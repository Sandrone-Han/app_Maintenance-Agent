import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiPost } from '@/lib/api';

type TeamMember = {
  id: string;
  name: string;
  team: string;
};

type SpecialRequirementAction =
  | 'mustWork'
  | 'mustRest'
  | 'cannotWork'
  | 'cannotShift'
  | 'onlyShift';

type SpecialRequirement = {
  id: string;
  personName: string;
  date: string;
  shift: string;
  action: SpecialRequirementAction;
};

type ScheduleJobResponse = {
  id: string;
  status: string;
  resultCount: number;
  exceptionCount: number;
  logs: string[];
};

type FlowNodeStatus = 'pending' | 'active' | 'success' | 'warning' | 'failed';

const shiftOptions = ['早班', '晚班', '长白班'];
const actionOptions: Array<{ value: SpecialRequirementAction; label: string; needsShift: boolean }> = [
  { value: 'mustWork', label: '必须上指定班次', needsShift: true },
  { value: 'mustRest', label: '必须休息', needsShift: false },
  { value: 'cannotWork', label: '不能上班', needsShift: false },
  { value: 'cannotShift', label: '不能上指定班次', needsShift: true },
  { value: 'onlyShift', label: '只能上指定班次', needsShift: true },
];

const flowNodes = [
  { title: '提交参数', description: '日期、开机数、特殊要求' },
  { title: '校验基础数据', description: '检查必填项和日期范围' },
  { title: '读取业务数据', description: '人员、出勤、班组记录' },
  { title: '推导班组轮换', description: 'A1/A2/A3 上4休2' },
  { title: '生成长白班', description: 'B 组长白班排入' },
  { title: '计算班次要求', description: '早晚班人数和技能' },
  { title: '处理特殊要求', description: '指定上班、休息、禁排' },
  { title: '执行借调补齐', description: '从休息班组补人' },
  { title: '校验规则异常', description: '休假、连续班、技能' },
  { title: '写入结果日志', description: '保存排班和任务日志' },
];

const flowStatusStyles: Record<FlowNodeStatus, string> = {
  pending: 'border-border bg-muted/30 text-muted-foreground',
  active: 'border-blue-300 bg-blue-50 text-blue-950 ring-1 ring-blue-200',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  warning: 'border-amber-300 bg-amber-50 text-amber-950',
  failed: 'border-red-300 bg-red-50 text-red-950',
};

const flowIconStyles: Record<FlowNodeStatus, string> = {
  pending: 'border-muted-foreground/30 bg-background text-muted-foreground',
  active: 'border-blue-300 bg-blue-100 text-blue-700',
  success: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  warning: 'border-amber-300 bg-amber-100 text-amber-700',
  failed: 'border-red-300 bg-red-100 text-red-700',
};

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getFlowNodeStatus(index: number, isProcessing: boolean, lastJob: ScheduleJobResponse | null, errorMessage: string): FlowNodeStatus {
  if (lastJob?.status === 'COMPLETED') return 'success';
  if (lastJob?.status === 'COMPLETED_WITH_WARNINGS') return index === 8 ? 'warning' : 'success';
  if (lastJob?.status === 'FAILED' || errorMessage) {
    if (index === 1) return 'failed';
    return index === 0 ? 'success' : 'pending';
  }
  if (isProcessing) {
    if (index < 2) return 'success';
    return index === 2 ? 'active' : 'pending';
  }
  return 'pending';
}

function getFlowNodeIcon(status: FlowNodeStatus) {
  if (status === 'success') return <CheckCircle2 className="size-4" />;
  if (status === 'warning' || status === 'failed') return <AlertTriangle className="size-4" />;
  if (status === 'active') return <Loader2 className="size-4 animate-spin" />;
  return <CalendarClock className="size-4" />;
}

