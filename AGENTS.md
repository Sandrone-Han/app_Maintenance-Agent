# 设备维护计划智能体 - 需求拆解文档

## 产品概述

- **产品类型**: 企业级管理系统（中后台）
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 设备维护排班管理员、班组长
- **核心价值**: 自动化生成设备维护人员排班计划，通过AI智能排班引擎处理复杂的班组轮换、人员借调和技能匹配规则，大幅降低人工排班的时间成本和出错率
- **界面语言**: 中文
- **主题偏好**: 浅色（蓝色系工业风格）
- **导航模式**: 路径导航
- **导航布局**: Sidebar（左侧菜单 + 右侧内容区）

---

## 页面结构总览

> **说明**：此表为页面生成的唯一数据源，包含所有页面（一级+二级）

| 页面名称 | 文件名 | 路由 | 页面类型 | 入口来源 |
|---------|-------|------|---------|---------|
| 排班配置 | `ScheduleConfigPage.tsx` | `/schedule-config` | 一级 | 导航 |
| 排班结果 | `ScheduleResultPage.tsx` | `/schedule-result` | 一级 | 导航 / 排班配置页 → 排班完成自动跳转 |
| 班组管理 | `TeamManagePage.tsx` | `/team-manage` | 一级 | 导航 |
| 人员信息 | `PersonnelPage.tsx` | `/personnel` | 一级 | 导航 |
| 班组排班记录 | `TeamScheduleRecordPage.tsx` | `/team-schedule-record` | 一级 | 导航 |

---

## 页面布局建议

### 排班配置页
- **布局模式**: 上下分区 —— 上方为排班参数配置表单，下方为排班流程进度展示
- **视觉重心**: 输入（排班参数表单）与 状态（流程节点进度）
- **结果承载区**: 流程进度区域，初始态为"待开始"状态，三个节点均未激活

### 排班结果页
- **布局模式**: 上下分区 —— 上方筛选栏，下方结果表格
- **视觉重心**: 列表（排班结果表格）
- **结果承载区**: 排班结果表格，初始态为空表格或提示"请先执行排班"

### 班组管理页
- **布局模式**: 上下分区 —— 上方 Tab 切换（班组人员信息 / 班次基本信息），下方对应内容表格
- **视觉重心**: 列表（人员表格 / 班次表格）
- **结果承载区**: 表格区域，初始态展示示例数据

### 人员信息页
- **布局模式**: 上下分区 —— 上方操作栏（新增按钮），下方出勤信息表格
- **视觉重心**: 列表（出勤记录表格）
- **结果承载区**: 表格区域，初始态展示示例数据

### 班组排班记录页
- **布局模式**: 上下分区 —— 上方标题说明，下方记录表格
- **视觉重心**: 列表（班组排班状态表格）
- **结果承载区**: 表格区域，初始态展示示例数据

---

## 插件规划

| 插件实例名称 | 基于官方插件 | 业务用途 | 输出模式 | 所属页面 |
|------------|-----------|---------|---------|---------|
| 排班AI引擎 | `ai-text-to-json` | 接收排班参数（日期范围、开机数量、特殊要求）及当前班组/人员/出勤数据，按排班逻辑规则生成结构化排班计划 | unary | 排班配置 |

> **说明**：AI排班引擎的核心输入为结构化排班上下文（班组轮换状态、人员技能、出勤情况、特殊要求），输出为确定性的排班计划JSON。排班逻辑规则（上4休2、技能匹配、借调规则）作为prompt中的约束条件传递给AI，由AI在约束下求解排班方案。

---

## 导航配置

- **导航布局**: Sidebar（左侧固定，深色背景，蓝色系高亮）
- **导航项**（仅一级页面）:

