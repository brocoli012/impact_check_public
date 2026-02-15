/**
 * @module core/analysis/matcher
 * @description 인덱스 매처 - 기획서 키워드로 코드 인덱스 매칭
 */

import {
  ParsedSpec,
  MatchedEntities,
  MatchedEntity,
} from '../../types/analysis';
import {
  CodeIndex,
  ScreenInfo,
  ComponentInfo,
  ApiEndpoint,
  ModelInfo,
  DependencyGraph,
} from '../../types/index';
import { logger } from '../../utils/logger';

/**
 * IndexMatcher - 기획서 키워드로 코드 인덱스 매칭
 *
 * 기획서의 keywords + features에서 검색 쿼리를 추출하고
 * 코드 인덱스의 screens, components, apis, models와 텍스트 매칭 수행.
 * 매칭된 엔티티의 의존 그래프에서 1-hop 확장.
 */
export class IndexMatcher {
  /**
   * 기획서 키워드로 코드 인덱스 매칭
   * @param spec - 파싱된 기획서
   * @param index - 코드 인덱스
   * @returns 매칭된 엔티티들
   */
  match(spec: ParsedSpec, index: CodeIndex): MatchedEntities {
    logger.info('Starting index matching...');

    // 검색 키워드 수집
    const searchKeywords = this.collectKeywords(spec);
    logger.debug(`Search keywords: ${searchKeywords.join(', ')}`);

    // 각 엔티티 타입별 매칭
    const screens = this.matchScreens(searchKeywords, index.screens);
    const components = this.matchComponents(searchKeywords, index.components);
    const apis = this.matchApis(searchKeywords, index.apis);
    const models = this.matchModels(searchKeywords, index.models);

    // 초기 매칭 결과
    let matched: MatchedEntities = { screens, components, apis, models };

    // 의존 그래프 기반 확장 (1-hop)
    matched = this.expandByDependency(matched, index.dependencies);

    logger.info(
      `Matched: ${matched.screens.length} screens, ` +
      `${matched.components.length} components, ` +
      `${matched.apis.length} apis, ` +
      `${matched.models.length} models`
    );

    return matched;
  }

  /**
   * 기획서에서 검색 키워드 수집
   * @param spec - 파싱된 기획서
   * @returns 검색 키워드 배열
   */
  private collectKeywords(spec: ParsedSpec): string[] {
    const keywords = new Set<string>();

    // 기획서 전체 키워드
    spec.keywords.forEach(k => keywords.add(k.toLowerCase()));

    // 기능별 키워드
    spec.features.forEach(f => {
      f.keywords.forEach(k => keywords.add(k.toLowerCase()));
      // 기능명에서도 키워드 추출
      keywords.add(f.name.toLowerCase());
      if (f.targetScreen) {
        keywords.add(f.targetScreen.toLowerCase());
      }
    });

    // 대상 화면
    spec.targetScreens.forEach(s => keywords.add(s.toLowerCase()));

    return Array.from(keywords).filter(k => k.length >= 2);
  }

