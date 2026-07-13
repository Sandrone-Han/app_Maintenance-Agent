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

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/schedule-config" replace />} />
        <Route path="schedule-config" element={<ScheduleConfigPage />} />
        <Route path="schedule-result" element={<ScheduleResultPage />} />
        <Route path="team-manage" element={<TeamManagePage />} />
        <Route path="personnel" element={<PersonnelPage />} />
        <Route path="team-schedule-record" element={<TeamScheduleRecordPage />} />
        <Route path="data-statistics" element={<DataStatisticsPage />} />
        <Route path="employee-agent" element={<EmployeeAgentPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
