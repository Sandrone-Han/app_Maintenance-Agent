import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type ScheduleResultRow = {
  ID: string;
  JOB_ID: string;
  WORK_DATE: Date;
  WEEKDAY_NAME: string | null;
  SHIFT_NAME: string;
  TEAM: string;
  PERSON_NAME: string;
  ROLE_NAME: string;
  SKILLS_TEXT: string | null;
  STATUS: string;
  IS_BORROWED: string | null;
  ORIGINAL_TEAM: string | null;
  ACTUAL_TEAM: string | null;
  BORROW_REASON: string | null;
  VALIDATION_RESULT: string | null;
  EXCEPTION_REASON: string | null;
  IS_ADJUSTED?: string;
  ADJUSTMENT_ID?: string | null;
  ADJUSTMENT_ORIGINAL_PERSON_NAME?: string | null;
  ADJUSTMENT_LEAVE_TYPE?: string | null;
  ADJUSTMENT_REASON?: string | null;
  IS_SWAPPED?: string;
  SWAP_ID?: string | null;
  SWAP_PEER_PERSON_NAME?: string | null;
  SWAP_REASON?: string | null;
};

type ScheduleResultForUpdateRow = ScheduleResultRow & {
  MEMBER_ID: string | null;
};

type AttendanceConflictRow = {
  PERSON_NAME: string;
};

type ScheduleResultUpdatePayload = {
  shiftName?: unknown;
  team?: unknown;
  personName?: unknown;
  roleName?: unknown;
  skillsText?: unknown;
  isBorrowed?: unknown;
  originalTeam?: unknown;
  actualTeam?: unknown;
  borrowReason?: unknown;
  validationResult?: unknown;
  exceptionReason?: unknown;
};

type NormalizedScheduleResultUpdate = {
  shiftName: string;
  team: string;
  personName: string;
  roleName: string;
  skillsText: string;
  status: string;
  isBorrowed: string;
  originalTeam: string;
  actualTeam: string;
  borrowReason: string | null;
  validationResult: string;
  exceptionReason: string | null;
};

