import { useState, useMemo } from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, CalendarClock, Clock, Layers } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { IScheduleResult } from '@/data/scheduleresult';
import type { ITeamMember } from '@/data/teammembers';
import { MOCK_SCHEDULE_RESULTS } from '@/data/scheduleresult';
import { MOCK_TEAM_MEMBERS } from '@/data/teammembers';

const SCHEDULE_KEY = '__app_scheduler_scheduleResults';
const TEAM_MEMBERS_KEY = '__app_scheduler_teamMembers';

function loadScheduleResults(): IScheduleResult[] {
  try {
    const raw = scopedStorage.getItem(SCHEDULE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as IScheduleResult[];
    }
  } catch { /* ignore */ }
  return MOCK_SCHEDULE_RESULTS;
}

function loadTeamMembers(): ITeamMember[] {
  try {
    const raw = scopedStorage.getItem(TEAM_MEMBERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as ITeamMember[];
    }
  } catch { /* ignore */ }
  return MOCK_TEAM_MEMBERS;
}

export default function DataStatisticsPage() {
  const [scheduleResults] = useState<IScheduleResult[]>(loadScheduleResults);
  const [teamMembers] = useState<ITeamMember[]>(loadTeamMembers);

  const getShiftHours = (shift: string): number => {
    switch (shift) {
      case '早班':
      case '晚班':
        return 12;
      case '长白班':
        return 8.5;
      default:
        return 0;
    }
  };

  const stats = useMemo(() => {
    const totalPersons = teamMembers.length;
    const totalScheduleRecords = scheduleResults.length;
    
    const personHours = scheduleResults.reduce((acc, result) => {
      if (!acc[result.personName]) {
        acc[result.personName] = { hours: 0, team: result.team };
      }
      acc[result.personName].hours += getShiftHours(result.shift);
      return acc;
    }, {} as Record<string, { hours: number; team: string }>);

    const shiftStats = scheduleResults.reduce((acc, result) => {
      if (!acc[result.shift]) acc[result.shift] = 0;
      acc[result.shift]++;
      return acc;
    }, {} as Record<string, number>);

    const maxHours = Math.max(...Object.values(personHours).map((p) => p.hours), 1);

    const totalWorkHours = Object.values(personHours).reduce((sum, p) => sum + p.hours, 0);
    
    const teamCount = [...new Set(teamMembers.map((m) => m.team))].length;

    return { totalPersons, totalScheduleRecords, personHours, shiftStats, maxHours, totalWorkHours, teamCount };
  }, [teamMembers, scheduleResults]);

  return (
    <div className="space-y-6">
      <Card className="rounded-[32px] border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-black italic tracking-tighter">数据统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50">
              <div className="size-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Users className="size-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalPersons}</div>
                <div className="text-sm text-muted-foreground">总人数</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50">
              <div className="size-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Layers className="size-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.teamCount}</div>
                <div className="text-sm text-muted-foreground">班组数量</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50">
              <div className="size-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <CalendarClock className="size-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalScheduleRecords}</div>
                <div className="text-sm text-muted-foreground">排班记录数</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50">
              <div className="size-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock className="size-6" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalWorkHours.toFixed(0)}h</div>
                <div className="text-sm text-muted-foreground">总工时</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="rounded-[32px] border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black italic tracking-tighter">人员上班时长统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-2 h-64 min-w-max px-2">
                {Object.entries(stats.personHours)
                  .sort((a, b) => b[1].hours - a[1].hours)
                  .map(([personName, data]) => {
                    const heightPercentage = (data.hours / stats.maxHours) * 100;
                    const teamColor = data.team === 'A1' ? 'bg-blue-500' : data.team === 'A2' ? 'bg-blue-700' : data.team === 'A3' ? 'bg-indigo-500' : 'bg-gray-500';
                    return (
                      <div key={personName} className="flex flex-col items-center" style={{ width: '28px' }}>
                        <div className="text-xs font-bold mb-1">{data.hours.toFixed(0)}h</div>
                        <div className="w-full bg-muted rounded-b-lg overflow-hidden flex flex-col justify-end" style={{ height: '180px' }}>
                          <div
                            className={`w-full rounded-t-lg transition-all duration-500 ${teamColor}`}
                            style={{ height: `${heightPercentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-center mt-1 truncate w-full">{personName}</div>
                        <div className="text-xs text-muted-foreground">{data.team}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-black italic tracking-tighter">班次统计</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">班次</TableHead>
                  <TableHead className="whitespace-nowrap">次数</TableHead>
                  <TableHead className="whitespace-nowrap">占比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(stats.shiftStats).map(([shift, count]) => {
                  const percentage = ((count / stats.totalScheduleRecords) * 100).toFixed(1);
                  return (
                    <TableRow key={shift}>
                      <TableCell className="font-medium">{shift}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${shift === '早班' ? 'bg-blue-500' : shift === '晚班' ? 'bg-blue-700' : 'bg-gray-400'}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm w-12">{percentage}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[32px] border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-black italic tracking-tighter">技能分布</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">技能</TableHead>
                <TableHead className="whitespace-nowrap">人数</TableHead>
                <TableHead className="whitespace-nowrap">占比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const skillStats = teamMembers.reduce((acc, member) => {
                  member.skills.forEach((skill) => {
                    if (!acc[skill]) acc[skill] = 0;
                    acc[skill]++;
                  });
                  return acc;
                }, {} as Record<string, number>);

                return Object.entries(skillStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([skill, count]) => {
                    const percentage = ((count / stats.totalPersons) * 100).toFixed(1);
                    return (
                      <TableRow key={skill}>
                        <TableCell className="font-medium">{skill}</TableCell>
                        <TableCell>{count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500" style={{ width: `${percentage}%` }} />
                            </div>
                            <span className="text-sm w-12">{percentage}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
