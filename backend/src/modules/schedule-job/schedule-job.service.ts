import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import {
  AttendanceRow,
  HistoricalScheduleResultRow,
  ScheduleEngineService,
  ScheduleResultInsert,
  SpecialRequirement,
  SpecialRequirementAction,
  TeamMemberRow,
  TeamScheduleRecordRow,
} from './schedule-engine.service';

type ScheduleJobPayload = {
  weekendMachineCount?: number;
  startDate?: string;
  endDate?: string;
  specialRequirements?: RawSpecialRequirement[];
};

type RawSpecialRequirement = {
  personName?: string;
  date?: string;
  shift?: string;
  action?: SpecialRequirementAction;
};

type NormalizedScheduleJobPayload = {
  weekendMachineCount: number;
  startDate: string;
  endDate: string;
  specialRequirements: SpecialRequirement[];
};

type JobRow = {
  ID: string;
  WEEKEND_MACHINE_COUNT: number;
  START_DATE: Date;
  END_DATE: Date;
  STATUS: string;
  ERROR_MESSAGE: string | null;
  CREATED_AT: Date;
  FINISHED_AT: Date | null;
};

type OptimizationSuggestion = {
  title: string;
  reason: string;
  action: string;
};

const SPECIAL_ACTIONS: SpecialRequirementAction[] = [
  'mustWork',
  'mustRest',
  'cannotWork',
  'cannotShift',
  'onlyShift',
];
const SHIFT_OPTIONS = ['早班', '晚班', '长白班'];
const ACTIONS_REQUIRING_SHIFT: SpecialRequirementAction[] = ['mustWork', 'cannotShift', 'onlyShift'];
const REST_ACTIONS: SpecialRequirementAction[] = ['mustRest', 'cannotWork'];
const WORK_ACTIONS: SpecialRequirementAction[] = ['mustWork', 'cannotShift', 'onlyShift'];

