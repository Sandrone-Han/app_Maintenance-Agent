// ---- plugin:scheduling_ai_engine_1 ----
// ============================================================
// 插件 scheduling_ai_engine_1 (排班AI引擎) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface SchedulingAiEngineOneInput {
  /** 排班的特殊要求，例如：节假日排班、人员调休等 */
  special_requirements?: string;
  /** 当前班组、人员及出勤数据，包含人员信息、技能、可用时间等 */
  staff_data: string;
  /** 排班的日期范围，例如：2024-06-01至2024-06-30 */
  date_range: string;
  /** 需要开机的设备数量 */
  machine_count: string;
}

/**
 * capabilityClient.load('scheduling_ai_engine_1').call<SchedulingAiEngineOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { schedules } = result;
 */
export interface SchedulingAiEngineOneOutput {
  /** 排班计划列表，items schema: {date: string(日期，格式YYYY-MM-DD), shift: string(班次，可选值：早班/晚班/长白班), team: string(班组名称), personName: string(人员姓名), role: string(人员角色), skills: string(人员技能), status: string(排班状态，如：正常/调休/请假等)} */
  schedules: unknown[];
}
// ---- end:scheduling_ai_engine_1 ----

// ---- plugin:scheduling_ai_engine_2 ----
// ============================================================
// 插件 scheduling_ai_engine_2 (排班AI引擎) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface SchedulingAiEngineTwoInput {
  /** 排班日期范围，格式如：2024-06-01至2024-06-30 */
  date_range: string;
  /** 每日需要开机的班次数量 */
  required_shifts: string;
  /** 特殊排班要求，如节假日排班、特定人员排班偏好等 */
  special_requirements?: string;
  /** 当前班组人员信息、出勤数据、可排班时间等基础数据 */
  team_staff_data: string;
}

/**
 * capabilityClient.load('scheduling_ai_engine_2').call<SchedulingAiEngineTwoOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { schedule_period, daily_schedules, staff_workload_statistics, ... } = result;
 */
export interface SchedulingAiEngineTwoOutput {
  /** 排班周期，格式：开始日期-结束日期 */
  schedule_period: string;
  /** 每日排班列表，items schema: {date: string(排班日期), shifts: Array(当日班次列表，items schema: {shift_id: string(班次ID), shift_name: string(班次名称), start_time: string(开始时间), end_time: string(结束时间), staff_id: string(排班人员ID), staff_name: string(排班人员姓名)})} */
  daily_schedules: unknown[];
  /** 人员工作量统计，items schema: {staff_id: string(人员ID), staff_name: string(人员姓名), total_shifts: number(总班次数量), total_work_hours: number(总工作时长)} */
  staff_workload_statistics: unknown[];
  /** 特殊安排说明，items schema: {date: string(日期), description: string(特殊安排内容)} */
  special_arrangements: unknown[];
  /** 排班计划说明和注意事项 */
  schedule_notes: string;
}
// ---- end:scheduling_ai_engine_2 ----