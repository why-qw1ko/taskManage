'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  Clock3,
  Inbox,
  LayoutGrid,
  List,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompositionGuard } from '@/hooks/use-composition-guard';
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  dateKey,
  offsetDate,
  seed,
  newTask,
  validateData,
  setStatus,
  type Data,
  type Task,
  type Status,
} from '@/lib/tasks';
import { Choice, colors, priorities, statuses, type Option } from '@/components/dayflow/common';
import { TaskCard } from '@/components/dayflow/task-card';
import { EditorDialog } from '@/components/dayflow/editor-dialog';
import {
  SettingsDialog,
  type ConfirmRequest,
} from '@/components/dayflow/settings-dialog';
import { CalendarView } from '@/components/dayflow/calendar-view';
import { RightPanel } from '@/components/dayflow/right-panel';

const EMPTY_TASKS: Task[] = [];
const EMPTY_LISTS: string[] = [];

type StoredData = { revision: number; data: Data };
function readStored(value: unknown): StoredData {
  if (!value || typeof value !== 'object') throw new Error('invalid database response');
  const record = value as { revision?: unknown; data?: unknown };
  if (!Number.isSafeInteger(record.revision) || (record.revision as number) < 1)
    throw new Error('invalid database revision');
  return { revision: record.revision as number, data: validateData(record.data) };
}
function readRevision(value: unknown): number {
  if (!value || typeof value !== 'object') throw new Error('invalid database response');
  const revision = (value as { revision?: unknown }).revision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 1) throw new Error('invalid database revision');
  return revision as number;
}

