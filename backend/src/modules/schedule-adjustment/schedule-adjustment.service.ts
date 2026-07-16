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
  MEMBER_ID: string | null;
  PERSON_NAME: string;
  ROLE_NAME: string;
  SKILLS_TEXT: string | null;
  ACTUAL_TEAM: string | null;
};

type TeamMemberRow = {
  ID: string;
  NAME: string;
  TEAM: string;
  ROLE: string;
  STATUS: string;
  SKILLS: string | null;
};

type EffectiveDayRow = {
  RESULT_ID: string;
  SHIFT_NAME: string;
  PERSON_NAME: string;
  ACTUAL_TEAM: string;
};

type AdjustmentRow = {
  ID: string;
  RESULT_ID: string;
  JOB_ID: string;
  WORK_DATE: Date;
  SHIFT_NAME: string;
  ORIGINAL_PERSON_NAME: string;
  ORIGINAL_TEAM: string | null;
  REPLACEMENT_PERSON_NAME: string;
  REPLACEMENT_TEAM: string;
  REPLACEMENT_ROLE_NAME: string;
  REPLACEMENT_SKILLS_TEXT: string | null;
  LEAVE_TYPE: string;
  REASON: string | null;
  STATUS: string;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  CANCELED_AT: Date | null;
};

type CreateAdjustmentPayload = {
  resultId?: unknown;
  leaveType?: unknown;
  reason?: unknown;
  replacementPersonName?: unknown;
};

type AdjustmentRecommendation = {
  memberId: string;
  personName: string;
  team: string;
  role: string;
  skills: string[];
  priority: number;
  reason: string;
  warnings: string[];
  sourceType: '同班组' | '休息班组' | '休息班次' | '其他班组';
  riskLevel: '低风险' | '有风险';
  riskScore: number;
};

type Candidate = TeamMemberRow & {
  skills: string[];
};

const LEAVE_TYPES = ['请假', '事假', '临时调休', '其他'];

@Injectable()
export class ScheduleAdjustmentService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(query: Record<string, string | undefined>) {
    const filters: string[] = [];
    const params: Record<string, string> = {};

    if (query.resultId) {
      filters.push('RESULT_ID = :resultId');
      params.resultId = query.resultId;
    }
    if (query.status) {
      filters.push('STATUS = :status');
      params.status = query.status;
    }

    const rows = await this.databaseService.query<AdjustmentRow>(
      `SELECT ID, RESULT_ID, JOB_ID, WORK_DATE, SHIFT_NAME, ORIGINAL_PERSON_NAME, ORIGINAL_TEAM,
              REPLACEMENT_PERSON_NAME, REPLACEMENT_TEAM, REPLACEMENT_ROLE_NAME, REPLACEMENT_SKILLS_TEXT,
              LEAVE_TYPE, REASON, STATUS, CREATED_AT, UPDATED_AT, CANCELED_AT
       FROM SCHEDULE_RESULT_ADJUSTMENT
       ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY CREATED_AT DESC, ID`,
      params,
    );

