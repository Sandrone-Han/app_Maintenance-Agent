// EXPORTS: ITeamScheduleRecord, MOCK_TEAM_SCHEDULE_RECORDS

export interface ITeamScheduleRecord {
  id: string;
  team: 'A1' | 'A2' | 'A3' | 'B';
  type: '早班/晚班' | '长白班';
  currentShift: string;
  currentShiftDate: string;
  nextShift: string;
  nextShiftDate: string;
}

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