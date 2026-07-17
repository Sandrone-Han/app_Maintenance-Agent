// EXPORTS: ITeamScheduleRecord, MOCK_TEAM_SCHEDULE_RECORDS

// 班组轮换记录结构，用于承接“当前班次”和“下一班次”的连续性。
export interface ITeamScheduleRecord {
  id: string;
  team: 'A1' | 'A2' | 'A3' | 'B';
  type: '早班/晚班' | '长白班';
  currentShift: string;
  currentShiftDate: string;
  nextShift: string;
  nextShiftDate: string;
}

// 初始班组轮换状态，排班配置页会据此推导后续排班连续性。
export const MOCK_TEAM_SCHEDULE_RECORDS: ITeamScheduleRecord[] = [
  {
    id: '1',
    team: 'A1',
    type: '早班/晚班',
    currentShift: '早班',
    currentShiftDate: '2026-06-30',
    nextShift: '早班',
    nextShiftDate: '2026-07-01',
  },
  {
    id: '2',
    team: 'A2',
    type: '早班/晚班',
    currentShift: '晚班',
    currentShiftDate: '2026-06-30',
    nextShift: '休息',
    nextShiftDate: '2026-07-01',
  },
  {
    id: '3',
    team: 'A3',
    type: '早班/晚班',
    currentShift: '休息',
    currentShiftDate: '2026-06-30',
    nextShift: '早班',
    nextShiftDate: '2026-07-01',
  },
];
