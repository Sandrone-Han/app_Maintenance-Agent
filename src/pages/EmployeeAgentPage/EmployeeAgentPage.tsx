import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Bot, Send, Trash2, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiPost } from '@/lib/api';

type AgentProfile = {
  id: string;
  name: string;
  team: string;
  shiftType: string;
  role: string;
  status: string;
  skills: string[];
};

type AgentStats = {
  total: number;
  early: number;
  late: number;
  longDay: number;
  borrowed: number;
  exceptions: number;
};

type AgentSchedule = {
  id: string;
  date: string;
  weekdayName: string;
  shift: string;
  team: string;
  role: string;
  skills: string;
  isBorrowed: string;
  originalTeam: string;
  actualTeam: string;
  borrowReason: string;
  validationResult: string;
  exceptionReason: string;
};

type AgentAttendance = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  team: string;
};

type AgentResponse = {
  intent: string;
  employeeName: string | null;
  answer: string;
  profile: AgentProfile | null;
  stats: AgentStats;
  schedules: AgentSchedule[];
  attendance: AgentAttendance[];
  suggestions: string[];
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const QUICK_QUESTIONS = [
  '查询张工个人信息',
  '查询张工未来7天排班',
  '查询张工借调记录',
  '查询张工异常排班',
];

const EMPLOYEE_AGENT_STATE_KEY = '__maintenance_employee_agent_state';

type EmployeeAgentStoredState = {
  message: string;
  startDate: string;
  endDate: string;
  chatMessages: ChatMessage[];
  lastResponse: AgentResponse | null;
};

// 日期格式化工具，服务于查询时间范围默认值。
function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

// 基于当前日期偏移天数，生成默认结束日期。
function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// 默认欢迎消息，作为员工查询对话的初始上下文。
function getDefaultChatMessages(): ChatMessage[] {
  return [
    {
      role: 'assistant',
      content: '你好，我可以查询员工个人信息、排班历史、借调记录、异常排班和出勤记录。',
    },
  ];
}

// 员工查询页的默认状态：输入框、时间范围、聊天记录和上次结构化结果。
function getDefaultEmployeeAgentState(): EmployeeAgentStoredState {
  return {
    message: '',
    startDate: formatDate(new Date()),
    endDate: formatDate(addDays(new Date(), 7)),
    chatMessages: getDefaultChatMessages(),
    lastResponse: null,
  };
}

// 从 localStorage 恢复上次查询状态，失败时退回默认值。
function loadEmployeeAgentState() {
  const defaults = getDefaultEmployeeAgentState();
  try {
    const raw = localStorage.getItem(EMPLOYEE_AGENT_STATE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<EmployeeAgentStoredState>;
    return {
      message: typeof parsed.message === 'string' ? parsed.message : defaults.message,
      startDate: typeof parsed.startDate === 'string' ? parsed.startDate : defaults.startDate,
      endDate: typeof parsed.endDate === 'string' ? parsed.endDate : defaults.endDate,
      chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages.filter((item) => item.role === 'user' || item.role === 'assistant') : defaults.chatMessages,
      lastResponse: parsed.lastResponse ?? defaults.lastResponse,
    };
  } catch {
    return defaults;
  }
}

// 员工查询页：用聊天形式调用后端员工查询接口，并展示结构化排班结果。
export default function EmployeeAgentPage() {
  const initialState = useMemo(() => loadEmployeeAgentState(), []);
  // 页面状态：查询输入、时间范围、聊天消息和最近一次查询结果。
  const [message, setMessage] = useState(initialState.message);
  const [startDate, setStartDate] = useState(initialState.startDate);
  const [endDate, setEndDate] = useState(initialState.endDate);
  const [isLoading, setIsLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialState.chatMessages);
  const [lastResponse, setLastResponse] = useState<AgentResponse | null>(initialState.lastResponse);

  const canSubmit = useMemo(() => message.trim() !== '' && startDate <= endDate, [endDate, message, startDate]);
  const canClearHistory = useMemo(() => {
    return lastResponse !== null || chatMessages.some((item) => item.role === 'user');
  }, [chatMessages, lastResponse]);

  // 将当前会话缓存到本地，刷新页面后仍可恢复上下文。
  useEffect(() => {
    localStorage.setItem(
      EMPLOYEE_AGENT_STATE_KEY,
      JSON.stringify({ message, startDate, endDate, chatMessages, lastResponse }),
    );
  }, [message, startDate, endDate, chatMessages, lastResponse]);

  // 发送用户问题到后端员工智能查询接口，并把回答写入聊天流。
  const askAgent = async (question = message) => {
    const text = question.trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    setMessage('');
    setChatMessages((prev) => [...prev, { role: 'user', content: text }]);

    try {
      const response = await apiPost<AgentResponse>('/employee-agent/query', {
        message: text,
        startDate,
        endDate,
      });
      setLastResponse(response);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: response.answer }]);
    } catch (error) {
      toast.error('员工查询失败', { description: String(error) });
      setChatMessages((prev) => [...prev, { role: 'assistant', content: '查询失败，请稍后重试。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 清空历史对话和结构化结果，保留默认欢迎语。
  const clearChatHistory = () => {
    setChatMessages(getDefaultChatMessages());
    setLastResponse(null);
    toast.success('历史聊天记录已清除');
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-6xl flex-col">
      {/* 页面头部：时间范围筛选和清空历史入口。 */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">员工查询</h1>
            <p className="mt-1 text-sm text-muted-foreground">按员工姓名查询档案、排班、借调、异常和出勤记录。</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={clearChatHistory}
            disabled={isLoading || !canClearHistory}
            className="h-9 rounded-[8px]"
          >
            <Trash2 className="size-4" />
            清除历史
          </Button>
          <div className="space-y-1">
            <Label htmlFor="agent-start-date" className="text-xs text-muted-foreground">开始日期</Label>
            <Input id="agent-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 w-36" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agent-end-date" className="text-xs text-muted-foreground">结束日期</Label>
            <Input id="agent-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 w-36" />
          </div>
        </div>
      </header>

      {/* 聊天内容区：快捷问题、用户/助手消息和结构化结果卡片。 */}
      <main className="flex-1 space-y-5 pb-36">
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((question) => (
            <Button
              key={question}
              variant="outline"
              size="sm"
              onClick={() => void askAgent(question)}
              disabled={isLoading}
              className="rounded-full"
            >
              {question}
            </Button>
          ))}
        </div>

        <div className="space-y-6">
          {chatMessages.map((item, index) => (
            <div
              key={`${item.role}-${index}-${item.content}`}
              className={`flex gap-3 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {item.role === 'assistant' && (
                <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-primary">
                  <Bot className="size-4" />
                </span>
              )}
              <div
                className={`max-w-[min(760px,82vw)] rounded-[8px] px-4 py-3 text-sm leading-7 ${
                  item.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'border bg-background text-foreground shadow-sm'
                }`}
              >
                {item.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-primary">
                <Bot className="size-4" />
              </span>
              <div className="rounded-[8px] border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                正在查询...
              </div>
            </div>
          )}
        </div>

        {lastResponse && (
          <section className="ml-0 space-y-4 rounded-[8px] border bg-background p-4 shadow-sm md:ml-11">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <UserRound className="size-5 text-primary" />
                <div>
                  <p className="font-semibold">{lastResponse.profile?.name ?? lastResponse.employeeName ?? '未匹配员工'}</p>
                  {lastResponse.profile && (
                    <p className="text-sm text-muted-foreground">
                      {lastResponse.profile.team} / {lastResponse.profile.shiftType} / {lastResponse.profile.role}
                    </p>
                  )}
                </div>
              </div>
              {lastResponse.profile && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{lastResponse.profile.status}</Badge>
                  {lastResponse.profile.skills.map((skill) => (
                    <Badge key={skill} variant="outline">{skill}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['总排班', lastResponse.stats.total],
                ['早班', lastResponse.stats.early],
                ['晚班', lastResponse.stats.late],
                ['长白班', lastResponse.stats.longDay],
                ['借调', lastResponse.stats.borrowed],
                ['异常', lastResponse.stats.exceptions],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[8px] border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {lastResponse.schedules.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse">
                  <thead>
                    <tr className="bg-muted/60">
                      {['日期', '星期', '班次', '班组', '借调', '校验', '异常原因'].map((header) => (
                        <th key={header} className="border border-border px-3 py-2 text-left text-xs font-bold text-muted-foreground">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lastResponse.schedules.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/40">
                        <td className="border border-border px-3 py-2 text-sm">{item.date}</td>
                        <td className="border border-border px-3 py-2 text-sm">{item.weekdayName}</td>
                        <td className="border border-border px-3 py-2 text-sm">{item.shift}</td>
                        <td className="border border-border px-3 py-2 text-sm">{item.team}</td>
                        <td className="border border-border px-3 py-2 text-sm">
                          {item.isBorrowed === '是' ? `${item.originalTeam} -> ${item.actualTeam}` : '否'}
                        </td>
                        <td className="border border-border px-3 py-2 text-sm">{item.validationResult}</td>
                        <td className="border border-border px-3 py-2 text-sm text-destructive">{item.exceptionReason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-[8px] border border-dashed p-6 text-center text-sm text-muted-foreground">
                当前问题没有返回排班明细。
              </p>
            )}

            {lastResponse.attendance.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/60">
                      {['开始日期', '结束日期', '班组', '状态'].map((header) => (
                        <th key={header} className="border border-border px-3 py-2 text-left text-xs font-bold text-muted-foreground">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lastResponse.attendance.map((item) => (
                      <tr key={item.id}>
                        <td className="border border-border px-3 py-2 text-sm">{item.startDate}</td>
                        <td className="border border-border px-3 py-2 text-sm">{item.endDate}</td>
                        <td className="border border-border px-3 py-2 text-sm">{item.team}</td>
                        <td className="border border-border px-3 py-2 text-sm">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {lastResponse.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {lastResponse.suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => void askAgent(suggestion)}
                    className="rounded-full"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* 底部固定输入区：支持 Enter 发送、Shift+Enter 换行。 */}
      <div className="sticky bottom-0 -mx-2 border-t bg-background/95 px-2 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-[8px] border bg-background p-3 shadow-lg">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void askAgent();
              }
            }}
            placeholder="输入问题，例如：查询张工未来7天排班"
            className="min-h-16 resize-none border-0 shadow-none focus-visible:ring-0"
            disabled={isLoading}
          />
          <Button
            onClick={() => void askAgent()}
            disabled={!canSubmit || isLoading}
            className="size-10 shrink-0 rounded-full p-0"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
