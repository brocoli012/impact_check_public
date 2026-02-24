/**
 * @module core/indexing/domain-extractor
 * @description CodeIndex에서 비즈니스 도메인 키워드와 기능 요약을 추출
 */

import { CodeIndex, ScreenInfo, ApiEndpoint } from '../../types/index';

/**
 * 도메인 키워드 매핑 테이블
 * 한국어 도메인명 → 영문 키워드 패턴 목록
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  '주문': ['order', 'checkout', 'purchase'],
  '결제': ['payment', 'pay', 'billing', 'invoice', 'settlement'],
  '상품': ['product', 'item', 'catalog', 'goods', 'merchandise'],
  '회원': ['user', 'member', 'auth', 'account', 'profile', 'login', 'signup'],
  '장바구니': ['cart', 'basket'],
  '배송': ['delivery', 'shipping', 'logistics', 'fulfillment'],
  '재고': ['inventory', 'stock', 'warehouse'],
  '검색': ['search', 'filter', 'query'],
  '알림': ['notification', 'alert', 'push', 'email', 'sms'],
  '리뷰': ['review', 'rating', 'comment', 'feedback'],
  '쿠폰': ['coupon', 'promotion', 'discount', 'voucher'],
  '정산': ['settlement', 'reconciliation', 'accounting'],
  '관리자': ['admin', 'management', 'dashboard', 'backoffice'],
  '콘텐츠': ['content', 'cms', 'article', 'post', 'blog'],
};

/** 도메인 추출 결과 */
export interface DomainExtractionResult {
  /** 추출된 도메인 키워드 목록 (한국어) */
  domains: string[];
  /** 기능 요약 목록 */
  featureSummary: string[];
}

/**
 * DomainExtractor - CodeIndex에서 비즈니스 도메인과 기능 요약을 추출
 */
export class DomainExtractor {
  /**
   * CodeIndex에서 비즈니스 도메인 키워드와 기능 요약을 추출
   * @param codeIndex - 전체 코드 인덱스
   * @returns 도메인 키워드와 기능 요약
   */
  extract(codeIndex: CodeIndex): DomainExtractionResult {
    const domainScores = this.computeDomainScores(codeIndex);
    const domains = this.selectTopDomains(domainScores);
    const featureSummary = this.generateFeatureSummary(codeIndex);

    return { domains, featureSummary };
  }

  /**
   * 도메인별 매칭 점수를 계산
   * API 경로, 화면/라우트명, 모델/엔티티명, 디렉토리 구조를 분석
   */
  private computeDomainScores(codeIndex: CodeIndex): Map<string, number> {
    const scores = new Map<string, number>();

    // 분석 대상 텍스트 수집
    const apiPaths = codeIndex.apis.map(a => a.path.toLowerCase());
    const apiHandlers = codeIndex.apis.map(a => a.handler.toLowerCase());
    const screenNames = codeIndex.screens.map(s => s.name.toLowerCase());
    const screenRoutes = codeIndex.screens.map(s => s.route.toLowerCase());
    const modelNames = codeIndex.models.map(m => m.name.toLowerCase());
    const filePaths = codeIndex.files.map(f => f.path.toLowerCase());

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      let score = 0;

      for (const keyword of keywords) {
        const kw = keyword.toLowerCase();

        // 1. API 경로 패턴 분석 (가중치 3)
        for (const apiPath of apiPaths) {
          if (this.containsKeyword(apiPath, kw)) {
            score += 3;
          }
        }

        // 2. API 핸들러명 분석 (가중치 2)
        for (const handler of apiHandlers) {
          if (this.containsKeyword(handler, kw)) {
            score += 2;
          }
        }

        // 3. 화면/라우트명 분석 (가중치 3)
        for (const name of screenNames) {
          if (this.containsKeyword(name, kw)) {
            score += 3;
          }
        }
        for (const route of screenRoutes) {
          if (this.containsKeyword(route, kw)) {
            score += 2;
          }
        }

        // 4. 모델/엔티티명 분석 (가중치 2)
        for (const model of modelNames) {
          if (this.containsKeyword(model, kw)) {
            score += 2;
          }
        }

        // 5. 디렉토리 구조 분석 (가중치 1)
        for (const fp of filePaths) {
          if (this.containsKeywordInPath(fp, kw)) {
            score += 1;
          }
        }
      }

      if (score > 0) {
        scores.set(domain, score);
      }
    }