@Injectable()
// 排班任务服务：负责参数校验、加载上下文、调用排班引擎并落库结果。
export class ScheduleJobService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly scheduleEngineService: ScheduleEngineService,
  ) {}

  // 创建排班任务并立即执行，最终写入任务、结果、日志和班组轮换状态。
  async create(rawPayload: unknown) {
    const payload = this.parsePayload(rawPayload);
    const jobId = randomUUID();

    const teamMembers = await this.loadTeamMembers();
    this.validateSpecialRequirements(payload, teamMembers);
    const attendance = await this.loadAttendance();
    const teamScheduleRecords = await this.loadTeamScheduleRecords();
    const historicalResults = await this.loadHistoricalResults(payload.startDate);

    const result = this.scheduleEngineService.generate({
      jobId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      weekendMachineCount: payload.weekendMachineCount,
      teamMembers,
      attendance,
      teamScheduleRecords,
      historicalResults,
      specialRequirements: payload.specialRequirements,
    });

    // 任务结果和日志在同一事务内写入，避免只生成部分数据。
    await this.databaseService.transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO SCHEDULE_JOB
           (ID, WEEKEND_MACHINE_COUNT, START_DATE, END_DATE, STATUS, ERROR_MESSAGE, FINISHED_AT)
         VALUES
           (:id, :weekendMachineCount, TO_DATE(:startDate, 'YYYY-MM-DD'), TO_DATE(:endDate, 'YYYY-MM-DD'), :status, :errorMessage, CURRENT_TIMESTAMP)`,
        {
          id: jobId,
          weekendMachineCount: payload.weekendMachineCount,
          startDate: payload.startDate,
          endDate: payload.endDate,
          status: result.status,
          errorMessage: result.errorMessage,
        },
      );

      for (const request of payload.specialRequirements) {
        await connection.execute(
          `INSERT INTO SCHEDULE_SPECIAL_REQUEST (ID, JOB_ID, PERSON_NAME, REQUEST_DATE, SHIFT_NAME)
           VALUES (:id, :jobId, :personName, TO_DATE(:requestDate, 'YYYY-MM-DD'), :shiftName)`,
          {
            id: randomUUID(),
            jobId,
            personName: request.personName,
            requestDate: request.date,
            shiftName: `${request.action}:${request.shift}`,
          },
        );
      }

      for (const row of result.rows) {
        await this.insertScheduleResult(connection, row);
      }

      if (result.status !== 'FAILED') {
        for (const record of result.finalTeamRecords) {
          await connection.execute(
            `MERGE INTO TEAM_SCHEDULE_RECORD target
             USING (SELECT :team AS TEAM FROM DUAL) source
             ON (target.TEAM = source.TEAM)
             WHEN MATCHED THEN UPDATE SET
               CURRENT_SHIFT = :currentShift,
               CURRENT_SHIFT_DATE = TO_DATE(:currentShiftDate, 'YYYY-MM-DD'),
               NEXT_SHIFT = :nextShift,
               NEXT_SHIFT_DATE = TO_DATE(:nextShiftDate, 'YYYY-MM-DD'),
               UPDATED_AT = CURRENT_TIMESTAMP
             WHEN NOT MATCHED THEN INSERT
               (ID, TEAM, TYPE, CURRENT_SHIFT, CURRENT_SHIFT_DATE, NEXT_SHIFT, NEXT_SHIFT_DATE)
             VALUES
               (:id, :team, '早晚班', :currentShift, TO_DATE(:currentShiftDate, 'YYYY-MM-DD'), :nextShift, TO_DATE(:nextShiftDate, 'YYYY-MM-DD'))`,
            {
              id: randomUUID(),
              team: record.team,
              currentShift: record.currentShift,
              currentShiftDate: record.currentShiftDate,
              nextShift: record.nextShift,
              nextShiftDate: record.nextShiftDate,
            },
          );
        }
      }

      await this.writeLogs(connection, jobId, result.logs, result.status);
    });

    return {
      id: jobId,
      status: result.status,
      resultCount: result.rows.length,
      exceptionCount: result.exceptionCount,
      errorMessage: result.errorMessage,
      canPreview: result.rows.length > 0,
      nextActions: result.status === 'FAILED'
        ? ['查看失败预览并人工编辑', '按优化方案调整后重新生成']
        : [],
      optimizationSuggestions: this.buildOptimizationSuggestions(result.errorMessage),
      logs: result.logs,
    };
  }

  // 查询单个任务状态、结果数量和异常数量。
  async findOne(id: string) {
    const rows = await this.databaseService.query<JobRow>(
      `SELECT ID, WEEKEND_MACHINE_COUNT, START_DATE, END_DATE, STATUS, ERROR_MESSAGE, CREATED_AT, FINISHED_AT
       FROM SCHEDULE_JOB
       WHERE ID = :id`,
      { id },
    );

    const row = rows[0];
    if (!row) throw new NotFoundException('排班任务不存在');

    return {
      id: row.ID,
      weekendMachineCount: row.WEEKEND_MACHINE_COUNT,
      startDate: this.formatDate(row.START_DATE),
      endDate: this.formatDate(row.END_DATE),
      status: row.STATUS,
      errorMessage: row.ERROR_MESSAGE,
      optimizationSuggestions: this.buildOptimizationSuggestions(row.ERROR_MESSAGE),
      createdAt: row.CREATED_AT.toISOString(),
      finishedAt: row.FINISHED_AT?.toISOString() ?? null,
    };
  }

  // 查询任务执行日志，供前端流程区展示。
  async findLogs(id: string) {
    const rows = await this.databaseService.query<{
      ID: string;
      LEVEL_NAME: string;
      MESSAGE: string;
      CREATED_AT: Date;
    }>(
      `SELECT ID, LEVEL_NAME, MESSAGE, CREATED_AT
       FROM SCHEDULE_JOB_LOG
       WHERE JOB_ID = :id
       ORDER BY CREATED_AT, ID`,
      { id },
    );

    return rows.map((row) => ({
      id: row.ID,
      level: row.LEVEL_NAME,
      message: row.MESSAGE,
      createdAt: row.CREATED_AT.toISOString(),
    }));
  }

  // 删除排班任务记录。
  async remove(id: string) {
    await this.findOne(id);
    await this.databaseService.execute('DELETE FROM SCHEDULE_JOB WHERE ID = :id', { id });
    return { id };
  }

  // 解析并校验排班任务请求体，统一日期、开机数和特殊要求结构。
  private parsePayload(rawPayload: unknown): NormalizedScheduleJobPayload {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new BadRequestException('请求体不能为空');
    }

    const payload = rawPayload as ScheduleJobPayload;
    const weekendMachineCount = Number(payload.weekendMachineCount);

    if (!Number.isInteger(weekendMachineCount) || weekendMachineCount < 0) {
      throw new BadRequestException('weekendMachineCount 必须是非负整数');
    }

    if (!payload.startDate || !payload.endDate) {
      throw new BadRequestException('startDate 和 endDate 不能为空');
    }

    const startDate = this.requiredDateText(payload.startDate, 'startDate');
    const endDate = this.requiredDateText(payload.endDate, 'endDate');

    if (this.dateTime(startDate) > this.dateTime(endDate)) {
      throw new BadRequestException('endDate 不能早于 startDate');
    }

    const specialRequirements = (payload.specialRequirements ?? []).map((request) => {
      const personName = this.optionalText(request.personName);
      if (!personName || !request.date) {
        throw new BadRequestException('特殊排班要求必须包含 personName 和 date');
      }
      const date = this.requiredDateText(request.date, '特殊排班要求日期');
      if (this.dateTime(date) < this.dateTime(startDate) || this.dateTime(date) > this.dateTime(endDate)) {
        throw new BadRequestException(`${personName} 的特殊排班要求日期必须在本次排班范围内`);
      }

      const action = request.action ?? 'mustWork';
      if (!SPECIAL_ACTIONS.includes(action)) {
        throw new BadRequestException(`不支持的特殊排班动作：${action}`);
      }

      const needsShift = ACTIONS_REQUIRING_SHIFT.includes(action);
      const shift = needsShift ? this.optionalText(request.shift) : '';
      if (needsShift && !shift) {
        throw new BadRequestException('该特殊排班要求必须选择 shift');
      }
      if (needsShift && !SHIFT_OPTIONS.includes(shift)) {
        throw new BadRequestException(`特殊排班要求班次只能是：${SHIFT_OPTIONS.join('、')}`);
      }

      return {
        personName,
        date,
        shift,
        action,
      };
    });

    return {
      weekendMachineCount,
      startDate,
      endDate,
      specialRequirements,
    };
  }

  // 校验特殊要求中的人员存在性、日期范围和动作冲突。
  private validateSpecialRequirements(payload: NormalizedScheduleJobPayload, members: TeamMemberRow[]) {
    const memberNames = new Set(members.map((member) => member.NAME));
    const grouped = new Map<string, SpecialRequirement[]>();

    for (const requirement of payload.specialRequirements) {
      if (!memberNames.has(requirement.personName)) {
        throw new BadRequestException(`特殊排班人员不存在或已停用：${requirement.personName}`);
      }

      const key = `${requirement.date}::${requirement.personName}`;
      grouped.set(key, [...(grouped.get(key) ?? []), requirement]);
    }

    for (const requirements of grouped.values()) {
      this.validateSpecialRequirementGroup(requirements);
    }
  }

  // 校验同一人同一天的特殊要求组合是否自相矛盾。
  private validateSpecialRequirementGroup(requirements: SpecialRequirement[]) {
    const sample = requirements[0];
    const label = `${sample.personName} ${sample.date}`;
    const actions = requirements.map((item) => item.action);

    if (actions.some((action) => REST_ACTIONS.includes(action)) && actions.some((action) => WORK_ACTIONS.includes(action))) {
      throw new BadRequestException(`${label} 不能同时设置休息/不能上班和上班/班次要求`);
    }

    const mustWorkShifts = this.distinctShifts(requirements, 'mustWork');
    if (mustWorkShifts.length > 1) {
      throw new BadRequestException(`${label} 不能同时指定必须上多个班次`);
    }

    const onlyShifts = this.distinctShifts(requirements, 'onlyShift');
    if (onlyShifts.length > 1) {
      throw new BadRequestException(`${label} 不能同时设置多个“只能上”班次`);
    }

    const cannotShifts = new Set(this.distinctShifts(requirements, 'cannotShift'));
    const mustWorkShift = mustWorkShifts[0];
    const onlyShift = onlyShifts[0];

    if (mustWorkShift && cannotShifts.has(mustWorkShift)) {
      throw new BadRequestException(`${label} 不能同时设置必须上${mustWorkShift}和不能上${mustWorkShift}`);
    }
    if (onlyShift && cannotShifts.has(onlyShift)) {
      throw new BadRequestException(`${label} 不能同时设置只能上${onlyShift}和不能上${onlyShift}`);
    }
    if (mustWorkShift && onlyShift && mustWorkShift !== onlyShift) {
      throw new BadRequestException(`${label} 的必须上班次和只能上班次不一致`);
    }
  }

  private distinctShifts(requirements: SpecialRequirement[], action: SpecialRequirementAction) {
    return Array.from(new Set(requirements.filter((item) => item.action === action).map((item) => item.shift)));
  }

  // 将失败原因转成前端可展示的优化建议。
  private buildOptimizationSuggestions(errorMessage: string | null): OptimizationSuggestion[] {
    const reasons = (errorMessage ?? '').split('；').map((item) => item.trim()).filter(Boolean);
    if (reasons.length === 0) return [];

    const suggestions: OptimizationSuggestion[] = [];
    const add = (title: string, reason: string, action: string) => {
      if (suggestions.some((item) => item.title === title && item.action === action)) return;
      suggestions.push({ title, reason, action });
    };

    for (const reason of reasons) {
      if (/人数不足/.test(reason)) {
        add(
          '补足班次人数',
          reason,
          '优先恢复可出勤人员或启用休息班组候选；如果是周末低开机，可降低开机数后重新生成。',
        );
      }
      if (/缺组长/.test(reason)) {
        add(
          '补充组长',
          reason,
          '检查当班组长是否休假或停用；必要时从休息班组借调组长，或在失败预览中手动指定具备组长角色的人员。',
        );
      }
      if (/缺组员/.test(reason)) {
        add(
          '补充组员',
          reason,
          '检查该班组可出勤组员数量；可撤销冲突休假、借调休息班次人员，或手动调整该班次人员。',
        );
      }
      if (/缺电工/.test(reason)) {
        add(
          '补充电工技能',
          reason,
          '优先选择休息班组中具备电工技能的低负荷人员；若没有候选，需要先维护人员技能或调整休假记录。',
        );
      }
      if (/缺注塑维修/.test(reason)) {
        add(
          '补充注塑维修技能',
          reason,
          '优先选择休息班组中具备注塑维修技能的人员；若没有候选，需要先维护人员技能或调整休假记录。',
        );
      }
      if (/当天为休假\/请假状态/.test(reason)) {
        add(
          '处理休假冲突',
          reason,
          '确认休假信息是否正确；若人员确实休假，使用失败预览手动替换人员后保存，或调整休假后重新生成。',
        );
      }
      if (/特殊要求/.test(reason)) {
        add(
          '调整特殊要求',
          reason,
          '特殊要求与休息、请假或班次冲突时，先修改特殊要求日期/班次/人员，再重新生成。',
        );
      }
      if (/连续上班|休息间隔不足/.test(reason)) {
        add(
          '修正连续排班冲突',
          reason,
          '优先换用本周低负荷或休息班次人员；必要时在失败预览中拆分连续班次并重新确认。',
        );
      }
      if (/借调来源不是当天实际休息班组/.test(reason)) {
        add(
          '修正借调来源',
          reason,
          '借调只能来自当天实际休息班组；请在失败预览中改为休息班组人员，或重新生成让轮换恢复后再处理。',
        );
      }
    }

    if (suggestions.length === 0) {
      add(
        '查看失败预览并人工修正',
        reasons[0],
        '打开本次失败任务结果，逐条查看异常原因；可编辑人员、班组、班次、借调状态后保存。',
      );
    }

    return suggestions;
  }

  private requiredDateText(value: unknown, label: string) {
    const text = this.optionalText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(this.dateTime(text))) {
      throw new BadRequestException(`${label} 必须是 YYYY-MM-DD 格式`);
    }
    return text;
  }

  private dateTime(date: string) {
    return new Date(`${date}T00:00:00`).getTime();
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  // 读取可排班人员及技能，作为排班引擎输入。
  private async loadTeamMembers() {
    return this.databaseService.query<TeamMemberRow>(`
      SELECT
        tm.ID,
        tm.NAME,
        tm.TEAM,
        tm.SHIFT_TYPE,
        tm.ROLE,
        LISTAGG(tms.SKILL_NAME, ',') WITHIN GROUP (ORDER BY tms.SKILL_NAME) AS SKILLS
      FROM TEAM_MEMBER tm
      LEFT JOIN TEAM_MEMBER_SKILL tms ON tms.MEMBER_ID = tm.ID
      WHERE tm.STATUS IS NULL OR tm.STATUS <> '停用'
      GROUP BY tm.ID, tm.NAME, tm.TEAM, tm.SHIFT_TYPE, tm.ROLE
      ORDER BY tm.TEAM, tm.ID
    `);
  }

  // 读取出勤/请假记录，用于排班时避开不可上班人员。
  private async loadAttendance() {
    return this.databaseService.query<AttendanceRow>(`
      SELECT PERSON_NAME, START_DATE, END_DATE, STATUS
      FROM ATTENDANCE_RECORD
      WHERE STATUS <> '正常'
    `);
  }

  // 读取班组轮换记录，保持新排班和历史轮换连续。
  private async loadTeamScheduleRecords() {
    return this.databaseService.query<TeamScheduleRecordRow>(`
      SELECT TEAM, CURRENT_SHIFT, CURRENT_SHIFT_DATE, NEXT_SHIFT, NEXT_SHIFT_DATE
      FROM TEAM_SCHEDULE_RECORD
      WHERE TEAM IN ('A1', 'A2', 'A3')
    `);
  }

  // 读取排班开始前的历史结果，用于判断连续上班和休息间隔。
  private async loadHistoricalResults(startDate: string) {
    return this.databaseService.query<HistoricalScheduleResultRow>(
      `SELECT
         sr.WORK_DATE,
         sr.SHIFT_NAME,
         COALESCE(
           adj.REPLACEMENT_TEAM,
           CASE
             WHEN sws.ID IS NOT NULL THEN sws.TARGET_TEAM
             WHEN swt.ID IS NOT NULL THEN swt.SOURCE_TEAM
           END,
           sr.TEAM
         ) AS TEAM,
         COALESCE(
           adj.REPLACEMENT_TEAM,
           CASE
             WHEN sws.ID IS NOT NULL THEN sws.TARGET_TEAM
             WHEN swt.ID IS NOT NULL THEN swt.SOURCE_TEAM
           END,
           sr.ACTUAL_TEAM,
           sr.TEAM
         ) AS ACTUAL_TEAM,
         COALESCE(
           adj.REPLACEMENT_PERSON_NAME,
           CASE
             WHEN sws.ID IS NOT NULL THEN sws.TARGET_PERSON_NAME
             WHEN swt.ID IS NOT NULL THEN swt.SOURCE_PERSON_NAME
           END,
           sr.PERSON_NAME
         ) AS PERSON_NAME,
         sr.IS_BORROWED
       FROM SCHEDULE_RESULT sr
       JOIN (
         SELECT WORK_DATE, JOB_ID
         FROM (
           SELECT
             dated.WORK_DATE,
             sj.ID AS JOB_ID,
             ROW_NUMBER() OVER (
               PARTITION BY dated.WORK_DATE
               ORDER BY sj.CREATED_AT DESC, sj.ID DESC
             ) AS RN
           FROM (
             SELECT DISTINCT WORK_DATE
             FROM SCHEDULE_RESULT
             WHERE WORK_DATE >= TO_DATE(:startDate, 'YYYY-MM-DD') - 7
               AND WORK_DATE < TO_DATE(:startDate, 'YYYY-MM-DD')
           ) dated
           JOIN SCHEDULE_JOB sj
             ON dated.WORK_DATE BETWEEN sj.START_DATE AND sj.END_DATE
         )
         WHERE RN = 1
       ) latest_job
         ON latest_job.WORK_DATE = sr.WORK_DATE
        AND latest_job.JOB_ID = sr.JOB_ID
       LEFT JOIN SCHEDULE_RESULT_ADJUSTMENT adj
         ON adj.RESULT_ID = sr.ID
        AND adj.STATUS = N'生效'
       LEFT JOIN SCHEDULE_RESULT_SWAP sws
         ON sws.SOURCE_RESULT_ID = sr.ID
        AND sws.STATUS = N'生效'
       LEFT JOIN SCHEDULE_RESULT_SWAP swt
         ON swt.TARGET_RESULT_ID = sr.ID
        AND swt.STATUS = N'生效'
       WHERE sr.WORK_DATE >= TO_DATE(:startDate, 'YYYY-MM-DD') - 7
         AND sr.WORK_DATE < TO_DATE(:startDate, 'YYYY-MM-DD')
         AND sr.VALIDATION_RESULT IN ('通过', '已确认')
         AND NOT (
           sr.SHIFT_NAME = N'休息'
           AND EXISTS (
             SELECT 1
             FROM SCHEDULE_RESULT_ADJUSTMENT adj_consumed
             WHERE adj_consumed.JOB_ID = sr.JOB_ID
               AND adj_consumed.WORK_DATE = sr.WORK_DATE
               AND adj_consumed.REPLACEMENT_PERSON_NAME = sr.PERSON_NAME
               AND adj_consumed.STATUS = N'生效'
           )
         )
       ORDER BY sr.WORK_DATE, sr.SHIFT_NAME`,
      { startDate },
    );
  }

  // 写入排班结果明细，包含借调、校验、异常等字段。
  private async insertScheduleResult(
    connection: { execute: (sql: string, params?: Record<string, unknown>) => Promise<unknown> },
    row: ScheduleResultInsert,
  ) {
    await connection.execute(
      `INSERT INTO SCHEDULE_RESULT
         (ID, JOB_ID, WORK_DATE, WEEKDAY_NAME, SHIFT_NAME, TEAM, MEMBER_ID, PERSON_NAME, ROLE_NAME, SKILLS_TEXT, STATUS,
          IS_BORROWED, ORIGINAL_TEAM, ACTUAL_TEAM, BORROW_REASON, VALIDATION_RESULT, EXCEPTION_REASON)
       VALUES
         (:id, :jobId, TO_DATE(:workDate, 'YYYY-MM-DD'), :weekdayName, :shiftName, :team, :memberId, :personName, :roleName,
          :skillsText, :status, :isBorrowed, :originalTeam, :actualTeam, :borrowReason, :validationResult, :exceptionReason)`,
      row,
    );
  }

  // 批量写入任务执行日志。
  private async writeLogs(
    connection: { execute: (sql: string, params?: Record<string, unknown>) => Promise<unknown> },
    jobId: string,
    logs: string[],
    status: string,
  ) {
    const level = status === 'COMPLETED' ? 'INFO' : 'WARN';
    for (const message of logs) {
      await connection.execute(
        `INSERT INTO SCHEDULE_JOB_LOG (ID, JOB_ID, LEVEL_NAME, MESSAGE)
         VALUES (:id, :jobId, :levelName, :message)`,
        { id: randomUUID(), jobId, levelName: level, message },
      );
    }
  }

  // Oracle Date 转 yyyy-MM-dd。
  private formatDate(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
