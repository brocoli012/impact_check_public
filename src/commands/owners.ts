/**
 * @module commands/owners
 * @description Owners 명령어 핸들러 - 시스템별 담당자 관리 (CRUD)
 */

import * as path from 'path';
import { Command, CommandResult, ResultCode } from '../types/common';
import { ConfigManager } from '../config/config-manager';
import { readJsonFile, writeJsonFile, getProjectDir, ensureDir } from '../utils/file';
import { logger } from '../utils/logger';

/** 시스템 담당자 정보 */
export interface OwnerEntry {
  /** 시스템 고유 ID */
  systemId: string;
  /** 시스템 이름 */
  systemName: string;
  /** 담당자 이름 */
  ownerName: string;
  /** 담당자 이메일 */
  email: string;
  /** 소속 팀 */
  team: string;
  /** 담당 경로 패턴 목록 */
  paths: string[];
}

/** 담당자 설정 파일 */
interface OwnersConfig {
  owners: OwnerEntry[];
}

/**
 * OwnersCommand - 담당자 관리 명령어
 *
 * 사용법:
 *   /impact owners                   - 담당자 목록 조회
 *   /impact owners --show <systemId> - 담당자 상세 조회
 *   /impact owners --add <systemId> <systemName> <ownerName> <email> <team> <paths...>
 *   /impact owners --remove <systemId> - 담당자 삭제
 */
export class OwnersCommand implements Command {
  readonly name = 'owners';
  readonly description = '시스템별 담당자 및 팀 정보를 관리합니다.';
  private readonly args: string[];

  constructor(args: string[]) {
    this.args = args;
  }

