/**
 * @module commands/annotations
 * @description Annotations 명령어 핸들러 - 보강 주석 생성 및 조회
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ProjectsConfig } from '../types/index';
import { AnnotationManager } from '../core/annotations/annotation-manager';
import { AnnotationGenerator } from '../core/annotations/annotation-generator';
import { Indexer } from '../core/indexing/indexer';
import { ConfigManager } from '../config/config-manager';
import { readJsonFile, getImpactDir } from '../utils/file';
import { logger } from '../utils/logger';

/**
 * AnnotationsCommand - 보강 주석 명령어
 *
 * 사용법: /impact annotations [generate [path]] [view [path]]
 * 기능:
 *   - 보강 주석 생성
 *   - 기존 보강 주석 조회
 *   - 보강 주석 상태 요약
 */
export class AnnotationsCommand implements Command {
  readonly name = 'annotations';
  readonly description = '보강 주석을 생성하거나 기존 보강 주석을 조회합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    const subCommand = this.args[0];

    if (subCommand === 'generate') {
      const targetPath = this.args[1];
      return this.handleGenerate(targetPath);
    } else if (subCommand === 'view') {
      const { targetPath, format, outputDir } = this.parseViewArgs(this.args.slice(1));
      return this.handleView(targetPath, format, outputDir);
    } else {
      // 기본: 도움말 또는 요약 표시
      console.log('\n사용법: /impact annotations [generate [path]] [view [path]]');
      console.log('  generate [path]  보강 주석 생성 (선택: 특정 경로)');
      console.log('  view [path]      보강 주석 조회 (선택: 특정 경로)');
      console.log('    --format md|yaml  출력 형식 (기본: yaml)');
      console.log('    --output <dir>    md 파일로 저장 (디렉토리 자동 생성)');
      return {
        code: ResultCode.SUCCESS,
        message: 'Annotations command usage displayed.',
      };
    }
  }

  /**
   * generate 서브커맨드 처리
   */
  private async handleGenerate(targetPath?: string): Promise<CommandResult> {
    try {
      // 1. 활성 프로젝트 확인
      const { projectId, projectPath } = await this.getActiveProject();

      // 2. 인덱스 로드
      const indexer = new Indexer();
      const codeIndex = await indexer.loadIndex(projectId);

      if (!codeIndex) {
        logger.error('인덱스가 없습니다. 먼저 reindex를 실행해주세요.');
        return {
          code: ResultCode.NEEDS_INDEX,
          message: '인덱스가 없습니다. 먼저 reindex를 실행해주세요.',
        };
      }

      // 3. 대상 파일 결정
      let targetFiles = codeIndex.files;
      if (targetPath) {
        const normalizedTarget = targetPath.replace(/\\/g, '/');
        targetFiles = codeIndex.files.filter(f =>
          f.path.replace(/\\/g, '/').startsWith(normalizedTarget)
        );

        if (targetFiles.length === 0) {
          logger.warn(`경로 "${targetPath}"에 해당하는 파일이 없습니다.`);
          return {
            code: ResultCode.SUCCESS,
            message: `경로 "${targetPath}"에 해당하는 파일이 없습니다.`,
          };
        }
      }

      logger.header('Impact Checker - 보강 주석 생성');
      console.log(`\n프로젝트: ${projectId}`);
      console.log(`대상 파일: ${targetFiles.length}개`);
      if (targetPath) {
        console.log(`필터 경로: ${targetPath}`);
      }
      console.log('');

      const annotationManager = new AnnotationManager();
      const annotationGenerator = new AnnotationGenerator();
      const startTime = Date.now();

      // 4. 파일별 sourceHash로 변경 여부 확인 & 파싱 대상 수집
      const filesToGenerate: Array<{ filePath: string; parsedFile: import('../core/indexing/types').ParsedFile }> = [];

      // 파일 파싱을 위해 인덱서의 내부 파싱 기능은 직접 사용 불가
      // 대신 TypeScriptParser를 직접 사용
      const { TypeScriptParser } = await import('../core/indexing/parsers/typescript-parser');
      const parser = new TypeScriptParser();

      for (let i = 0; i < targetFiles.length; i++) {
        const file = targetFiles[i];
        const absolutePath = path.join(projectPath, file.path);

        // 파일 존재 확인
        if (!fs.existsSync(absolutePath)) {
          continue;
        }

        // sourceHash로 변경 여부 확인
        const isChanged = await annotationManager.isChanged(projectId, file.path, file.hash);
        if (!isChanged) {
          continue;
        }

        // 파서가 지원하는 파일인지 확인
        if (!parser.canParse(file.path)) {
          continue;
        }

        try {
          const content = fs.readFileSync(absolutePath, 'utf-8');
          const parsedFile = await parser.parse(file.path, content);
          if (parsedFile.functions.length > 0) {
            filesToGenerate.push({ filePath: file.path, parsedFile });
          }
        } catch (_err) {
          // 파싱 실패 시 건너뛰기
          logger.debug(`파싱 실패: ${file.path}`);
        }
      }

      if (filesToGenerate.length === 0) {
        console.log('변경된 파일이 없거나, 분석 대상 함수가 없습니다.');
        return {
          code: ResultCode.SUCCESS,
          message: '분석 대상 파일 없음.',
        };
      }

      console.log(`분석 대상: ${filesToGenerate.length}개 파일\n`);

      // 5. 배치 생성
      let totalFunctions = 0;
      let totalPolicies = 0;

      const generated = await annotationGenerator.generateBatch(
        filesToGenerate,
        projectPath,
        (current, total, filePath) => {
          console.log(`[${current}/${total}] ${filePath} 분석 중...`);
        },
      );

      // 6. 기존 보강 주석과 병합 후 저장
      for (const [filePath, newAnnotation] of generated) {
        const existing = await annotationManager.load(projectId, filePath);

        let toSave = newAnnotation;
        if (existing) {
          // userModified 보존 병합
          toSave = await annotationManager.merge(existing, newAnnotation);
        }

        await annotationManager.save(projectId, filePath, toSave);

        totalFunctions += toSave.annotations.length;
        for (const ann of toSave.annotations) {
          totalPolicies += ann.policies ? ann.policies.length : 0;
        }
      }

      // 7. 메타 갱신
      await annotationManager.updateMeta(projectId);

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

      // 8. 완료 요약
      logger.separator();
      console.log('\n보강 주석 생성 완료:');
      console.log(`  분석 파일 수:   ${generated.size}`);
      console.log(`  함수 수:        ${totalFunctions}`);
      console.log(`  추론 정책 수:   ${totalPolicies}`);
      console.log(`  소요 시간:      ${elapsedSec}s`);
      logger.separator();
      logger.success('보강 주석 생성이 완료되었습니다!');

      return {
        code: ResultCode.SUCCESS,
        message: `Annotations generated for ${generated.size} files.`,
        data: {
          projectId,
          filesAnalyzed: generated.size,
          totalFunctions,
          totalPolicies,
          elapsedSeconds: parseFloat(elapsedSec),
        },
      };
    } catch (err) {
      if (err instanceof ProjectNotFoundError) {
        return {
          code: ResultCode.NEEDS_CONFIG,
          message: err.message,
        };
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`보강 주석 생성 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Annotations generate failed: ${errorMsg}`,
      };
    }
  }

  /**
   * view 서브커맨드 처리
   */
  private async handleView(targetPath?: string, format: 'yaml' | 'md' = 'yaml', outputDir?: string): Promise<CommandResult> {
    try {
      // 1. 활성 프로젝트 확인
      const { projectId } = await this.getActiveProject();

      const annotationManager = new AnnotationManager();

      // outputDir 지정 시 format은 자동으로 'md'
      const effectiveFormat = outputDir ? 'md' : format;

      if (targetPath) {
        // 특정 파일 보강 주석 조회
        const annotation = await annotationManager.load(projectId, targetPath);

        if (!annotation) {
          console.log(`\n"${targetPath}"의 보강 주석이 없습니다. generate를 먼저 실행해주세요.`);
          return {
            code: ResultCode.SUCCESS,
            message: '보강 주석이 없습니다. generate를 먼저 실행해주세요.',
          };
        }

        if (outputDir) {
          // 파일로 저장
          fs.mkdirSync(outputDir, { recursive: true });
          const mdContent = this.generateSingleFileMd(annotation);
          const filename = annotation.file.split('/').pop() || annotation.file;
          const outputPath = path.join(outputDir, `${filename}.annotation.md`);
          fs.writeFileSync(outputPath, mdContent, 'utf-8');
          console.log(`저장 완료: ${outputPath}`);
        } else if (effectiveFormat === 'md') {
          this.printSingleFileMd(annotation);
        } else {
          logger.header(`보강 주석: ${targetPath}`);
          console.log(`\n시스템: ${annotation.system}`);
          console.log(`분석 시각: ${annotation.lastAnalyzed}`);
          console.log(`분석 엔진: ${annotation.analyzerVersion} (${annotation.model})`);
          console.log(`파일 요약: ${annotation.fileSummary.description}`);
          console.log('');

          for (const ann of annotation.annotations) {
            console.log(`  [${ann.type}] ${ann.function}`);
            console.log(`    주석: ${ann.enriched_comment}`);
            console.log(`    신뢰도: ${(ann.confidence * 100).toFixed(0)}%`);
            if (ann.userModified) {
              console.log(`    (사용자 수정됨)`);
            }
            if (ann.policies && ann.policies.length > 0) {
              console.log(`    정책:`);
              for (const policy of ann.policies) {
                console.log(`      - ${policy.name} (${policy.category}, ${(policy.confidence * 100).toFixed(0)}%)`);
              }
            }
            console.log('');
          }
        }

        return {
          code: ResultCode.SUCCESS,
          message: `Annotation view for ${targetPath}`,
          data: { projectId, file: targetPath, annotation },
        };
      } else {
        // 전체 통계 표시
        const meta = await annotationManager.getMeta(projectId);

        if (!meta) {
          console.log('\n보강 주석이 없습니다. generate를 먼저 실행해주세요.');
          return {
            code: ResultCode.SUCCESS,
            message: '보강 주석이 없습니다. generate를 먼저 실행해주세요.',
          };
        }

        if (outputDir) {
          // 디렉토리 자동 생성
          fs.mkdirSync(outputDir, { recursive: true });

          // 통계 md 저장
          const statsMd = this.generateStatsMd(meta);
          const statsPath = path.join(outputDir, 'stats.annotation.md');
          fs.writeFileSync(statsPath, statsMd, 'utf-8');
          console.log(`저장 완료: ${statsPath}`);

          // 모든 어노테이션 파일을 개별 저장
          const allAnnotations = await annotationManager.loadAll(projectId);
          for (const [filePath, ann] of allAnnotations) {
            const mdContent = this.generateSingleFileMd(ann);
            const filename = filePath.split('/').pop() || filePath;
            const outputPath = path.join(outputDir, `${filename}.annotation.md`);
            fs.writeFileSync(outputPath, mdContent, 'utf-8');
            console.log(`저장 완료: ${outputPath}`);
          }
        } else if (effectiveFormat === 'md') {
          this.printStatsMd(meta);
        } else {
          logger.header('보강 주석 통계');
          console.log(`\n프로젝트: ${projectId}`);
          console.log(`버전: ${meta.version}`);
          console.log(`생성: ${meta.createdAt}`);
          console.log(`업데이트: ${meta.lastUpdatedAt}`);
          console.log('');
          console.log(`  전체 파일 수:       ${meta.totalFiles}`);
          console.log(`  전체 보강 주석 수:  ${meta.totalAnnotations}`);
          console.log(`  전체 정책 수:       ${meta.totalPolicies}`);
          console.log(`  평균 신뢰도:        ${(meta.avgConfidence * 100).toFixed(0)}%`);
          console.log(`  낮은 신뢰도:        ${meta.lowConfidenceCount}건`);
          console.log(`  사용자 수정:        ${meta.userModifiedCount}건`);
          console.log('');

          // 시스템별 통계
          const systemNames = Object.keys(meta.systems);
          if (systemNames.length > 0) {
            console.log('  시스템별:');
            for (const sysName of systemNames) {
              const sys = meta.systems[sysName];
              console.log(`    ${sysName}: ${sys.files}파일, ${sys.annotations}주석, ${sys.policies}정책`);
            }
            console.log('');
          }

          // 최근 보강 주석 파일 목록 (최신 5개)
          const allAnnotations = await annotationManager.loadAll(projectId);
          if (allAnnotations.size > 0) {
            const sorted = Array.from(allAnnotations.entries())
              .sort((a, b) => {
                const dateA = new Date(a[1].lastAnalyzed).getTime();
                const dateB = new Date(b[1].lastAnalyzed).getTime();
                return dateB - dateA;
              })
              .slice(0, 5);

            console.log('  최근 분석 파일:');
            for (const [filePath, ann] of sorted) {
              console.log(`    ${filePath} (${ann.annotations.length}개 함수, ${ann.lastAnalyzed})`);
            }
            console.log('');
          }
        }

        return {
          code: ResultCode.SUCCESS,
          message: 'Annotation statistics displayed.',
          data: { projectId, meta },
        };
      }
    } catch (err) {
      if (err instanceof ProjectNotFoundError) {
        return {
          code: ResultCode.NEEDS_CONFIG,
          message: err.message,
        };
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`보강 주석 조회 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Annotations view failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 단일 파일 보강 주석의 마크다운 문자열을 생성
   */
  private generateSingleFileMd(annotation: import('../types/annotations').AnnotationFile): string {
    const lines: string[] = [];
    const filename = annotation.file.split('/').pop() || annotation.file;
    lines.push(`# ${filename} 어노테이션`);
    lines.push('');
    lines.push('## 파일 요약');
    lines.push(`- **설명**: ${annotation.fileSummary.description}`);
    lines.push(`- **비즈니스 도메인**: ${annotation.fileSummary.businessDomain}`);
    lines.push(`- **신뢰도**: ${(annotation.fileSummary.confidence * 100).toFixed(0)}%`);
    lines.push(`- **키워드**: ${annotation.fileSummary.keywords.join(', ')}`);
    lines.push('');
    lines.push('## 함수 목록');

    for (const ann of annotation.annotations) {
      lines.push('');
      lines.push(`### ${ann.function}`);
      lines.push(`- **타입**: ${ann.type}`);
      lines.push(`- **시그니처**: \`${ann.signature}\``);
      lines.push(`- **설명**: ${ann.enriched_comment}`);
      lines.push(`- **신뢰도**: ${(ann.confidence * 100).toFixed(0)}%`);

      if (ann.policies && ann.policies.length > 0) {
        lines.push('');
        lines.push('#### 관련 정책');
        for (const policy of ann.policies) {
          lines.push(`- ${policy.name} (${policy.category}, ${(policy.confidence * 100).toFixed(0)}%)`);
        }
      }

      if (ann.relatedFunctions && ann.relatedFunctions.length > 0) {
        lines.push('');
        lines.push('#### 관련 함수');
        for (const fn of ann.relatedFunctions) {
          lines.push(`- ${fn}`);
        }
      }

      if (ann.relatedApis && ann.relatedApis.length > 0) {
        lines.push('');
        lines.push('#### 관련 API');
        for (const api of ann.relatedApis) {
          lines.push(`- ${api}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 단일 파일 보강 주석을 마크다운 형식으로 출력
   */
  private printSingleFileMd(annotation: import('../types/annotations').AnnotationFile): void {
    console.log(this.generateSingleFileMd(annotation));
  }

  /**
   * 통계 마크다운 문자열을 생성
   */
  private generateStatsMd(meta: import('../types/annotations').AnnotationMeta): string {
    const lines: string[] = [];
    lines.push('# 어노테이션 통계');
    lines.push('');
    lines.push('| 항목 | 값 |');
    lines.push('|------|:---:|');
    lines.push(`| 전체 파일 | ${meta.totalFiles}개 |`);
    lines.push(`| 전체 함수 | ${meta.totalAnnotations}개 |`);
    lines.push(`| 추출된 정책 | ${meta.totalPolicies}개 |`);
    lines.push(`| 평균 신뢰도 | ${(meta.avgConfidence * 100).toFixed(0)}% |`);

    const systemNames = Object.keys(meta.systems);
    if (systemNames.length > 0) {
      lines.push('');
      lines.push('## 시스템별 현황');
      lines.push('| 시스템 | 파일 수 | 함수 수 | 정책 수 |');
      lines.push('|--------|:------:|:------:|:------:|');
      for (const sysName of systemNames) {
        const sys = meta.systems[sysName];
        lines.push(`| ${sysName} | ${sys.files} | ${sys.annotations} | ${sys.policies} |`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 통계를 마크다운 형식으로 출력
   */
  private printStatsMd(meta: import('../types/annotations').AnnotationMeta): void {
    console.log(this.generateStatsMd(meta));
  }

  /**
   * view 서브커맨드의 인자를 파싱한다.
   * --format md|yaml 옵션, --output <dir> 옵션, targetPath를 추출한다.
   */
  private parseViewArgs(args: string[]): { targetPath?: string; format: 'yaml' | 'md'; outputDir?: string } {
    let format: 'yaml' | 'md' = 'yaml';
    let targetPath: string | undefined;
    let outputDir: string | undefined;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--format' && i + 1 < args.length) {
        const val = args[i + 1];
        if (val === 'md' || val === 'yaml') {
          format = val;
        }
        i++; // skip the value
      } else if (args[i] === '--output' && i + 1 < args.length) {
        outputDir = args[i + 1];
        i++; // skip the value
      } else {
        targetPath = args[i];
      }
    }

    return { targetPath, format, outputDir };
  }

  /**
   * 활성 프로젝트 정보를 가져온다.
   * @throws {ProjectNotFoundError} 프로젝트가 설정되지 않았거나 찾을 수 없을 때
   */
  private async getActiveProject(): Promise<{ projectId: string; projectPath: string }> {
    const configManager = new ConfigManager();
    await configManager.load();
    const activeProjectId = configManager.getActiveProject();

    if (!activeProjectId) {
      throw new ProjectNotFoundError('프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.');
    }

    const impactDir = getImpactDir();
    const projectsPath = path.join(impactDir, 'projects.json');
    const projectsConfig = readJsonFile<ProjectsConfig>(projectsPath);

    if (!projectsConfig) {
      throw new ProjectNotFoundError('프로젝트를 먼저 설정해주세요. /impact init을 실행하세요.');
    }

    const project = projectsConfig.projects.find(p => p.id === activeProjectId);
    if (!project) {
      throw new ProjectNotFoundError(`프로젝트를 찾을 수 없습니다: ${activeProjectId}`);
    }

    return { projectId: activeProjectId, projectPath: project.path };
  }
}

/**
 * 프로젝트 미설정/미존재 에러
 */
class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}
