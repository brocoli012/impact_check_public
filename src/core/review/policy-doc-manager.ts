/**
 * @module core/review/policy-doc-manager
 * @description 정책 문서 관리자 - 정책 문서 저장/조회/검색/삭제 및 인덱스 관리 (REQ-018-A3)
 *
 * 정책 문서는 YAML frontmatter + Markdown 형태로 저장되며,
 * index.json을 통해 빠른 목록 조회와 필터링을 지원합니다.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PolicyDocument, PolicyDocumentEntry, PolicyIndex } from '../../types/review';
import { ensureDir, getImpactDir } from '../../utils/file';
import { logger } from '../../utils/logger';

/** 한글 -> 영문 slug 변환 사전 */
const KOREAN_SLUG_MAP: Record<string, string> = {
  '데이터': 'data',
  '동기화': 'sync',
  '정책': 'policy',
  '엑셀': 'excel',
  '업로드': 'upload',
  '필드': 'field',
  '소유권': 'ownership',
  '검증': 'validation',
  '처리': 'handling',
  '에러': 'error',
  '상품': 'product',
  '코드': 'code',
  '제한': 'limit',
  '주문': 'order',
  '결제': 'payment',
  '배송': 'delivery',
  '회원': 'member',
  '관리': 'management',
  '설정': 'config',
  '알림': 'notification',
  '연동': 'integration',
  '보안': 'security',
  '인증': 'auth',
  '차단': 'block',
  '허용': 'allow',
  '변경': 'change',
  '삭제': 'delete',
  '생성': 'create',
  '수정': 'modify',
  '조회': 'query',
  '목록': 'list',
  '상세': 'detail',
  '등록': 'register',
  '승인': 'approve',
  '반려': 'reject',
  '이관': 'transfer',
  '정산': 'settlement',
  '가격': 'price',
  '할인': 'discount',
  '쿠폰': 'coupon',
  '재고': 'inventory',
  '물류': 'logistics',
  '입고': 'inbound',
  '출고': 'outbound',
  '반품': 'return',
  '교환': 'exchange',
};

/**
 * PolicyDocManager - 정책 문서 저장/조회/인덱스 관리
 *
 * 기능:
 *   - save: YAML frontmatter + Markdown 형태로 정책 문서 저장
 *   - list: 필터링(카테고리, 프로젝트, 태그)을 통한 목록 조회
 *   - search: 제목/내용/태그 기반 키워드 검색
 *   - get: 개별 정책 문서 조회 (Markdown 파일 파싱)
 *   - delete: 정책 문서 삭제 및 인덱스 갱신
 */
export class PolicyDocManager {
  private readonly storageDir: string;
  private readonly indexFile: string;

  /**
   * PolicyDocManager 생성
   * @param basePath - 기본 경로 (기본값: HOME 디렉토리)
   */
  constructor(basePath?: string) {
    const impactDir = getImpactDir(basePath);
    this.storageDir = path.join(impactDir, 'policies', 'documented');
    this.indexFile = path.join(impactDir, 'policies', 'documented', 'index.json');
  }

  /**
   * 정책 문서를 Markdown 파일로 저장하고 인덱스를 갱신
   * @param doc - 저장할 정책 문서
   * @returns 생성된 파일 경로
   */
  save(doc: PolicyDocument): string {
    ensureDir(this.storageDir);

    // ID 자동 생성 (미지정 시)
    if (!doc.id) {
      doc.id = this.generateId();
    }

    // 파일명 생성
    const filename = this.generateFilename(doc);
    const filePath = path.join(this.storageDir, filename);

    // Markdown 콘텐츠 생성 및 저장
    const markdown = this.generateMarkdown(doc);
    fs.writeFileSync(filePath, markdown, 'utf-8');

    // 인덱스 갱신
    this.updateIndex();

    logger.debug(`Policy document saved: ${filePath}`);
    return filePath;
  }

  /**
   * 정책 문서 목록 조회 (필터 지원)
   * @param filter - 필터 옵션 (카테고리, 프로젝트, 태그)
   * @returns 필터링된 정책 문서 엔트리 목록
   */
  list(filter?: { category?: string; project?: string; tag?: string }): PolicyDocumentEntry[] {
    const index = this.getIndex();
    let entries = index.policies;

    if (filter?.category) {
      entries = entries.filter(e => e.category === filter.category);
    }
    if (filter?.project) {
      entries = entries.filter(e => e.project === filter.project);
    }
    if (filter?.tag) {
      const lowerTag = filter.tag.toLowerCase();
      entries = entries.filter(e =>
        e.tags.some(t => t.toLowerCase().includes(lowerTag)),
      );
    }

    return entries;
  }

