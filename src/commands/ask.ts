/**
 * @module commands/ask
 * @description Ask 명령어 핸들러 - 코드베이스에 대한 자유 질의
 */

import { Command, CommandResult, ResultCode } from '../types/common';
import { CodeIndex } from '../types/index';
import { ConfigManager } from '../config/config-manager';
import { Indexer } from '../core/indexing/indexer';
import { AnnotationLoader } from '../core/annotations/annotation-loader';
import { logger } from '../utils/logger';

/** 한글 불용어 목록 */
const KOREAN_STOPWORDS = new Set([
  '은', '는', '이', '가', '에', '을', '를', '의', '와', '과',
  '도', '로', '으로', '에서', '부터', '까지', '만', '뿐',
  '하다', '되다', '있다', '없다', '하는', '되는', '있는', '없는',
  '그', '저', '이것', '저것', '그것',
  '어디', '무엇', '어떤', '어떻게',
]);

/** 한글 어미/조사 패턴 (토큰 끝에서 제거) */
const KOREAN_SUFFIX_PATTERN = /(?:에서|으로|부터|까지|에는|에게|에도|는|은|이|가|을|를|의|와|과|도|에|로|서)$/;

/** 영어 불용어 목록 */
const ENGLISH_STOPWORDS = new Set([
  'the', 'is', 'in', 'of', 'a', 'an', 'to', 'and', 'or', 'for',
  'it', 'on', 'at', 'by', 'with', 'from', 'as', 'be', 'are',
  'was', 'were', 'been', 'has', 'have', 'had', 'do', 'does', 'did',
  'not', 'but', 'if', 'so', 'no', 'yes', 'can', 'will',
  'this', 'that', 'what', 'where', 'how', 'which', 'who',
  'my', 'your', 'me', 'we', 'they', 'them',
]);

/** 검색 결과 항목 */
interface SearchHit {
  /** 항목 종류 */
  type: 'file' | 'component' | 'api' | 'screen' | 'policy' | 'model';
  /** 항목 이름 */
  name: string;
  /** 파일 경로 */
  filePath: string;
  /** 매칭 점수 */
  score: number;
  /** 추가 정보 */
  detail?: string;
}

/**
 * 질문 텍스트에서 키워드를 추출한다.
 *
 * - 한글/영어 토큰을 분리
 * - 불용어 제거
 * - 2글자 이상만 유지
 *
 * @param question - 질문 문자열
 * @returns 키워드 배열
 */
export function extractKeywords(question: string): string[] {
  // 한글 토큰: 연속된 한글 문자열
  const koreanTokens = question.match(/[가-힣]+/g) || [];
  // 영어 토큰: 연속된 영문자+숫자 문자열
  const englishTokens = question.match(/[a-zA-Z0-9_-]+/g) || [];

  const allTokens: string[] = [];

  // 한글 토큰: 조사/어미 제거 후 추가
  for (const token of koreanTokens) {
    const stripped = token.replace(KOREAN_SUFFIX_PATTERN, '');
    // 조사 제거 후 남은 부분이 있으면 사용, 아니면 원본 사용
    const finalToken = stripped.length >= 2 ? stripped : token;
    allTokens.push(finalToken);
  }

  allTokens.push(...englishTokens);

  const keywords: string[] = [];
  for (const token of allTokens) {
    const lower = token.toLowerCase();
    if (lower.length < 2) continue;
    if (KOREAN_STOPWORDS.has(lower)) continue;
    if (ENGLISH_STOPWORDS.has(lower)) continue;
    keywords.push(lower);
  }

  // 중복 제거
  return [...new Set(keywords)];
}

/**
 * 키워드로 인덱스를 검색하여 관련 항목을 찾는다.
 *
 * 검색 대상:
 *   - 파일명
 *   - 컴포넌트/모듈 이름
 *   - API 경로/핸들러
 *   - 화면 이름/라우트
 *   - 정책 이름/카테고리/설명
 *   - 모델 이름/필드
 *
 * @param index - 코드 인덱스
 * @param keywords - 검색 키워드 배열
 * @returns 관련 항목 배열 (점수 순 정렬, 최대 20개)
 */
