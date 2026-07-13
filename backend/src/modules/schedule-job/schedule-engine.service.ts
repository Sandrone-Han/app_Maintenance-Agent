import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type TeamMemberRow = {
  ID: string;
  NAME: string;
  TEAM: string;
  SHIFT_TYPE: string;
  ROLE: string;
  SKILLS: string | null;
};

export type AttendanceRow = {
  PERSON_NAME: string;
  START_DATE: Date;
  END_DATE: Date;
  STATUS: string;
};

export type TeamScheduleRecordRow = {
  TEAM: string;
  CURRENT_SHIFT: string;
  CURRENT_SHIFT_DATE: Date;
  NEXT_SHIFT: string;
  NEXT_SHIFT_DATE: Date;
};

export type HistoricalScheduleResultRow = {
  WORK_DATE: Date;
  SHIFT_NAME: string;
  PERSON_NAME: string;
  IS_BORROWED: string | null;
};

export type SpecialRequirementAction =
  | 'mustWork'
  | 'mustRest'
  | 'cannotWork'
  | 'cannotShift'
  | 'onlyShift';

export type SpecialRequirement = {
  personName: string;
  date: string;
  shift: string;
  action: SpecialRequirementAction;
};

export type ScheduleResultInsert = {
  id: string;
  jobId: string;
  workDate: string;
  weekdayName: string;
  shiftName: string;
  team: string;
  memberId: string;
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

export type ScheduleEngineInput = {
  jobId: string;
  startDate: string;
  endDate: string;
  weekendMachineCount: number;
  teamMembers: TeamMemberRow[];
  attendance: AttendanceRow[];
  teamScheduleRecords: TeamScheduleRecordRow[];
  historicalResults: HistoricalScheduleResultRow[];
  specialRequirements: SpecialRequirement[];
};

export type ScheduleEngineOutput = {
  rows: ScheduleResultInsert[];
  logs: string[];
  exceptionCount: number;
  status: 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'FAILED';
  errorMessage: string | null;
  finalTeamRecords: Array<{
    team: string;
    currentShift: string;
    currentShiftDate: string;
    nextShift: string;
    nextShiftDate: string;
  }>;
};

type Member = TeamMemberRow & {
  skills: string[];
};

type Assignment = {
  member: Member;
  date: string;
  weekdayName: string;
  shiftName: string;
  actualTeam: string;
  isBorrowed: boolean;
  originalTeam: string;
  borrowReason: string | null;
};

type ShiftRequirement = {
  minCount: number;
  requireLeader: boolean;
  requireElectrician: boolean;
  requireInjection: boolean;
  ruleMissing?: string;
};

type ShiftContext = {
  earlyTeam?: string;
  lateTeam?: string;
  restTeam?: string;
};

type AssignmentLedger = {
  datesByPerson: Map<string, Set<string>>;
  eventsByPerson: Map<string, number[]>;
  borrowCountByPerson: Map<string, number>;
};

const A_TEAMS = ['A1', 'A2', 'A3'];
const CYCLE = ['早班', '早班', '晚班', '晚班', '休息', '休息'];
const DEFAULT_CYCLE_INDEX: Record<string, number> = {
  A1: 0,
  A2: 2,
  A3: 4,
};

@Injectable()
export class ScheduleEngineService {
  generate(input: ScheduleEngineInput): ScheduleEngineOutput {
    const logs: string[] = ['开始排班。'];
    const rows: ScheduleResultInsert[] = [];
    const exceptions: string[] = [];
    const dateList = this.buildDateList(input.startDate, input.endDate);
    const members = input.teamMembers.map((member) => ({
      ...member,
      skills: this.parseSkills(member.SKILLS),
    }));
    const ledger = this.buildInitialLedger(input.startDate, input.historicalResults);

    logs.push(`读取排班日期：${input.startDate} 至 ${input.endDate}。`);
    logs.push(`读取周末开机数量：${input.weekendMachineCount}。`);
    logs.push(`读取人员信息：${members.length} 人。`);
    logs.push(`读取出勤记录：${input.attendance.length} 条。`);
    logs.push(`读取班组历史排班记录：${input.teamScheduleRecords.length} 条。`);
    logs.push(`读取排班开始日前历史结果：${input.historicalResults.length} 条。`);

    const baseValidation = this.validateBaseData(members, input.teamScheduleRecords);
    if (baseValidation.length > 0) {
      logs.push(...baseValidation.map((item) => `基础数据异常：${item}`));
      return {
        rows: [],
        logs,
        exceptionCount: baseValidation.length,
        status: 'FAILED',
        errorMessage: baseValidation.join('；'),
        finalTeamRecords: [],
      };
    }

    const specialRules = this.buildSpecialRuleMap(input.specialRequirements);
    const cycleBase = this.buildCycleBase(input.startDate, input.teamScheduleRecords, dateList, logs);
    const restTeamByDate = new Map<string, string>();
    let finalTeamRecords: ScheduleEngineOutput['finalTeamRecords'] = [];

    for (const [dayIndex, date] of dateList.entries()) {
      const weekdayName = this.getWeekdayName(date);
      logs.push(`处理 ${date} ${weekdayName}。`);

      const rotation = this.getRotationForDay(cycleBase, dayIndex);
      const coverageErrors = this.validateCoverage(rotation);
      if (coverageErrors.length > 0) {
        exceptions.push(...coverageErrors.map((message) => `${date} ${message}`));
        logs.push(...coverageErrors.map((message) => `班组轮换异常：${date} ${message}`));
      }

      const restTeam = rotation.find((item) => item.shiftName === '休息')?.team;
      if (restTeam) restTeamByDate.set(date, restTeam);
      const earlyTeam = rotation.find((item) => item.shiftName === '早班')?.team;
      const lateTeam = rotation.find((item) => item.shiftName === '晚班')?.team;

      this.assignLongDayShift({
        rows,
        logs,
        exceptions,
        date,
        weekdayName,
        jobId: input.jobId,
        members,
        attendance: input.attendance,
        specialRules,
        ledger,
      });

      const longDayCount = rows.filter((row) => row.workDate === date && row.shiftName === '长白班').length;
      const isWeekend = this.isWeekend(date);

      if (earlyTeam) {
        this.assignAndValidateShift({
          rows,
          logs,
          exceptions,
          jobId: input.jobId,
          date,
          weekdayName,
          shiftName: '早班',
          team: earlyTeam,
          restTeam,
          requirement: this.getRequirement('早班', isWeekend, input.weekendMachineCount, longDayCount),
          members,
          attendance: input.attendance,
          specialRules,
          ledger,
        });
      }

      if (lateTeam) {
        this.assignAndValidateShift({
          rows,
          logs,
          exceptions,
          jobId: input.jobId,
          date,
          weekdayName,
          shiftName: '晚班',
          team: lateTeam,
          restTeam,
          requirement: this.getRequirement('晚班', isWeekend, input.weekendMachineCount, longDayCount),
          members,
          attendance: input.attendance,
          specialRules,
          ledger,
        });
      }

      this.applyMustWorkRequests({
        rows,
        logs,
        exceptions,
        jobId: input.jobId,
        date,
        weekdayName,
        members,
        attendance: input.attendance,
        specialRules,
        ledger,
        shiftContext: { earlyTeam, lateTeam, restTeam },
        requests: input.specialRequirements.filter((request) => request.date === date && request.action === 'mustWork'),
      });

      finalTeamRecords = this.buildFinalTeamRecords(input.startDate, input.endDate, cycleBase);
    }

    exceptions.push(...this.runGlobalValidation(rows, dateList, members, input.attendance, restTeamByDate));
    const uniqueExceptions = Array.from(new Set(exceptions));
    const hasSevereException = uniqueExceptions.some((reason) => this.isSevereException(reason));

    logs.push(`保存排班结果：${rows.length} 条。`);
    logs.push(uniqueExceptions.length > 0 ? `排班完成，但存在 ${uniqueExceptions.length} 个异常。` : '排班完成，全部校验通过。');

    return {
      rows,
      logs,
      exceptionCount: uniqueExceptions.length,
      status: hasSevereException ? 'FAILED' : uniqueExceptions.length > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
      errorMessage: uniqueExceptions.length > 0 ? uniqueExceptions.join('；') : null,
      finalTeamRecords,
    };
  }

  private validateBaseData(members: Member[], records: TeamScheduleRecordRow[]) {
    const errors: string[] = [];
    if (members.length === 0) errors.push('人员数据为空');

    for (const team of [...A_TEAMS, 'B']) {
      if (!members.some((member) => member.TEAM === team)) {
        errors.push(`${team} 班组人员缺失`);
      }
    }

    for (const member of members) {
      if (!member.ROLE) errors.push(`${member.NAME} 角色缺失`);
      if (member.skills.length === 0) errors.push(`${member.NAME} 技能缺失`);
    }

    for (const team of A_TEAMS) {
      if (!records.some((record) => record.TEAM === team)) {
        errors.push(`${team} 历史排班记录缺失`);
      }
    }

    return errors;
  }

  private buildCycleBase(startDate: string, records: TeamScheduleRecordRow[], dateList: string[], logs: string[]) {
    const base: Record<string, number> = {};

    for (const team of A_TEAMS) {
      const record = records.find((item) => item.TEAM === team);
      if (!record) {
        base[team] = DEFAULT_CYCLE_INDEX[team];
        continue;
      }

      const nextShift = this.normalizeShift(record.NEXT_SHIFT);
      const currentShift = this.normalizeShift(record.CURRENT_SHIFT);
      const candidate = CYCLE.findIndex((shift, index) => {
        const previous = CYCLE[(index + CYCLE.length - 1) % CYCLE.length];
        return shift === nextShift && previous === currentShift;
      });
      const nextIndex = candidate >= 0 ? candidate : CYCLE.findIndex((shift) => shift === nextShift);
      const daysFromNextDate = this.diffDays(this.formatDate(record.NEXT_SHIFT_DATE), startDate);
      base[team] = this.mod((nextIndex >= 0 ? nextIndex : DEFAULT_CYCLE_INDEX[team]) + daysFromNextDate, CYCLE.length);
    }

    const isValidForRange = dateList.every((_, dayIndex) => this.validateCoverage(this.getRotationForDay(base, dayIndex)).length === 0);
    if (isValidForRange) {
      return base;
    }

    logs.push('班组轮换基准在本次日期范围内不一致，已按默认 A1早班、A2晚班、A3休息 自动修正本次排班基准。');
    return { ...DEFAULT_CYCLE_INDEX };
  }

  private getRotationForDay(base: Record<string, number>, dayIndex: number) {
    return A_TEAMS.map((team) => ({
      team,
      shiftName: CYCLE[this.mod(base[team] + dayIndex, CYCLE.length)],
    }));
  }

  private validateCoverage(rotation: Array<{ team: string; shiftName: string }>) {
    const errors: string[] = [];
    for (const shiftName of ['早班', '晚班', '休息']) {
      const count = rotation.filter((item) => item.shiftName === shiftName).length;
      if (count !== 1) errors.push(`必须满足 1 个${shiftName}班组，当前为 ${count} 个`);
    }
    return errors;
  }

  private assignLongDayShift(input: {
    rows: ScheduleResultInsert[];
    logs: string[];
    exceptions: string[];
    date: string;
    weekdayName: string;
    jobId: string;
    members: Member[];
    attendance: AttendanceRow[];
    specialRules: Map<string, SpecialRequirement[]>;
    ledger: AssignmentLedger;
  }) {
    const candidates = this.sortCandidates(
      input.members.filter((member) => member.TEAM === 'B' && this.canAssign(member, input.date, '长白班', input.attendance, input.specialRules, input.ledger)),
      input.ledger,
    );

    for (const member of candidates.slice(0, 1)) {
      const appended = this.appendRowSafely({
        rows: input.rows,
        exceptions: input.exceptions,
        logs: input.logs,
        row: this.toRow({
          jobId: input.jobId,
          assignment: {
            member,
            date: input.date,
            weekdayName: input.weekdayName,
            shiftName: '长白班',
            actualTeam: 'B',
            isBorrowed: false,
            originalTeam: member.TEAM,
            borrowReason: null,
          },
          validationResult: '通过',
          exceptionReason: null,
        }),
      });
      if (!appended) continue;
      this.markAssigned(member.NAME, input.date, '长白班', false, input.ledger);
    }

    input.logs.push(`${input.date} 长白班生成 ${Math.min(candidates.length, 1)} 人。`);
  }

  private assignAndValidateShift(input: {
    rows: ScheduleResultInsert[];
    logs: string[];
    exceptions: string[];
    jobId: string;
    date: string;
    weekdayName: string;
    shiftName: '早班' | '晚班';
    team: string;
    restTeam?: string;
    requirement: ShiftRequirement;
    members: Member[];
    attendance: AttendanceRow[];
    specialRules: Map<string, SpecialRequirement[]>;
    ledger: AssignmentLedger;
  }) {
    if (input.requirement.ruleMissing) {
      this.recordShiftException(input.rows, input.exceptions, input.date, input.shiftName, input.requirement.ruleMissing);
      input.logs.push(`${input.date} ${input.shiftName} 规则缺失：${input.requirement.ruleMissing}`);
      return;
    }

    const candidates = this.sortCandidates(
      input.members.filter((member) => member.TEAM === input.team && this.canAssign(member, input.date, input.shiftName, input.attendance, input.specialRules, input.ledger)),
      input.ledger,
    );
    const initialMembers = this.selectShiftMembers(candidates, input.requirement);
    const assignments: Assignment[] = initialMembers.map((member) => ({
      member,
      date: input.date,
      weekdayName: input.weekdayName,
      shiftName: input.shiftName,
      actualTeam: input.team,
      isBorrowed: false,
      originalTeam: member.TEAM,
      borrowReason: null,
    }));

    for (const member of initialMembers) this.markAssigned(member.NAME, input.date, input.shiftName, false, input.ledger);

    input.logs.push(`${input.date} ${input.shiftName} 初始安排 ${assignments.length} 人。`);
    this.borrowIfNeeded(input, assignments);

    const validation = this.validateShift(assignments, input.requirement);
    if (!validation.ok) {
      const reason = validation.errors.join('；');
      input.exceptions.push(`${input.date} ${input.shiftName} ${reason}`);
      input.logs.push(`${input.date} ${input.shiftName} 校验不通过：${reason}`);
    }

    for (const assignment of assignments) {
      this.appendRowSafely({
        rows: input.rows,
        exceptions: input.exceptions,
        logs: input.logs,
        row: this.toRow({
          jobId: input.jobId,
          assignment,
          validationResult: validation.ok ? '通过' : '不通过',
          exceptionReason: validation.ok ? null : validation.errors.join('；'),
        }),
      });
    }
  }

  private borrowIfNeeded(
    input: {
      logs: string[];
      requirement: ShiftRequirement;
      restTeam?: string;
      members: Member[];
      date: string;
      weekdayName: string;
      shiftName: '早班' | '晚班';
      team: string;
      attendance: AttendanceRow[];
      specialRules: Map<string, SpecialRequirement[]>;
      ledger: AssignmentLedger;
    },
    assignments: Assignment[],
  ) {
    if (!input.restTeam) return;

    const borrowSteps = [
      { reason: '缺组长', needs: () => input.requirement.requireLeader && !this.hasLeader(assignments), match: (member: Member) => this.isLeader(member) },
      { reason: '缺电工', needs: () => input.requirement.requireElectrician && !this.hasSkill(assignments, '电工'), match: (member: Member) => this.hasMemberSkill(member, '电工') },
      { reason: '缺注塑维修', needs: () => input.requirement.requireInjection && !this.hasSkill(assignments, '注塑维修'), match: (member: Member) => this.hasMemberSkill(member, '注塑维修') },
      { reason: '缺人数', needs: () => assignments.length < input.requirement.minCount, match: () => true },
    ];

    for (const step of borrowSteps) {
      while (step.needs()) {
        const candidates = this.sortCandidates(
          input.members.filter(
            (member) =>
              member.TEAM === input.restTeam &&
              step.match(member) &&
              !assignments.some((assignment) => assignment.member.ID === member.ID) &&
              this.canAssign(member, input.date, input.shiftName, input.attendance, input.specialRules, input.ledger),
          ),
          input.ledger,
          step.reason,
        );
        const candidate = candidates[0];
        if (!candidate) break;

        assignments.push({
          member: candidate,
          date: input.date,
          weekdayName: input.weekdayName,
          shiftName: input.shiftName,
          actualTeam: input.team,
          isBorrowed: true,
          originalTeam: candidate.TEAM,
          borrowReason: step.reason,
        });
        this.markAssigned(candidate.NAME, input.date, input.shiftName, true, input.ledger);
        input.logs.push(`${input.date} ${input.shiftName} 从 ${input.restTeam} 借调 ${candidate.NAME}，原因：${step.reason}。`);
      }
    }
  }

  private applyMustWorkRequests(input: {
    rows: ScheduleResultInsert[];
    logs: string[];
    exceptions: string[];
    jobId: string;
    date: string;
    weekdayName: string;
    members: Member[];
    attendance: AttendanceRow[];
    specialRules: Map<string, SpecialRequirement[]>;
    ledger: AssignmentLedger;
    shiftContext: ShiftContext;
    requests: SpecialRequirement[];
  }) {
    for (const request of input.requests) {
      const existing = input.rows.find((row) => row.workDate === input.date && row.personName === request.personName);
      if (existing) {
        if (existing.shiftName === request.shift) {
          input.logs.push(`${input.date} 特殊要求已满足：${request.personName} ${request.shift}。`);
          continue;
        }
        const reason = `特殊要求冲突：${request.personName} 已安排 ${existing.shiftName}，不能改为 ${request.shift}`;
        input.exceptions.push(`${input.date} ${reason}`);
        input.logs.push(reason);
        this.markRowsInvalid([existing], reason);
        continue;
      }

      const member = input.members.find((item) => item.NAME === request.personName);
      if (!member) {
        const reason = `特殊要求人员不存在：${request.personName}`;
        input.exceptions.push(`${input.date} ${reason}`);
        input.logs.push(reason);
        continue;
      }

      if (!this.canAssign(member, input.date, request.shift, input.attendance, input.specialRules, input.ledger)) {
        const reason = `特殊要求未满足：${request.personName} 不能安排 ${request.shift}`;
        input.exceptions.push(`${input.date} ${reason}`);
        input.logs.push(reason);
        continue;
      }

      const targetTeam = this.getTargetTeamForMustWork(request.shift, input.shiftContext);
      if (!targetTeam) {
        const reason = `特殊要求未满足：${request.shift} 当天没有可落位班组`;
        input.exceptions.push(`${input.date} ${reason}`);
        input.logs.push(reason);
        continue;
      }

      const isBorrowed = member.TEAM !== targetTeam;
      if (isBorrowed && member.TEAM !== input.shiftContext.restTeam) {
        const reason = `特殊要求未满足：${request.personName} 不属于 ${request.shift} 当班班组，也不是当天休息班组`;
        input.exceptions.push(`${input.date} ${reason}`);
        input.logs.push(reason);
        continue;
      }

      const appended = this.appendRowSafely({
        rows: input.rows,
        exceptions: input.exceptions,
        logs: input.logs,
        row: this.toRow({
          jobId: input.jobId,
          assignment: {
            member,
            date: input.date,
            weekdayName: input.weekdayName,
            shiftName: request.shift,
            actualTeam: targetTeam,
            isBorrowed,
            originalTeam: member.TEAM,
            borrowReason: '特殊要求',
          },
          validationResult: '通过',
          exceptionReason: null,
        }),
      });
      if (appended) {
        this.markAssigned(member.NAME, input.date, request.shift, isBorrowed, input.ledger);
        input.logs.push(`${input.date} 按特殊要求安排 ${request.personName} ${request.shift}。`);
      }
    }
  }

  private getRequirement(
    shiftName: '早班' | '晚班',
    isWeekend: boolean,
    weekendMachineCount: number,
    longDayCount: number,
  ): ShiftRequirement {
    if (!isWeekend) {
      return {
        minCount: shiftName === '早班' ? 5 : 6,
        requireLeader: true,
        requireElectrician: true,
        requireInjection: true,
      };
    }

    if (weekendMachineCount === 0 && shiftName === '晚班') {
      return {
        minCount: 0,
        requireLeader: false,
        requireElectrician: false,
        requireInjection: false,
        ruleMissing: `周末开机数量 ${weekendMachineCount} 台的${shiftName}规则待确认`,
      };
    }

    const standard = this.getWeekendStandardCount(shiftName, weekendMachineCount);
    return {
      minCount: shiftName === '早班' ? Math.max(standard - longDayCount, 0) : standard,
      requireLeader: false,
      requireElectrician: false,
      requireInjection: false,
    };
  }

  private getWeekendStandardCount(shiftName: '早班' | '晚班', count: number) {
    if (count === 0) return shiftName === '早班' ? 0 : 0;
    if (count >= 1 && count <= 9) return 2;
    if (count >= 10 && count <= 14) return 3;
    if (count >= 15 && count <= 19) return shiftName === '早班' ? 4 : 5;
    if (count >= 20 && count <= 39) return shiftName === '早班' ? 5 : 6;
    return 6;
  }

  private validateShift(assignments: Assignment[], requirement: ShiftRequirement) {
    const errors: string[] = [];
    if (assignments.length < requirement.minCount) errors.push(`人数不足，要求 ${requirement.minCount} 人，实际 ${assignments.length} 人`);
    if (requirement.requireLeader && !this.hasLeader(assignments)) errors.push('缺组长');
    if (requirement.requireElectrician && !this.hasSkill(assignments, '电工')) errors.push('缺电工');
    if (requirement.requireInjection && !this.hasSkill(assignments, '注塑维修')) errors.push('缺注塑维修');
    return { ok: errors.length === 0, errors };
  }

  private selectShiftMembers(candidates: Member[], requirement: ShiftRequirement) {
    const selected: Member[] = [];
    const add = (member: Member | undefined) => {
      if (!member || selected.some((item) => item.ID === member.ID)) return;
      selected.push(member);
    };

    if (requirement.requireLeader) add(candidates.find((member) => this.isLeader(member)));
    if (requirement.requireElectrician) add(candidates.find((member) => this.hasMemberSkill(member, '电工')));
    if (requirement.requireInjection) add(candidates.find((member) => this.hasMemberSkill(member, '注塑维修')));

    for (const candidate of candidates) {
      if (selected.length >= requirement.minCount) break;
      add(candidate);
    }

    return selected;
  }

  private getTargetTeamForMustWork(shiftName: string, context: ShiftContext) {
    if (shiftName === '早班') return context.earlyTeam;
    if (shiftName === '晚班') return context.lateTeam;
    if (shiftName === '长白班') return 'B';
    return undefined;
  }

  private isSevereException(reason: string) {
    return /必须满足|当天被安排|同一天同时存在早班和晚班|存在多个实际班组|未生成 B 班组长白班|特殊要求冲突/.test(reason);
  }

  private runGlobalValidation(
    rows: ScheduleResultInsert[],
    dateList: string[],
    members: Member[],
    attendance: AttendanceRow[],
    restTeamByDate: Map<string, string>,
  ) {
    const errors: string[] = [];
    for (const date of dateList) {
      const dayRows = rows.filter((row) => row.workDate === date);
      const personCounts = new Map<string, number>();
      for (const row of dayRows) {
        personCounts.set(row.personName, (personCounts.get(row.personName) ?? 0) + 1);
      }
      for (const [personName, count] of personCounts) {
        if (count > 1) {
          const reason = `${personName} 当天被安排 ${count} 个班次`;
          errors.push(`${date} ${reason}`);
          this.markRowsInvalid(dayRows.filter((row) => row.personName === personName), reason);
        }
      }
      if (!dayRows.some((row) => row.shiftName === '长白班')) errors.push(`${date} 未生成 B 班组长白班`);
      for (const shiftName of ['早班', '晚班']) {
        const teams = new Set(dayRows.filter((row) => row.shiftName === shiftName).map((row) => row.actualTeam));
        if (teams.size > 1) {
          const reason = `${shiftName} 存在多个实际班组：${Array.from(teams).join('、')}`;
          errors.push(`${date} ${reason}`);
          this.markRowsInvalid(dayRows.filter((row) => row.shiftName === shiftName), reason);
        }
      }

      const earlyTeams = new Set(dayRows.filter((row) => row.shiftName === '早班').map((row) => row.actualTeam));
      const lateTeams = new Set(dayRows.filter((row) => row.shiftName === '晚班').map((row) => row.actualTeam));
      for (const team of earlyTeams) {
        if (!lateTeams.has(team)) continue;
        const reason = `${team} 同一天同时存在早班和晚班`;
        errors.push(`${date} ${reason}`);
        this.markRowsInvalid(
          dayRows.filter((row) => row.actualTeam === team && (row.shiftName === '早班' || row.shiftName === '晚班')),
          reason,
        );
      }

      for (const row of dayRows) {
        const member = members.find((item) => item.ID === row.memberId || item.NAME === row.personName);
        if (!member) continue;
        if (this.isAbsent(row.personName, date, attendance)) {
          const reason = `${row.personName} 当天为休假/请假状态，不能排班`;
          errors.push(`${date} ${reason}`);
          this.markRowsInvalid([row], reason);
        }
        if (member.skills.length === 0) {
          const reason = `${row.personName} 技能缺失，不能排班`;
          errors.push(`${date} ${reason}`);
          this.markRowsInvalid([row], reason);
        }
        const restTeam = restTeamByDate.get(date);
        if (row.isBorrowed === '是' && restTeam && row.originalTeam !== restTeam) {
          const reason = `${row.personName} 借调来源不是当天休息班组 ${restTeam}`;
          errors.push(`${date} ${reason}`);
          this.markRowsInvalid([row], reason);
        }
      }
    }
    return Array.from(new Set(errors));
  }

  private recordShiftException(rows: ScheduleResultInsert[], exceptions: string[], date: string, shiftName: string, reason: string) {
    exceptions.push(`${date} ${shiftName} ${reason}`);
    for (const row of rows.filter((item) => item.workDate === date && item.shiftName === shiftName)) {
      row.validationResult = '不通过';
      row.exceptionReason = reason;
      row.status = '异常';
    }
  }

  private appendRowSafely(input: {
    rows: ScheduleResultInsert[];
    exceptions: string[];
    logs: string[];
    row: ScheduleResultInsert;
  }) {
    const conflict = input.rows.find((row) => row.workDate === input.row.workDate && row.personName === input.row.personName);
    if (conflict) {
      const reason = `${input.row.personName} 已有${conflict.shiftName}，拒绝追加${input.row.shiftName}`;
      input.exceptions.push(`${input.row.workDate} ${reason}`);
      input.logs.push(`${input.row.workDate} ${reason}。`);
      this.markRowsInvalid([conflict], reason);
      return false;
    }

    input.rows.push(input.row);
    return true;
  }

  private markRowsInvalid(rows: ScheduleResultInsert[], reason: string) {
    for (const row of rows) {
      row.validationResult = '不通过';
      row.status = '异常';
      row.exceptionReason = row.exceptionReason ? `${row.exceptionReason}；${reason}` : reason;
    }
  }

  private toRow(input: {
    jobId: string;
    assignment: Assignment;
    validationResult: string;
    exceptionReason: string | null;
  }): ScheduleResultInsert {
    return {
      id: randomUUID(),
      jobId: input.jobId,
      workDate: input.assignment.date,
      weekdayName: input.assignment.weekdayName,
      shiftName: input.assignment.shiftName,
      team: input.assignment.actualTeam,
      memberId: input.assignment.member.ID,
      personName: input.assignment.member.NAME,
      roleName: input.assignment.member.ROLE,
      skillsText: input.assignment.member.skills.join(','),
      status: input.validationResult === '通过' ? '已排班' : '异常',
      isBorrowed: input.assignment.isBorrowed ? '是' : '否',
      originalTeam: input.assignment.originalTeam,
      actualTeam: input.assignment.actualTeam,
      borrowReason: input.assignment.borrowReason,
      validationResult: input.validationResult,
      exceptionReason: input.exceptionReason,
    };
  }

  private buildFinalTeamRecords(startDate: string, endDate: string, base: Record<string, number>) {
    const dayIndex = this.diffDays(startDate, endDate);
    const nextDate = this.formatDate(this.addDays(new Date(`${endDate}T00:00:00`), 1));
    return A_TEAMS.map((team) => ({
      team,
      currentShift: CYCLE[this.mod(base[team] + dayIndex, CYCLE.length)],
      currentShiftDate: endDate,
      nextShift: CYCLE[this.mod(base[team] + dayIndex + 1, CYCLE.length)],
      nextShiftDate: nextDate,
    }));
  }

  private canAssign(
    member: Member,
    date: string,
    shiftName: string,
    attendance: AttendanceRow[],
    specialRules: Map<string, SpecialRequirement[]>,
    ledger: AssignmentLedger,
  ) {
    if (this.isAbsent(member.NAME, date, attendance)) return false;
    if (!this.satisfiesSpecialRules(member.NAME, date, shiftName, specialRules)) return false;
    if (this.isAlreadyAssignedSameDay(member.NAME, date, ledger)) return false;
    if (this.violatesRestBetweenShifts(member.NAME, date, shiftName, ledger)) return false;
    if (this.wouldReachSevenDays(member.NAME, date, ledger)) return false;
    return true;
  }

  private satisfiesSpecialRules(personName: string, date: string, shiftName: string, specialRules: Map<string, SpecialRequirement[]>) {
    const rules = specialRules.get(`${date}::${personName}`) ?? [];
    return rules.every((rule) => {
      if (rule.action === 'mustRest' || rule.action === 'cannotWork') return false;
      if (rule.action === 'cannotShift') return rule.shift !== shiftName;
      if (rule.action === 'onlyShift') return rule.shift === shiftName;
      return true;
    });
  }

  private isAlreadyAssignedSameDay(personName: string, date: string, ledger: AssignmentLedger) {
    return ledger.datesByPerson.get(personName)?.has(date) ?? false;
  }

  private violatesRestBetweenShifts(personName: string, date: string, shiftName: string, ledger: AssignmentLedger) {
    const currentIndex = this.toEventIndex(date, shiftName);
    return (ledger.eventsByPerson.get(personName) ?? []).some((eventIndex) => currentIndex - eventIndex > 0 && currentIndex - eventIndex <= 1);
  }

  private wouldReachSevenDays(personName: string, date: string, ledger: AssignmentLedger) {
    const assigned = ledger.datesByPerson.get(personName) ?? new Set<string>();
    for (let offset = 1; offset <= 6; offset += 1) {
      const previousDate = this.formatDate(this.addDays(new Date(`${date}T00:00:00`), -offset));
      if (!assigned.has(previousDate)) return false;
    }
    return true;
  }

  private markAssigned(personName: string, date: string, shiftName: string, borrowed: boolean, ledger: AssignmentLedger) {
    const dates = ledger.datesByPerson.get(personName) ?? new Set<string>();
    dates.add(date);
    ledger.datesByPerson.set(personName, dates);

    const events = ledger.eventsByPerson.get(personName) ?? [];
    events.push(this.toEventIndex(date, shiftName));
    ledger.eventsByPerson.set(personName, events);

    if (borrowed) {
      ledger.borrowCountByPerson.set(personName, (ledger.borrowCountByPerson.get(personName) ?? 0) + 1);
    }
  }

  private buildInitialLedger(startDate: string, rows: HistoricalScheduleResultRow[]): AssignmentLedger {
    const ledger: AssignmentLedger = {
      datesByPerson: new Map(),
      eventsByPerson: new Map(),
      borrowCountByPerson: new Map(),
    };
    for (const row of rows) {
      const date = this.formatDate(row.WORK_DATE);
      this.markAssigned(row.PERSON_NAME, date, row.SHIFT_NAME, row.IS_BORROWED === '是', ledger);
    }
    for (const events of ledger.eventsByPerson.values()) {
      events.sort((a, b) => a - b);
    }
    return ledger;
  }

  private sortCandidates(candidates: Member[], ledger: AssignmentLedger, reason?: string) {
    return [...candidates].sort((a, b) => {
      const borrowDiff = (ledger.borrowCountByPerson.get(a.NAME) ?? 0) - (ledger.borrowCountByPerson.get(b.NAME) ?? 0);
      if (borrowDiff !== 0) return borrowDiff;
      const workDiff = (ledger.datesByPerson.get(a.NAME)?.size ?? 0) - (ledger.datesByPerson.get(b.NAME)?.size ?? 0);
      if (workDiff !== 0) return workDiff;
      if (reason && reason !== '缺人数') {
        return b.skills.length - a.skills.length;
      }
      return a.NAME.localeCompare(b.NAME, 'zh-Hans-CN');
    });
  }

  private buildSpecialRuleMap(requirements: SpecialRequirement[]) {
    const map = new Map<string, SpecialRequirement[]>();
    for (const requirement of requirements) {
      const key = `${requirement.date}::${requirement.personName}`;
      map.set(key, [...(map.get(key) ?? []), requirement]);
    }
    return map;
  }

  private isAbsent(personName: string, date: string, attendance: AttendanceRow[]) {
    const target = new Date(`${date}T00:00:00`).getTime();
    return attendance.some((record) => {
      if (record.PERSON_NAME !== personName) return false;
      return record.START_DATE.getTime() <= target && target <= record.END_DATE.getTime();
    });
  }

  private hasLeader(assignments: Assignment[]) {
    return assignments.some((assignment) => this.isLeader(assignment.member));
  }

  private isLeader(member: Member) {
    return member.ROLE.includes('组长') || member.ROLE.includes('班长');
  }

  private hasSkill(assignments: Assignment[], skill: string) {
    return assignments.some((assignment) => this.hasMemberSkill(assignment.member, skill));
  }

  private hasMemberSkill(member: Member, skill: string) {
    return member.skills.some((item) => item.includes(skill));
  }

  private parseSkills(skills: string | null) {
    return (skills ?? '').split(/[,，、/]/).map((skill) => skill.trim()).filter(Boolean);
  }

  private normalizeShift(shift: string) {
    if (shift.includes('早')) return '早班';
    if (shift.includes('晚')) return '晚班';
    if (shift.includes('休')) return '休息';
    if (shift.includes('长白')) return '长白班';
    return shift;
  }

  private buildDateList(startDate: string, endDate: string) {
    const dates: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    while (cursor <= end) {
      dates.push(this.formatDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  private isWeekend(date: string) {
    const day = new Date(`${date}T00:00:00`).getDay();
    return day === 0 || day === 6;
  }

  private getWeekdayName(date: string) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${date}T00:00:00`).getDay()];
  }

  private toEventIndex(date: string, shiftName: string) {
    const day = Math.floor(new Date(`${date}T00:00:00`).getTime() / 86400000);
    const shiftOrder = shiftName === '早班' ? 0 : shiftName === '长白班' ? 1 : shiftName === '晚班' ? 2 : 1;
    return day * 3 + shiftOrder;
  }

  private diffDays(from: string, to: string) {
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    const toTime = new Date(`${to}T00:00:00`).getTime();
    return Math.round((toTime - fromTime) / 86400000);
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

  private mod(value: number, divisor: number) {
    return ((value % divisor) + divisor) % divisor;
  }
}
