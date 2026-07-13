import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download, Pencil, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IScheduleResult } from '@/data/scheduleresult';
import { API_BASE_URL, apiGet, apiPut } from '@/lib/api';
import { ScheduleSwimlaneChart } from './ScheduleSwimlaneChart';

const SHIFT_STYLES: Record<string, string> = {
  早班: 'bg-blue-100 text-blue-900',
  晚班: 'bg-indigo-100 text-indigo-900',
  长白班: 'bg-emerald-100 text-emerald-900',
};

const VALIDATION_STYLES: Record<string, string> = {
  通过: 'bg-emerald-100 text-emerald-900',
  不通过: 'bg-red-100 text-red-900',
  已确认: 'bg-amber-100 text-amber-900',
};

const SCHEDULE_RESULT_FILTERS_KEY = '__maintenance_schedule_result_filters';

type ScheduleResultFilterState = {
  filterTeam: string;
  filterValidation: string;
  filterPersonName: string;
  startDate: string;
  endDate: string;
};

type EditScheduleResultForm = {
  shiftName: string;
  team: string;
  personName: string;
  roleName: string;
  skillsText: string;
  isBorrowed: string;
  originalTeam: string;
  actualTeam: string;
  borrowReason: string;
  validationResult: string;
  exceptionReason: string;
};

type HighlightField =
  | 'shift'
  | 'team'
  | 'personName'
  | 'role'
  | 'skills'
  | 'status'
  | 'isBorrowed'
  | 'originalTeam'
  | 'actualTeam'
  | 'exceptionReason';

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

function getDefaultScheduleResultFilters(): ScheduleResultFilterState {
  return {
    filterTeam: 'all',
    filterValidation: 'all',
    filterPersonName: '',
    startDate: formatDate(addDays(new Date(), -30)),
    endDate: formatDate(addDays(new Date(), 30)),
  };
}