export function searchIndex(index: CodeIndex, keywords: string[]): SearchHit[] {
  const hits: SearchHit[] = [];

  if (keywords.length === 0) return hits;

  // 파일명 매칭
  for (const file of index.files) {
    const score = calculateMatchScore(file.path.toLowerCase(), keywords);
    if (score > 0) {
      hits.push({
        type: 'file',
        name: file.path,
        filePath: file.path,
        score,
      });
    }
  }

  // 컴포넌트 매칭
  for (const comp of index.components) {
    const nameScore = calculateMatchScore(comp.name.toLowerCase(), keywords);
    const pathScore = calculateMatchScore(comp.filePath.toLowerCase(), keywords);
    const score = Math.max(nameScore * 2, pathScore); // 이름 매칭에 가중치
    if (score > 0) {
      hits.push({
        type: 'component',
        name: comp.name,
        filePath: comp.filePath,
        score,
        detail: `type: ${comp.type}, props: [${comp.props.join(', ')}]`,
      });
    }
  }

  // API 엔드포인트 매칭
  for (const api of index.apis) {
    const pathScore = calculateMatchScore(api.path.toLowerCase(), keywords);
    const handlerScore = calculateMatchScore(api.handler.toLowerCase(), keywords);
    const fileScore = calculateMatchScore(api.filePath.toLowerCase(), keywords);
    const score = Math.max(pathScore * 2, handlerScore * 2, fileScore);
    if (score > 0) {
      hits.push({
        type: 'api',
        name: `${api.method} ${api.path}`,
        filePath: api.filePath,
        score,
        detail: `handler: ${api.handler}`,
      });
    }
  }

  // 화면 매칭
  for (const screen of index.screens) {
    const nameScore = calculateMatchScore(screen.name.toLowerCase(), keywords);
    const routeScore = calculateMatchScore(screen.route.toLowerCase(), keywords);
    const fileScore = calculateMatchScore(screen.filePath.toLowerCase(), keywords);
    const score = Math.max(nameScore * 2, routeScore * 2, fileScore);
    if (score > 0) {
      hits.push({
        type: 'screen',
        name: screen.name,
        filePath: screen.filePath,
        score,
        detail: `route: ${screen.route}`,
      });
    }
  }

  // 정책 매칭
  for (const policy of index.policies) {
    const nameScore = calculateMatchScore(policy.name.toLowerCase(), keywords);
    const catScore = calculateMatchScore(policy.category.toLowerCase(), keywords);
    const descScore = calculateMatchScore(policy.description.toLowerCase(), keywords);
    const score = Math.max(nameScore * 2, catScore * 1.5, descScore);
    if (score > 0) {
      hits.push({
        type: 'policy',
        name: policy.name,
        filePath: policy.filePath,
        score,
        detail: `category: ${policy.category}`,
      });
    }
  }

  // 모델 매칭
  for (const model of index.models) {
    const nameScore = calculateMatchScore(model.name.toLowerCase(), keywords);
    const fieldNames = model.fields.map(f => f.name).join(' ').toLowerCase();
    const fieldScore = calculateMatchScore(fieldNames, keywords);
    const score = Math.max(nameScore * 2, fieldScore);
    if (score > 0) {
      hits.push({
        type: 'model',
        name: model.name,
        filePath: model.filePath,
        score,
        detail: `fields: [${model.fields.map(f => f.name).join(', ')}]`,
      });
    }
  }

  // 점수 내림차순 정렬
  hits.sort((a, b) => b.score - a.score);

  // 상위 20개 제한
  return hits.slice(0, 20);
}

/**
 * 문자열이 키워드 목록과 얼마나 매칭되는지 점수를 계산한다.
 * 정확 매칭(포함)에 대해 각 키워드마다 1점을 부여한다.
 *
 * @param target - 검색 대상 문자열
 * @param keywords - 키워드 배열
 * @returns 매칭 점수 (0 이상)
 */
function calculateMatchScore(target: string, keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (target.includes(keyword)) {
      score += 1;
    }
  }
  return score;
}

/**
 * AskCommand - 코드베이스 자유 질의 명령어
 *
 * 사용법: /impact ask <질문>
 * 기능:
 *   - 질문에서 키워드 추출
 *   - 인덱스 검색 (파일, 컴포넌트, API, 화면, 정책, 모델)
 *   - 보강 주석 로드 (있을 경우)
 *   - 구조화된 답변 출력
 */
export class AskCommand implements Command {
  readonly name = 'ask';
  readonly description = '코드베이스에 대한 자유 질의';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      // 질문 구성
      const question = this.args.join(' ').trim();
      if (!question) {
        console.log('');
        console.log('  질문을 입력해주세요.');
        console.log('  예: ask 결제 로직은 어디에 있나요?');
        console.log('');
        return {
          code: ResultCode.SUCCESS,
          message: '질문을 입력해주세요. 예: ask 결제 로직은 어디에 있나요?',
        };
      }

      // 활성 프로젝트 확인
      const homePath = process.env.HOME || process.env.USERPROFILE;
      const configManager = new ConfigManager(homePath || undefined);
      await configManager.load();

      const activeProjectId = configManager.getActiveProject();
      if (!activeProjectId) {
        return {
          code: ResultCode.NEEDS_CONFIG,
          message: '먼저 프로젝트를 초기화하세요: /impact init <프로젝트경로>',
        };
      }

