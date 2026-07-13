import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type EmployeeAgentPayload = {
  message?: string;
  startDate?: string;
  endDate?: string;
};

type AgentIntent =
  | 'employee_profile'
  | 'schedule_history'
  | 'borrow_history'
  | 'exception_history'
  | 'attendance_history'
  | 'summary'
  | 'not_found';

type MemberRow = {
  ID: string;
  NAME: string;
  TEAM: string;
  SHIFT_TYPE: string;
  ROLE: string;
  STATUS: string;
  SKILLS: string | null;
};

type ScheduleRow = {
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
};

type AttendanceRow = {
  ID: string;
  PERSON_NAME: string;
  TEAM: string;
  START_DATE: Date;
  END_DATE: Date;
  STATUS: string;
  UPDATED_AT: Date;
};

type ParsedQuestion = {
  intent: AgentIntent;
  employeeName: string | null;
  startDate: string;
  endDate: string;
};

@Injectable()
export class EmployeeAgentService {
  constructor(private readonly databaseService: DatabaseService) {}

  async query(rawPayload: unknown) {
    const payload = this.parsePayload(rawPayload);
    const allMembers = await this.loadMembers();
    const parsed = this.parseMessage(payload, allMembers);

    if (!parsed.employeeName) {
      return {
        intent: 'not_found',
        employeeName: null,
        answer: '没有识别到员工姓名，请输入例如“查询张工未来7天排班”。',
        profile: null,
        stats: this.emptyStats(),
        schedules: [],
        attendance: [],
        suggestions: allMembers.slice(0, 6).map((member) => `查询${member.NAME}未来7天排班`),
      };
    }

    const matchedMembers = allMembers.filter((member) => member.NAME === parsed.employeeName);
    const member = matchedMembers[0];
    if (!member) {
      const candidates = this.findCandidateNames(payload.message, allMembers);
      return {
        intent: 'not_found',
        employeeName: parsed.employeeName,
        answer: `没有找到员工“${parsed.employeeName}”。`,
        profile: null,
        stats: this.emptyStats(),
        schedules: [],
        attendance: [],
        suggestions: candidates.length > 0 ? candidates.map((name) => `查询${name}个人信息`) : allMembers.slice(0, 6).map((item) => `查询${item.NAME}个人信息`),
      };
    }

    const schedules = await this.loadSchedules(member.NAME, parsed.startDate, parsed.endDate);
    const attendance = await this.loadAttendance(member.NAME, parsed.startDate, parsed.endDate);
    const stats = this.buildStats(schedules);
    const profile = this.toProfile(member);
    const answer = this.buildAnswer(parsed, profile, stats, schedules, attendance, matchedMembers.length > 1);

    return {
      intent: parsed.intent,
      employeeName: member.NAME,
      answer,
      profile,
      stats,
      schedules: this.filterSchedulesByIntent(parsed.intent, schedules).map((row) => this.toScheduleDto(row)),
      attendance: this.filterAttendanceByIntent(parsed.intent, attendance).map((row) => this.toAttendanceDto(row)),
      suggestions: [
        `查看${member.NAME}未来7天排班`,
        `查看${member.NAME}借调记录`,
        `查看${member.NAME}异常排班`,
        `查看${member.NAME}个人信息`,
      ],
    };
  }

  private parsePayload(rawPayload: unknown): Required<EmployeeAgentPayload> {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new BadRequestException('请求体不能为空');
    }

    const payload = rawPayload as EmployeeAgentPayload;
    const message = String(payload.message ?? '').trim();
    if (!message) throw new BadRequestException('message 不能为空');