    return scores;
  }

  /**
   * 텍스트에 키워드가 포함되는지 확인 (단어 경계 고려)
   */
  private containsKeyword(text: string, keyword: string): boolean {
    // camelCase, PascalCase, kebab-case, snake_case 모두 고려
    // 키워드가 경로 세그먼트 또는 단어의 일부로 포함되는지 확인
    const patterns = [
      keyword,                        // 정확한 매칭
      keyword.replace(/-/g, ''),       // 하이픈 제거 매칭
    ];

    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 파일 경로에서 디렉토리 이름 기준 키워드 매칭
   */
  private containsKeywordInPath(filePath: string, keyword: string): boolean {
    const segments = filePath.split('/');
    for (const segment of segments) {
      // 디렉토리명이나 파일명에 키워드 포함 확인
      if (segment.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 점수 기반으로 상위 도메인을 선택 (최소 점수 임계값 적용)
   */
  private selectTopDomains(scores: Map<string, number>): string[] {
    if (scores.size === 0) return [];

    // 점수 내림차순 정렬
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);

    // 최소 점수 임계값: 최고 점수의 10% 또는 2 중 큰 값
    const maxScore = sorted[0][1];
    const threshold = Math.max(maxScore * 0.1, 2);

    return sorted
      .filter(([_, score]) => score >= threshold)
      .map(([domain]) => domain);
  }

  /**
   * 화면/API 그룹별 기능 요약을 생성
   * 최대 10개 항목 반환
   */
  private generateFeatureSummary(codeIndex: CodeIndex): string[] {
    // API를 경로 prefix로 그룹핑
    const apiGroups = this.groupApisByPrefix(codeIndex.apis);

    // 화면을 관련 도메인별로 그룹핑
    const screenGroups = this.groupScreensByDomain(codeIndex.screens);

    const summaries: string[] = [];

    // 화면 그룹 기반 요약 생성
    for (const [domainLabel, screens] of Object.entries(screenGroups)) {
      // 이 도메인과 매칭되는 API 그룹 찾기
      const relatedApiCount = this.countRelatedApis(screens, codeIndex.apis);
      const screenNames = screens.map(s => s.name).slice(0, 3);
      const nameHint = screenNames.join('/');

      const summary = `${domainLabel} ${nameHint} (화면 ${screens.length}개, API ${relatedApiCount}개)`;
      summaries.push(summary);
    }

    // 화면 그룹에 포함되지 않은 API 그룹에 대한 요약
    for (const [prefix, apis] of Object.entries(apiGroups)) {
      // 이미 화면 기반 요약에 포함된 API인지 확인
      const alreadyCovered = summaries.some(s =>
        s.toLowerCase().includes(prefix.toLowerCase()),
      );

      if (!alreadyCovered && apis.length >= 2) {
        const domainLabel = this.inferDomainFromPrefix(prefix);
        if (domainLabel) {
          summaries.push(`${domainLabel} API (API ${apis.length}개)`);
        }
      }
    }

    // 최대 10개로 제한
    return summaries.slice(0, 10);
  }

  /**
   * API를 경로 prefix (첫 2 세그먼트)로 그룹핑
   */
  private groupApisByPrefix(apis: ApiEndpoint[]): Record<string, ApiEndpoint[]> {
    const groups: Record<string, ApiEndpoint[]> = {};

    for (const api of apis) {
      const prefix = this.extractApiPrefix(api.path);
      if (!groups[prefix]) {
        groups[prefix] = [];
      }
      groups[prefix].push(api);
    }

    return groups;
  }

  /**
   * API 경로에서 prefix 추출 (예: /api/orders/123 → orders)
   */
  private extractApiPrefix(apiPath: string): string {
    const segments = apiPath.split('/').filter(s => s && s !== 'api' && s !== 'v1' && s !== 'v2');
    return segments[0] || 'other';
  }

  /**
   * 화면을 도메인별로 그룹핑
   */
  private groupScreensByDomain(screens: ScreenInfo[]): Record<string, ScreenInfo[]> {
    const groups: Record<string, ScreenInfo[]> = {};

    for (const screen of screens) {
      const domain = this.inferScreenDomain(screen);
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(screen);
    }

    return groups;
  }

  /**
   * 화면에서 도메인 추론
   */
  private inferScreenDomain(screen: ScreenInfo): string {
    const text = `${screen.name} ${screen.route}`.toLowerCase();

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          return domain;
        }
      }
    }

    return '기타';
  }

  /**
   * 화면 그룹에 관련된 API 수를 계산
   */
  private countRelatedApis(screens: ScreenInfo[], allApis: ApiEndpoint[]): number {
    const relatedApiIds = new Set<string>();

    for (const screen of screens) {
      for (const apiCallId of screen.apiCalls) {
        relatedApiIds.add(apiCallId);
      }
    }

    // apiCalls ID로 직접 매칭 + 경로 기반 매칭
    let count = relatedApiIds.size;

    // 직접 매칭이 없는 경우 화면 이름 기반으로 관련 API 추정
    if (count === 0) {
      const screenKeywords = screens.map(s => s.name.toLowerCase());
      for (const api of allApis) {
        const apiPath = api.path.toLowerCase();
        for (const keyword of screenKeywords) {
          // 화면명의 주요 단어가 API 경로에 포함되는지 확인
          const words = keyword.replace(/([A-Z])/g, ' $1').toLowerCase().split(/[\s_-]+/);
          for (const word of words) {
            if (word.length > 3 && apiPath.includes(word)) {
              count++;
              break;
            }
          }
        }
      }
    }

    return count;
  }

  /**
   * API prefix에서 도메인 라벨을 추론
   */
  private inferDomainFromPrefix(prefix: string): string | null {
    const lowerPrefix = prefix.toLowerCase();

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      for (const kw of keywords) {
        if (lowerPrefix.includes(kw) || kw.includes(lowerPrefix)) {
          return domain;
        }
      }
    }

    return null;
  }
}
