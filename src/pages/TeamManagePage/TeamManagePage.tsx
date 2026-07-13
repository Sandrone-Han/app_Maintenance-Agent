import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, RefreshCw, Trash2, Upload, Users } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from '@/lib/api';

type TeamMember = {
  id: string;
  name: string;
  team: string;
  shiftType: string;
  role: string;
  status: string;
  skills: string[];
};

type ShiftType = {
  id: string;
  shiftCategory: string;
  scheduleRule: string;
  shiftName: string;
  startTime: string;
  endTime: string;
};

type MemberForm = {
  id?: string;
  name: string;
  team: string;
  shiftType: string;
  role: string;
  status: string;
  skillsText: string;
};

type ShiftForm = {
  id?: string;
  shiftCategory: string;
  scheduleRule: string;
  shiftName: string;
  startTime: string;
  endTime: string;
};

type ImportTeamMembersResult = {
  fileName: string;
  total: number;
  inserted: number;
  updated: number;
};

const emptyMemberForm: MemberForm = {
  name: '',
  team: 'A1',
  shiftType: '早晚班',
  role: '组员',
  status: '启用',
  skillsText: '',
};

const emptyShiftForm: ShiftForm = {
  shiftCategory: '早晚班',
  scheduleRule: '上4休2',
  shiftName: '早班',
  startTime: '07:00',
  endTime: '19:00',
};

