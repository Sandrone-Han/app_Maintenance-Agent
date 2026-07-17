import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { History, RefreshCw, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet, apiPost } from '@/lib/api';

type TeamScheduleRecord = {
  id: string;
  team: string;
  type: string;
  currentShift: string;
  currentShiftDate: string;
  nextShift: string;
  nextShiftDate: string;
};

const shiftVariant: Record<string, string> = {
  早班: 'bg-blue-100 text-blue-900',
  晚班: 'bg-indigo-100 text-indigo-900',
  休息: 'bg-gray-100 text-gray-700',
  长白班: 'bg-emerald-100 text-emerald-900',
};

// 班组排班记录页：查看 A/B 班组当前班次、下一班次和轮换连续性。
export default function TeamScheduleRecordPage() {
  // 页面状态：轮换记录列表、刷新加载态和恢复默认轮换加载态。
  const [records, setRecords] = useState<TeamScheduleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // 从后端读取最新班组轮换状态。
  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<TeamScheduleRecord[]>('/team-schedule-records');
      setRecords(data);
    } catch (error) {
      toast.error('班组排班记录加载失败', { description: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  // 将 A1/A2/A3 恢复到默认轮换基准，便于重新开始排班。
  const resetDefaultRecords = async () => {
    const confirmed = window.confirm('确认恢复默认轮换？这会把 A1/A2/A3 重置为 A1早班、A2晚班、A3休息。');
    if (!confirmed) return;

    setIsResetting(true);
    try {
      await apiPost('/team-schedule-records/reset-default', {
        baseDate: formatDate(new Date()),
      });
      toast.success('默认轮换已恢复');
      await loadRecords();
    } catch (error) {
      toast.error('恢复默认轮换失败', { description: String(error) });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题和操作区：支持恢复默认轮换与手动刷新。 */}
      <Card className="rounded-[8px] border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <History className="size-5" />
                班组排班记录
              </CardTitle>
              <CardDescription>查看各班组当前班次和下一次轮换状态。</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void resetDefaultRecords()}
                disabled={isLoading || isResetting}
                className="rounded-[8px]"
              >
                <RotateCcw className="size-4" />
                恢复默认轮换
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadRecords()}
                disabled={isLoading || isResetting}
                className="rounded-[8px]"
              >
                <RefreshCw className="size-4" />
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 只读表格区：用 Badge 区分当前班次状态。 */}
      <Card className="rounded-[8px] border-border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-sm">
                  <th className="px-4 py-3 font-medium">班组</th>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">当前班次</th>
                  <th className="px-4 py-3 font-medium">当前班次时间</th>
                  <th className="px-4 py-3 font-medium">下一次班次</th>
                  <th className="px-4 py-3 font-medium">下一次班次时间</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-semibold">{record.team}</td>
                    <td className="px-4 py-3">{record.type}</td>
                    <td className="px-4 py-3">
                      <Badge className={shiftVariant[record.currentShift] ?? ''}>{record.currentShift}</Badge>
                    </td>
                    <td className="px-4 py-3">{record.currentShiftDate}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{record.nextShift}</Badge>
                    </td>
                    <td className="px-4 py-3">{record.nextShiftDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 将 Date 转成后端接口使用的 yyyy-MM-dd 字符串。
function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
