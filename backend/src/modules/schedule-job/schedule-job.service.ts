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

@Injectable()
export class ScheduleJobService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly scheduleEngineService: ScheduleEngineService,
  ) {}

  async create(rawPayload: unknown) {
    const payload = this.parsePayload(rawPayload);
    const jobId = randomUUID();

    const teamMembers = await this.loadTeamMembers();
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
      logs: result.logs,
    };
  }

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
      createdAt: row.CREATED_AT.toISOString(),
      finishedAt: row.FINISHED_AT?.toISOString() ?? null,
    };
  }

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

  async remove(id: string) {
    await this.findOne(id);
    await this.databaseService.execute('DELETE FROM SCHEDULE_JOB WHERE ID = :id', { id });
    return { id };
  }

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

    if (new Date(payload.startDate) > new Date(payload.endDate)) {
      throw new BadRequestException('endDate 不能早于 startDate');
    }

    const allowedActions: SpecialRequirementAction[] = [
      'mustWork',
      'mustRest',
      'cannotWork',
      'cannotShift',
      'onlyShift',
    ];

    const specialRequirements = (payload.specialRequirements ?? []).map((request) => {
      if (!request.personName || !request.date) {
        throw new BadRequestException('特殊排班要求必须包含 personName 和 date');
      }

      const action = request.action ?? 'mustWork';
      if (!allowedActions.includes(action)) {
        throw new BadRequestException(`不支持的特殊排班动作：${action}`);
      }

      if (['mustWork', 'cannotShift', 'onlyShift'].includes(action) && !request.shift) {
        throw new BadRequestException('该特殊排班要求必须选择 shift');
      }

      return {
        personName: request.personName,
        date: request.date,
        shift: request.shift ?? '',
        action,
      };
    });

    return {
      weekendMachineCount,
      startDate: payload.startDate,
      endDate: payload.endDate,
      specialRequirements,
    };
  }

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

  private async loadAttendance() {
    return this.databaseService.query<AttendanceRow>(`
      SELECT PERSON_NAME, START_DATE, END_DATE, STATUS
      FROM ATTENDANCE_RECORD
      WHERE STATUS <> '正常'
    `);
  }

  private async loadTeamScheduleRecords() {
    return this.databaseService.query<TeamScheduleRecordRow>(`
      SELECT TEAM, CURRENT_SHIFT, CURRENT_SHIFT_DATE, NEXT_SHIFT, NEXT_SHIFT_DATE
      FROM TEAM_SCHEDULE_RECORD
      WHERE TEAM IN ('A1', 'A2', 'A3')
    `);
  }

  private async loadHistoricalResults(startDate: string) {
    return this.databaseService.query<HistoricalScheduleResultRow>(
      `SELECT sr.WORK_DATE, sr.SHIFT_NAME, sr.PERSON_NAME, sr.IS_BORROWED
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
       WHERE sr.WORK_DATE >= TO_DATE(:startDate, 'YYYY-MM-DD') - 7
         AND sr.WORK_DATE < TO_DATE(:startDate, 'YYYY-MM-DD')
         AND sr.VALIDATION_RESULT IN ('通过', '已确认')
       ORDER BY sr.WORK_DATE, sr.SHIFT_NAME`,
      { startDate },
    );
  }

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

  private formatDate(date: Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }
}
