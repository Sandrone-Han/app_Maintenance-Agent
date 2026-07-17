// EXPORTS: IShiftType, MOCK_SHIFT_TYPES

// 班次基础配置结构，描述班次类型、轮换规则和上下班时间。
export interface IShiftType {
  id: string
  shiftCategory: '早班/晚班' | '长白班'
  scheduleRule: string
  shiftName: '早班' | '晚班' | '长白班'
  startTime: string
  endTime: string
}

// 系统内置的班次示例数据，用于班组管理和排班引擎初始化。
export const MOCK_SHIFT_TYPES: IShiftType[] = [
  {
    id: '1',
    shiftCategory: '早班/晚班',
    scheduleRule: '上4休2',
    shiftName: '早班',
    startTime: '07:00',
    endTime: '19:00'
  },
  {
    id: '2',
    shiftCategory: '早班/晚班',
    scheduleRule: '上4休2',
    shiftName: '晚班',
    startTime: '19:00',
    endTime: '07:00'
  },
  {
    id: '3',
    shiftCategory: '长白班',
    scheduleRule: '长白班',
    shiftName: '长白班',
    startTime: '08:30',
    endTime: '17:00'
  }
]