  /**
   * 정책 문서 키워드 검색 (제목/내용/태그)
   * @param query - 검색 키워드
   * @returns 매칭된 정책 문서 엔트리 목록
   */
  search(query: string): PolicyDocumentEntry[] {
    const lowerQuery = query.toLowerCase();
    const index = this.getIndex();

    return index.policies.filter(entry => {
      // 제목 매칭
      if (entry.title.toLowerCase().includes(lowerQuery)) return true;
      // 태그 매칭
      if (entry.tags.some(t => t.toLowerCase().includes(lowerQuery))) return true;
      // 카테고리 매칭
      if (entry.category.toLowerCase().includes(lowerQuery)) return true;

      // 내용 매칭 (파일 읽기)
      try {
        const fullPath = path.join(this.storageDir, entry.filePath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.toLowerCase().includes(lowerQuery)) return true;
        }
      } catch {
        // 파일 읽기 실패 시 무시
      }

      return false;
    });
  }

  /**
   * 개별 정책 문서 조회
   * @param id - 정책 문서 ID
   * @returns PolicyDocument 또는 null (미존재 시)
   */
  get(id: string): PolicyDocument | null {
    const index = this.getIndex();
    const entry = index.policies.find(p => p.id === id);

    if (!entry) return null;

    const fullPath = path.join(this.storageDir, entry.filePath);
    if (!fs.existsSync(fullPath)) return null;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return this.parseMarkdown(content);
    } catch {
      logger.warn(`Failed to read policy document: ${fullPath}`);
      return null;
    }
  }

  /**
   * 정책 문서 삭제 (파일 + 인덱스 갱신)
   * @param id - 정책 문서 ID
   * @returns 삭제 성공 여부
   */
  delete(id: string): boolean {
    const index = this.getIndex();
    const entry = index.policies.find(p => p.id === id);

    if (!entry) return false;

    // 파일 삭제
    const fullPath = path.join(this.storageDir, entry.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // 인덱스 갱신
    this.updateIndex();
    return true;
  }

  /**
   * 현재 정책 인덱스를 로드
   * @returns PolicyIndex
   */
  getIndex(): PolicyIndex {
    if (!fs.existsSync(this.indexFile)) {
      return { policies: [], lastUpdated: new Date().toISOString() };
    }

    try {
      const content = fs.readFileSync(this.indexFile, 'utf-8');
      return JSON.parse(content) as PolicyIndex;
    } catch {
      logger.warn('Policy index corrupted, rebuilding...');
      this.updateIndex();
      if (fs.existsSync(this.indexFile)) {
        const content = fs.readFileSync(this.indexFile, 'utf-8');
        return JSON.parse(content) as PolicyIndex;
      }
      return { policies: [], lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * 파일명 생성: {category}-{slug}.policy.md
   */
  private generateFilename(doc: PolicyDocument): string {
    const slug = this.slugify(doc.title);
    const baseName = `${doc.category}-${slug}.policy.md`;

    // 중복 처리
    let finalName = baseName;
    let counter = 2;
    while (fs.existsSync(path.join(this.storageDir, finalName))) {
      // 동일 ID면 덮어쓰기 허용
      const existingContent = fs.readFileSync(path.join(this.storageDir, finalName), 'utf-8');
      const existingDoc = this.parseMarkdown(existingContent);
      if (existingDoc && existingDoc.id === doc.id) {
        break;
      }
      const ext = '.policy.md';
      const nameWithoutExt = baseName.slice(0, -ext.length);
      finalName = `${nameWithoutExt}-${counter}${ext}`;
      counter++;
    }

    return finalName;
  }

  /**
   * YAML frontmatter + Markdown 콘텐츠 생성
   */
  private generateMarkdown(doc: PolicyDocument): string {
    const lines: string[] = [];

    // YAML frontmatter
    lines.push('---');
    lines.push(`id: ${doc.id}`);
    lines.push(`title: "${doc.title.replace(/"/g, '\\"')}"`);
    lines.push(`category: ${doc.category}`);
    if (doc.project) {
      lines.push(`project: ${doc.project}`);
    }
    lines.push(`confirmedAt: ${doc.confirmedAt}`);
    lines.push(`tags: [${doc.tags.join(', ')}]`);
    lines.push('---');
    lines.push('');

    // 본문
    lines.push(`# ${doc.title}`);
    lines.push('');
    lines.push('## 정책 내용');
    lines.push('');
    lines.push(doc.content);
    lines.push('');
    lines.push('## 확인 맥락');
    lines.push('');
    lines.push(doc.source);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Markdown 파일에서 PolicyDocument로 파싱
   */
  private parseMarkdown(content: string): PolicyDocument | null {
    // frontmatter 추출
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const frontmatter = fmMatch[1];
    const body = content.slice(fmMatch[0].length).trim();

    // YAML frontmatter 파싱 (간단한 파싱)
    const id = this.extractYamlValue(frontmatter, 'id') || '';
    const title = this.extractYamlValue(frontmatter, 'title') || '';
    const category = this.extractYamlValue(frontmatter, 'category') || 'general';
    const project = this.extractYamlValue(frontmatter, 'project') || undefined;
    const confirmedAt = this.extractYamlValue(frontmatter, 'confirmedAt') || '';
    const tagsStr = this.extractYamlValue(frontmatter, 'tags') || '';

    // tags 파싱: [tag1, tag2, tag3]
    const tags = tagsStr
      .replace(/^\[/, '').replace(/\]$/, '')
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // 본문에서 정책 내용과 확인 맥락 추출
    let policyContent = '';
    let source = '';

    const contentMatch = body.match(/## 정책 내용\n\n([\s\S]*?)(?=\n## |$)/);
    if (contentMatch) {
      policyContent = contentMatch[1].trim();
    }

    const sourceMatch = body.match(/## 확인 맥락\n\n([\s\S]*?)$/);
    if (sourceMatch) {
      source = sourceMatch[1].trim();
    }

    return {
      id,
      title,
      category,
      content: policyContent,
      source,
      confirmedAt,
      project,
      tags,
    };
  }

  /**
   * YAML frontmatter에서 단일 값 추출
   */
  private extractYamlValue(yaml: string, key: string): string | null {
    const regex = new RegExp(`^${key}:\\s*(.+)$`, 'm');
    const match = yaml.match(regex);
    if (!match) return null;

    let value = match[1].trim();
    // 따옴표 제거
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }

  /**
   * 문자열을 slug로 변환 (한글 사전 매핑 + 영문 변환)
   */
  private slugify(text: string): string {
    let result = text;

    // 한글 사전 매핑 적용
    for (const [korean, english] of Object.entries(KOREAN_SLUG_MAP)) {
      result = result.replace(new RegExp(korean, 'g'), english);
    }

    // 남은 한글 제거 및 정규화
    result = result
      .replace(/[가-힣]+/g, '')       // 매핑되지 않은 한글 제거
      .replace(/[^\w\s-]/g, '')        // 특수문자 제거
      .replace(/[\s_]+/g, '-')         // 공백/언더스코어 -> 하이픈
      .replace(/-+/g, '-')             // 연속 하이픈 정리
      .replace(/^-|-$/g, '')           // 앞뒤 하이픈 제거
      .toLowerCase();

    return result || 'untitled';
  }

  /**
   * 고유 ID 생성
   */
  private generateId(): string {
    const index = this.getIndex();
    const existingIds = index.policies.map(p => p.id);

    let counter = existingIds.length + 1;
    let id = `policy-doc-${String(counter).padStart(3, '0')}`;

    while (existingIds.includes(id)) {
      counter++;
      id = `policy-doc-${String(counter).padStart(3, '0')}`;
    }

    return id;
  }

  /**
   * 인덱스 재구성 (storageDir 내 모든 .policy.md 파일 스캔)
   */
  private updateIndex(): void {
    ensureDir(this.storageDir);

    const entries: PolicyDocumentEntry[] = [];

    if (!fs.existsSync(this.storageDir)) {
      this.writeIndex({ policies: [], lastUpdated: new Date().toISOString() });
      return;
    }

    const files = fs.readdirSync(this.storageDir).filter(f => f.endsWith('.policy.md'));

    for (const file of files) {
      try {
        const filePath = path.join(this.storageDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const doc = this.parseMarkdown(content);

        if (doc) {
          entries.push({
            id: doc.id,
            title: doc.title,
            category: doc.category,
            filePath: file,
            project: doc.project,
            tags: doc.tags,
            confirmedAt: doc.confirmedAt,
          });
        }
      } catch {
        logger.warn(`Failed to parse policy file: ${file}`);
      }
    }

    this.writeIndex({
      policies: entries,
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * 인덱스 파일 저장
   */
  private writeIndex(index: PolicyIndex): void {
    ensureDir(path.dirname(this.indexFile));
    fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2), 'utf-8');
  }
}