| 导航文字 | 路由 | 图标(建议) |
|---------|------|-----------|
| 排班配置 | `/schedule-config` | CalendarClock / Settings |
| 排班结果 | `/schedule-result` | Table / ClipboardList |
| 班组管理 | `/team-manage` | Users / Building |
| 人员信息 | `/personnel` | UserCheck / Contact |
| 班组排班记录 | `/team-schedule-record` | History / Clock |

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 班组人员信息（初始数据） | demo-mock | `src/data/teamMembers.ts` 常量数组，按用户提供的15条示例数据初始化 | ✅ 本身就是 mock |
| 班次基本信息（初始数据） | demo-mock | `src/data/shiftTypes.ts` 常量数组，按用户提供的3条班次定义初始化 | ✅ 本身就是 mock |
| 人员出勤信息（初始数据） | demo-mock | `src/data/attendance.ts` 常量数组，按用户提供的2条出勤记录初始化 | ✅ 本身就是 mock |
| 班组排班记录（初始数据） | demo-mock | `src/data/teamScheduleRecords.ts` 常量数组，按用户提供的3条记录初始化 | ✅ 本身就是 mock |
| 班组人员信息 CRUD（新增/编辑/删除） | local-persist | localStorage key=`__app_scheduler_teamMembers`，初始值从 mock 数据加载 | 无（首次加载用 mock 初始化 localStorage） |
| 班次基本信息 CRUD（新增/编辑/删除） | local-persist | localStorage key=`__app_scheduler_shiftTypes`，初始值从 mock 数据加载 | 无（首次加载用 mock 初始化 localStorage） |
| 人员出勤信息 CRUD（新增/编辑/删除） | local-persist | localStorage key=`__app_scheduler_attendance`，初始值从 mock 数据加载 | 无（首次加载用 mock 初始化 localStorage） |
| 班组排班记录更新 | local-persist | localStorage key=`__app_scheduler_teamScheduleRecords`，排班完成后更新 | 无（首次加载用 mock 初始化 localStorage） |
| AI 排班生成 | real-plugin | capabilityClient 调 `排班AI引擎` 实例（ai-text-to-json），传入排班参数、当前班组状态、人员技能、出勤信息、特殊要求，返回结构化排班计划 JSON | 无（插件能力不可 mock） |
| 排班结果存储 | local-persist | localStorage key=`__app_scheduler_scheduleResults`，AI排班完成后存储 | 无 |
| 排班结果导出（Excel/CSV） | import-export | Blob + URL.createObjectURL + a.click 触发下载，支持 CSV 和简易 Excel（xlsx 库）格式 | 无 |
| 附件需求文档（PDF） | real-file | 用户上传的 PDF 需求文档，作为需求参考（已通过用户消息中的示例数据覆盖核心内容，PDF 作为补充参考） | 无（需求已由用户消息完整覆盖） |

---

## 数据共享配置

| 存储键名 | 数据说明 | 使用页面 |
|---------|---------|---------|
| `__app_scheduler_teamMembers` | 班组人员信息列表，类型为 `ITeamMember[]` | 班组管理、排班配置（数据校验时读取） |
| `__app_scheduler_shiftTypes` | 班次基本信息列表，类型为 `IShiftType[]` | 班组管理、排班配置 |
| `__app_scheduler_attendance` | 人员出勤信息列表，类型为 `IAttendance[]` | 人员信息、排班配置（数据校验时读取） |
| `__app_scheduler_teamScheduleRecords` | 班组排班记录列表，类型为 `ITeamScheduleRecord[]` | 班组排班记录、排班配置（排班逻辑读取当前状态） |
| `__app_scheduler_scheduleResults` | 排班结果列表，类型为 `IScheduleResult[]` | 排班结果、排班配置（排班完成后写入） |

```ts
interface ITeamMember {
  id: string;
  name: string;
  team: 'A1' | 'A2' | 'A3' | 'B';
  shiftType: '早晚班' | '长白班';
  role: '组长' | '组员';
  skills: string[]; // 如 ['电工', '注塑维修']
}

interface IShiftType {
  id: string;
  shiftCategory: '早晚班' | '长白班';
  scheduleRule: string; // 如 '上4休2'
  shiftName: '早班' | '晚班' | '长白班';
  startTime: string; // '07:00'
  endTime: string;   // '19:00'
}

interface IAttendance {
  id: string;
  personName: string;
  team: string;
  startDate: string; // '2026-07-05'
  endDate: string;   // '2026-07-07'
  status: '正常' | '休假' | '事假' | '请假';
  updatedAt: string; // '2026-06-28 10:00'
}

interface ITeamScheduleRecord {
  id: string;
  team: string;
  type: '早晚班' | '长白班';
  currentShift: string;
  currentShiftDate: string;
  nextShift: string;
  nextShiftDate: string;
}

interface IScheduleResult {
  id: string;
  date: string;
  shift: '早班' | '晚班' | '长白班';
  team: string;
  personName: string;
  role: string;
  skills: string;
  status: string;
}
```

---

## 功能列表

> **说明**：每个页面的功能点，供页面生成使用

