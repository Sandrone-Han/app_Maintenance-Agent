// EXPORTS: IAttendance, MOCK_ATTENDANCE

// 人员出勤/请假记录结构，供人员信息页和排班校验读取。
export interface IAttendance {
  id: string
  personName: string
  team: string
  startDate: string
  endDate: string
  status: '正常' | '休假' | '事假' | '请假'
  updatedAt: string
}

// 首次初始化时使用的出勤示例数据，之后由后端或本地持久化数据覆盖。
export const MOCK_ATTENDANCE: IAttendance[] = [
  {
    id: '1',
    personName: '李工',
    team: 'A1',
    startDate: '2026-07-05',
    endDate: '2026-07-07',
    status: '休假',
    updatedAt: '2026-06-28 10:00',
  },
  {
    id: '2',
    personName: '刘工',
    team: 'A2',
    startDate: '2026-07-03',
    endDate: '2026-07-03',
    status: '事假',
    updatedAt: '2026-06-29 14:30',
  },
]
