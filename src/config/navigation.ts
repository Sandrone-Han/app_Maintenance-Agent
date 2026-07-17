import {
  BarChart3,
  Bot,
  CalendarClock,
  ClipboardList,
  History,
  UserCheck,
  Users,
} from 'lucide-react';

// 全局导航配置：左侧菜单和顶部导航都从这里读取路径、文案和图标。
export const NAV_ITEMS = [
  { path: '/schedule-config', label: '排班配置', icon: CalendarClock },
  { path: '/schedule-result', label: '排班结果', icon: ClipboardList },
  { path: '/employee-agent', label: '员工查询', icon: Bot },
  { path: '/team-manage', label: '班组管理', icon: Users },
  { path: '/personnel', label: '休假信息', icon: UserCheck },
  { path: '/team-schedule-record', label: '排班记录', icon: History },
  { path: '/data-statistics', label: '数据统计', icon: BarChart3 },
] as const;