### 排班配置页
- **页面目标**: 配置排班参数并触发AI自动排班流程
- **功能点**:
  - **配置排班参数**: 表单含周末开机数量（数字输入）、排产开始时间（日期选择器，默认当前日期+1天）、排产结束时间（日期选择器，默认当前日期+7天）、特殊人员排班要求（文本输入，可指定具体日期、具体人员上早班）
  - **触发排班流程**: 点击"开始排班"按钮，依次执行3个节点（数据校验 → AI排班 → 排班结束），每个节点完成后自动推进到下一节点
  - **数据校验节点**: 校验周末开机数量等必填项，读取 localStorage 中的班组、人员、出勤信息，校验通过则显示绿色勾，校验失败则显示红色叉并在页面展示具体错误信息
  - **AI排班节点**: 调用排班AI引擎插件，传入完整排班上下文（日期范围、开机数量、班组轮换状态、人员技能、出勤情况、特殊要求），流式展示AI排班日志（如"正在获取A1班组当前班次..."、"正在匹配早班技能要求..."），最终返回结构化排班计划
  - **排班结束节点**: 将AI返回的排班结果存储到 localStorage（`__app_scheduler_scheduleResults`），更新班组排班记录（`__app_scheduler_teamScheduleRecords`），显示"排班完成"提示，并提供"查看排班结果"按钮跳转到排班结果页

### 排班结果页
- **页面目标**: 查看、筛选和导出已生成的排班计划
- **功能点**:
  - **排班结果表格展示**: 表格列包含日期、班次、班组、人员、角色、技能、状态，支持分页（每页20条）、排序（按日期、班组）
  - **筛选排班结果**: 顶部筛选栏，支持按日期范围、班组（下拉选择）、人员（搜索/下拉选择）筛选，筛选条件变化时实时更新表格数据
  - **导出排班结果**: 点击"导出"按钮，弹出格式选择（CSV / Excel），使用 Blob + a.click 触发下载，导出当前筛选后的排班结果数据

### 班组管理页
- **页面目标**: 管理班组人员信息和班次基本信息
- **功能点**:
  - **班组人员信息 Tab**: 表格展示所有人员（列：人员、班组、班次类型、角色、技能），支持行内编辑（弹出 Dialog 表单）、新增（顶部"新增人员"按钮 → Dialog 表单）、删除（行操作 → 确认弹窗 → 删除），数据变更后同步更新 localStorage
  - **班次基本信息 Tab**: 表格展示所有班次类型（列：班次类型、排班规则、班次、开始时间、结束时间），支持行内编辑、新增、删除，操作方式同人员信息 Tab

### 人员信息页
- **页面目标**: 管理人员的出勤状态记录
- **功能点**:
  - **出勤信息表格展示**: 表格列包含人员、班组、开始日期、结束日期、状态、更新时间，状态列使用 Badge 组件区分（正常=绿色、休假=橙色、请假/事假=红色）
  - **新增出勤记录**: 顶部"新增记录"按钮 → 弹出 Dialog 表单（选择人员、班组、日期范围、状态下拉选择），提交后写入 localStorage 并刷新表格
  - **编辑出勤记录**: 行内"编辑"按钮 → 弹出 Dialog 表单预填当前数据，修改后提交更新
  - **删除出勤记录**: 行内"删除"按钮 → 确认弹窗 → 删除记录

### 班组排班记录页
- **页面目标**: 查看各班组当前的排班状态和轮换情况
- **功能点**:
  - **班组排班记录表格展示**: 表格列包含班组、类型、当前班次、当前班次时间、下一次班次、下一次班次时间，以只读形式展示
  - **排班状态可视化**: 当前班次列使用 Badge 区分（早班=蓝色、晚班=深蓝/紫色、休息=灰色、长白班=绿色），直观展示各班组当前状态

---

## 排班逻辑规则（供AI排班引擎参考）

> **说明**：以下规则作为 AI 排班引擎 prompt 中的约束条件，由 AI 在约束下求解排班方案

### 核心约束
1. **班组轮换**：A1/A2/A3 三个早晚班班组按"上4休2"规则轮换（2天早班 + 2天晚班 + 2天休息），每天2个班组上班、1个班组休息
2. **连续性**：新排班需读取前2天的班组排班记录（`__app_scheduler_teamScheduleRecords`），保持轮换连续性
3. **休息原则**：员工上完一个班次至少休息一个班次，不能连续上2个班次；员工不能连续上7天班
4. **技能匹配**：工作日早班≥5人（含组长，至少1注塑维修+1电工），晚班≥6人（含组长，至少1注塑维修+1电工）
5. **周末规则**：根据开机数量动态计算早晚班人数（公式见需求文档），开机数量=0时不排早班
6. **借调规则**：人员/技能不足时从休息班组借调，优先选择不影响被借调班组技能要求的人员
7. **特殊要求**：支持指定具体日期、具体人员上早班，需校验上班原则，不满足则按借调规则调整

-------

设计规范文档生成失败