import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, RefreshCw, Trash2, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';

type AttendanceRecord = {
  id: string;
  personName: string;
  team: string;
  startDate: string;
  endDate: string;
  status: string;
  updatedAt: string;
};

type TeamMember = {
  id: string;
  name: string;
  team: string;
};

type AttendanceForm = {
  id?: string;
  personName: string;
  team: string;
  startDate: string;
  endDate: string;
  status: string;
};

const emptyForm: AttendanceForm = {
  personName: '',
  team: '',
  startDate: '',
  endDate: '',
  status: '正常',
};

const statusClass: Record<string, string> = {
  正常: 'bg-emerald-100 text-emerald-900',
  休假: 'bg-orange-100 text-orange-900',
  请假: 'bg-red-100 text-red-900',
  事假: 'bg-red-100 text-red-900',
};

export default function PersonnelPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState<AttendanceForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [attendanceData, memberData] = await Promise.all([
        apiGet<AttendanceRecord[]>('/attendance-records'),
        apiGet<TeamMember[]>('/team-members'),
      ]);
      setRecords(attendanceData);
      setMembers(memberData);
    } catch (error) {
      toast.error('人员出勤数据加载失败', { description: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const teamByPerson = useMemo(() => {
    return new Map(members.map((member) => [member.name, member.team]));
  }, [members]);

  const updateForm = <K extends keyof AttendanceForm>(key: K, value: AttendanceForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    if (!form.personName || !form.team || !form.startDate || !form.endDate || !form.status) {
      toast.error('请完整填写出勤记录');
      return;
    }

    try {
      if (form.id) {
        await apiPut(`/attendance-records/${form.id}`, form);
        toast.success('出勤记录已更新');
      } else {
        await apiPost('/attendance-records', form);
        toast.success('出勤记录已新增');
      }

      setForm(emptyForm);
      await loadData();
    } catch (error) {
      toast.error('保存出勤记录失败', { description: String(error) });
    }
  };

  const editRecord = (record: AttendanceRecord) => {
    setForm({
      id: record.id,
      personName: record.personName,
      team: record.team,
      startDate: record.startDate,
      endDate: record.endDate,
      status: record.status,
    });
  };

  const removeRecord = async (id: string) => {
    try {
      await apiDelete(`/attendance-records/${id}`);
      toast.success('出勤记录已删除');
      await loadData();
    } catch (error) {
      toast.error('删除出勤记录失败', { description: String(error) });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[8px] border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <UserCheck className="size-5" />
            人员信息
          </CardTitle>
          <CardDescription>维护人员出勤状态，数据保存到后端 Oracle。</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
          <div className="space-y-2">
            <Label>人员</Label>
            <Select
              value={form.personName}
              onValueChange={(value) => {
                updateForm('personName', value);
                updateForm('team', teamByPerson.get(value) ?? '');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择人员" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.name}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>班组</Label>
            <Input value={form.team} onChange={(event) => updateForm('team', event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>开始日期</Label>
            <Input type="date" value={form.startDate} onChange={(event) => updateForm('startDate', event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>结束日期</Label>
            <Input type="date" value={form.endDate} onChange={(event) => updateForm('endDate', event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>状态</Label>
            <Select value={form.status} onValueChange={(value) => updateForm('status', value)}>
              <SelectTrigger className="min-w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['正常', '休假', '事假', '请假'].map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => void submit()} className="rounded-[8px]">
              <Plus className="size-4" />
              {form.id ? '保存' : '新增'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setForm(emptyForm);
                void loadData();
              }}
              disabled={isLoading}
              className="rounded-[8px]"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[8px] border-border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-sm">
                  <th className="px-4 py-3 font-medium">人员</th>
                  <th className="px-4 py-3 font-medium">班组</th>
                  <th className="px-4 py-3 font-medium">开始日期</th>
                  <th className="px-4 py-3 font-medium">结束日期</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">更新时间</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{record.personName}</td>
                    <td className="px-4 py-3">{record.team}</td>
                    <td className="px-4 py-3">{record.startDate}</td>
                    <td className="px-4 py-3">{record.endDate}</td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass[record.status] ?? ''}>{record.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{new Date(record.updatedAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => editRecord(record)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => void removeRecord(record.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
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
