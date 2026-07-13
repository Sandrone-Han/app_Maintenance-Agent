import { useMemo, useState } from 'react';
import { Users, Workflow } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { IScheduleResult } from '@/data/scheduleresult';
import { cn } from '@/lib/utils';

type SwimlaneMode = 'person' | 'team';

type SwimlaneCell = {
  key: string;
  shift: string;
  team: string;
  personName: string;
  role: string;
  skills: string;
  isBorrowed: string;
  originalTeam: string;
  actualTeam: string;
  borrowReason: string;
  validationResult: string;
  exceptionReason: string;
};

const MODE_CONFIG: Record<SwimlaneMode, {
  title: string;
  description: string;
  laneHeader: string;
  cellSubLabel: string;
}> = {
  person: {
    title: '人员泳道图',
    description: '点击“人员图”后，按人员逐行展示每个人在各日期的排班。',
    laneHeader: '人员',
    cellSubLabel: '班组',
  },
  team: {
    title: '班组泳道图',
    description: '点击“班组图”后，按班组逐行展示各班组在各日期的排班。',
    laneHeader: '班组',
    cellSubLabel: '人员',
  },
};

const SHIFT_ORDER: Record<string, number> = {
  早班: 1,
  晚班: 2,
  长白班: 3,
};

const SHIFT_CHIP_STYLES: Record<string, string> = {
  早班: 'border-blue-300 bg-blue-50 text-blue-900',
  晚班: 'border-indigo-300 bg-indigo-50 text-indigo-900',
  长白班: 'border-emerald-300 bg-emerald-50 text-emerald-900',
};

const VALIDATION_MARK_STYLES: Record<string, string> = {
  不通过: 'border-red-400 ring-1 ring-red-300',
  已确认: 'border-amber-400 ring-1 ring-amber-300',
};

function formatChartDate(date: string) {
  const [, month, day] = date.split('-');
  return month && day ? `${month}-${day}` : date;
}

function getLaneName(result: IScheduleResult, mode: SwimlaneMode) {
  if (mode === 'team') return result.actualTeam || result.team || '未分组';
  return result.personName || '未命名';
}

function getCellTitle(item: SwimlaneCell) {
  return [
    `${item.personName} ${item.shift}`,
    `班组：${item.actualTeam || item.team}`,
    `角色：${item.role || '-'}`,
    `技能：${item.skills || '-'}`,
    item.isBorrowed === '是' ? `借调：${item.originalTeam} -> ${item.actualTeam}` : '',
    item.borrowReason ? `借调原因：${item.borrowReason}` : '',
    item.validationResult ? `校验：${item.validationResult}` : '',
    item.exceptionReason ? `异常原因：${item.exceptionReason}` : '',
  ].filter(Boolean).join('\n');
}

export function ScheduleSwimlaneChart({ results }: { results: IScheduleResult[] }) {
  const [mode, setMode] = useState<SwimlaneMode>('person');
  const activeMode = MODE_CONFIG[mode];

  const { dateList, laneList, cellMap } = useMemo(() => {
    const dates = Array.from(new Map(
      results.map((item) => [item.date, item.weekdayName]),
    ).entries()).sort(([dateA], [dateB]) => dateA.localeCompare(dateB));

    const lanes = Array.from(new Set(
      results.map((item) => getLaneName(item, mode)),
    )).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

    const cells = new Map<string, SwimlaneCell[]>();
    for (const item of results) {
      const lane = getLaneName(item, mode);
      const key = `${lane}__${item.date}`;
      const list = cells.get(key) ?? [];
      list.push({
        key: item.id,
        shift: item.shift,
        team: item.team,
        personName: item.personName,
        role: item.role,
        skills: item.skills,
        isBorrowed: item.isBorrowed,
        originalTeam: item.originalTeam,
        actualTeam: item.actualTeam,
        borrowReason: item.borrowReason,
        validationResult: item.validationResult,
        exceptionReason: item.exceptionReason,
      });
      cells.set(key, list);
    }

    for (const list of cells.values()) {
      list.sort((a, b) => {
        const shiftOrder = (SHIFT_ORDER[a.shift] ?? 99) - (SHIFT_ORDER[b.shift] ?? 99);
        if (shiftOrder !== 0) return shiftOrder;
        return a.personName.localeCompare(b.personName, 'zh-Hans-CN');
      });
    }

    return { dateList: dates, laneList: lanes, cellMap: cells };
  }, [mode, results]);

  return (
    <Card className="rounded-[8px] border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold">{activeMode.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeMode.description}
            </p>
          </div>
          <div className="flex rounded-[8px] border border-border bg-background p-1">
            <Button
              type="button"
              variant={mode === 'person' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('person')}
              aria-pressed={mode === 'person'}
              className="h-8 rounded-[6px]"
            >
              <Users className="size-4" />
              人员图
            </Button>
            <Button
              type="button"
              variant={mode === 'team' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('team')}
              aria-pressed={mode === 'team'}
              className="h-8 rounded-[6px]"
            >
              <Workflow className="size-4" />
              班组图
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            当前筛选条件下暂无排班结果
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[8px] border border-border">
            <div
              key={mode}
              className="grid min-w-max"
              style={{
                gridTemplateColumns: `140px repeat(${dateList.length}, minmax(112px, 1fr))`,
              }}
            >
              <div className="sticky left-0 z-20 border-b border-r border-border bg-muted/80 px-3 py-3 text-xs font-bold text-muted-foreground">
                {activeMode.laneHeader}
              </div>
              {dateList.map(([date, weekday]) => (
                <div key={date} className="border-b border-r border-border bg-muted/60 px-3 py-2 text-center">
                  <div className="text-xs font-semibold text-foreground">{formatChartDate(date)}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{weekday}</div>
                </div>
              ))}

              {laneList.map((lane) => (
                <div key={lane} className="contents">
                  <div className="sticky left-0 z-10 flex min-h-16 items-center border-r border-b border-border bg-background px-3 text-sm font-medium">
                    <span className="truncate" title={lane}>{lane}</span>
                  </div>
                  {dateList.map(([date]) => {
                    const items = cellMap.get(`${lane}__${date}`) ?? [];
                    return (
                      <div key={`${lane}-${date}`} className="min-h-16 border-r border-b border-border bg-background p-2">
                        {items.length === 0 ? (
                          <div className="h-full rounded-[6px] bg-muted/30" />
                        ) : (
                          <div className="flex h-full flex-col gap-1.5">
                            {items.map((item) => (
                              <div
                                key={item.key}
                                title={getCellTitle(item)}
                                className={cn(
                                  'relative min-h-8 rounded-[6px] border px-2 py-1 text-xs leading-tight',
                                  SHIFT_CHIP_STYLES[item.shift] ?? 'border-gray-300 bg-gray-50 text-gray-900',
                                  VALIDATION_MARK_STYLES[item.validationResult],
                                )}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold">{item.shift}</span>
                                  {item.isBorrowed === '是' && (
                                    <span className="rounded bg-white/80 px-1 text-[10px] font-bold text-amber-700">
                                      借
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 truncate text-[11px]">
                                  {activeMode.cellSubLabel}：{mode === 'team' ? item.personName : item.actualTeam || item.team}
                                </div>
                                {item.validationResult === '不通过' && (
                                  <span className="absolute right-1 top-1 size-1.5 rounded-full bg-red-500" />
                                )}
                                {item.validationResult === '已确认' && (
                                  <span className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-500" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