@Injectable()
export class ScheduleResultService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(query: Record<string, string | undefined>) {
    const rows = await this.queryRows(query);
    return rows.map((row) => this.toDto(row));
  }

  async exportCsv(query: Record<string, string | undefined>) {
    const rows = await this.findAll(query);
    const header = [
      '日期',
      '星期',
      '班次',
      '班组',
      '人员',
      '角色',
      '技能',
      '是否借调',
      '原班组',
      '实际班组',
      '借调原因',
      '校验结果',
      '异常原因',
      '调整状态',
      '原人员',
      '调整原因',
      '换班状态',
      '换班对象',
      '换班原因',
    ];
    const body = rows.map((row) => [
      row.date,
      row.weekdayName,
      row.shift,
      row.team,
      row.personName,
      row.role,
      row.skills,
      row.isBorrowed,
      row.originalTeam,
      row.actualTeam,
      row.borrowReason,
      row.validationResult,
      row.exceptionReason,
      row.isAdjusted ? '已调整' : '原始',
      row.originalPersonName,
      row.adjustmentReason,
      row.isSwapped ? '已换班' : '未换班',
      row.swapPeerPersonName,
      row.swapReason,
    ]);

    return [header, ...body]
      .map((line) => line.map((cell) => this.escapeCsv(cell)).join(','))
      .join('\n');
  }

  async acknowledgeException(id: string) {
    await this.databaseService.execute(
      `UPDATE SCHEDULE_RESULT
       SET STATUS = '已确认异常',
           VALIDATION_RESULT = '已确认',
           EXCEPTION_REASON = CASE
             WHEN EXCEPTION_REASON IS NULL OR EXCEPTION_REASON = '' THEN '人工确认'
             WHEN EXCEPTION_REASON LIKE '已确认：%' THEN EXCEPTION_REASON
             ELSE '已确认：' || EXCEPTION_REASON
           END
       WHERE ID = :id`,
      { id },
    );

    return { id, status: '已确认异常', validationResult: '已确认' };
  }

  async updateResult(id: string, rawPayload: unknown) {
    const current = await this.loadResultForUpdate(id);
    if (await this.hasActiveAdjustment(id)) {
      throw new BadRequestException('该排班结果存在本周临时调整，请先撤销调整后再编辑原始排班');
    }
    if (await this.hasActiveSwap(id)) {
      throw new BadRequestException('该排班结果存在换班，请先撤销换班后再编辑原始排班');
    }
    const payload = this.parseUpdatePayload(rawPayload);
    const validationErrors = await this.validateManualUpdate(id, current, payload);
    if (['通过', '已确认'].includes(payload.validationResult) && validationErrors.length > 0) {
      throw new BadRequestException(`人工修正仍存在冲突：${validationErrors.join('；')}`);
    }

    await this.databaseService.execute(
      `UPDATE SCHEDULE_RESULT
       SET SHIFT_NAME = :shiftName,
           TEAM = :team,
           PERSON_NAME = :personName,
           ROLE_NAME = :roleName,
           SKILLS_TEXT = :skillsText,
           STATUS = :status,
           IS_BORROWED = :isBorrowed,
           ORIGINAL_TEAM = :originalTeam,
           ACTUAL_TEAM = :actualTeam,
           BORROW_REASON = :borrowReason,
           VALIDATION_RESULT = :validationResult,
           EXCEPTION_REASON = :exceptionReason
       WHERE ID = :id`,
      { id, ...payload },
    );

    return {
      id,
      status: payload.status,
      validationResult: payload.validationResult,
    };
  }

  private async ensureExists(id: string) {
    await this.loadResultForUpdate(id);
  }

  private async hasActiveAdjustment(resultId: string) {
    const rows = await this.databaseService.query<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT
       FROM SCHEDULE_RESULT_ADJUSTMENT
       WHERE RESULT_ID = :resultId AND STATUS = '生效'`,
      { resultId },
    );

    return Number(rows[0]?.CNT ?? 0) > 0;
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

  private async loadResultForUpdate(id: string) {
    const rows = await this.databaseService.query<ScheduleResultForUpdateRow>(
      `SELECT
         ID,
         JOB_ID,
         WORK_DATE,
         WEEKDAY_NAME,
         SHIFT_NAME,
         TEAM,
         MEMBER_ID,
         PERSON_NAME,
         ROLE_NAME,
         SKILLS_TEXT,
         STATUS,
         IS_BORROWED,
         ORIGINAL_TEAM,
         ACTUAL_TEAM,
         BORROW_REASON,
         VALIDATION_RESULT,
         EXCEPTION_REASON
       FROM SCHEDULE_RESULT
       WHERE ID = :id`,
      { id },
    );
    if (!rows[0]) throw new NotFoundException('排班结果不存在');
    return rows[0];
  }

  private async validateManualUpdate(
    id: string,
    current: ScheduleResultForUpdateRow,
    payload: NormalizedScheduleResultUpdate,
  ) {
    const errors: string[] = [];
    const date = this.formatDate(current.WORK_DATE);
    const dayRows = await this.databaseService.query<ScheduleResultRow>(
      `SELECT
         ID,
         JOB_ID,
         WORK_DATE,
         WEEKDAY_NAME,
         SHIFT_NAME,
         TEAM,
         PERSON_NAME,
         ROLE_NAME,
         SKILLS_TEXT,
         STATUS,
         IS_BORROWED,
         ORIGINAL_TEAM,
         ACTUAL_TEAM,
         BORROW_REASON,
         VALIDATION_RESULT,
         EXCEPTION_REASON
       FROM SCHEDULE_RESULT
       WHERE JOB_ID = :jobId
         AND WORK_DATE = TO_DATE(:workDate, 'YYYY-MM-DD')
         AND ID <> :id`,
      { jobId: current.JOB_ID, workDate: date, id },
    );

    const proposed = {
      SHIFT_NAME: payload.shiftName,
      PERSON_NAME: payload.personName,
      ACTUAL_TEAM: payload.actualTeam,
      TEAM: payload.team,
      IS_BORROWED: payload.isBorrowed,
      ORIGINAL_TEAM: payload.originalTeam,
    };
    const combined = [...dayRows, proposed];

    if (dayRows.some((row) => row.PERSON_NAME === payload.personName)) {
      errors.push(`${payload.personName} 当天已有其他班次`);
    }

    for (const shiftName of ['早班', '晚班']) {
      const teams = new Set(
        combined
          .filter((row) => row.SHIFT_NAME === shiftName)
          .map((row) => row.ACTUAL_TEAM ?? row.TEAM)
          .filter(Boolean),
      );
      if (teams.size > 1) {
        errors.push(`${shiftName} 存在多个实际班组：${Array.from(teams).join('、')}`);
      }
    }

    const earlyTeams = new Set(combined.filter((row) => row.SHIFT_NAME === '早班').map((row) => row.ACTUAL_TEAM ?? row.TEAM));
    const lateTeams = new Set(combined.filter((row) => row.SHIFT_NAME === '晚班').map((row) => row.ACTUAL_TEAM ?? row.TEAM));
    for (const team of earlyTeams) {
      if (lateTeams.has(team)) errors.push(`${team} 同一天同时存在早班和晚班`);
    }

    const absentRows = await this.databaseService.query<AttendanceConflictRow>(
      `SELECT PERSON_NAME
       FROM ATTENDANCE_RECORD
       WHERE PERSON_NAME = :personName
         AND STATUS <> '正常'
         AND START_DATE <= TO_DATE(:workDate, 'YYYY-MM-DD')
         AND END_DATE >= TO_DATE(:workDate, 'YYYY-MM-DD')`,
      { personName: payload.personName, workDate: date },
    );
    if (absentRows.length > 0) errors.push(`${payload.personName} 当天为休假/请假状态`);

    const restTeam = this.inferRestTeam(combined);
    if (payload.isBorrowed === '是' && restTeam && payload.originalTeam !== restTeam) {
      errors.push(`${payload.personName} 借调来源不是当天休息班组 ${restTeam}`);
    }

    return Array.from(new Set(errors));
  }

  private parseUpdatePayload(rawPayload: unknown): NormalizedScheduleResultUpdate {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new BadRequestException('请求体不能为空');
    }

    const payload = rawPayload as ScheduleResultUpdatePayload;
    const shiftName = this.requiredText(payload.shiftName, '班次');
    const team = this.requiredText(payload.team, '班组');
    const personName = this.requiredText(payload.personName, '人员');
    const roleName = this.requiredText(payload.roleName, '角色');
    const skillsText = this.optionalText(payload.skillsText);
    const isBorrowed = this.requiredText(payload.isBorrowed, '是否借调');
    const originalTeam = this.requiredText(payload.originalTeam, '原班组');
    const actualTeam = this.requiredText(payload.actualTeam, '实际班组');
    const borrowReason = this.optionalText(payload.borrowReason) || null;
    const validationResult = this.requiredText(payload.validationResult, '校验结果');
    const exceptionReason = this.optionalText(payload.exceptionReason) || null;

    if (!['早班', '晚班', '长白班', '休息'].includes(shiftName)) {
      throw new BadRequestException('班次只能是 早班、晚班、长白班、休息');
    }
    if (!['是', '否'].includes(isBorrowed)) {
      throw new BadRequestException('是否借调只能是 是 或 否');
    }
    if (!['通过', '不通过', '已确认'].includes(validationResult)) {
      throw new BadRequestException('校验结果只能是 通过、不通过、已确认');
    }
    if (validationResult === '不通过' && !exceptionReason) {
      throw new BadRequestException('校验结果为不通过时，异常原因不能为空');
    }

    return {
      shiftName,
      team,
      personName,
      roleName,
      skillsText,
      status: this.statusFromValidation(validationResult),
      isBorrowed,
      originalTeam,
      actualTeam,
      borrowReason,
      validationResult,
      exceptionReason,
    };
  }

  private requiredText(value: unknown, label: string) {
    const text = this.optionalText(value);
    if (!text) throw new BadRequestException(`${label}不能为空`);
    return text;
  }

  private optionalText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private statusFromValidation(validationResult: string) {
    if (validationResult === '通过') return '人工修正';
    if (validationResult === '已确认') return '已确认异常';
    return '异常';
  }

  private inferRestTeam(rows: Array<{ SHIFT_NAME: string; ACTUAL_TEAM: string | null; TEAM: string }>) {
    const workingTeams = new Set(
      rows
        .filter((row) => row.SHIFT_NAME === '早班' || row.SHIFT_NAME === '晚班')
        .map((row) => row.ACTUAL_TEAM ?? row.TEAM),
    );
    return ['A1', 'A2', 'A3'].find((team) => !workingTeams.has(team));
  }

  private async queryRows(query: Record<string, string | undefined>) {
    const filters: string[] = [];
    const params: Record<string, string> = {};

    if (query.jobId) {
      filters.push('sr.JOB_ID = :jobId');
      params.jobId = query.jobId;
    }
    if (query.team) {
      filters.push(`COALESCE(
        adj.REPLACEMENT_TEAM,
        CASE
          WHEN sws.ID IS NOT NULL THEN sws.TARGET_TEAM
          WHEN swt.ID IS NOT NULL THEN swt.SOURCE_TEAM
        END,
        sr.TEAM
      ) = :team`);
      params.team = query.team;
    }
    if (query.personName) {
      filters.push(`COALESCE(
        adj.REPLACEMENT_PERSON_NAME,
        CASE
          WHEN sws.ID IS NOT NULL THEN sws.TARGET_PERSON_NAME
          WHEN swt.ID IS NOT NULL THEN swt.SOURCE_PERSON_NAME
        END,
        sr.PERSON_NAME
      ) LIKE :personName`);
      params.personName = `%${query.personName}%`;
    }
    if (query.validationResult) {
      filters.push('sr.VALIDATION_RESULT = :validationResult');
      params.validationResult = query.validationResult;
    }
    if (query.startDate) {
      filters.push(`sr.WORK_DATE >= TO_DATE(:startDate, 'YYYY-MM-DD')`);
      params.startDate = query.startDate;
    }
    if (query.endDate) {
      filters.push(`sr.WORK_DATE <= TO_DATE(:endDate, 'YYYY-MM-DD')`);
      params.endDate = query.endDate;
    }
    const effectiveFilters = [
      ...filters,
      `NOT (
        sr.SHIFT_NAME = N'休息'
        AND EXISTS (
          SELECT 1
          FROM SCHEDULE_RESULT_ADJUSTMENT adj_consumed
          WHERE adj_consumed.JOB_ID = sr.JOB_ID
            AND adj_consumed.WORK_DATE = sr.WORK_DATE
            AND adj_consumed.REPLACEMENT_PERSON_NAME = sr.PERSON_NAME
            AND adj_consumed.STATUS = N'生效'
        )
      )`,
    ];

    const baseSource = query.jobId
      ? 'SCHEDULE_RESULT sr'
      : `SCHEDULE_RESULT sr
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
             ) dated
             JOIN SCHEDULE_JOB sj
               ON dated.WORK_DATE BETWEEN sj.START_DATE AND sj.END_DATE
           )
           WHERE RN = 1
         ) latest_job
           ON latest_job.WORK_DATE = sr.WORK_DATE
          AND latest_job.JOB_ID = sr.JOB_ID`;

    return this.databaseService.query<ScheduleResultRow>(
      `SELECT
         ID,
         JOB_ID,
         WORK_DATE,
         WEEKDAY_NAME,
         SHIFT_NAME,
         TEAM,
         PERSON_NAME,
         ROLE_NAME,
         SKILLS_TEXT,
         STATUS,
         IS_BORROWED,
         ORIGINAL_TEAM,
         ACTUAL_TEAM,
         BORROW_REASON,
         VALIDATION_RESULT,
         EXCEPTION_REASON,
         IS_ADJUSTED,
         ADJUSTMENT_ID,
         ADJUSTMENT_ORIGINAL_PERSON_NAME,
         ADJUSTMENT_LEAVE_TYPE,
         ADJUSTMENT_REASON,
         IS_SWAPPED,
         SWAP_ID,
         SWAP_PEER_PERSON_NAME,
         SWAP_REASON
       FROM (
         SELECT
           sr.ID,
           sr.JOB_ID,
           sr.WORK_DATE,
           sr.WEEKDAY_NAME,
           sr.SHIFT_NAME,
           COALESCE(
             adj.REPLACEMENT_TEAM,
             CASE
               WHEN sws.ID IS NOT NULL THEN sws.TARGET_TEAM
               WHEN swt.ID IS NOT NULL THEN swt.SOURCE_TEAM
             END,
             sr.TEAM
           ) AS TEAM,
           sr.MEMBER_ID,
           COALESCE(
             adj.REPLACEMENT_PERSON_NAME,
             CASE
               WHEN sws.ID IS NOT NULL THEN sws.TARGET_PERSON_NAME
               WHEN swt.ID IS NOT NULL THEN swt.SOURCE_PERSON_NAME
             END,
             sr.PERSON_NAME
           ) AS PERSON_NAME,
           COALESCE(
             adj.REPLACEMENT_ROLE_NAME,
             CASE
               WHEN sws.ID IS NOT NULL THEN sws.TARGET_ROLE_NAME
               WHEN swt.ID IS NOT NULL THEN swt.SOURCE_ROLE_NAME
             END,
             sr.ROLE_NAME
           ) AS ROLE_NAME,
           COALESCE(
             adj.REPLACEMENT_SKILLS_TEXT,
             CASE
               WHEN sws.ID IS NOT NULL THEN sws.TARGET_SKILLS_TEXT
               WHEN swt.ID IS NOT NULL THEN swt.SOURCE_SKILLS_TEXT
             END,
             sr.SKILLS_TEXT
           ) AS SKILLS_TEXT,
           CASE
             WHEN adj.ID IS NOT NULL THEN N'临时调整'
             WHEN sws.ID IS NOT NULL OR swt.ID IS NOT NULL THEN N'换班'
             ELSE sr.STATUS
           END AS STATUS,
           sr.IS_BORROWED,
           sr.ORIGINAL_TEAM,
           COALESCE(
             adj.REPLACEMENT_TEAM,
             CASE
               WHEN sws.ID IS NOT NULL THEN sws.TARGET_TEAM
               WHEN swt.ID IS NOT NULL THEN swt.SOURCE_TEAM
             END,
             sr.ACTUAL_TEAM,
             sr.TEAM
           ) AS ACTUAL_TEAM,
           CASE
             WHEN adj.ID IS NOT NULL THEN N'本周临时调整：' || adj.LEAVE_TYPE
             WHEN sws.ID IS NOT NULL OR swt.ID IS NOT NULL THEN N'换班'
             ELSE sr.BORROW_REASON
           END AS BORROW_REASON,
           sr.VALIDATION_RESULT,
           sr.EXCEPTION_REASON,
           CASE WHEN adj.ID IS NOT NULL THEN N'是' ELSE N'否' END AS IS_ADJUSTED,
           adj.ID AS ADJUSTMENT_ID,
           adj.ORIGINAL_PERSON_NAME AS ADJUSTMENT_ORIGINAL_PERSON_NAME,
           adj.LEAVE_TYPE AS ADJUSTMENT_LEAVE_TYPE,
           adj.REASON AS ADJUSTMENT_REASON,
           CASE WHEN sws.ID IS NOT NULL OR swt.ID IS NOT NULL THEN N'是' ELSE N'否' END AS IS_SWAPPED,
           COALESCE(sws.ID, swt.ID) AS SWAP_ID,
           CASE
             WHEN sws.ID IS NOT NULL THEN sws.TARGET_PERSON_NAME
             WHEN swt.ID IS NOT NULL THEN swt.SOURCE_PERSON_NAME
           END AS SWAP_PEER_PERSON_NAME,
           COALESCE(sws.REASON, swt.REASON) AS SWAP_REASON,
           ROW_NUMBER() OVER (
             PARTITION BY
               sr.WORK_DATE,
               sr.SHIFT_NAME,
               COALESCE(
                 adj.REPLACEMENT_PERSON_NAME,
                 CASE
                   WHEN sws.ID IS NOT NULL THEN sws.TARGET_PERSON_NAME
                   WHEN swt.ID IS NOT NULL THEN swt.SOURCE_PERSON_NAME
                 END,
                 sr.PERSON_NAME
               ),
               COALESCE(
                 adj.REPLACEMENT_TEAM,
                 CASE
                   WHEN sws.ID IS NOT NULL THEN sws.TARGET_TEAM
                   WHEN swt.ID IS NOT NULL THEN swt.SOURCE_TEAM
                 END,
                 sr.ACTUAL_TEAM,
                 sr.TEAM
               )
             ORDER BY sr.CREATED_AT DESC, sr.ID DESC
           ) AS RN
         FROM ${baseSource}
         LEFT JOIN SCHEDULE_RESULT_ADJUSTMENT adj
           ON adj.RESULT_ID = sr.ID
          AND adj.STATUS = N'生效'
         LEFT JOIN SCHEDULE_RESULT_SWAP sws
           ON sws.SOURCE_RESULT_ID = sr.ID
          AND sws.STATUS = N'生效'
          LEFT JOIN SCHEDULE_RESULT_SWAP swt
            ON swt.TARGET_RESULT_ID = sr.ID
           AND swt.STATUS = N'生效'
          WHERE ${effectiveFilters.join(' AND ')}
        )
      WHERE RN = 1
      ORDER BY
        WORK_DATE ASC,
        CASE SHIFT_NAME
          WHEN N'早班' THEN 1
          WHEN N'晚班' THEN 2
          WHEN N'长白班' THEN 3
          ELSE 9
        END,
        TEAM,
        PERSON_NAME`,
      params,
    );
  }

  private toDto(row: ScheduleResultRow) {
    return {
      id: row.ID,
      jobId: row.JOB_ID,
      date: this.formatDate(row.WORK_DATE),
      weekdayName: row.WEEKDAY_NAME ?? this.getWeekdayName(row.WORK_DATE),
      shift: row.SHIFT_NAME,
      team: row.TEAM,
      personName: row.PERSON_NAME,
      role: row.ROLE_NAME,
      skills: row.SKILLS_TEXT ?? '',
      status: row.STATUS,
      isBorrowed: row.IS_BORROWED ?? '否',
      originalTeam: row.ORIGINAL_TEAM ?? row.TEAM,
      actualTeam: row.ACTUAL_TEAM ?? row.TEAM,
      borrowReason: row.BORROW_REASON ?? '',
      validationResult: row.VALIDATION_RESULT ?? '通过',
      exceptionReason: row.EXCEPTION_REASON ?? '',
      isAdjusted: row.IS_ADJUSTED === '是',
      adjustmentId: row.ADJUSTMENT_ID ?? '',
      originalPersonName: row.ADJUSTMENT_ORIGINAL_PERSON_NAME ?? row.PERSON_NAME,
      adjustmentLeaveType: row.ADJUSTMENT_LEAVE_TYPE ?? '',
      adjustmentReason: row.ADJUSTMENT_REASON ?? '',
      isSwapped: row.IS_SWAPPED === '是',
      swapId: row.SWAP_ID ?? '',
      swapPeerPersonName: row.SWAP_PEER_PERSON_NAME ?? '',
      swapReason: row.SWAP_REASON ?? '',
    };
  }

  private formatDate(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  private getWeekdayName(date: Date) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  }

  private escapeCsv(value: unknown) {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