  /**
   * 화면 매칭
   */
  private matchScreens(keywords: string[], screens: ScreenInfo[]): MatchedEntity[] {
    const matched: MatchedEntity[] = [];

    for (const screen of screens) {
      const { score, reason } = this.matchEntity(keywords, {
        name: screen.name,
        route: screen.route,
        filePath: screen.filePath,
      });

      if (score > 0) {
        matched.push({
          id: screen.id,
          name: screen.name,
          matchScore: score,
          matchReason: reason,
        });
      }
    }

    return matched.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * 컴포넌트 매칭
   */
  private matchComponents(keywords: string[], components: ComponentInfo[]): MatchedEntity[] {
    const matched: MatchedEntity[] = [];

    for (const comp of components) {
      const { score, reason } = this.matchEntity(keywords, {
        name: comp.name,
        filePath: comp.filePath,
        type: comp.type,
        props: comp.props.join(' '),
      });

      if (score > 0) {
        matched.push({
          id: comp.id,
          name: comp.name,
          matchScore: score,
          matchReason: reason,
        });
      }
    }

    return matched.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * API 매칭
   */
  private matchApis(keywords: string[], apis: ApiEndpoint[]): MatchedEntity[] {
    const matched: MatchedEntity[] = [];

    for (const api of apis) {
      const { score, reason } = this.matchEntity(keywords, {
        name: `${api.method} ${api.path}`,
        path: api.path,
        handler: api.handler,
        filePath: api.filePath,
      });

      if (score > 0) {
        matched.push({
          id: api.id,
          name: `${api.method} ${api.path}`,
          matchScore: score,
          matchReason: reason,
        });
      }
    }

    return matched.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * 모델 매칭
   */
  private matchModels(keywords: string[], models: ModelInfo[]): MatchedEntity[] {
    const matched: MatchedEntity[] = [];

    for (const model of models) {
      const fieldNames = model.fields.map(f => f.name).join(' ');
      const { score, reason } = this.matchEntity(keywords, {
        name: model.name,
        filePath: model.filePath,
        fields: fieldNames,
      });

      if (score > 0) {
        matched.push({
          id: model.id,
          name: model.name,
          matchScore: score,
          matchReason: reason,
        });
      }
    }

    return matched.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * 엔티티 하나에 대해 키워드 매칭 점수 계산
   * @param keywords - 검색 키워드 목록
   * @param targets - 매칭 대상 필드들
   * @returns 매칭 점수와 근거
   */
  private matchEntity(
    keywords: string[],
    targets: Record<string, string | undefined>,
  ): { score: number; reason: string } {
    let totalScore = 0;
    const reasons: string[] = [];

    for (const keyword of keywords) {
      let bestSimilarity = 0;
      let bestField = '';

      for (const [field, value] of Object.entries(targets)) {
        if (!value) continue;
        const similarity = this.calculateSimilarity(keyword, value.toLowerCase());
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestField = field;
        }
      }

      if (bestSimilarity > 0) {
        totalScore += bestSimilarity;
        reasons.push(`'${keyword}' matched in ${bestField} (${(bestSimilarity * 100).toFixed(0)}%)`);
      }
    }

    // 정규화: 매칭된 키워드 수 기반, 최대 1.0
    const normalizedScore = Math.min(1.0, totalScore / Math.max(keywords.length * 0.5, 1));

    return {
      score: normalizedScore,
      reason: reasons.slice(0, 5).join('; '),
    };
  }

  /**
   * 키워드와 대상 문자열의 유사도 점수 계산
   * @param keyword - 검색 키워드
   * @param target - 대상 문자열
   * @returns 유사도 점수 (0.0 ~ 1.0)
   */
  calculateSimilarity(keyword: string, target: string): number {
    const kw = keyword.toLowerCase();
    const tgt = target.toLowerCase();

    // 정확히 일치
    if (tgt === kw) return 1.0;

    // 포함 관계
    if (tgt.includes(kw)) return 0.8;
    if (kw.includes(tgt) && tgt.length >= 2) return 0.6;

    // 경로/이름 부분 매칭
    const parts = tgt.split(/[\s/\-_.]+/);
    for (const part of parts) {
      if (part === kw) return 0.9;
      if (part.includes(kw)) return 0.7;
    }

    // camelCase 분리 매칭
    const camelParts = tgt.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/);
    for (const part of camelParts) {
      if (part === kw) return 0.85;
      if (part.includes(kw)) return 0.6;
    }

    return 0;
  }

  /**
   * 의존 그래프 기반 1-hop 확장
   * @param matched - 초기 매칭 결과
   * @param graph - 의존성 그래프
   * @returns 확장된 매칭 결과
   */
  private expandByDependency(
    matched: MatchedEntities,
    graph: DependencyGraph,
  ): MatchedEntities {
    const allMatchedIds = new Set<string>();
    [
      ...matched.screens,
      ...matched.components,
      ...matched.apis,
      ...matched.models,
    ].forEach(e => allMatchedIds.add(e.id));

    const expandedIds = new Set<string>();

    // 매칭된 노드의 인접 노드(1-hop) 탐색
    for (const id of allMatchedIds) {
      for (const edge of graph.graph.edges) {
        if (edge.from === id && !allMatchedIds.has(edge.to)) {
          expandedIds.add(edge.to);
        }
        if (edge.to === id && !allMatchedIds.has(edge.from)) {
          expandedIds.add(edge.from);
        }
      }
    }

    // 확장된 노드를 알맞은 카테고리에 추가
    for (const expandedId of expandedIds) {
      const node = graph.graph.nodes.find(n => n.id === expandedId);
      if (!node) continue;

      const expandedEntity: MatchedEntity = {
        id: node.id,
        name: node.name,
        matchScore: 0.3, // 의존성 확장은 낮은 점수
        matchReason: `Expanded via dependency graph (1-hop)`,
      };

      switch (node.type) {
        case 'screen':
          if (!matched.screens.find(s => s.id === node.id)) {
            matched.screens.push(expandedEntity);
          }
          break;
        case 'component':
          if (!matched.components.find(c => c.id === node.id)) {
            matched.components.push(expandedEntity);
          }
          break;
        case 'api':
          if (!matched.apis.find(a => a.id === node.id)) {
            matched.apis.push(expandedEntity);
          }
          break;
        case 'model':
          if (!matched.models.find(m => m.id === node.id)) {
            matched.models.push(expandedEntity);
          }
          break;
        default:
          // module 등은 component로 분류
          if (!matched.components.find(c => c.id === node.id)) {
            matched.components.push(expandedEntity);
          }
          break;
      }
    }

    return matched;
  }
}
