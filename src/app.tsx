import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import ScheduleConfigPage from "@/pages/ScheduleConfigPage/ScheduleConfigPage";
import ScheduleResultPage from "@/pages/ScheduleResultPage/ScheduleResultPage";
import TeamManagePage from "@/pages/TeamManagePage/TeamManagePage";
import PersonnelPage from "@/pages/PersonnelPage/PersonnelPage";
import TeamScheduleRecordPage from "@/pages/TeamScheduleRecordPage/TeamScheduleRecordPage";
import DataStatisticsPage from "@/pages/DataStatisticsPage/DataStatisticsPage";
import EmployeeAgentPage from "@/pages/EmployeeAgentPage/EmployeeAgentPage";

// 应用路由总表：所有业务页面都挂在 Layout 之下，共用侧边栏和顶部栏。
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* 默认进入排班配置页，作为排班流程的起点。 */}
        <Route index element={<Navigate to="/schedule-config" replace />} />
        <Route path="schedule-config" element={<ScheduleConfigPage />} />
        <Route path="schedule-result" element={<ScheduleResultPage />} />
        <Route path="team-manage" element={<TeamManagePage />} />
        <Route path="personnel" element={<PersonnelPage />} />
        <Route path="team-schedule-record" element={<TeamScheduleRecordPage />} />
        <Route path="data-statistics" element={<DataStatisticsPage />} />
        <Route path="employee-agent" element={<EmployeeAgentPage />} />
      </Route>
      {/* 兜底路由，处理未配置的访问路径。 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
