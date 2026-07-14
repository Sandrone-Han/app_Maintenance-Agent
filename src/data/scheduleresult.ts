// EXPORTS: IScheduleResult, MOCK_SCHEDULE_RESULTS

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

export const MOCK_SCHEDULE_RESULTS: IScheduleResult[] = [];