export default function ScheduleConfigPage() {
  const navigate = useNavigate();
  const [weekendMachineCount, setWeekendMachineCount] = useState('0');
  const [startDate, setStartDate] = useState(() => formatDate(addDays(new Date(), 1)));
  const [endDate, setEndDate] = useState(() => formatDate(addDays(new Date(), 7)));
  const [specialRequirements, setSpecialRequirements] = useState<SpecialRequirement[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastJob, setLastJob] = useState<ScheduleJobResponse | null>(null);

  useEffect(() => {
    apiGet<TeamMember[]>('/team-members')
      .then(setTeamMembers)
      .catch((error) => {
        toast.error('人员数据加载失败', { description: String(error) });
      });
  }, []);

  const personNames = useMemo(() => {
    return Array.from(new Set(teamMembers.map((member) => member.name))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [teamMembers]);

  const canSubmit = useMemo(() => {
    const count = Number(weekendMachineCount);
    return (
      Number.isInteger(count) &&
      count >= 0 &&
      startDate !== '' &&
      endDate !== '' &&
      new Date(`${startDate}T00:00:00`) <= new Date(`${endDate}T00:00:00`)
    );
  }, [endDate, startDate, weekendMachineCount]);

  const getSpecialRequirementError = (item: SpecialRequirement, index: number) => {
    const label = `特殊要求第 ${index + 1} 行`;
    const option = actionOptions.find((action) => action.value === item.action);
    if (!item.personName) return `${label}：请选择人员`;
    if (!item.date) return `${label}：请选择日期`;
    if (new Date(`${item.date}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
      return `${label}：日期不能早于排产开始时间`;
    }
    if (new Date(`${item.date}T00:00:00`) > new Date(`${endDate}T00:00:00`)) {
      return `${label}：日期不能晚于排产结束时间`;
    }
    if (option?.needsShift && !item.shift) return `${label}：请选择班次`;
    return '';
  };

  const specialRequirementErrors = useMemo(() => {
    return specialRequirements
      .map((item, index) => ({ id: item.id, message: getSpecialRequirementError(item, index) }))
      .filter((item) => item.message);
  }, [endDate, specialRequirements, startDate]);

  const addSpecialRequirement = () => {
    if (personNames.length === 0) {
      toast.warning('人员数据还在加载，暂时不能添加特殊要求');
      return;
    }
    setSpecialRequirements((prev) => [
      ...prev,
      {
        id: createId(),
        personName: personNames[0],
        date: startDate,
        shift: '早班',
        action: 'mustWork',
      },
    ]);
  };

  const removeSpecialRequirement = (id: string) => {
    setSpecialRequirements((prev) => prev.filter((item) => item.id !== id));
  };

  const updateSpecialRequirement = (
    id: string,
    field: keyof SpecialRequirement,
    value: string,
  ) => {
    setSpecialRequirements((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        if (field === 'action' && !actionOptions.find((option) => option.value === value)?.needsShift) {
          next.shift = '';
        }
        if (field === 'action' && actionOptions.find((option) => option.value === value)?.needsShift && !next.shift) {
          next.shift = '早班';
        }
        return next;
      }),
    );
  };

  const startSchedule = async () => {
    if (!canSubmit || isProcessing) return;
    if (specialRequirementErrors.length > 0) {
      const message = specialRequirementErrors[0].message;
      setErrorMessage(message);
      setLogs((prev) => [...prev, `排班失败：${message}`]);
      toast.error('特殊排班要求未填写完整', { description: message });
      return;
    }

    setIsProcessing(true);
    setLogs(['开始提交排班任务...']);
    setErrorMessage('');
    setLastJob(null);

    try {
      const response = await apiPost<ScheduleJobResponse>('/schedule-jobs', {
        weekendMachineCount: Number(weekendMachineCount),
        startDate,
        endDate,
        specialRequirements: specialRequirements.map((item) => ({
            personName: item.personName,
            date: item.date,
            shift: item.shift,
            action: item.action,
        })),
      });

      setLastJob(response);
      setLogs(['排班任务已完成', ...response.logs]);

      if (response.status === 'COMPLETED_WITH_WARNINGS') {
        toast.warning('排班完成，但存在异常', {
          description: `生成 ${response.resultCount} 条结果，异常 ${response.exceptionCount} 个`,
        });
      } else if (response.status === 'FAILED') {
        toast.error('排班失败', { description: `异常 ${response.exceptionCount} 个` });
      } else {
        toast.success('排班任务已完成', { description: `生成 ${response.resultCount} 条结果` });
      }
    } catch (error) {
      const message = String(error);
      setErrorMessage(message);
      setLogs((prev) => [...prev, `排班失败：${message}`]);
      toast.error('排班失败', { description: message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[8px] border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <CalendarClock className="size-5" />
            排班配置
          </CardTitle>
          <CardDescription>
            按 Word 规则文档执行确定性排班，结果会写入 Oracle 数据库。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="weekendMachineCount">周末开机数量</Label>
              <Input
                id="weekendMachineCount"
                type="number"
                min="0"
                value={weekendMachineCount}
                onChange={(event) => setWeekendMachineCount(event.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">排产开始时间</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">排产结束时间</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>特殊人员排班要求</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSpecialRequirement}
                disabled={isProcessing || personNames.length === 0}
                className="rounded-[8px]"
              >
                <Plus className="size-4" />
                {personNames.length === 0 ? '人员加载中' : '添加'}
              </Button>
            </div>

            {specialRequirements.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
                暂无特殊排班要求
              </div>
            ) : (
              <div className="space-y-2">
                {specialRequirements.map((item) => {
                  const needsShift = actionOptions.find((option) => option.value === item.action)?.needsShift;
                  const rowError = getSpecialRequirementError(item, specialRequirements.findIndex((current) => current.id === item.id));
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                        <Select
                          value={item.personName}
                          onValueChange={(value) => updateSpecialRequirement(item.id, 'personName', value)}
                          disabled={isProcessing}
                        >
                          <SelectTrigger className={rowError.includes('人员') ? 'border-destructive' : ''}>
                            <SelectValue placeholder="选择人员" />
                          </SelectTrigger>
                          <SelectContent>
                            {personNames.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={item.date}
                          onChange={(event) => updateSpecialRequirement(item.id, 'date', event.target.value)}
                          disabled={isProcessing}
                          className={rowError.includes('日期') ? 'border-destructive' : ''}
                        />
                        <Select
                          value={item.action}
                          onValueChange={(value) => updateSpecialRequirement(item.id, 'action', value)}
                          disabled={isProcessing}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择要求" />
                          </SelectTrigger>
                          <SelectContent>
                            {actionOptions.map((action) => (
                              <SelectItem key={action.value} value={action.value}>
                                {action.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={needsShift ? item.shift : 'no-shift'}
                          onValueChange={(value) => updateSpecialRequirement(item.id, 'shift', value)}
                          disabled={isProcessing || !needsShift}
                        >
                          <SelectTrigger className={rowError.includes('班次') ? 'border-destructive' : ''}>
                            <SelectValue placeholder={needsShift ? '选择班次' : '无需班次'} />
                          </SelectTrigger>
                          <SelectContent>
                            {!needsShift && <SelectItem value="no-shift">无需班次</SelectItem>}
                            {shiftOptions.map((shift) => (
                              <SelectItem key={shift} value={shift}>
                                {shift}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSpecialRequirement(item.id)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      {rowError && (
                        <p className="text-xs text-destructive">{rowError}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={() => void startSchedule()}
              disabled={!canSubmit || isProcessing}
              className="rounded-[8px]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  排班中
                </>
              ) : (
                <>
                  <CalendarClock className="size-4" />
                  开始排班
                </>
              )}
            </Button>
            {lastJob && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/schedule-result')}
                className="rounded-[8px]"
              >
                查看排班结果
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[8px] border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            {lastJob ? <CheckCircle2 className="size-5 text-emerald-600" /> : <CalendarClock className="size-5" />}
            排班流程
          </CardTitle>
          <CardDescription>
            {lastJob
              ? `任务 ${lastJob.id} 状态 ${lastJob.status}，生成 ${lastJob.resultCount} 条结果，异常 ${lastJob.exceptionCount} 个。`
              : '排班日志会在这里展示。'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[8px] border bg-background p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {flowNodes.map((node, index) => {
                const status = getFlowNodeStatus(index, isProcessing, lastJob, errorMessage);
                return (
                  <div key={node.title} className="flex min-w-0 items-stretch gap-2">
                    <div className={`flex min-h-[104px] flex-1 flex-col justify-between rounded-[8px] border p-3 ${flowStatusStyles[status]}`}>
                      <div className="flex items-start gap-3">
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${flowIconStyles[status]}`}>
                          {getFlowNodeIcon(status)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-5">{node.title}</p>
                          <p className="mt-1 text-xs leading-5 opacity-80">{node.description}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs opacity-70">步骤 {index + 1}</p>
                    </div>
                    {index < flowNodes.length - 1 && (
                      <div className="hidden w-5 shrink-0 items-center justify-center text-muted-foreground xl:flex">
                        <ArrowRight className="size-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-3 rounded-[8px] border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}
          <div className="max-h-80 overflow-y-auto rounded-[8px] border bg-muted/40 p-4">
            {logs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无日志</p>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, index) => (
                  <p key={`${index}-${log}`} className="text-foreground/80">
                    {log}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