function loadScheduleResultFilters() {
  const defaults = getDefaultScheduleResultFilters();
  try {
    const raw = localStorage.getItem(SCHEDULE_RESULT_FILTERS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ScheduleResultFilterState>;
    return {
      filterTeam: typeof parsed.filterTeam === 'string' ? parsed.filterTeam : defaults.filterTeam,
      filterValidation: typeof parsed.filterValidation === 'string' ? parsed.filterValidation : defaults.filterValidation,
      filterPersonName: typeof parsed.filterPersonName === 'string' ? parsed.filterPersonName : defaults.filterPersonName,
      startDate: typeof parsed.startDate === 'string' ? parsed.startDate : defaults.startDate,
      endDate: typeof parsed.endDate === 'string' ? parsed.endDate : defaults.endDate,
    };
  } catch {
    return defaults;
  }
}

function toEditForm(result: IScheduleResult): EditScheduleResultForm {
  return {
    shiftName: result.shift,
    team: result.team,
    personName: result.personName,
    roleName: result.role,
    skillsText: result.skills,
    isBorrowed: result.isBorrowed || '否',
    originalTeam: result.originalTeam,
    actualTeam: result.actualTeam,
    borrowReason: result.borrowReason,
    validationResult: result.validationResult,
    exceptionReason: result.exceptionReason,
  };
}

function getHighlightedFields(result: IScheduleResult) {
  const fields = new Set<HighlightField>();
  const reason = result.exceptionReason ?? '';
  if (!reason || result.validationResult !== '不通过') return fields;

  if (/当天被安排|已有|多个班次/.test(reason)) {
    fields.add('personName');
    fields.add('shift');
  }
  if (/同一天同时存在早班和晚班|多个实际班组/.test(reason)) {
    fields.add('team');
    fields.add('actualTeam');
    fields.add('shift');
  }
  if (/休假|请假/.test(reason)) {
    fields.add('personName');
    fields.add('status');
    fields.add('exceptionReason');
  }
  if (/借调来源/.test(reason)) {
    fields.add('isBorrowed');
    fields.add('originalTeam');
    fields.add('actualTeam');
  }
  if (/技能|电工|注塑维修/.test(reason)) {
    fields.add('skills');
  }
  if (/组长|班长/.test(reason)) {
    fields.add('role');
  }
  if (/人数不足/.test(reason)) {
    fields.add('shift');
    fields.add('team');
  }
  fields.add('exceptionReason');
  return fields;
}

export default function ScheduleResultPage() {
  const initialFilters = useMemo(() => loadScheduleResultFilters(), []);
  const [results, setResults] = useState<IScheduleResult[]>([]);
  const [filterTeam, setFilterTeam] = useState(initialFilters.filterTeam);
  const [filterValidation, setFilterValidation] = useState(initialFilters.filterValidation);
  const [filterPersonName, setFilterPersonName] = useState(initialFilters.filterPersonName);
  const [startDate, setStartDate] = useState(initialFilters.startDate);
  const [endDate, setEndDate] = useState(initialFilters.endDate);
  const [isLoading, setIsLoading] = useState(false);
  const [editingResult, setEditingResult] = useState<IScheduleResult | null>(null);
  const [editForm, setEditForm] = useState<EditScheduleResultForm | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (filterTeam !== 'all') params.set('team', filterTeam);
    if (filterValidation === 'exception') params.set('validationResult', '不通过');
    if (filterValidation === 'confirmed') params.set('validationResult', '已确认');
    if (filterPersonName.trim()) params.set('personName', filterPersonName.trim());
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params;
  };

  const loadResults = async () => {
    setIsLoading(true);
    try {
      const params = buildQueryParams();
      const queryString = params.toString();
      const data = await apiGet<IScheduleResult[]>(`/schedule-results${queryString ? `?${queryString}` : ''}`);
      setResults(data);
    } catch (error) {
      toast.error('排班结果加载失败', {
        description: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadResults();
  }, [filterTeam, filterValidation, filterPersonName, startDate, endDate]);

  useEffect(() => {
    localStorage.setItem(
      SCHEDULE_RESULT_FILTERS_KEY,
      JSON.stringify({ filterTeam, filterValidation, filterPersonName, startDate, endDate }),
    );
  }, [filterTeam, filterValidation, filterPersonName, startDate, endDate]);

  const teams = useMemo(() => {
    return Array.from(new Set(results.map((item) => item.team))).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [results]);

  const filteredResults = useMemo(() => {
    return results;
  }, [results]);

  const exceptionCount = useMemo(() => {
    return filteredResults.filter((item) => item.validationResult === '不通过').length;
  }, [filteredResults]);

  const confirmedCount = useMemo(() => {
    return filteredResults.filter((item) => item.validationResult === '已确认').length;
  }, [filteredResults]);

  const getRowClassName = (result: IScheduleResult) => {
    if (result.validationResult === '不通过') return 'bg-red-50 hover:bg-red-100/70';
    if (result.validationResult === '已确认') return 'bg-amber-50 hover:bg-amber-100/70';
    return 'hover:bg-muted/40';
  };

  const getCellClassName = (highlightedFields: Set<HighlightField>, field: HighlightField, extra = '') => {
    const base = `border border-border px-3 py-2 text-sm ${extra}`;
    if (!highlightedFields.has(field)) return base;
    return `${base} bg-red-100 text-red-950 ring-1 ring-inset ring-red-300`;
  };

  const handleExportCsv = () => {
    const params = buildQueryParams();
    window.location.href = `${API_BASE_URL}/schedule-results/export?${params.toString()}`;
  };

  const acknowledgeException = async (id: string) => {
    try {
      await apiPut(`/schedule-results/${id}/acknowledge-exception`, {});
      toast.success('异常已确认');
      await loadResults();
    } catch (error) {
      toast.error('确认异常失败', { description: String(error) });
    }
  };

  const openEditDialog = (result: IScheduleResult) => {
    setEditingResult(result);
    setEditForm(toEditForm(result));
  };

  const closeEditDialog = () => {
    setEditingResult(null);
    setEditForm(null);
  };

  const updateEditForm = (field: keyof EditScheduleResultForm, value: string) => {
    setEditForm((current) => current ? { ...current, [field]: value } : current);
  };

  const saveEditResult = async () => {
    if (!editingResult || !editForm) return;
    setIsSavingEdit(true);
    try {
      await apiPut(`/schedule-results/${editingResult.id}`, editForm);
      toast.success('排班结果已更新');
      setEditingResult(null);
      setEditForm(null);
      await loadResults();
    } catch (error) {
      toast.error('保存排班结果失败', { description: String(error) });
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[8px] border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-semibold">排班结果</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                当前显示 {filteredResults.length} 条，未处理异常 {exceptionCount} 条，已确认 {confirmedCount} 条
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                当前展示每个日期最新一次排班任务结果，可按人员查看过去和未来排班。
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">人员</Label>
                <Input
                  value={filterPersonName}
                  onChange={(event) => setFilterPersonName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void loadResults();
                  }}
                  placeholder="输入姓名"
                  className="h-9 w-32"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">开始日期</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-9 w-36"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">结束日期</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-9 w-36"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">班组</Label>
                <Select value={filterTeam} onValueChange={setFilterTeam}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team} value={team}>
                        {team}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">校验</Label>
                <Select value={filterValidation} onValueChange={setFilterValidation}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="exception">只看异常</SelectItem>
                    <SelectItem value="confirmed">已确认</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadResults()}
                disabled={isLoading}
                className="rounded-[8px]"
              >
                <RefreshCw className="size-4" />
                刷新
              </Button>
              <Button
                size="sm"
                onClick={handleExportCsv}
                disabled={filteredResults.length === 0}
                className="rounded-[8px]"
              >
                <Download className="size-4" />
                导出 CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <ScheduleSwimlaneChart results={filteredResults} />

      {exceptionCount > 0 && (
        <div className="flex items-start gap-3 rounded-[8px] border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm">当前筛选结果中存在未处理异常记录，可在行尾进行确认。</p>
        </div>
      )}

      <Card className="rounded-[8px] border-border shadow-sm">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse">
              <thead>
                <tr className="bg-muted/60">
                  {[
                    '日期',
                    '星期',
                    '班次',
                    '班组',
                    '人员',
                    '角色',
                    '技能',
                    '是否借调',
                    '原班组',
                    '实际班组',
                    '借调原因',
                    '校验结果',
                    '异常原因',
                    '操作',
                  ].map((header) => (
                    <th key={header} className="border border-border px-3 py-3 text-left text-xs font-bold text-muted-foreground">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="border border-border px-3 py-12 text-center text-sm text-muted-foreground">
                      当前筛选条件下没有排班结果。
                    </td>
                  </tr>
                ) : filteredResults.map((result) => {
                  const highlightedFields = getHighlightedFields(result);
                  return (
                  <tr key={result.id} className={getRowClassName(result)}>
                    <td className="border border-border px-3 py-2 text-sm">{result.date}</td>
                    <td className="border border-border px-3 py-2 text-sm">{result.weekdayName}</td>
                    <td className={getCellClassName(highlightedFields, 'shift')}>
                      <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${SHIFT_STYLES[result.shift] ?? 'bg-gray-100 text-gray-900'}`}>
                        {result.shift}
                      </span>
                    </td>
                    <td className={getCellClassName(highlightedFields, 'team', 'font-medium')}>{result.team}</td>
                    <td className={getCellClassName(highlightedFields, 'personName')}>{result.personName}</td>
                    <td className={getCellClassName(highlightedFields, 'role')}>{result.role}</td>
                    <td className={getCellClassName(highlightedFields, 'skills', 'max-w-[180px]')}>{result.skills}</td>
                    <td className={getCellClassName(highlightedFields, 'isBorrowed')}>{result.isBorrowed}</td>
                    <td className={getCellClassName(highlightedFields, 'originalTeam')}>{result.originalTeam}</td>
                    <td className={getCellClassName(highlightedFields, 'actualTeam')}>{result.actualTeam}</td>
                    <td className="border border-border px-3 py-2 text-sm">{result.borrowReason || '-'}</td>
                    <td className={getCellClassName(highlightedFields, 'status')}>
                      <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${VALIDATION_STYLES[result.validationResult] ?? 'bg-gray-100 text-gray-900'}`}>
                        {result.validationResult}
                      </span>
                    </td>
                    <td className={getCellClassName(highlightedFields, 'exceptionReason', 'max-w-[240px] text-destructive')}>
                      {result.exceptionReason || '-'}
                    </td>
                    <td className="border border-border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(result)}
                          className="rounded-[8px]"
                        >
                          <Pencil className="size-4" />
                          编辑
                        </Button>
                        {result.validationResult === '不通过' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void acknowledgeException(result.id)}
                          className="rounded-[8px]"
                        >
                          <CheckCircle2 className="size-4" />
                          确认
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingResult)} onOpenChange={(open) => {
        if (!open) closeEditDialog();
      }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-[8px]">
          <DialogHeader>
            <DialogTitle>编辑排班结果</DialogTitle>
          </DialogHeader>

          {editingResult && editForm && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">日期</Label>
                  <Input value={editingResult.date} disabled className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">星期</Label>
                  <Input value={editingResult.weekdayName} disabled className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">班次</Label>
                  <Select value={editForm.shiftName} onValueChange={(value) => updateEditForm('shiftName', value)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择班次" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="早班">早班</SelectItem>
                      <SelectItem value="晚班">晚班</SelectItem>
                      <SelectItem value="长白班">长白班</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">班组</Label>
                  <Input value={editForm.team} onChange={(event) => updateEditForm('team', event.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">人员</Label>
                  <Input value={editForm.personName} onChange={(event) => updateEditForm('personName', event.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">角色</Label>
                  <Input value={editForm.roleName} onChange={(event) => updateEditForm('roleName', event.target.value)} className="h-9" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">技能</Label>
                  <Input value={editForm.skillsText} onChange={(event) => updateEditForm('skillsText', event.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">是否借调</Label>
                  <Select value={editForm.isBorrowed} onValueChange={(value) => updateEditForm('isBorrowed', value)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="是否借调" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="否">否</SelectItem>
                      <SelectItem value="是">是</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">原班组</Label>
                  <Input value={editForm.originalTeam} onChange={(event) => updateEditForm('originalTeam', event.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">实际班组</Label>
                  <Input value={editForm.actualTeam} onChange={(event) => updateEditForm('actualTeam', event.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">校验结果</Label>
                  <Select value={editForm.validationResult} onValueChange={(value) => updateEditForm('validationResult', value)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="校验结果" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="通过">通过</SelectItem>
                      <SelectItem value="不通过">不通过</SelectItem>
                      <SelectItem value="已确认">已确认</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">借调原因</Label>
                  <Textarea
                    value={editForm.borrowReason}
                    onChange={(event) => updateEditForm('borrowReason', event.target.value)}
                    className="min-h-20"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">异常原因 / 修正备注</Label>
                  <Textarea
                    value={editForm.exceptionReason}
                    onChange={(event) => updateEditForm('exceptionReason', event.target.value)}
                    className="min-h-20"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={isSavingEdit} className="rounded-[8px]">
              取消
            </Button>
            <Button onClick={() => void saveEditResult()} disabled={isSavingEdit || !editForm} className="rounded-[8px]">
              {isSavingEdit ? '保存中...' : '保存修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
