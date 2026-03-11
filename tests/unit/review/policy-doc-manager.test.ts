/**
 * @module tests/unit/review/policy-doc-manager
 * @description PolicyDocManager unit tests (REQ-018-A3)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PolicyDocManager } from '../../../src/core/review/policy-doc-manager';
import { PolicyDocument } from '../../../src/types/review';

/* ------------------------------------------------------------------ */
/*  Test helpers                                                        */
/* ------------------------------------------------------------------ */

let tmpDir: string;
let manager: PolicyDocManager;

function createTestDoc(overrides: Partial<PolicyDocument> = {}): PolicyDocument {
  return {
    id: '',
    title: '데이터 동기화 정책',
    category: 'data-integrity',
    content: '역방향 Kafka 토픽을 통한 데이터 동기화 시, eventual consistency를 허용하며 최대 허용 지연 시간은 5분으로 한다.',
    source: 'CLI policy-doc save',
    confirmedAt: '2026-03-10',
    project: 'lip',
    tags: ['kafka', '역방향토픽', '동기화'],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Setup / Teardown                                                    */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kic-policy-test-'));
  manager = new PolicyDocManager(tmpDir);
});

afterEach(() => {
  // Clean up temp directory
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

/* ------------------------------------------------------------------ */
/*  Tests: save                                                         */
/* ------------------------------------------------------------------ */

describe('PolicyDocManager.save', () => {
  it('should create a markdown file with YAML frontmatter', () => {
    const doc = createTestDoc();
    const filePath = manager.save(doc);

    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain('title:');
    expect(content).toContain('category: data-integrity');
    expect(content).toContain('project: lip');
    expect(content).toContain('tags: [kafka, 역방향토픽, 동기화]');
    expect(content).toContain('# 데이터 동기화 정책');
    expect(content).toContain('## 정책 내용');
    expect(content).toContain('## 확인 맥락');
  });

  it('should update the index after saving', () => {
    const doc = createTestDoc();
    manager.save(doc);

    const index = manager.getIndex();
    expect(index.policies).toHaveLength(1);
    expect(index.policies[0].title).toBe('데이터 동기화 정책');
    expect(index.policies[0].category).toBe('data-integrity');
    expect(index.policies[0].project).toBe('lip');
    expect(index.policies[0].tags).toEqual(['kafka', '역방향토픽', '동기화']);
  });

  it('should generate a proper filename with category and slug', () => {
    const doc = createTestDoc();
    const filePath = manager.save(doc);
    const filename = path.basename(filePath);

    expect(filename).toMatch(/^data-integrity-.*\.policy\.md$/);
  });

  it('should auto-generate ID when not provided', () => {
    const doc = createTestDoc({ id: '' });
    manager.save(doc);

    const index = manager.getIndex();
    expect(index.policies[0].id).toMatch(/^policy-doc-\d{3}$/);
  });

  it('should handle multiple saves with unique IDs', () => {
    manager.save(createTestDoc({ title: '정책 1' }));
    manager.save(createTestDoc({ title: '정책 2' }));
    manager.save(createTestDoc({ title: '정책 3' }));

    const index = manager.getIndex();
    expect(index.policies).toHaveLength(3);

    const ids = index.policies.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: list                                                         */
/* ------------------------------------------------------------------ */

describe('PolicyDocManager.list', () => {
  beforeEach(() => {
    manager.save(createTestDoc({ title: '정책 A', category: 'data-integrity', project: 'lip', tags: ['kafka'] }));
    manager.save(createTestDoc({ title: '정책 B', category: 'data-handling', project: 'escm-api', tags: ['excel'] }));
    manager.save(createTestDoc({ title: '정책 C', category: 'data-integrity', project: 'lip', tags: ['동기화'] }));
  });

  it('should return all entries without filter', () => {
    const entries = manager.list();
    expect(entries).toHaveLength(3);
  });

  it('should filter by category', () => {
    const entries = manager.list({ category: 'data-integrity' });
    expect(entries).toHaveLength(2);
    entries.forEach(e => expect(e.category).toBe('data-integrity'));
  });

  it('should filter by project', () => {
    const entries = manager.list({ project: 'escm-api' });
    expect(entries).toHaveLength(1);
    expect(entries[0].project).toBe('escm-api');
  });

  it('should filter by tag', () => {
    const entries = manager.list({ tag: 'kafka' });
    expect(entries).toHaveLength(1);
    expect(entries[0].tags).toContain('kafka');
  });

  it('should return empty array when no matches', () => {
    const entries = manager.list({ category: 'nonexistent' });
    expect(entries).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: search                                                       */
/* ------------------------------------------------------------------ */

describe('PolicyDocManager.search', () => {
  beforeEach(() => {
    manager.save(createTestDoc({
      title: '데이터 동기화 정책',
      content: 'Kafka 토픽을 통한 동기화',
      tags: ['kafka', '동기화'],
    }));
    manager.save(createTestDoc({
      title: '엑셀 업로드 정책',
      content: '엑셀 업로드 시 차단 로직',
      tags: ['excel', '업로드'],
    }));
  });

  it('should find by title keyword', () => {
    const results = manager.search('엑셀');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('엑셀 업로드 정책');
  });

  it('should find by content keyword', () => {
    const results = manager.search('차단');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('엑셀 업로드 정책');
  });

  it('should find by tag keyword', () => {
    const results = manager.search('kafka');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('데이터 동기화 정책');
  });

  it('should return empty array when no matches', () => {
    const results = manager.search('nonexistent');
    expect(results).toHaveLength(0);
  });

  it('should be case-insensitive', () => {
    const results = manager.search('KAFKA');
    expect(results).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: get                                                          */
/* ------------------------------------------------------------------ */

describe('PolicyDocManager.get', () => {
  it('should return full PolicyDocument for existing ID', () => {
    manager.save(createTestDoc({ title: '테스트 정책' }));
    const index = manager.getIndex();
    const id = index.policies[0].id;

    const doc = manager.get(id);
    expect(doc).not.toBeNull();
    expect(doc!.title).toBe('테스트 정책');
    expect(doc!.category).toBe('data-integrity');
    expect(doc!.content).toBeTruthy();
    expect(doc!.source).toBeTruthy();
    expect(doc!.tags).toEqual(['kafka', '역방향토픽', '동기화']);
  });

  it('should return null for non-existing ID', () => {
    const doc = manager.get('nonexistent-id');
    expect(doc).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: delete                                                       */
/* ------------------------------------------------------------------ */

describe('PolicyDocManager.delete', () => {
  it('should remove file and update index', () => {
    const filePath = manager.save(createTestDoc({ title: '삭제 대상 정책' }));
    const index = manager.getIndex();
    const id = index.policies[0].id;

    expect(fs.existsSync(filePath)).toBe(true);
    expect(index.policies).toHaveLength(1);

    const result = manager.delete(id);
    expect(result).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);

    const updatedIndex = manager.getIndex();
    expect(updatedIndex.policies).toHaveLength(0);
  });

  it('should return false for non-existing ID', () => {
    const result = manager.delete('nonexistent-id');
    expect(result).toBe(false);
  });

  it('should not affect other documents', () => {
    manager.save(createTestDoc({ title: '정책 1' }));
    manager.save(createTestDoc({ title: '정책 2' }));

    const index = manager.getIndex();
    expect(index.policies).toHaveLength(2);

    const firstId = index.policies[0].id;
    manager.delete(firstId);

    const updatedIndex = manager.getIndex();
    expect(updatedIndex.policies).toHaveLength(1);
    expect(updatedIndex.policies[0].title).toBe('정책 2');
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: getIndex                                                     */
/* ------------------------------------------------------------------ */

describe('PolicyDocManager.getIndex', () => {
  it('should return empty index when no documents exist', () => {
    const index = manager.getIndex();
    expect(index.policies).toHaveLength(0);
    expect(index.lastUpdated).toBeTruthy();
  });

  it('should contain lastUpdated timestamp', () => {
    manager.save(createTestDoc());
    const index = manager.getIndex();
    expect(index.lastUpdated).toBeTruthy();
    // Should be a valid ISO date string
    expect(new Date(index.lastUpdated).getTime()).not.toBeNaN();
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: markdown round-trip                                          */
/* ------------------------------------------------------------------ */

describe('Markdown round-trip', () => {
  it('should preserve all fields through save -> get', () => {
    const original = createTestDoc({
      title: '라운드트립 테스트',
      category: 'operational',
      content: '정책 내용 테스트 123',
      source: '확인 맥락 테스트',
      confirmedAt: '2026-03-10',
      project: 'lip',
      tags: ['tag1', 'tag2'],
    });

    manager.save(original);
    const index = manager.getIndex();
    const doc = manager.get(index.policies[0].id);

    expect(doc).not.toBeNull();
    expect(doc!.title).toBe('라운드트립 테스트');
    expect(doc!.category).toBe('operational');
    expect(doc!.content).toBe('정책 내용 테스트 123');
    expect(doc!.source).toBe('확인 맥락 테스트');
    expect(doc!.confirmedAt).toBe('2026-03-10');
    expect(doc!.project).toBe('lip');
    expect(doc!.tags).toEqual(['tag1', 'tag2']);
  });
});
