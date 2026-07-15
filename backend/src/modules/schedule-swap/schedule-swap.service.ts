import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as oracledb from 'oracledb';
import { DatabaseService } from '../database/database.service';

type ScheduleResultRow = {
  ID: string;
  JOB_ID: string;
  WORK_DATE: Date;
  SHIFT_NAME: string;
  TEAM: string;
  PERSON_NAME: string;
  ROLE_NAME: string;
  SKILLS_TEXT: string | null;
  ACTUAL_TEAM: string | null;
};

type SwapRow = {
  ID: string;
  SOURCE_RESULT_ID: string;
  TARGET_RESULT_ID: string;
  JOB_ID: string;
  SOURCE_WORK_DATE: Date;
  SOURCE_SHIFT_NAME: string;
  SOURCE_PERSON_NAME: string;
  SOURCE_TEAM: string | null;
  SOURCE_ROLE_NAME: string | null;
  SOURCE_SKILLS_TEXT: string | null;
  TARGET_WORK_DATE: Date;
  TARGET_SHIFT_NAME: string;
  TARGET_PERSON_NAME: string;
  TARGET_TEAM: string | null;
  TARGET_ROLE_NAME: string | null;
  TARGET_SKILLS_TEXT: string | null;
  REASON: string | null;
  STATUS: string;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  CANCELED_AT: Date | null;
};

type CreateSwapPayload = {
  sourceResultId?: unknown;
  targetResultId?: unknown;
  reason?: unknown;
};

type SwapRecommendation = {
  resultId: string;
  date: string;
  shift: string;
  personName: string;
  team: string;
  role: string;
  skills: string[];
  priority: number;
  reason: string;
  warnings: string[];
  isCrossTeam: boolean;
  riskLevel: '低风险' | '有风险';
  riskScore: number;
};

@Injectable()
export class ScheduleSwapService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(query: Record<string, string | undefined>) {
    const filters: string[] = [];
    const params: Record<string, string> = {};
    if (query.resultId) {
      filters.push('(SOURCE_RESULT_ID = :resultId OR TARGET_RESULT_ID = :resultId)');
      params.resultId = query.resultId;
    }
    if (query.status) {
      filters.push('STATUS = :status');
      params.status = query.status;
    }

    const rows = await this.databaseService.query<SwapRow>(
      `SELECT ID, SOURCE_RESULT_ID, TARGET_RESULT_ID, JOB_ID,
              SOURCE_WORK_DATE, SOURCE_SHIFT_NAME, SOURCE_PERSON_NAME, SOURCE_TEAM, SOURCE_ROLE_NAME, SOURCE_SKILLS_TEXT,
              TARGET_WORK_DATE, TARGET_SHIFT_NAME, TARGET_PERSON_NAME, TARGET_TEAM, TARGET_ROLE_NAME, TARGET_SKILLS_TEXT,
              REASON, STATUS, CREATED_AT, UPDATED_AT, CANCELED_AT
       FROM SCHEDULE_RESULT_SWAP
       ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY CREATED_AT DESC, ID`,
      params,
    );