function NavItem({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={() => {
        onClick();
        setOpenMobile(false);
      }}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const quickCompositionGuard = useCompositionGuard();
  const listCompositionGuard = useCompositionGuard();
  const [data, setData] = useState<Data | null>(null);
  const dataRef = useRef<Data | null>(null);
  const [scope, setScope] = useState('today');
  const [view, setView] = useState('list');
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('created');
  const [quick, setQuick] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const editingBaseRef = useRef<Task | null>(null);
  const [settings, setSettings] = useState(false);
  const [listModal, setListModal] = useState(false);
  const [listName, setListName] = useState('');
  const [subtask, setSubtask] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [ready, setReady] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [today, setToday] = useState(dateKey());
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState('');
  const [remaining, setRemaining] = useState(1500);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [focusTask, setFocusTask] = useState('none');
  const searchRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revisionRef = useRef<number | null>(null);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const channelRef = useRef<BroadcastChannel | null>(null);

  const toast = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4000);
  }, []);

  const update = useCallback(
    (fn: (d: Data) => Data): Promise<boolean> => {
      const operation = writeQueue.current.then(async () => {
        const current = dataRef.current;
        if (!current || storageBlocked) return false;
        try {
          const next = validateData(fn(current));
          const response = await fetch('/api/data', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: revisionRef.current, data: next }),
          });
          if (response.status === 409) {
            const latestResponse = await fetch('/api/data', { cache: 'no-store' });
            if (!latestResponse.ok) throw new Error('read failed');
            const latest = readStored(await latestResponse.json());
            const valid = latest.data;
            revisionRef.current = latest.revision;
            dataRef.current = valid;
            setData(valid);
            setError('数据已在其他页面更改，本次操作未保存，请检查后重试。');
            return false;
          }
          if (!response.ok) throw new Error('write failed');
          revisionRef.current = readRevision(await response.json());
          dataRef.current = next;
          setData(next);
          setError('');
          channelRef.current?.postMessage('updated');
          return true;
        } catch (error) {
          setError(error instanceof Error && error.message === 'TASK_CHANGED'
            ? '该任务已在其他页面发生变化，本次修改未保存。请重新打开任务后再试。'
            : '保存失败，本次修改未写入 SQLite。请检查本机服务和数据库后重试。');
          return false;
        }
      });
      writeQueue.current = operation;
      return operation;
    },
    [storageBlocked],
  );

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/data', { cache: 'no-store' });
        if (!response.ok) throw new Error('read failed');
        const initialResponse = await response.json();
        let stored: StoredData | null = initialResponse === null ? null : readStored(initialResponse);
        if (!stored) {
          const initial = seed();
          const saved = await fetch('/api/data', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revision: null, data: initial }),
          });
          if (saved.status === 409) {
            const latest = await fetch('/api/data', { cache: 'no-store' });
            if (!latest.ok) throw new Error('read failed');
            stored = readStored(await latest.json());
          } else {
            if (!saved.ok) throw new Error('initialization failed');
            stored = { revision: readRevision(await saved.json()), data: initial };
          }
        }
        const d = validateData(stored.data);
        if (!active) return;
        revisionRef.current = stored.revision;
        dataRef.current = d;
        setData(d);
        setRemaining(d.focusMinutes * 60);
      } catch {
        if (!active) return;
        const d = { ...seed(), tasks: [] };
        dataRef.current = d;
        setData(d);
        setStorageBlocked(true);
        setError('无法读取或初始化 SQLite，请检查本机服务和数据库后刷新页面。');
      }
      if (active) setReady(true);
    }
    void load();
    const timer = setInterval(() => setToday(dateKey()), 30000);
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('dayflow-sqlite');
    channelRef.current = channel;
    if (channel) channel.onmessage = () => {
      writeQueue.current = writeQueue.current.then(async () => {
        try {
          const response = await fetch('/api/data', { cache: 'no-store' });
          if (!response.ok) throw new Error('read failed');
          const latest = readStored(await response.json());
          if (!active) return;
          revisionRef.current = latest.revision;
          dataRef.current = validateData(latest.data);
          setData(dataRef.current);
        } catch { if (active) setError('无法同步其他标签页的数据，请刷新后检查。'); }
      });
    };
    return () => {
      active = false;
      clearInterval(timer);
      channel?.close();
      if (channelRef.current === channel) channelRef.current = null;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', data?.dark ?? false);
  }, [data?.dark]);

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setDeadline(null);
        void update((d) => ({ ...d, focusSessions: d.focusSessions + 1 })).then((saved) => {
          if (saved) toast('专注完成！休息一下，喝杯水吧。');
        });
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline, update, toast]);

  const tasks = data?.tasks ?? EMPTY_TASKS;
  const lists = data?.lists ?? EMPTY_LISTS;
  const listScope = scope.startsWith('list:') ? scope.slice(5) : '';

  const openNew = useCallback(
    (date?: string) => {
      editingBaseRef.current = null;
      setSubtask('');
      setEditing(
        newTask('', listScope || '收集箱', date ?? (scope === 'today' ? today : '')),
      );
    },
    [listScope, scope, today],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      const target = e.target as HTMLElement;
      if (
        e.key === 'n' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !target.isContentEditable &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
        !document.querySelector('[role="dialog"]')
      ) {
        e.preventDefault();
        openNew();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openNew]);

  const pending = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);
  const todayTasks = useMemo(
    () => tasks.filter((t) => t.date === today),
    [tasks, today],
  );
  const todayPending = useMemo(
    () => todayTasks.filter((t) => t.status !== 'done').length,
    [todayTasks],
  );
  const doneToday = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === 'done' &&
          t.completed &&
          dateKey(new Date(t.completed)) === today,
      ).length,
    [tasks, today],
  );
  const rate = useMemo(
    () =>
      todayTasks.length
        ? Math.round(
            (todayTasks.filter((t) => t.status === 'done').length /
              todayTasks.length) *
              100,
          )
        : 0,
    [todayTasks],
  );
  const overdue = useMemo(
    () => pending.filter((t) => t.date && t.date < today),
    [pending, today],
  );
  const upcomingCount = useMemo(
    () => pending.filter((t) => t.date >= today && t.date <= offsetDate(6)).length,
    [pending, today],
  );
  const starredCount = useMemo(
    () => pending.filter((t) => t.starred).length,
    [pending],
  );
  const doneCount = useMemo(
    () => tasks.filter((t) => t.status === 'done').length,
    [tasks],
  );
  const listCounts = useMemo(
    () =>
      new Map(lists.map((l) => [l, pending.filter((t) => t.list === l).length])),
    [lists, pending],
  );
  const scopeTitle =
    listScope ||
    ({
      today: '我的一天',
      all: '全部任务',
      upcoming: '最近 7 天',
      starred: '重要任务',
      done: '已完成',
      overdue: '逾期任务',
    }[scope] ??
      '我的一天');

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (query.trim()) {
          if (
            ![t.title, t.notes, ...t.tags]
              .join(' ')
              .toLowerCase()
              .includes(query.trim().toLowerCase())
          )
            return false;
        } else if (
          listScope
            ? t.list !== listScope
            : scope === 'today'
              ? t.date !== today
              : scope === 'upcoming'
                ? !t.date ||
                  t.date < today ||
                  t.date > offsetDate(6) ||
                  t.status === 'done'
                : scope === 'starred'
                  ? !t.starred
                  : scope === 'done'
                    ? t.status !== 'done'
                    : scope === 'overdue'
                      ? !t.date || t.date >= today || t.status === 'done'
                      : false
        )
          return false;
        return (
          (priority === 'all' || t.priority === priority) &&
          (!selectedDay || view !== 'calendar' || t.date === selectedDay)
        );
      }),
    [tasks, query, listScope, scope, today, priority, selectedDay, view],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        sort === 'priority'
          ? ['high', 'medium', 'low'].indexOf(a.priority) -
            ['high', 'medium', 'low'].indexOf(b.priority)
          : sort === 'date'
            ? (a.date || '9999').localeCompare(b.date || '9999')
            : b.created.localeCompare(a.created),
      ),
    [filtered, sort],
  );

  const navigate = useCallback((s: string) => {
    setScope(s);
    setQuery('');
    setSelectedDay('');
  }, []);

  const openEdit = useCallback((t: Task) => {
    editingBaseRef.current = structuredClone(t);
    setEditing(structuredClone(t));
    setSubtask('');
  }, []);

  const moveTask = useCallback(
    (id: string, status: Status) => {
      update((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === id ? setStatus(t, status) : t)),
      }));
    },
    [update],
  );

  const toggleTask = useCallback(
    (id: string, done: boolean) => moveTask(id, done ? 'done' : 'todo'),
    [moveTask],
  );

  const starTask = useCallback(
    (id: string, starred: boolean) => {
      update((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === id ? { ...t, starred } : t)),
      }));
    },
    [update],
  );

  const selectDay = useCallback(
    (day: string) => {
      setSelectedDay(day);
      if (day) setScope(listScope ? 'list:' + listScope : 'all');
    },
    [listScope],
  );

  const resetMonth = useCallback(() => {
    setMonth(new Date());
    setSelectedDay('');
  }, []);

  const showCalendar = useCallback(
    (base?: Date, day?: string) => {
      navigate('all');
      setView('calendar');
      setMonth(base ?? new Date());
      setSelectedDay(day ?? '');
    },
    [navigate],
  );

  const toggleTimer = useCallback(() => {
    if (deadline) {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      setDeadline(null);
    } else {
      const duration =
        remaining > 0 ? remaining : (dataRef.current?.focusMinutes ?? 25) * 60;
      setRemaining(duration);
      setDeadline(Date.now() + duration * 1000);
    }
  }, [deadline, remaining]);

  const resetTimer = useCallback(() => {
    setDeadline(null);
    setRemaining((dataRef.current?.focusMinutes ?? 25) * 60);
  }, []);

  const handleFocusMinutesChange = useCallback((minutes: number) => {
    setDeadline(null);
    setRemaining(minutes * 60);
  }, []);

  async function saveTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.title.trim()) return;
    const t = {
      ...editing,
      title: editing.title.trim(),
      tags: [...new Set(editing.tags.filter(Boolean))],
    };
    const base = editingBaseRef.current;
    if (
      await update((d) => {
        const existing = d.tasks.find((x) => x.id === t.id);
        if (base && JSON.stringify(existing) !== JSON.stringify(base))
          throw new Error('TASK_CHANGED');
        return {
          ...d,
          tasks: existing ? d.tasks.map((x) => (x.id === t.id ? t : x)) : [t, ...d.tasks],
        };
      })
    ) {
      setEditing(null);
      toast('任务已保存');
    }
  }

  async function addQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!quick.trim()) return;
    const t = newTask(
      quick.trim(),
      listScope || '收集箱',
      scope === 'today' ? today : '',
    );
    if (await update((d) => ({ ...d, tasks: [t, ...d.tasks] }))) {
      setQuick('');
      toast('已添加任务');
    }
  }

  function deleteTask(t: Task) {
    setConfirm({
      title: '删除这项任务？',
      body: `“${t.title}”及其子任务将被删除。`,
      action: async () => {
        if (
          await update((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }))
        ) {
          setEditing(null);
          toast('任务已删除');
        }
      },
    });
  }

  if (!ready || !data)
    return (
      <div className="boot">
        <div className="brand-symbol">
          <CheckCheck />
        </div>
        <p>正在打开你的工作台…</p>
      </div>
    );

  const taskCardProps = { lists, today, onToggle: toggleTask, onStar: starTask, onEdit: openEdit };

  return (
    <SidebarProvider
      style={{ '--sidebar-width': '246px' } as React.CSSProperties}
    >
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <div className="brand">
            <span className="brand-symbol">
              <CheckCheck size={23} />
            </span>
            <div>
              序日 <span>Dayflow</span>
            </div>
          </div>
          <div className="workspace">
            <span className="avatar">我</span>
            <div>
              个人工作空间<small>让每一天，更有条理</small>
            </div>
            <span className="local-pill">SQLite</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-section">
            <span className="nav-caption">工作台</span>
            {(
              [
                ['today', '我的一天', Sun, todayPending],
                ['all', '全部任务', Inbox, pending.length],
                ['upcoming', '最近 7 天', CalendarDays, upcomingCount],
                ['starred', '重要任务', Star, starredCount],
                ['done', '已完成', CircleCheck, doneCount],
              ] as const
            ).map(([key, label, Icon, count]) => (
              <NavItem
                key={key}
                active={scope === key}
                onClick={() => navigate(key)}
              >
                <Icon size={19} />
                <span>{label}</span>
                <small>{count}</small>
              </NavItem>
            ))}
          </div>
          <div className="nav-section">
            <div className="caption-row">
              <span className="nav-caption">我的清单</span>
              <button
                className="icon-button"
                aria-label="新建清单"
                onClick={() => setListModal(true)}
              >
                <Plus size={16} />
              </button>
            </div>
            {lists.map((l, i) => (
              <NavItem
                key={l}
                active={listScope === l}
                onClick={() => navigate('list:' + l)}
              >
                <span
                  className="list-dot"
                  style={{ background: colors[i % colors.length] }}
                />
                <span>{l}</span>
                <small>{listCounts.get(l) ?? 0}</small>
              </NavItem>
            ))}
            <button className="new-list" onClick={() => setListModal(true)}>
              <Plus size={16} />
              新建清单
            </button>
          </div>
          <div className="sidebar-note">
            <Sparkles size={19} />
            <p>
              留一点空间，
              <br />
              给真正重要的事。
            </p>
            <span>一步一步，也是一种前进。</span>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={18} />
            <span>设置与数据</span>
          </button>
          <div className="storage-note">
            <span className="status-dot" />
            数据保存在本机 SQLite
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-menu" />
            <span>个人空间</span>
            <ChevronRight size={14} />
            <strong>{scopeTitle}</strong>
          </div>
          <div className="top-actions">
            <label className="search">
              <Search size={17} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索所有任务…"
                aria-label="搜索所有任务"
              />
              <kbd>Ctrl K</kbd>
              {query && (
                <button aria-label="清除搜索" onClick={() => setQuery('')}>
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              className="icon-button"
              title="切换主题"
              aria-label="切换深浅主题"
              onClick={() => update((d) => ({ ...d, dark: !d.dark }))}
            >
              {data.dark ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <span className="avatar small">我</span>
          </div>
        </header>
        {error && (
          <div role="alert" className="error-banner">
            {error}
            <button onClick={() => setSettings(true)}>打开设置</button>
          </div>
        )}
        <div className="page-layout">
          <main className="workspace-main">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {new Date(today + 'T12:00:00').toLocaleDateString('zh-CN', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                  <span> / </span>每一天，都值得认真对待
                </div>
                <h1>
                  {query ? '搜索结果' : scopeTitle}
                  <span className="heading-dot">.</span>
                </h1>
                <p>
                  {scope === 'today' && !query
                    ? '把注意力留给今天，让重要的事稳步向前。'
                    : query
                      ? `找到 ${sorted.length} 项相关任务`
                      : '整理想法，安排时间，按自己的节奏完成。'}
                </p>
              </div>
              <button className="primary-button" onClick={() => openNew()}>
                <Plus size={18} />
                新建任务<kbd>N</kbd>
              </button>
            </div>
            <section className="stats">
              <div className="stat">
                <div className="stat-top">
                  <span>今日待办</span>
                  <span className="stat-icon violet">
                    <Sun size={18} />
                  </span>
                </div>
                <div className="stat-number">
                  {todayPending}
                  <span>项任务</span>
                </div>
                <small>专注当下，一件一件完成</small>
              </div>
              <div className="stat">
                <div className="stat-top">
                  <span>今日完成</span>
                  <span className="stat-icon green">
                    <CircleCheck size={18} />
                  </span>
                </div>
                <div className="stat-number">
                  {doneToday}
                  <span>项任务</span>
                </div>
                <small className="positive">每一步进展，都算数</small>
              </div>
              <button
                className="stat overdue-stat"
                onClick={() => navigate('overdue')}
              >
                <div className="stat-top">
                  <span>逾期待办</span>
                  <span className="stat-icon amber">
                    <Clock3 size={18} />
                  </span>
                </div>
                <div className="stat-number">
                  {overdue.length}
                  <span>项任务</span>
                </div>
                <small>
                  {overdue.length
                    ? '查看任务，重新安排时间'
                    : '没有逾期，保持这个节奏'}
                </small>
              </button>
              <div className="stat progress-stat">
                <div>
                  <div className="stat-top">今日进度</div>
                  <div className="stat-number">
                    {rate}
                    <span>%</span>
                  </div>
                  <small>按计划，慢慢来</small>
                </div>
                <div
                  className="progress-ring"
                  style={
                    { '--progress': `${rate * 3.6}deg` } as React.CSSProperties
                  }
                >
                  <Check size={22} />
                </div>
              </div>
            </section>
            <section className="tasks-panel">
              <div className="view-toolbar">
                <Tabs
                  value={view}
                  onValueChange={(v) => {
                    setView(String(v));
                    setSelectedDay('');
                  }}
                >
                  <TabsList className="view-tabs">
                    <TabsTrigger value="list">
                      <List size={16} />
                      列表
                    </TabsTrigger>
                    <TabsTrigger value="board">
                      <LayoutGrid size={16} />
                      看板
                    </TabsTrigger>
                    <TabsTrigger value="calendar">
                      <CalendarDays size={16} />
                      日历
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="filter-tools">
                  <Choice
                    label="优先级筛选"
                    value={priority}
                    onChange={setPriority}
                    options={
                      [
                        ['all', '全部优先级'],
                        ...Object.entries(priorities),
                      ] as Option[]
                    }
                  />
                  <ArrowDownUp size={15} />
                  <Choice
                    label="任务排序"
                    value={sort}
                    onChange={setSort}
                    options={[
                      ['created', '创建时间'],
                      ['date', '截止日期'],
                      ['priority', '优先级'],
                    ]}
                  />
                </div>
              </div>
              <form className="quick-add" onSubmit={addQuick} {...quickCompositionGuard}>
                <Plus size={19} />
                <input
                  value={quick}
                  maxLength={200}
                  onChange={(e) => setQuick(e.target.value)}
                  placeholder="添加一个任务，把想法先记下来…"
                  aria-label="快速添加任务"
                />
                <button type="submit">{quick ? '添加' : 'Enter ↵'}</button>
              </form>
              {view === 'list' && (
                <div className="task-groups">
                  {(['doing', 'todo', 'done'] as Status[]).map((status) => {
                    const rows = sorted.filter((t) => t.status === status);
                    return (
                      rows.length > 0 && (
                        <section key={status}>
                          <div className={`group-heading ${status}`}>
                            <span className="group-dot" />
                            {statuses[status]}
                            <span className="count-badge">{rows.length}</span>
                            <div />
                          </div>
                          {rows.map((t) => (
                            <TaskCard key={t.id} task={t} {...taskCardProps} />
                          ))}
                        </section>
                      )
                    );
                  })}
                  {sorted.length === 0 && (
                    <div className="empty-state">
                      <CircleCheck size={36} />
                      <h3>{query ? '没有找到匹配的任务' : '这里还没有任务'}</h3>
                      <p>
                        {query
                          ? '换个关键词，或清除筛选再试试。'
                          : '把想做的事记下来，让今天更清晰。'}
                      </p>
                      <button
                        className="subtle-button"
                        onClick={() => (query ? setQuery('') : openNew())}
                      >
                        {query ? '清除搜索' : '添加第一个任务'}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              {view === 'board' && (
                <div className="board">
                  {(['todo', 'doing', 'done'] as Status[]).map((status) => (
                    <section
                      className={`board-column ${status}`}
                      key={status}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('text/plain');
                        if (tasks.some((t) => t.id === id)) moveTask(id, status);
                      }}
                    >
                      <div className="group-heading">
                        <span className="group-dot" />
                        {statuses[status]}
                        <span className="count-badge">
                          {sorted.filter((t) => t.status === status).length}
                        </span>
                      </div>
                      {sorted
                        .filter((t) => t.status === status)
                        .map((t) => (
                          <TaskCard key={t.id} task={t} board {...taskCardProps} />
                        ))}
                      <button
                        className="board-add"
                        onClick={() => {
                          const t = newTask(
                            '',
                            listScope || '收集箱',
                            scope === 'today' ? today : '',
                          );
                          setEditing(setStatus(t, status));
                          setSubtask('');
                        }}
                      >
                        <Plus size={15} />
                        添加任务
                      </button>
                    </section>
                  ))}
                </div>
              )}
              {view === 'calendar' && (
                <CalendarView
                  month={month}
                  onMonthChange={setMonth}
                  selectedDay={selectedDay}
                  onSelectDay={selectDay}
                  onResetMonth={resetMonth}
                  today={today}
                  tasks={tasks}
                  lists={lists}
                  listScope={listScope}
                  filtered={sorted}
                  onAdd={(date) => openNew(date)}
                  onToggle={toggleTask}
                  onStar={starTask}
                  onEdit={openEdit}
                />
              )}
            </section>
            <footer className="main-footer">
              <ShieldCheck size={14} />
              <span>只属于你的个人空间</span>
              <span className="footer-tip">按 N 新建任务 · Ctrl K 搜索</span>
            </footer>
          </main>
          <RightPanel
            today={today}
            tasks={tasks}
            pending={pending}
            remaining={remaining}
            running={deadline !== null}
            focusTask={focusTask}
            sessions={data.focusSessions}
            onFocusTaskChange={setFocusTask}
            onToggleTimer={toggleTimer}
            onResetTimer={resetTimer}
            onShowCalendar={showCalendar}
            onShowUpcoming={() => navigate('upcoming')}
            onEditTask={openEdit}
          />
        </div>
      </div>
      <EditorDialog
        editing={editing}
        lists={lists}
        exists={!!editing && tasks.some((t) => t.id === editing.id)}
        subtask={subtask}
        onSubtaskChange={setSubtask}
        onChange={setEditing}
        onSave={saveTask}
        onDelete={deleteTask}
      />
      <Dialog open={listModal} onOpenChange={setListModal}>
        <DialogContent className="settings-dialog">
          <DialogTitle>新建清单</DialogTitle>
          <DialogDescription>给同类任务一个专属空间。</DialogDescription>
          <form
            className="task-form"
            {...listCompositionGuard}
            onSubmit={async (e) => {
              e.preventDefault();
              const name = listName.trim();
              if (!name) return;
              if (lists.includes(name)) {
                toast('这个清单已经存在');
                return;
              }
              if (await update((d) => ({ ...d, lists: [...d.lists, name] }))) {
                setListModal(false);
                setListName('');
                navigate('list:' + name);
              }
            }}
          >
            <label>
              清单名称
              <input
                autoFocus
                value={listName}
                maxLength={40}
                required
                onChange={(e) => setListName(e.target.value)}
                placeholder="例如：旅行计划"
              />
            </label>
            <button className="primary-button" type="submit">
              创建清单
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <SettingsDialog
        open={settings}
        onOpenChange={setSettings}
        data={data}
        today={today}
        listScope={listScope}
        storageBlocked={storageBlocked}
        update={update}
        toast={toast}
        onConfirm={setConfirm}
        onFocusMinutesChange={handleFocusMinutesChange}
        navigate={navigate}
      />
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirm?.action();
                setConfirm(null);
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {notice && (
        <div role="status" className="toast">
          <CircleCheck size={18} />
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </SidebarProvider>
  );
}
