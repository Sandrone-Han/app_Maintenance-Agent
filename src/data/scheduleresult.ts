// EXPORTS: IScheduleResult, MOCK_SCHEDULE_RESULTS

// 排班结果行结构，覆盖原始排班、借调、请假替班和换班后的展示字段。
export interface IScheduleResult {
  id: string;
  jobId?: string;
  date: string;
  weekdayName: string;
  shift: '早班' | '晚班' | '长白班' | string;
  team: string;
  personName: string;
  role: string;
  skills: string;
  status: string;
  isBorrowed: '是' | '否' | string;
  originalTeam: string;
  actualTeam: string;
  borrowReason: string;
  validationResult: '通过' | '不通过' | string;
  exceptionReason: string;
  isAdjusted?: boolean;
  adjustmentId?: string;
  originalPersonName?: string;
  adjustmentLeaveType?: string;
  adjustmentReason?: string;
  isSwapped?: boolean;
  swapId?: string;
  swapPeerPersonName?: string;
  swapReason?: string;
}

// 排班结果默认空数组，等待排班任务生成或从后端查询。
export const MOCK_SCHEDULE_RESULTS: IScheduleResult[] = [];
