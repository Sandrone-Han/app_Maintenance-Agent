// 排班结果行结构，覆盖原始排班、借调、请假替班和换班后的展示字段。
export interface IScheduleResult {
  id: string;
  jobId?: string;
  date: string;
  weekdayName: string;
  shift: string;
  team: string;
  personName: string;
  role: string;
  skills: string;
  status: string;
  isBorrowed: string;
  originalTeam: string;
  actualTeam: string;
  borrowReason: string;
  validationResult: string;
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