  async execute(): Promise<CommandResult> {
    try {
      // 활성 프로젝트 확인
      const configManager = new ConfigManager();
      await configManager.load();
      const projectId = configManager.getActiveProject();

      if (!projectId) {
        logger.error('활성 프로젝트가 없습니다. 먼저 /impact init을 실행하세요.');
        return {
          code: ResultCode.NEEDS_INDEX,
          message: 'No active project. Run /impact init first.',
        };
      }

      const ownersPath = path.join(getProjectDir(projectId), 'owners.json');

      // --add 처리
      if (this.args.includes('--add')) {
        return this.handleAdd(ownersPath);
      }

      // --remove 처리
      const removeIdx = this.args.indexOf('--remove');
      if (removeIdx !== -1) {
        const systemId = this.args[removeIdx + 1];
        if (!systemId) {
          logger.error('삭제할 시스템 ID를 지정해주세요.');
          return {
            code: ResultCode.FAILURE,
            message: 'System ID is required for --remove.',
          };
        }
        return this.handleRemove(ownersPath, systemId);
      }

      // --show 처리
      const showIdx = this.args.indexOf('--show');
      if (showIdx !== -1) {
        const systemId = this.args[showIdx + 1];
        if (!systemId) {
          logger.error('조회할 시스템 ID를 지정해주세요.');
          return {
            code: ResultCode.FAILURE,
            message: 'System ID is required for --show.',
          };
        }
        return this.handleShow(ownersPath, systemId);
      }

      // 기본: 목록 조회
      return this.handleList(ownersPath);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`담당자 관리 실패: ${errorMsg}`);
      return {
        code: ResultCode.FAILURE,
        message: `Owners command failed: ${errorMsg}`,
      };
    }
  }

  /**
   * 담당자 목록 조회
   */
  private handleList(ownersPath: string): CommandResult {
    const config = this.loadOwners(ownersPath);

    logger.header('시스템 담당자 목록');

    if (config.owners.length === 0) {
      console.log('\n등록된 담당자가 없습니다.');
      console.log('담당자 추가: /impact owners --add <systemId> <systemName> <ownerName> <email> <team> [paths...]');
    } else {
      console.log('');
      for (const owner of config.owners) {
        console.log(`  ${owner.systemId.padEnd(20)} ${owner.ownerName.padEnd(12)} ${owner.team.padEnd(12)} ${owner.email}`);
      }
      console.log(`\n총 ${config.owners.length}명의 담당자가 등록되어 있습니다.`);
    }

    return {
      code: ResultCode.SUCCESS,
      message: `Listed ${config.owners.length} owners.`,
      data: { owners: config.owners },
    };
  }

  /**
   * 담당자 상세 조회
   */
  private handleShow(ownersPath: string, systemId: string): CommandResult {
    const config = this.loadOwners(ownersPath);
    const owner = config.owners.find(o => o.systemId === systemId);

    if (!owner) {
      logger.error(`담당자를 찾을 수 없습니다: ${systemId}`);
      return {
        code: ResultCode.FAILURE,
        message: `Owner not found: ${systemId}`,
      };
    }

    logger.header(`담당자 상세 - ${owner.systemName}`);
    console.log(`\n  시스템 ID:   ${owner.systemId}`);
    console.log(`  시스템 이름: ${owner.systemName}`);
    console.log(`  담당자:      ${owner.ownerName}`);
    console.log(`  이메일:      ${owner.email}`);
    console.log(`  팀:          ${owner.team}`);

    if (owner.paths.length > 0) {
      console.log('  담당 경로:');
      for (const p of owner.paths) {
        console.log(`    - ${p}`);
      }
    }
    console.log('');

    return {
      code: ResultCode.SUCCESS,
      message: `Showing owner: ${systemId}`,
      data: { owner },
    };
  }

  /**
   * 담당자 추가
   * --add <systemId> <systemName> <ownerName> <email> <team> [paths...]
   */
  private handleAdd(ownersPath: string): CommandResult {
    const addIdx = this.args.indexOf('--add');
    const params = this.args.slice(addIdx + 1);

    if (params.length < 5) {
      logger.error('담당자 추가에 필요한 정보가 부족합니다.');
      console.log('\n사용법: /impact owners --add <systemId> <systemName> <ownerName> <email> <team> [paths...]');
      return {
        code: ResultCode.FAILURE,
        message: 'Insufficient parameters for --add.',
      };
    }

    const [systemId, systemName, ownerName, email, team, ...paths] = params;

    const config = this.loadOwners(ownersPath);

    // 중복 확인
    const existing = config.owners.find(o => o.systemId === systemId);
    if (existing) {
      logger.error(`이미 등록된 시스템입니다: ${systemId}`);
      return {
        code: ResultCode.FAILURE,
        message: `System already exists: ${systemId}`,
      };
    }

    const newOwner: OwnerEntry = {
      systemId,
      systemName,
      ownerName,
      email,
      team,
      paths: paths.length > 0 ? paths : [],
    };

    config.owners.push(newOwner);
    this.saveOwners(ownersPath, config);

    logger.success(`담당자가 추가되었습니다: ${systemName} (${ownerName})`);

    return {
      code: ResultCode.SUCCESS,
      message: `Owner added: ${systemId}`,
      data: { owner: newOwner },
    };
  }

  /**
   * 담당자 삭제
   */
  private handleRemove(ownersPath: string, systemId: string): CommandResult {
    const config = this.loadOwners(ownersPath);
    const idx = config.owners.findIndex(o => o.systemId === systemId);

    if (idx === -1) {
      logger.error(`담당자를 찾을 수 없습니다: ${systemId}`);
      return {
        code: ResultCode.FAILURE,
        message: `Owner not found: ${systemId}`,
      };
    }

    const removed = config.owners.splice(idx, 1)[0];
    this.saveOwners(ownersPath, config);

    logger.success(`담당자가 삭제되었습니다: ${removed.systemName} (${removed.ownerName})`);

    return {
      code: ResultCode.SUCCESS,
      message: `Owner removed: ${systemId}`,
      data: { removed },
    };
  }

  /**
   * 담당자 설정 파일 로드
   */
  private loadOwners(ownersPath: string): OwnersConfig {
    const config = readJsonFile<OwnersConfig>(ownersPath);
    return config || { owners: [] };
  }

  /**
   * 담당자 설정 파일 저장
   */
  private saveOwners(ownersPath: string, config: OwnersConfig): void {
    ensureDir(path.dirname(ownersPath));
    writeJsonFile(ownersPath, config);
  }
}