    const defaultStart = new Date();
    const defaultEnd = this.addDays(defaultStart, 7);
    return {
      message,
      startDate: this.normalizeDate(payload.startDate) ?? this.formatDate(defaultStart),
      endDate: this.normalizeDate(payload.endDate) ?? this.formatDate(defaultEnd),
    };
  }

  // This is intentionally isolated so a future LLM parser can replace only this layer.
  private parseMessage(payload: Required<EmployeeAgentPayload>, members: MemberRow[]): ParsedQuestion {
    const message = payload.message;
    const member = members.find((item) => message.includes(item.NAME));
    const employeeName = member?.NAME ?? this.extractLikelyName(message, members);
    const range = { startDate: payload.startDate, endDate: payload.endDate };

    return {
      intent: this.detectIntent(message),
      employeeName,
      startDate: range.startDate,
      endDate: range.endDate,
    };
  }

  private detectIntent(message: string): AgentIntent {
    if (/(个人信息|档案|技能|班组|角色)/.test(message)) return 'employee_profile';
    if (/(借调)/.test(message)) return 'borrow_history';
    if (/(异常|不通过|确认)/.test(message)) return 'exception_history';
    if (/(休假|请假|出勤)/.test(message)) return 'attendance_history';
    if (/(排班|历史|记录|上班)/.test(message)) return 'schedule_history';
    return 'summary';
  }

  private extractLikelyName(message: string, members: MemberRow[]) {
    const clean = message.replace(/查询|查看|最近|未来|\d+|天|排班|历史|记录|个人信息|档案|技能|班组|角色|借调|异常|休假|请假|出勤|的/g, '');
    const candidate = clean.trim().slice(0, 10);
    if (!candidate) return null;
    return members.find((member) => member.NAME.includes(candidate) || candidate.includes(member.NAME))?.NAME ?? candidate;
  }

  private async loadMembers() {
    return this.databaseService.query<MemberRow>(`
      SELECT
        tm.ID,
        tm.NAME,
        tm.TEAM,
        tm.SHIFT_TYPE,
        tm.ROLE,
        tm.STATUS,
        LISTAGG(tms.SKILL_NAME, ',') WITHIN GROUP (ORDER BY tms.SKILL_NAME) AS SKILLS
      FROM TEAM_MEMBER tm
      LEFT JOIN TEAM_MEMBER_SKILL tms ON tms.MEMBER_ID = tm.ID
      GROUP BY tm.ID, tm.NAME, tm.TEAM, tm.SHIFT_TYPE, tm.ROLE, tm.STATUS
      ORDER BY tm.NAME, tm.TEAM
    `);
  }

  private async loadSchedules(personName: string, startDate: string, endDate: string) {
    return this.databaseService.query<ScheduleRow>(
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
       FROM (
         SELECT
           sr.*,
           ROW_NUMBER() OVER (
             PARTITION BY sr.WORK_DATE, sr.SHIFT_NAME, sr.PERSON_NAME, NVL(sr.ACTUAL_TEAM, sr.TEAM)
             ORDER BY sr.CREATED_AT DESC, sr.ID DESC
           ) AS RN
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
              ) dated
              JOIN SCHEDULE_JOB sj
                ON dated.WORK_DATE BETWEEN sj.START_DATE AND sj.END_DATE
            )
            WHERE RN = 1
          ) latest_job
           ON latest_job.WORK_DATE = sr.WORK_DATE
          AND latest_job.JOB_ID = sr.JOB_ID
         WHERE sr.PERSON_NAME = :personName
           AND sr.WORK_DATE >= TO_DATE(:startDate, 'YYYY-MM-DD')
           AND sr.WORK_DATE <= TO_DATE(:endDate, 'YYYY-MM-DD')
       )
       WHERE RN = 1
       ORDER BY WORK_DATE DESC, SHIFT_NAME`,
      { personName, startDate, endDate },
    );
  }

  private async loadAttendance(personName: string, startDate: string, endDate: string) {
    return this.databaseService.query<AttendanceRow>(
      `SELECT ID, PERSON_NAME, TEAM, START_DATE, END_DATE, STATUS, UPDATED_AT
       FROM ATTENDANCE_RECORD
       WHERE PERSON_NAME = :personName
         AND END_DATE >= TO_DATE(:startDate, 'YYYY-MM-DD')
         AND START_DATE <= TO_DATE(:endDate, 'YYYY-MM-DD')
       ORDER BY START_DATE DESC`,
      { personName, startDate, endDate },
    );
  }

  private buildStats(schedules: ScheduleRow[]) {
    return {
      total: schedules.length,
      early: schedules.filter((row) => row.SHIFT_NAME === '早班').length,
      late: schedules.filter((row) => row.SHIFT_NAME === '晚班').length,
      longDay: schedules.filter((row) => row.SHIFT_NAME === '长白班').length,
      borrowed: schedules.filter((row) => row.IS_BORROWED === '是').length,
      exceptions: schedules.filter((row) => row.VALIDATION_RESULT && row.VALIDATION_RESULT !== '通过').length,
    };
  }

  private buildAnswer(
    parsed: ParsedQuestion,
    profile: ReturnType<EmployeeAgentService['toProfile']>,
    stats: ReturnType<EmployeeAgentService['buildStats']>,
    schedules: ScheduleRow[],
    attendance: AttendanceRow[],
    duplicatedName: boolean,
  ) {
    const duplicateNote = duplicatedName ? '系统中存在同名员工，当前返回第一条匹配记录。' : '';
    if (parsed.intent === 'employee_profile') {
      return `${profile.name} 属于 ${profile.team} 班组，班次类型为 ${profile.shiftType}，角色是 ${profile.role}，技能包括 ${profile.skills.join('、') || '暂无技能'}。${duplicateNote}`;
    }
    if (parsed.intent === 'borrow_history') {
      return `${profile.name} 在 ${parsed.startDate} 至 ${parsed.endDate} 共被借调 ${stats.borrowed} 次。${duplicateNote}`;
    }
    if (parsed.intent === 'exception_history') {
      return `${profile.name} 在 ${parsed.startDate} 至 ${parsed.endDate} 有 ${stats.exceptions} 条异常或已确认异常排班记录。${duplicateNote}`;
    }
    if (parsed.intent === 'attendance_history') {
      return `${profile.name} 在 ${parsed.startDate} 至 ${parsed.endDate} 有 ${attendance.length} 条出勤/请假记录。${duplicateNote}`;
    }
    if (schedules.length === 0) {
      return `${profile.name} 在 ${parsed.startDate} 至 ${parsed.endDate} 没有查询到排班记录。${duplicateNote}`;
    }
    return `${profile.name} 在 ${parsed.startDate} 至 ${parsed.endDate} 共排班 ${stats.total} 次，其中早班 ${stats.early} 次、晚班 ${stats.late} 次、长白班 ${stats.longDay} 次、借调 ${stats.borrowed} 次、异常 ${stats.exceptions} 条。${duplicateNote}`;
  }

  private filterSchedulesByIntent(intent: AgentIntent, schedules: ScheduleRow[]) {
    if (intent === 'borrow_history') return schedules.filter((row) => row.IS_BORROWED === '是');
    if (intent === 'exception_history') return schedules.filter((row) => row.VALIDATION_RESULT && row.VALIDATION_RESULT !== '通过');
    if (intent === 'attendance_history') return [];
    if (intent === 'employee_profile') return schedules.slice(0, 10);
    return schedules;
  }

  private filterAttendanceByIntent(intent: AgentIntent, attendance: AttendanceRow[]) {
    return intent === 'attendance_history' || intent === 'summary' ? attendance : [];
  }

  private toProfile(row: MemberRow) {
    return {
      id: row.ID,
      name: row.NAME,
      team: row.TEAM,
      shiftType: row.SHIFT_TYPE,
      role: row.ROLE,
      status: row.STATUS,
      skills: row.SKILLS ? row.SKILLS.split(',') : [],
    };
  }

  private toScheduleDto(row: ScheduleRow) {
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
    };
  }

  private toAttendanceDto(row: AttendanceRow) {
    return {
      id: row.ID,
      personName: row.PERSON_NAME,
      team: row.TEAM,
      startDate: this.formatDate(row.START_DATE),
      endDate: this.formatDate(row.END_DATE),
      status: row.STATUS,
      updatedAt: row.UPDATED_AT.toISOString(),
    };
  }

  private findCandidateNames(message: string, members: MemberRow[]) {
    return members
      .filter((member) => message.includes(member.NAME.slice(0, 1)) || member.NAME.includes(message.slice(0, 1)))
      .slice(0, 6)
      .map((member) => member.NAME);
  }

  private emptyStats() {
    return { total: 0, early: 0, late: 0, longDay: 0, borrowed: 0, exceptions: 0 };
  }

  private normalizeDate(value?: string) {
    if (!value) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
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
}