export default function TeamManagePage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [memberForm, setMemberForm] = useState<MemberForm>(emptyMemberForm);
  const [shiftForm, setShiftForm] = useState<ShiftForm>(emptyShiftForm);
  const [isLoading, setIsLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [memberData, shiftData] = await Promise.all([
        apiGet<TeamMember[]>('/team-members'),
        apiGet<ShiftType[]>('/shift-types'),
      ]);
      setMembers(memberData);
      setShiftTypes(shiftData);
    } catch (error) {
      toast.error('班组管理数据加载失败', { description: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateMemberForm = <K extends keyof MemberForm>(key: K, value: MemberForm[K]) => {
    setMemberForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateShiftForm = <K extends keyof ShiftForm>(key: K, value: ShiftForm[K]) => {
    setShiftForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveMember = async () => {
    if (!memberForm.name) {
      toast.error('人员姓名不能为空');
      return;
    }

    const payload = {
      name: memberForm.name,
      team: memberForm.team,
      shiftType: memberForm.shiftType,
      role: memberForm.role,
      status: memberForm.status,
      skills: memberForm.skillsText.split(',').map((item) => item.trim()).filter(Boolean),
    };

    try {
      if (memberForm.id) {
        await apiPut(`/team-members/${memberForm.id}`, payload);
        toast.success('人员已更新');
      } else {
        await apiPost('/team-members', payload);
        toast.success('人员已新增');
      }
      setMemberForm(emptyMemberForm);
      await loadData();
    } catch (error) {
      toast.error('保存人员失败', { description: String(error) });
    }
  };

  const saveShift = async () => {
    if (!shiftForm.shiftName || !shiftForm.startTime || !shiftForm.endTime) {
      toast.error('班次信息不能为空');
      return;
    }

    try {
      if (shiftForm.id) {
        await apiPut(`/shift-types/${shiftForm.id}`, shiftForm);
        toast.success('班次已更新');
      } else {
        await apiPost('/shift-types', shiftForm);
        toast.success('班次已新增');
      }
      setShiftForm(emptyShiftForm);
      await loadData();
    } catch (error) {
      toast.error('保存班次失败', { description: String(error) });
    }
  };

  const editMember = (member: TeamMember) => {
    setMemberForm({
      id: member.id,
      name: member.name,
      team: member.team,
      shiftType: member.shiftType,
      role: member.role,
      status: member.status,
      skillsText: member.skills.join(','),
    });
  };

  const editShift = (shift: ShiftType) => {
    setShiftForm(shift);
  };

  const deleteMember = async (id: string) => {
    try {
      await apiDelete(`/team-members/${id}`);
      toast.success('人员已删除');
      await loadData();
    } catch (error) {
      toast.error('删除人员失败', { description: String(error) });
    }
  };

  const deleteShift = async (id: string) => {
    try {
      await apiDelete(`/shift-types/${id}`);
      toast.success('班次已删除');
      await loadData();
    } catch (error) {
      toast.error('删除班次失败', { description: String(error) });
    }
  };

  const importTeamMembers = async (file: File | undefined) => {
    if (!file) return;

    try {
      const result = await apiUpload<ImportTeamMembersResult>('/team-members/import-excel', file);
      toast.success('Excel 导入成功', {
        description: `共 ${result.total} 行，新增 ${result.inserted} 人，更新 ${result.updated} 人`,
      });
      await loadData();
    } catch (error) {
      toast.error('Excel 导入失败', { description: String(error) });
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[8px] border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <Users className="size-5" />
                班组管理
              </CardTitle>
              <CardDescription>维护班组人员和班次基础信息，数据保存到后端 Oracle。</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={isLoading}
              className="rounded-[8px]"
            >
              <RefreshCw className="size-4" />
              刷新
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => void importTeamMembers(event.target.files?.[0])}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              className="rounded-[8px]"
            >
              <Upload className="size-4" />
              导入 Excel
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">班组人员信息</TabsTrigger>
          <TabsTrigger value="shifts">班次基本信息</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card className="rounded-[8px] border-border shadow-sm">
            <CardContent className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[1fr_120px_140px_110px_1fr_auto]">
              <Field label="人员">
                <Input value={memberForm.name} onChange={(event) => updateMemberForm('name', event.target.value)} />
              </Field>
              <Field label="班组">
                <Select value={memberForm.team} onValueChange={(value) => updateMemberForm('team', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['A1', 'A2', 'A3', 'B'].map((team) => <SelectItem key={team} value={team}>{team}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="班次类型">
                <Select value={memberForm.shiftType} onValueChange={(value) => updateMemberForm('shiftType', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['早晚班', '长白班'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="角色">
                <Select value={memberForm.role} onValueChange={(value) => updateMemberForm('role', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['组长', '组员'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="技能">
                <Input
                  placeholder="电工,注塑维修"
                  value={memberForm.skillsText}
                  onChange={(event) => updateMemberForm('skillsText', event.target.value)}
                />
              </Field>
              <div className="flex items-end gap-2">
                <Button onClick={() => void saveMember()} className="rounded-[8px]">
                  <Plus className="size-4" />
                  {memberForm.id ? '保存' : '新增'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <DataTable
            headers={['人员', '班组', '班次类型', '角色', '技能', '操作']}
            rows={members.map((member) => [
              member.name,
              member.team,
              member.shiftType,
              member.role,
              member.skills.join(','),
              <RowActions
                key={member.id}
                onEdit={() => editMember(member)}
                onDelete={() => void deleteMember(member.id)}
              />,
            ])}
          />
        </TabsContent>

        <TabsContent value="shifts" className="space-y-4">
          <Card className="rounded-[8px] border-border shadow-sm">
            <CardContent className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[140px_1fr_140px_120px_120px_auto]">
              <Field label="班次类型">
                <Select value={shiftForm.shiftCategory} onValueChange={(value) => updateShiftForm('shiftCategory', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['早晚班', '长白班'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="排班规则">
                <Input value={shiftForm.scheduleRule} onChange={(event) => updateShiftForm('scheduleRule', event.target.value)} />
              </Field>
              <Field label="班次">
                <Input value={shiftForm.shiftName} onChange={(event) => updateShiftForm('shiftName', event.target.value)} />
              </Field>
              <Field label="开始时间">
                <Input value={shiftForm.startTime} onChange={(event) => updateShiftForm('startTime', event.target.value)} />
              </Field>
              <Field label="结束时间">
                <Input value={shiftForm.endTime} onChange={(event) => updateShiftForm('endTime', event.target.value)} />
              </Field>
              <div className="flex items-end gap-2">
                <Button onClick={() => void saveShift()} className="rounded-[8px]">
                  <Plus className="size-4" />
                  {shiftForm.id ? '保存' : '新增'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <DataTable
            headers={['班次类型', '排班规则', '班次', '开始时间', '结束时间', '操作']}
            rows={shiftTypes.map((shift) => [
              shift.shiftCategory,
              shift.scheduleRule,
              shift.shiftName,
              shift.startTime,
              shift.endTime,
              <RowActions
                key={shift.id}
                onEdit={() => editShift(shift)}
                onDelete={() => void deleteShift(shift.id)}
              />,
            ])}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <Card className="rounded-[8px] border-border shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-sm">
                {headers.map((header) => (
                  <th key={header} className="px-4 py-3 font-medium last:text-right">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b last:border-b-0 hover:bg-muted/40">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 last:text-right">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