      // 인덱스 로드
      const indexer = new Indexer();
      const index = await indexer.loadIndex(activeProjectId);
      if (!index) {
        return {
          code: ResultCode.NEEDS_INDEX,
          message: '인덱스가 없습니다. /impact reindex를 먼저 실행하세요.',
        };
      }

      // 키워드 추출
      const keywords = extractKeywords(question);

      // 인덱스 검색
      const hits = searchIndex(index, keywords);

      // 매칭 결과 0건: 관련 없는 질문
      if (hits.length === 0) {
        console.log('');
        console.log('  이 질문은 현재 코드베이스와 관련이 없는 것 같습니다.');
        console.log(`  검색 키워드: [${keywords.join(', ')}]`);
        console.log('');
        return {
          code: ResultCode.SUCCESS,
          message: '이 질문은 현재 코드베이스와 관련이 없는 것 같습니다.',
          data: { keywords, hits: [] },
        };
      }

      // 보강 주석 로드 시도
      const relatedFilePaths = [...new Set(hits.map(h => h.filePath))];
      let annotationInfo: string[] = [];
      try {
        const loader = new AnnotationLoader();
        const annotations = await loader.loadForFiles(activeProjectId, relatedFilePaths);
        if (annotations.size > 0) {
          for (const [filePath, annotationFile] of annotations) {
            if (annotationFile.fileSummary) {
              annotationInfo.push(`  [${filePath}] ${annotationFile.fileSummary.description}`);
            }
            for (const ann of annotationFile.annotations) {
              if (ann.type === 'business_logic') {
                annotationInfo.push(`    - ${ann.function}: ${ann.enriched_comment}`);
              }
            }
          }
        }
      } catch {
        // 보강 주석 로드 실패 시 무시
      }

      // 결과 출력
      this.printResults(question, keywords, hits, annotationInfo);

      return {
        code: ResultCode.SUCCESS,
        message: `질의 완료: ${hits.length}개 관련 항목 발견`,
        data: { keywords, hits, annotationInfo },
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Ask command failed: ${errMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `질의 실패: ${errMsg}`,
      };
    }
  }

  /**
   * 검색 결과를 구조화하여 출력한다.
   */
  private printResults(
    question: string,
    keywords: string[],
    hits: SearchHit[],
    annotationInfo: string[],
  ): void {
    logger.header('코드베이스 질의 결과');

    console.log(`\n  질문: ${question}`);
    console.log(`  키워드: [${keywords.join(', ')}]`);
    console.log(`  관련 항목: ${hits.length}건\n`);

    // 유형별 분류
    const fileHits = hits.filter(h => h.type === 'file');
    const componentHits = hits.filter(h => h.type === 'component');
    const apiHits = hits.filter(h => h.type === 'api');
    const screenHits = hits.filter(h => h.type === 'screen');
    const policyHits = hits.filter(h => h.type === 'policy');
    const modelHits = hits.filter(h => h.type === 'model');

    if (fileHits.length > 0) {
      console.log('  [관련 파일]');
      for (const hit of fileHits) {
        console.log(`    - ${hit.name}`);
      }
      console.log('');
    }

    if (componentHits.length > 0) {
      console.log('  [관련 컴포넌트]');
      for (const hit of componentHits) {
        console.log(`    - ${hit.name} (${hit.filePath})`);
        if (hit.detail) console.log(`      ${hit.detail}`);
      }
      console.log('');
    }

    if (apiHits.length > 0) {
      console.log('  [관련 API]');
      for (const hit of apiHits) {
        console.log(`    - ${hit.name} (${hit.filePath})`);
        if (hit.detail) console.log(`      ${hit.detail}`);
      }
      console.log('');
    }

    if (screenHits.length > 0) {
      console.log('  [관련 화면]');
      for (const hit of screenHits) {
        console.log(`    - ${hit.name} (${hit.filePath})`);
        if (hit.detail) console.log(`      ${hit.detail}`);
      }
      console.log('');
    }

    if (policyHits.length > 0) {
      console.log('  [관련 정책]');
      for (const hit of policyHits) {
        console.log(`    - ${hit.name} (${hit.filePath})`);
        if (hit.detail) console.log(`      ${hit.detail}`);
      }
      console.log('');
    }

    if (modelHits.length > 0) {
      console.log('  [관련 모델]');
      for (const hit of modelHits) {
        console.log(`    - ${hit.name} (${hit.filePath})`);
        if (hit.detail) console.log(`      ${hit.detail}`);
      }
      console.log('');
    }

    // 보강 주석 정보
    if (annotationInfo.length > 0) {
      console.log('  [비즈니스 로직 설명 (보강 주석)]');
      for (const info of annotationInfo) {
        console.log(info);
      }
      console.log('');
    }
  }
}