    return rows.map((row) => this.toDto(row));
  }

  async getRecommendations(resultId: string) {
    if (!resultId) throw new BadRequestException('resultId 不能为空');
    const source = await this.loadResult(resultId);
    await this.ensureResultAvailableForSwap(source.ID);

    return {
      resultId,
      workDate: this.formatDate(source.WORK_DATE),
      shift: source.SHIFT_NAME,
      personName: source.PERSON_NAME,
      recommendations: await this.buildRecommendations(source),
    };
  }

  async create(rawPayload: unknown) {
    const payload = this.parseCreatePayload(rawPayload);
    if (payload.sourceResultId === payload.targetResultId) {
      throw new BadRequestException('不能和同一条排班结果换班');
    }

    const source = await this.loadResult(payload.sourceResultId);
    const target = await this.loadResult(payload.targetResultId);
    this.ensureSameScheduleWeek(source.WORK_DATE, target.WORK_DATE);
    if (source.JOB_ID !== target.JOB_ID) {
      throw new BadRequestException('只能在同一次排班任务内换班');
    }

    const recommendations = await this.buildRecommendations(source);
    if (!recommendations.some((item) => item.resultId === target.ID)) {
      throw new BadRequestException('目标班次不满足换班条件');
    }

    const id = randomUUID();
    await this.databaseService.transaction(async (connection) => {
      await this.lockScheduleResults(connection, [source.ID, target.ID]);
      await this.ensureResultAvailableForSwapForUpdate(connection, source.ID);
      await this.ensureResultAvailableForSwapForUpdate(connection, target.ID);
      await connection.execute(
        `INSERT INTO SCHEDULE_RESULT_SWAP
           (ID, SOURCE_RESULT_ID, TARGET_RESULT_ID, JOB_ID,
            SOURCE_WORK_DATE, SOURCE_SHIFT_NAME, SOURCE_PERSON_NAME, SOURCE_TEAM, SOURCE_ROLE_NAME, SOURCE_SKILLS_TEXT,
            TARGET_WORK_DATE, TARGET_SHIFT_NAME, TARGET_PERSON_NAME, TARGET_TEAM, TARGET_ROLE_NAME, TARGET_SKILLS_TEXT,
            REASON, STATUS)
         VALUES
           (:id, :sourceResultId, :targetResultId, :jobId,
            TO_DATE(:sourceWorkDate, 'YYYY-MM-DD'), :sourceShiftName, :sourcePersonName, :sourceTeam, :sourceRoleName, :sourceSkillsText,
            TO_DATE(:targetWorkDate, 'YYYY-MM-DD'), :targetShiftName, :targetPersonName, :targetTeam, :targetRoleName, :targetSkillsText,
            :reason, N'生效')`,
        {
          id,
          sourceResultId: source.ID,
          targetResultId: target.ID,
          jobId: source.JOB_ID,
          sourceWorkDate: this.formatDate(source.WORK_DATE),
          sourceShiftName: source.SHIFT_NAME,
          sourcePersonName: source.PERSON_NAME,
          sourceTeam: source.ACTUAL_TEAM ?? source.TEAM,
          sourceRoleName: source.ROLE_NAME,
          sourceSkillsText: source.SKILLS_TEXT ?? '',
          targetWorkDate: this.formatDate(target.WORK_DATE),
          targetShiftName: target.SHIFT_NAME,
          targetPersonName: target.PERSON_NAME,
          targetTeam: target.ACTUAL_TEAM ?? target.TEAM,
          targetRoleName: target.ROLE_NAME,
          targetSkillsText: target.SKILLS_TEXT ?? '',
          reason: payload.reason || null,
        },
      );
    });

    return { id, sourceResultId: source.ID, targetResultId: target.ID, status: '生效' };
  }

  async cancel(id: string) {
    const rows = await this.databaseService.query<{ ID: string; STATUS: string }>(
      'SELECT ID, STATUS FROM SCHEDULE_RESULT_SWAP WHERE ID = :id',
      { id },
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('换班记录不存在');
    if (row.STATUS !== '生效') return { id, status: row.STATUS };

    await this.databaseService.execute(
      `UPDATE SCHEDULE_RESULT_SWAP
       SET STATUS = N'已撤销',
           UPDATED_AT = CURRENT_TIMESTAMP,
           CANCELED_AT = CURRENT_TIMESTAMP
       WHERE ID = :id`,
      { id },
    );

    return { id, status: '已撤销' };
  }

  private async buildRecommendations(source: ScheduleResultRow) {
    const [monday, sunday] = this.weekRangeForDate(source.WORK_DATE);
    const candidates = await this.databaseService.query<ScheduleResultRow>(
      `SELECT ID, JOB_ID, WORK_DATE, SHIFT_NAME, TEAM, PERSON_NAME, ROLE_NAME, SKILLS_TEXT, ACTUAL_TEAM
       FROM SCHEDULE_RESULT
       WHERE JOB_ID = :jobId
         AND ID <> :sourceResultId
         AND WORK_DATE BETWEEN TO_DATE(:weekStart, 'YYYY-MM-DD') AND TO_DATE(:weekEnd, 'YYYY-MM-DD')
       ORDER BY WORK_DATE, SHIFT_NAME, TEAM, PERSON_NAME`,
      {
        jobId: source.JOB_ID,
        sourceResultId: source.ID,
        weekStart: this.formatDate(monday),
        weekEnd: this.formatDate(sunday),
      },
    );

    const sourceDate = this.formatDate(source.WORK_DATE);
    const sourceSkills = this.parseSkills(source.SKILLS_TEXT);
    const sourceTeam = source.ACTUAL_TEAM ?? source.TEAM;

    const result: SwapRecommendation[] = [];
    for (const target of candidates) {
      if (await this.hasActiveAdjustment(target.ID)) continue;
      if (await this.hasActiveSwap(target.ID)) continue;

      const targetDate = this.formatDate(target.WORK_DATE);
      if (await this.isAbsent(source.PERSON_NAME, targetDate)) continue;
      if (await this.isAbsent(target.PERSON_NAME, sourceDate)) continue;
      if (await this.hasOtherAssignment(source.JOB_ID, source.PERSON_NAME, targetDate, [source.ID, target.ID])) continue;
      if (await this.hasOtherAssignment(source.JOB_ID, target.PERSON_NAME, sourceDate, [source.ID, target.ID])) continue;

      const targetSkills = this.parseSkills(target.SKILLS_TEXT);
      const warnings: string[] = [];
      if (source.ROLE_NAME !== target.ROLE_NAME) warnings.push('双方角色不一致');
      const sourceMissing = targetSkills.filter((skill) => !sourceSkills.some((item) => item.includes(skill)));
      const targetMissing = sourceSkills.filter((skill) => !targetSkills.some((item) => item.includes(skill)));
      if (sourceMissing.length > 0) warnings.push(`${source.PERSON_NAME} 缺少对方技能：${sourceMissing.join('、')}`);
      if (targetMissing.length > 0) warnings.push(`${target.PERSON_NAME} 缺少对方技能：${targetMissing.join('、')}`);
      const riskScore = (source.ROLE_NAME === target.ROLE_NAME ? 0 : 10) + (sourceMissing.length + targetMissing.length) * 5;

      const targetTeam = target.ACTUAL_TEAM ?? target.TEAM;
      const isCrossTeam = sourceTeam !== targetTeam;
      const priority = isCrossTeam ? 1 : 0;
      const reason = riskScore === 0
        ? `${isCrossTeam ? '跨班组' : '同班组'}，低风险，角色和技能匹配`
        : `${isCrossTeam ? '跨班组' : '同班组'}，兜底推荐，影响最小`;

      result.push({
        resultId: target.ID,
        date: targetDate,
        shift: target.SHIFT_NAME,
        personName: target.PERSON_NAME,
        team: targetTeam,
        role: target.ROLE_NAME,
        skills: targetSkills,
        priority,
        reason,
        warnings,
        isCrossTeam,
        riskLevel: riskScore === 0 ? '低风险' : '有风险',
        riskScore,
      });
    }

    const sorted = result.sort((a, b) => {
      if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore;
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.team !== b.team) return a.team.localeCompare(b.team, 'zh-Hans-CN');
      const shiftDiff = this.shiftOrder(a.shift) - this.shiftOrder(b.shift);
      if (shiftDiff !== 0) return shiftDiff;
      const personDiff = a.personName.localeCompare(b.personName, 'zh-Hans-CN');
      if (personDiff !== 0) return personDiff;
      return a.resultId.localeCompare(b.resultId);
    });

    const lowRisk = sorted.filter((item) => item.riskScore === 0);
    if (lowRisk.length > 0) return lowRisk;

    const minRiskScore = sorted[0]?.riskScore;
    return minRiskScore === undefined
      ? []
      : sorted.filter((item) => item.riskScore === minRiskScore);
  }

  private parseCreatePayload(rawPayload: unknown) {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new BadRequestException('请求体不能为空');
    }
    const payload = rawPayload as CreateSwapPayload;
    return {
      sourceResultId: this.requiredText(payload.sourceResultId, 'sourceResultId'),
      targetResultId: this.requiredText(payload.targetResultId, 'targetResultId'),
      reason: this.optionalText(payload.reason),
    };
  }

  private async ensureResultAvailableForSwap(resultId: string) {
    if (await this.hasActiveAdjustment(resultId)) {
      throw new BadRequestException('该班次已有生效请假替班，不能换班');
    }
    if (await this.hasActiveSwap(resultId)) {
      throw new BadRequestException('该班次已有生效换班，不能重复换班');
    }
  }

  private async ensureResultAvailableForSwapForUpdate(connection: oracledb.Connection, resultId: string) {
    if (await this.hasActiveAdjustmentForUpdate(connection, resultId)) {
      throw new BadRequestException('该班次已有生效请假替班，不能换班');
    }
    if (await this.hasActiveSwapForUpdate(connection, resultId)) {
      throw new BadRequestException('该班次已有生效换班，不能重复换班');
    }
  }

  private async lockScheduleResults(connection: oracledb.Connection, resultIds: string[]) {
    const sortedIds = [...resultIds].sort();
    await connection.execute(
      `SELECT ID
       FROM SCHEDULE_RESULT
       WHERE ID IN (:firstId, :secondId)
       ORDER BY ID
       FOR UPDATE`,
      { firstId: sortedIds[0], secondId: sortedIds[1] },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
  }

  private async hasActiveAdjustment(resultId: string) {
    const rows = await this.databaseService.query<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT
       FROM SCHEDULE_RESULT_ADJUSTMENT
       WHERE RESULT_ID = :resultId AND STATUS = N'生效'`,
      { resultId },
    );
    return Number(rows[0]?.CNT ?? 0) > 0;
  }

  private async hasActiveAdjustmentForUpdate(connection: oracledb.Connection, resultId: string) {
    const count = await this.countWithConnection(
      connection,
      `SELECT COUNT(*) AS CNT
       FROM SCHEDULE_RESULT_ADJUSTMENT
       WHERE RESULT_ID = :resultId AND STATUS = N'生效'`,
      { resultId },
    );
    return count > 0;
  }

  private async hasActiveSwap(resultId: string) {
    const rows = await this.databaseService.query<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT
       FROM SCHEDULE_RESULT_SWAP
       WHERE STATUS = N'生效'
         AND (SOURCE_RESULT_ID = :resultId OR TARGET_RESULT_ID = :resultId)`,
      { resultId },
    );
    return Number(rows[0]?.CNT ?? 0) > 0;
  }

  private async hasActiveSwapForUpdate(connection: oracledb.Connection, resultId: string) {
    const count = await this.countWithConnection(
      connection,
      `SELECT COUNT(*) AS CNT
       FROM SCHEDULE_RESULT_SWAP
       WHERE STATUS = N'生效'
         AND (SOURCE_RESULT_ID = :resultId OR TARGET_RESULT_ID = :resultId)`,
      { resultId },
    );
    return count > 0;
  }

  private async countWithConnection(
    connection: oracledb.Connection,
    sql: string,
    bindParams: Record<string, unknown>,
  ) {
    const result = await connection.execute<{ CNT: number }>(
      sql,
      bindParams,
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return Number(result.rows?.[0]?.CNT ?? 0);
  }

  private async hasOtherAssignment(jobId: string, personName: string, date: string, excludedIds: string[]) {
    const rows = await this.databaseService.query<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT
       FROM SCHEDULE_RESULT sr
       LEFT JOIN SCHEDULE_RESULT_ADJUSTMENT adj
         ON adj.RESULT_ID = sr.ID
        AND adj.STATUS = N'生效'
       WHERE sr.JOB_ID = :jobId
         AND sr.WORK_DATE = TO_DATE(:workDate, 'YYYY-MM-DD')
         AND COALESCE(adj.REPLACEMENT_PERSON_NAME, sr.PERSON_NAME) = :personName
         AND sr.ID NOT IN (:excludedA, :excludedB)`,
      { jobId, workDate: date, personName, excludedA: excludedIds[0], excludedB: excludedIds[1] },
    );
    return Number(rows[0]?.CNT ?? 0) > 0;
  }

  private async isAbsent(personName: string, date: string) {
    const rows = await this.databaseService.query<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT
       FROM ATTENDANCE_RECORD
       WHERE PERSON_NAME = :personName
         AND STATUS <> N'正常'
         AND START_DATE <= TO_DATE(:workDate, 'YYYY-MM-DD')
         AND END_DATE >= TO_DATE(:workDate, 'YYYY-MM-DD')`,
      { personName, workDate: date },
    );
    return Number(rows[0]?.CNT ?? 0) > 0;
  }

  private async loadResult(id: string) {
    const rows = await this.databaseService.query<ScheduleResultRow>(
      `SELECT ID, JOB_ID, WORK_DATE, SHIFT_NAME, TEAM, PERSON_NAME, ROLE_NAME, SKILLS_TEXT, ACTUAL_TEAM
       FROM SCHEDULE_RESULT
       WHERE ID = :id`,
      { id },
    );
    if (!rows[0]) throw new NotFoundException('排班结果不存在');
    return rows[0];
  }

  private weekRangeForDate(workDate: Date) {
    const date = new Date(workDate);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return [monday, sunday] as const;
  }

  private ensureSameScheduleWeek(sourceDate: Date, targetDate: Date) {
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const [monday, sunday] = this.weekRangeForDate(sourceDate);
    if (target < monday || target > sunday) {
      throw new BadRequestException('只能在同一排班周内换班');
    }
  }

  private parseSkills(skills: string | null) {
    return (skills ?? '').split(/[,，、/]/).map((skill) => skill.trim()).filter(Boolean);
  }

  private requiredText(value: unknown, label: string) {
    const text = this.optionalText(value);
    if (!text) throw new BadRequestException(`${label} 不能为空`);
    return text;
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toDto(row: SwapRow) {
    return {
      id: row.ID,
      sourceResultId: row.SOURCE_RESULT_ID,
      targetResultId: row.TARGET_RESULT_ID,
      jobId: row.JOB_ID,
      sourceDate: this.formatDate(row.SOURCE_WORK_DATE),
      sourceShift: row.SOURCE_SHIFT_NAME,
      sourcePersonName: row.SOURCE_PERSON_NAME,
      targetDate: this.formatDate(row.TARGET_WORK_DATE),
      targetShift: row.TARGET_SHIFT_NAME,
      targetPersonName: row.TARGET_PERSON_NAME,
      reason: row.REASON ?? '',
      status: row.STATUS,
      createdAt: row.CREATED_AT.toISOString(),
      updatedAt: row.UPDATED_AT.toISOString(),
      canceledAt: row.CANCELED_AT?.toISOString() ?? null,
    };
  }

  private shiftOrder(shift: string) {
    if (shift === '早班') return 1;
    if (shift === '晚班') return 2;
    if (shift === '长白班') return 3;
    return 9;
  }

  private formatDate(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