    return rows.map((row) => this.toDto(row));
  }

  async getRecommendations(resultId: string) {
    if (!resultId) throw new BadRequestException('resultId 不能为空');
    const result = await this.loadResult(resultId);
    await this.ensureResultIsLatest(result.ID);
    this.ensureWorkShift(result.SHIFT_NAME);

    const active = await this.loadActiveAdjustment(result.ID);
    if (active) {
      throw new BadRequestException('该排班结果已有生效临时调整');
    }
    if (await this.hasActiveSwap(result.ID)) {
      throw new BadRequestException('该排班结果已有生效换班');
    }

    const candidates = await this.buildRecommendations(result);
    return {
      resultId,
      workDate: this.formatDate(result.WORK_DATE),
      shift: result.SHIFT_NAME,
      originalPersonName: result.PERSON_NAME,
      recommendations: candidates,
    };
  }

  async create(rawPayload: unknown) {
    const payload = this.parseCreatePayload(rawPayload);
    const result = await this.loadResult(payload.resultId);
    await this.ensureResultIsLatest(result.ID);
    this.ensureWorkShift(result.SHIFT_NAME);

    const replacement = await this.loadMemberByName(payload.replacementPersonName);
    if (!replacement) throw new BadRequestException('替班人员不存在或未启用');

    const recommendations = await this.buildRecommendations(result);
    const selected = recommendations.find((item) => item.personName === replacement.NAME);
    if (!selected) {
      throw new BadRequestException('替班人员不满足当天可用条件');
    }

    const id = randomUUID();
    await this.databaseService.transaction(async (connection) => {
      await this.lockScheduleResult(connection, result.ID);
      await this.ensureResultIsLatestForUpdate(connection, result.ID);
      await this.ensureResultAvailableForAdjustment(connection, result.ID);
      await connection.execute(
        `INSERT INTO SCHEDULE_RESULT_ADJUSTMENT
           (ID, RESULT_ID, JOB_ID, WORK_DATE, SHIFT_NAME, ORIGINAL_MEMBER_ID, ORIGINAL_PERSON_NAME, ORIGINAL_TEAM,
            REPLACEMENT_MEMBER_ID, REPLACEMENT_PERSON_NAME, REPLACEMENT_TEAM, REPLACEMENT_ROLE_NAME, REPLACEMENT_SKILLS_TEXT,
            LEAVE_TYPE, REASON, STATUS)
         VALUES
           (:id, :resultId, :jobId, TO_DATE(:workDate, 'YYYY-MM-DD'), :shiftName, :originalMemberId, :originalPersonName, :originalTeam,
            :replacementMemberId, :replacementPersonName, :replacementTeam, :replacementRoleName, :replacementSkillsText,
            :leaveType, :reason, N'生效')`,
        {
          id,
          resultId: result.ID,
          jobId: result.JOB_ID,
          workDate: this.formatDate(result.WORK_DATE),
          shiftName: result.SHIFT_NAME,
          originalMemberId: result.MEMBER_ID,
          originalPersonName: result.PERSON_NAME,
          originalTeam: result.ACTUAL_TEAM ?? result.TEAM,
          replacementMemberId: replacement.ID,
          replacementPersonName: replacement.NAME,
          replacementTeam: replacement.TEAM,
          replacementRoleName: replacement.ROLE,
          replacementSkillsText: replacement.SKILLS ?? '',
          leaveType: payload.leaveType,
          reason: payload.reason || null,
        },
      );
    });

    return { id, resultId: result.ID, status: '生效' };
  }

  async cancel(id: string) {
    const rows = await this.databaseService.query<{ ID: string; STATUS: string }>(
      'SELECT ID, STATUS FROM SCHEDULE_RESULT_ADJUSTMENT WHERE ID = :id',
      { id },
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('临时调整记录不存在');
    if (row.STATUS !== '生效') return { id, status: row.STATUS };

    await this.databaseService.execute(
      `UPDATE SCHEDULE_RESULT_ADJUSTMENT
       SET STATUS = N'已撤销',
           UPDATED_AT = CURRENT_TIMESTAMP,
           CANCELED_AT = CURRENT_TIMESTAMP
       WHERE ID = :id`,
      { id },
    );

    return { id, status: '已撤销' };
  }

  private async buildRecommendations(result: ScheduleResultRow) {
    const workDate = this.formatDate(result.WORK_DATE);
    const members = (await this.loadAvailableMembers()).map((member) => ({
      ...member,
      skills: this.parseSkills(member.SKILLS),
    }));
    const dayRows = await this.loadEffectiveDayRows(result.JOB_ID, workDate);
    const unavailableByTempLeave = await this.loadTempLeavePeople(workDate);
    const absentPeople = await this.loadAbsentPeople(workDate);
    const unavailableBySwap = await this.loadSwapPeople(workDate);
    const restRecordPeople = new Set(
      dayRows
        .filter((row) => row.RESULT_ID !== result.ID && row.SHIFT_NAME === '休息')
        .map((row) => row.PERSON_NAME),
    );
    const assignedPeople = new Set(
      dayRows
        .filter((row) => row.RESULT_ID !== result.ID && row.SHIFT_NAME !== '休息')
        .map((row) => row.PERSON_NAME),
    );
    const restTeam = this.inferRestTeam(dayRows);
    const originalTeam = result.ACTUAL_TEAM ?? result.TEAM;
    const originalSkills = this.parseSkills(result.SKILLS_TEXT);

    const recommendations: AdjustmentRecommendation[] = members
      .filter((member) => member.NAME !== result.PERSON_NAME)
      .filter((member) => !assignedPeople.has(member.NAME))
      .filter((member) => !absentPeople.has(member.NAME))
      .filter((member) => !unavailableByTempLeave.has(member.NAME))
      .filter((member) => !unavailableBySwap.has(member.NAME))
      .map((member) => {
        const warnings: string[] = [];
        if (member.ROLE !== result.ROLE_NAME) warnings.push('角色不完全一致');
        const missingSkills = originalSkills.filter((skill) => !member.skills.some((item) => item.includes(skill)));
        if (missingSkills.length > 0) warnings.push(`缺少技能：${missingSkills.join('、')}`);
        const riskScore = (member.ROLE === result.ROLE_NAME ? 0 : 10) + missingSkills.length * 5;

        const isRestRecordCandidate = restRecordPeople.has(member.NAME);
        const teamPriority = member.TEAM === originalTeam ? 0 : isRestRecordCandidate ? 1 : 2;
        const sourceType: AdjustmentRecommendation['sourceType'] =
          isRestRecordCandidate
            ? '休息班次'
            : member.TEAM === originalTeam
            ? '同班组'
            : member.TEAM === restTeam
              ? '休息班组'
              : '其他班组';
        const riskLevel: AdjustmentRecommendation['riskLevel'] = riskScore === 0 ? '低风险' : '有风险';

        return {
          memberId: member.ID,
          personName: member.NAME,
          team: member.TEAM,
          role: member.ROLE,
          skills: member.skills,
          priority: teamPriority,
          reason: riskScore === 0
            ? `${sourceType}，低风险，角色和技能匹配`
            : `${sourceType}，兜底推荐，影响最小`,
          warnings,
          sourceType,
          riskLevel,
          riskScore,
        };
      })
      .sort((a, b) => {
        if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore;
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.team !== b.team) return a.team.localeCompare(b.team, 'zh-Hans-CN');
        return a.personName.localeCompare(b.personName, 'zh-Hans-CN');
      });

    const lowRisk = recommendations.filter((item) => item.riskScore === 0);
    if (lowRisk.length > 0) return lowRisk;

    const minRiskScore = recommendations[0]?.riskScore;
    return minRiskScore === undefined
      ? []
      : recommendations.filter((item) => item.riskScore === minRiskScore);
  }

  private parseCreatePayload(rawPayload: unknown) {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new BadRequestException('请求体不能为空');
    }
    const payload = rawPayload as CreateAdjustmentPayload;
    const resultId = this.requiredText(payload.resultId, 'resultId');
    const leaveType = this.requiredText(payload.leaveType, 'leaveType');
    const replacementPersonName = this.requiredText(payload.replacementPersonName, 'replacementPersonName');
    const reason = this.optionalText(payload.reason);

    if (!LEAVE_TYPES.includes(leaveType)) {
      throw new BadRequestException(`请假类型只能是：${LEAVE_TYPES.join('、')}`);
    }

    return { resultId, leaveType, reason, replacementPersonName };
  }

  private async loadResult(id: string) {
    const rows = await this.databaseService.query<ScheduleResultRow>(
      `SELECT ID, JOB_ID, WORK_DATE, SHIFT_NAME, TEAM, MEMBER_ID, PERSON_NAME, ROLE_NAME, SKILLS_TEXT, ACTUAL_TEAM
       FROM SCHEDULE_RESULT
       WHERE ID = :id`,
      { id },
    );
    if (!rows[0]) throw new NotFoundException('排班结果不存在');
    return rows[0];
  }

  private async loadActiveAdjustment(resultId: string) {
    const rows = await this.databaseService.query<{ ID: string }>(
      `SELECT ID
       FROM SCHEDULE_RESULT_ADJUSTMENT
       WHERE RESULT_ID = :resultId AND STATUS = N'生效'
       FETCH FIRST 1 ROWS ONLY`,
      { resultId },
    );
    return rows[0] ?? null;
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

  private async lockScheduleResult(connection: oracledb.Connection, resultId: string) {
    await connection.execute(
      'SELECT ID FROM SCHEDULE_RESULT WHERE ID = :resultId FOR UPDATE',
      { resultId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
  }

  private ensureWorkShift(shiftName: string) {
    if (shiftName === '休息') {
      throw new BadRequestException('休息记录只能作为替班候选，不能作为请假替班源班次');
    }
  }

  private async ensureResultIsLatest(resultId: string) {
    const rows = await this.databaseService.query<{ CNT: number }>(
      this.latestResultSql(),
      { resultId },
    );
    if (Number(rows[0]?.CNT ?? 0) === 0) {
      throw new BadRequestException('只能对当前最新版本的排班结果进行临时调整');
    }
  }

  private async ensureResultIsLatestForUpdate(connection: oracledb.Connection, resultId: string) {
    const latestCount = await this.countWithConnection(connection, this.latestResultSql(), { resultId });
    if (latestCount === 0) {
      throw new BadRequestException('只能对当前最新版本的排班结果进行临时调整');
    }
  }

  private async ensureResultAvailableForAdjustment(connection: oracledb.Connection, resultId: string) {
    const activeAdjustmentCount = await this.countWithConnection(
      connection,
      `SELECT COUNT(*) AS CNT
       FROM SCHEDULE_RESULT_ADJUSTMENT
       WHERE RESULT_ID = :resultId AND STATUS = N'生效'`,
      { resultId },
    );
    if (activeAdjustmentCount > 0) {
      throw new BadRequestException('该排班结果已有生效临时调整');
    }

    const activeSwapCount = await this.countWithConnection(
      connection,
      `SELECT COUNT(*) AS CNT
       FROM SCHEDULE_RESULT_SWAP
       WHERE STATUS = N'生效'
         AND (SOURCE_RESULT_ID = :resultId OR TARGET_RESULT_ID = :resultId)`,
      { resultId },
    );
    if (activeSwapCount > 0) {
      throw new BadRequestException('该排班结果已有生效换班');
    }
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

  private latestResultSql() {
    return `
      WITH target_result AS (
        SELECT WORK_DATE
        FROM SCHEDULE_RESULT
        WHERE ID = :resultId
      ),
      latest_job AS (
        SELECT JOB_ID
        FROM (
          SELECT
            sj.ID AS JOB_ID,
            ROW_NUMBER() OVER (ORDER BY sj.CREATED_AT DESC, sj.ID DESC) AS RN
          FROM SCHEDULE_JOB sj
          JOIN target_result target
            ON target.WORK_DATE BETWEEN sj.START_DATE AND sj.END_DATE
          WHERE EXISTS (
            SELECT 1
            FROM SCHEDULE_RESULT sr2
            WHERE sr2.JOB_ID = sj.ID
              AND sr2.WORK_DATE = target.WORK_DATE
          )
        )
        WHERE RN = 1
      )
      SELECT COUNT(*) AS CNT
      FROM SCHEDULE_RESULT sr
      JOIN latest_job latest
        ON latest.JOB_ID = sr.JOB_ID
      WHERE sr.ID = :resultId`;
  }

  private async loadMemberByName(personName: string) {
    const rows = await this.databaseService.query<TeamMemberRow>(
      `SELECT tm.ID, tm.NAME, tm.TEAM, tm.ROLE, tm.STATUS,
              LISTAGG(tms.SKILL_NAME, ',') WITHIN GROUP (ORDER BY tms.SKILL_NAME) AS SKILLS
       FROM TEAM_MEMBER tm
       LEFT JOIN TEAM_MEMBER_SKILL tms ON tms.MEMBER_ID = tm.ID
       WHERE tm.NAME = :personName
         AND (tm.STATUS IS NULL OR tm.STATUS <> N'停用')
       GROUP BY tm.ID, tm.NAME, tm.TEAM, tm.ROLE, tm.STATUS
       FETCH FIRST 1 ROWS ONLY`,
      { personName },
    );
    return rows[0] ?? null;
  }

  private async loadAvailableMembers() {
    return this.databaseService.query<TeamMemberRow>(`
      SELECT tm.ID, tm.NAME, tm.TEAM, tm.ROLE, tm.STATUS,
             LISTAGG(tms.SKILL_NAME, ',') WITHIN GROUP (ORDER BY tms.SKILL_NAME) AS SKILLS
      FROM TEAM_MEMBER tm
      LEFT JOIN TEAM_MEMBER_SKILL tms ON tms.MEMBER_ID = tm.ID
      WHERE tm.STATUS IS NULL OR tm.STATUS <> N'停用'
      GROUP BY tm.ID, tm.NAME, tm.TEAM, tm.ROLE, tm.STATUS
      ORDER BY tm.TEAM, tm.NAME
    `);
  }

  private async loadEffectiveDayRows(jobId: string, workDate: string) {
    return this.databaseService.query<EffectiveDayRow>(
      `SELECT
         sr.ID AS RESULT_ID,
         sr.SHIFT_NAME,
         COALESCE(adj.REPLACEMENT_PERSON_NAME, sr.PERSON_NAME) AS PERSON_NAME,
         COALESCE(adj.REPLACEMENT_TEAM, sr.ACTUAL_TEAM, sr.TEAM) AS ACTUAL_TEAM
       FROM SCHEDULE_RESULT sr
       LEFT JOIN SCHEDULE_RESULT_ADJUSTMENT adj
         ON adj.RESULT_ID = sr.ID
        AND adj.STATUS = N'生效'
       WHERE sr.JOB_ID = :jobId
         AND sr.WORK_DATE = TO_DATE(:workDate, 'YYYY-MM-DD')`,
      { jobId, workDate },
    );
  }

  private async loadTempLeavePeople(workDate: string) {
    const rows = await this.databaseService.query<{ ORIGINAL_PERSON_NAME: string }>(
      `SELECT ORIGINAL_PERSON_NAME
       FROM SCHEDULE_RESULT_ADJUSTMENT
       WHERE STATUS = N'生效'
         AND WORK_DATE = TO_DATE(:workDate, 'YYYY-MM-DD')`,
      { workDate },
    );
    return new Set(rows.map((row) => row.ORIGINAL_PERSON_NAME));
  }

  private async loadSwapPeople(workDate: string) {
    const rows = await this.databaseService.query<{ PERSON_NAME: string }>(
      `SELECT PERSON_NAME
       FROM (
         SELECT SOURCE_PERSON_NAME AS PERSON_NAME
         FROM SCHEDULE_RESULT_SWAP
         WHERE STATUS = N'生效'
           AND SOURCE_WORK_DATE = TO_DATE(:workDate, 'YYYY-MM-DD')
         UNION
         SELECT TARGET_PERSON_NAME AS PERSON_NAME
         FROM SCHEDULE_RESULT_SWAP
         WHERE STATUS = N'生效'
           AND TARGET_WORK_DATE = TO_DATE(:workDate, 'YYYY-MM-DD')
       )`,
      { workDate },
    );
    return new Set(rows.map((row) => row.PERSON_NAME));
  }

  private async loadAbsentPeople(workDate: string) {
    const rows = await this.databaseService.query<{ PERSON_NAME: string }>(
      `SELECT PERSON_NAME
       FROM ATTENDANCE_RECORD
       WHERE STATUS <> N'正常'
         AND START_DATE <= TO_DATE(:workDate, 'YYYY-MM-DD')
         AND END_DATE >= TO_DATE(:workDate, 'YYYY-MM-DD')`,
      { workDate },
    );
    return new Set(rows.map((row) => row.PERSON_NAME));
  }

  private inferRestTeam(rows: EffectiveDayRow[]) {
    const workingTeams = new Set(
      rows
        .filter((row) => row.SHIFT_NAME === '早班' || row.SHIFT_NAME === '晚班')
        .map((row) => row.ACTUAL_TEAM),
    );
    return ['A1', 'A2', 'A3'].find((team) => !workingTeams.has(team));
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

  private toDto(row: AdjustmentRow) {
    return {
      id: row.ID,
      resultId: row.RESULT_ID,
      jobId: row.JOB_ID,
      date: this.formatDate(row.WORK_DATE),
      shift: row.SHIFT_NAME,
      originalPersonName: row.ORIGINAL_PERSON_NAME,
      originalTeam: row.ORIGINAL_TEAM ?? '',
      replacementPersonName: row.REPLACEMENT_PERSON_NAME,
      replacementTeam: row.REPLACEMENT_TEAM,
      replacementRole: row.REPLACEMENT_ROLE_NAME,
      replacementSkills: row.REPLACEMENT_SKILLS_TEXT ?? '',
      leaveType: row.LEAVE_TYPE,
      reason: row.REASON ?? '',
      status: row.STATUS,
      createdAt: row.CREATED_AT.toISOString(),
      updatedAt: row.UPDATED_AT.toISOString(),
      canceledAt: row.CANCELED_AT?.toISOString() ?? null,
    };
  }

  private formatDate(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
