import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Clock,
  Layers,
  Repeat2,
  Shuffle,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { IScheduleResult } from '@/data/scheduleresult';
import { apiGet } from '@/lib/api';

type StatisticsTab = 'week' | 'range';

type DateRange = {
  startDate: string;
  endDate: string;
};

type PersonStat = {
  personName: string;
  team: string;
  records: number;
  hours: number;
  early: number;
  late: number;
  day: number;
  borrowed: number;
  adjusted: number;
  swapped: number;
  exceptions: number;
};

type TeamStat = {
  team: string;
  records: number;
  hours: number;
  people: Set<string>;
  borrowed: number;
  adjusted: number;
  swapped: number;
  exceptions: number;
};

type ShiftStat = {
  shift: string;
  records: number;
  hours: number;
  percentage: number;
};

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseDate(dateText: string) {
  return new Date(`${dateText}T00:00:00`);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + mondayOffset);
  return result;
}

function getWeekRange(dateText: string): DateRange {
  const monday = startOfWeek(parseDate(dateText));
  return {
    startDate: formatDate(monday),
    endDate: formatDate(addDays(monday, 6)),
  };
}

function getShiftHours(shift: string) {
  if (shift === '早班' || shift === '晚班') return 12;
  if (shift === '长白班') return 8.5;
  return 0;
}

function isException(result: IScheduleResult) {
  return result.validationResult === '不通过' || Boolean(result.exceptionReason);
}

function uniqueCount(results: IScheduleResult[], key: keyof IScheduleResult, fallbackPredicate: (result: IScheduleResult) => boolean) {
  const values = new Set<string>();
  let fallbackCount = 0;
  for (const result of results) {
    const value = result[key];
    if (typeof value === 'string' && value) {
      values.add(value);
    } else if (fallbackPredicate(result)) {
      fallbackCount += 1;
    }
  }
  return values.size > 0 ? values.size : fallbackCount;
}

function buildStatistics(results: IScheduleResult[]) {
  const personMap = new Map<string, PersonStat>();
  const teamMap = new Map<string, TeamStat>();
  const shiftMap = new Map<string, { records: number; hours: number }>();

  for (const result of results) {
    const team = result.actualTeam || result.team || '未分组';
    const personName = result.personName || '未命名';
    const hours = getShiftHours(result.shift);
    const borrowed = result.isBorrowed === '是' ? 1 : 0;
    const adjusted = result.isAdjusted ? 1 : 0;
    const swapped = result.isSwapped ? 1 : 0;
    const exception = isException(result) ? 1 : 0;

    const person = personMap.get(personName) ?? {
      personName,
      team,
      records: 0,
      hours: 0,
      early: 0,
      late: 0,
      day: 0,
      borrowed: 0,
      adjusted: 0,
      swapped: 0,
      exceptions: 0,
    };
    person.records += 1;
    person.hours += hours;
    person.borrowed += borrowed;
    person.adjusted += adjusted;
    person.swapped += swapped;
    person.exceptions += exception;
    if (result.shift === '早班') person.early += 1;
    if (result.shift === '晚班') person.late += 1;
    if (result.shift === '长白班') person.day += 1;
    personMap.set(personName, person);

    const teamStat = teamMap.get(team) ?? {
      team,
      records: 0,
      hours: 0,
      people: new Set<string>(),
      borrowed: 0,
      adjusted: 0,
      swapped: 0,
      exceptions: 0,
    };
    teamStat.records += 1;
    teamStat.hours += hours;
    teamStat.people.add(personName);
    teamStat.borrowed += borrowed;
    teamStat.adjusted += adjusted;
    teamStat.swapped += swapped;
    teamStat.exceptions += exception;
    teamMap.set(team, teamStat);

    const shift = shiftMap.get(result.shift) ?? { records: 0, hours: 0 };
    shift.records += 1;
    shift.hours += hours;
    shiftMap.set(result.shift, shift);
  }

  const totalHours = Array.from(personMap.values()).reduce((sum, item) => sum + item.hours, 0);
  const shiftStats: ShiftStat[] = Array.from(shiftMap.entries())
    .map(([shift, item]) => ({
      shift,
      records: item.records,
      hours: item.hours,
      percentage: results.length > 0 ? (item.records / results.length) * 100 : 0,
    }))
    .sort((a, b) => getShiftOrder(a.shift) - getShiftOrder(b.shift));

  return {
    totalRecords: results.length,
    totalHours,
    peopleCount: personMap.size,
    teamCount: teamMap.size,
    exceptionCount: results.filter(isException).length,
    borrowedCount: results.filter((item) => item.isBorrowed === '是').length,
    adjustedCount: uniqueCount(results, 'adjustmentId', (item) => Boolean(item.isAdjusted)),
    swappedCount: uniqueCount(results, 'swapId', (item) => Boolean(item.isSwapped)),
    personStats: Array.from(personMap.values()).sort((a, b) => {
      if (b.hours !== a.hours) return b.hours - a.hours;
      return a.personName.localeCompare(b.personName, 'zh-Hans-CN');
    }),
    teamStats: Array.from(teamMap.values()).sort((a, b) => a.team.localeCompare(b.team, 'zh-Hans-CN')),
    shiftStats,
  };
}

function getShiftOrder(shift: string) {
  if (shift === '早班') return 1;
  if (shift === '晚班') return 2;
  if (shift === '长白班') return 3;
  return 9;
}

function ProgressBar({ value, className }: { value: number; className: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: typeof BarChart3;
  tone: string;
}) {
  return (
    <Card className="rounded-[8px] border-border shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-[8px] ${tone}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{title}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatisticsContent({
  results,
  range,
  isLoading,
}: {
  results: IScheduleResult[];
  range: DateRange;
  isLoading: boolean;
}) {
  const stats = useMemo(() => buildStatistics(results), [results]);
  const maxPersonHours = Math.max(...stats.personStats.map((item) => item.hours), 1);
  const maxTeamHours = Math.max(...stats.teamStats.map((item) => item.hours), 1);

  if (isLoading) {
    return (
      <Card className="rounded-[8px] border-border shadow-sm">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">正在生成统计...</CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="rounded-[8px] border-border shadow-sm">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">当前时间范围内暂无排班结果</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="排班记录数" value={String(stats.totalRecords)} icon={CalendarClock} tone="bg-blue-100 text-blue-700" />
        <SummaryCard title="总工时" value={`${stats.totalHours.toFixed(1)}h`} icon={Clock} tone="bg-emerald-100 text-emerald-700" />
        <SummaryCard title="参与人数" value={String(stats.peopleCount)} icon={Users} tone="bg-indigo-100 text-indigo-700" />
        <SummaryCard title="参与班组" value={String(stats.teamCount)} icon={Layers} tone="bg-sky-100 text-sky-700" />
        <SummaryCard title="异常数" value={String(stats.exceptionCount)} icon={AlertTriangle} tone="bg-amber-100 text-amber-700" />
        <SummaryCard title="借调数" value={String(stats.borrowedCount)} icon={Repeat2} tone="bg-cyan-100 text-cyan-700" />
        <SummaryCard title="临时调整数" value={String(stats.adjustedCount)} icon={Shuffle} tone="bg-violet-100 text-violet-700" />
        <SummaryCard title="换班数" value={String(stats.swappedCount)} icon={BarChart3} tone="bg-rose-100 text-rose-700" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Card className="rounded-[8px] border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">人员统计</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>人员</TableHead>
                    <TableHead>班组</TableHead>
                    <TableHead>班次数</TableHead>
                    <TableHead>总工时</TableHead>
                    <TableHead>班次分布</TableHead>
                    <TableHead>工时占比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.personStats.map((item) => (
                    <TableRow key={item.personName}>
                      <TableCell className="font-medium">{item.personName}</TableCell>
                      <TableCell>{item.team}</TableCell>
                      <TableCell>{item.records}</TableCell>
                      <TableCell>{item.hours.toFixed(1)}h</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        早 {item.early} / 晚 {item.late} / 长白 {item.day}
                      </TableCell>
                      <TableCell className="min-w-32">
                        <ProgressBar value={(item.hours / maxPersonHours) * 100} className="bg-blue-500" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[8px] border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">班次分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.shiftStats.map((item) => (
              <div key={item.shift} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.shift}</span>
                  <span className="text-muted-foreground">
                    {item.records} 次 / {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar
                  value={item.percentage}
                  className={item.shift === '早班' ? 'bg-blue-500' : item.shift === '晚班' ? 'bg-indigo-500' : 'bg-emerald-500'}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[8px] border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">班组统计</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>班组</TableHead>
                  <TableHead>人数</TableHead>
                  <TableHead>班次数</TableHead>
                  <TableHead>总工时</TableHead>
                  <TableHead>调整</TableHead>
                  <TableHead>工时占比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.teamStats.map((item) => (
                  <TableRow key={item.team}>
                    <TableCell className="font-medium">{item.team}</TableCell>
                    <TableCell>{item.people.size}</TableCell>
                    <TableCell>{item.records}</TableCell>
                    <TableCell>{item.hours.toFixed(1)}h</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">借 {item.borrowed}</Badge>
                        <Badge variant="secondary">调 {item.adjusted}</Badge>
                        <Badge variant="secondary">换 {item.swapped}</Badge>
                        <Badge variant="secondary">异常 {item.exceptions}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-32">
                      <ProgressBar value={(item.hours / maxTeamHours) * 100} className="bg-indigo-500" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-[8px] border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">异常与调整概览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: '异常记录', value: stats.exceptionCount, tone: 'bg-amber-500' },
              { label: '借调记录', value: stats.borrowedCount, tone: 'bg-cyan-500' },
              { label: '请假替班', value: stats.adjustedCount, tone: 'bg-violet-500' },
              { label: '换班记录', value: stats.swappedCount, tone: 'bg-rose-500' },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">{item.value}</span>
                </div>
                <ProgressBar value={stats.totalRecords > 0 ? (item.value / stats.totalRecords) * 100 : 0} className={item.tone} />
              </div>
            ))}
            <div className="rounded-[8px] bg-muted/50 p-3 text-xs text-muted-foreground">
              统计范围：{range.startDate} 至 {range.endDate}。数据按排班结果的调整后人员和班组统计。
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DataStatisticsPage() {
  const [activeTab, setActiveTab] = useState<StatisticsTab>('week');
  const [weekDate, setWeekDate] = useState(formatDate(new Date()));
  const [customStartDate, setCustomStartDate] = useState(getWeekRange(formatDate(new Date())).startDate);
  const [customEndDate, setCustomEndDate] = useState(getWeekRange(formatDate(new Date())).endDate);
  const [appliedRange, setAppliedRange] = useState<DateRange>(getWeekRange(formatDate(new Date())));
  const [results, setResults] = useState<IScheduleResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const weekRange = useMemo(() => getWeekRange(weekDate), [weekDate]);
  const currentRange = activeTab === 'week' ? weekRange : appliedRange;
  const isCustomRangeInvalid = customStartDate > customEndDate;

  useEffect(() => {
    let canceled = false;
    const loadStatistics = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const params = new URLSearchParams();
        params.set('startDate', currentRange.startDate);
        params.set('endDate', currentRange.endDate);
        const data = await apiGet<IScheduleResult[]>(`/schedule-results?${params.toString()}`);
        if (!canceled) setResults(data);
      } catch (error) {
        if (!canceled) {
          setResults([]);
          setErrorMessage(String(error));
        }
      } finally {
        if (!canceled) setIsLoading(false);
      }
    };

    void loadStatistics();
    return () => {
      canceled = true;
    };
  }, [currentRange.startDate, currentRange.endDate]);

  const changeWeek = (days: number) => {
    setWeekDate(formatDate(addDays(parseDate(weekDate), days)));
  };

  const applyCustomRange = () => {
    if (isCustomRangeInvalid) return;
    setAppliedRange({ startDate: customStartDate, endDate: customEndDate });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[8px] border-border shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl font-bold">数据统计</CardTitle>
          <p className="text-sm text-muted-foreground">按周或自选时间段统计排班执行情况、工时、班组负荷和调整记录。</p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as StatisticsTab)} className="space-y-4">
            <TabsList>
              <TabsTrigger value="week">按周统计</TabsTrigger>
              <TabsTrigger value="range">自选时间段统计</TabsTrigger>
            </TabsList>

            <TabsContent value="week" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">选择周内日期</Label>
                  <Input type="date" value={weekDate} onChange={(event) => setWeekDate(event.target.value)} className="h-9 w-44" />
                </div>
                <Button variant="outline" onClick={() => changeWeek(-7)} className="rounded-[8px]">上一周</Button>
                <Button variant="outline" onClick={() => changeWeek(7)} className="rounded-[8px]">下一周</Button>
                <div className="text-sm text-muted-foreground">
                  统计范围：{weekRange.startDate} 至 {weekRange.endDate}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="range" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">开始日期</Label>
                  <Input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} className="h-9 w-44" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">结束日期</Label>
                  <Input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} className="h-9 w-44" />
                </div>
                <Button onClick={applyCustomRange} disabled={isCustomRangeInvalid} className="rounded-[8px]">生成统计</Button>
                {isCustomRangeInvalid ? (
                  <div className="text-sm text-red-600">开始日期不能晚于结束日期</div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    当前统计：{appliedRange.startDate} 至 {appliedRange.endDate}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {errorMessage && (
        <Card className="rounded-[8px] border-red-200 bg-red-50 shadow-sm">
          <CardContent className="p-4 text-sm text-red-700">统计数据加载失败：{errorMessage}</CardContent>
        </Card>
      )}

      <StatisticsContent results={results} range={currentRange} isLoading={isLoading} />
    </div>
  );
}
