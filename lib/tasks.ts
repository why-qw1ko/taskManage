export type Status = 'todo' | 'doing' | 'done';
export type Task = {
  id: string;
  title: string;
  notes: string;
  list: string;
  priority: 'high' | 'medium' | 'low';
  date: string;
  status: Status;
  starred: boolean;
  tags: string[];
  subtasks: { id: string; title: string; done: boolean }[];
  created: string;
  completed: string;
  demo?: boolean;
};
export type Data = {
  version: 1;
  tasks: Task[];
  lists: string[];
  dark: boolean;
  focusMinutes: number;
  focusSessions: number;
};
export const dateKey = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function offsetDate(n: number, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export const uid = () => crypto.randomUUID();
export function newTask(title = '', list = '收集箱', date = ''): Task {
  return {
    id: uid(),
    title,
    notes: '',
    list,
    priority: 'medium',
    date,
    status: 'todo',
    starred: false,
    tags: [],
    subtasks: [],
    created: new Date().toISOString(),
    completed: '',
  };
}
export function seed(): Data {
  const rows: [string, string, number, Task['priority'], Status, string[]][] = [
    ['梳理本周工作计划', '工作', 0, 'high', 'doing', ['本周重点']],
    ['完成个人网站的首页设计', '工作', 0, 'high', 'todo', ['设计']],
    ['阅读 20 页《原子习惯》', '个人成长', 0, 'medium', 'todo', ['阅读']],
    ['傍晚散步，给自己一点放空时间', '生活', 0, 'low', 'todo', ['健康']],
    ['整理桌面，开启高效的一天', '生活', 0, 'low', 'done', []],
    ['准备周三项目讨论的材料', '工作', 2, 'medium', 'todo', []],
    ['给家里的绿植浇水', '生活', 1, 'low', 'todo', []],
    ['学习一个新的 TypeScript 技巧', '个人成长', 3, 'medium', 'todo', ['学习']],
    ['记录下一次旅行的灵感', '收集箱', 7, 'low', 'todo', []],
  ];
  return {
    version: 1,
    lists: ['收集箱', '工作', '生活', '个人成长'],
    dark: false,
    focusMinutes: 25,
    focusSessions: 0,
    tasks: rows.map(([title, list, day, priority, status, tags], i) => ({
      ...newTask(title, list, offsetDate(day)),
      priority,
      status,
      tags,
      starred: i < 2,
      demo: true,
      completed: status === 'done' ? new Date().toISOString() : '',
      notes:
        i === 1
          ? '从信息结构开始，再完成视觉细节。\n先把最重要的内容做清楚。'
          : '',
      subtasks:
        i === 0
          ? [
              { id: uid(), title: '回顾上周进展', done: true },
              { id: uid(), title: '确定本周三个重点', done: false },
              { id: uid(), title: '为重要任务预留时间', done: false },
            ]
          : [],
    })),
  };
}
const text = (x: unknown, max: number): x is string =>
  typeof x === 'string' && x.length <= max;
const validDate = (s: unknown) =>
  s === '' ||
  (typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    dateKey(new Date(s + 'T12:00:00')) === s);
/**
 * 数据版本迁移入口。validateData 只接受当前版本；未来 schema 升级时，
 * 在这里把旧版本数据逐级转换为最新结构，例如：
 *   if ((value as Data).version === 1) value = migrateV1toV2(value);
 * 保持迁移幂等，迁移结果仍会经过 validateData 的完整校验。
 */
export function migrateData(value: unknown): unknown {
  return value;
}
export function validateData(value: unknown): Data {
  value = migrateData(value);
  if (!value || typeof value !== 'object') throw new Error('备份格式无效');
  const d = value as Data;
  if (
    d.version !== 1 ||
    !Array.isArray(d.tasks) ||
    d.tasks.length > 10000 ||
    !Array.isArray(d.lists) ||
    d.lists.length > 100 ||
    !d.lists.includes('收集箱') ||
    !d.lists.every((x) => text(x, 40) && x.trim()) ||
    new Set(d.lists).size !== d.lists.length
  )
    throw new Error('备份版本或清单格式无效');
  const ids = new Set<string>();
  const tasks = d.tasks.map((t) => {
    if (
      !t ||
      !text(t.id, 100) ||
      !t.id ||
      ids.has(t.id) ||
      !text(t.title, 200) ||
      !t.title.trim() ||
      !text(t.notes, 10000) ||
      !d.lists.includes(t.list) ||
      !['high', 'medium', 'low'].includes(t.priority) ||
      !['todo', 'doing', 'done'].includes(t.status) ||
      !validDate(t.date) ||
      typeof t.starred !== 'boolean' ||
      !Array.isArray(t.tags) ||
      t.tags.length > 20 ||
      !t.tags.every((x) => text(x, 40)) ||
      !Array.isArray(t.subtasks) ||
      t.subtasks.length > 100 ||
      !t.subtasks.every(
        (s) =>
          s &&
          text(s.id, 100) &&
          s.id &&
          text(s.title, 200) &&
          s.title.trim() &&
          typeof s.done === 'boolean',
      ) ||
      new Set(t.subtasks.map((s) => s.id)).size !== t.subtasks.length ||
      !text(t.created, 40) ||
      !Number.isFinite(Date.parse(t.created)) ||
      !text(t.completed, 40) ||
      (t.completed !== '' && !Number.isFinite(Date.parse(t.completed)))
    )
      throw new Error('备份包含无效任务，未导入任何内容');
    ids.add(t.id);
    return {
      id: t.id,
      title: t.title,
      notes: t.notes,
      list: t.list,
      priority: t.priority,
      date: t.date,
      status: t.status,
      starred: t.starred,
      tags: [...t.tags],
      subtasks: t.subtasks.map((s) => ({
        id: s.id,
        title: s.title,
        done: s.done,
      })),
      created: t.created,
      completed: t.completed,
      demo: t.demo === true,
    };
  });
  return {
    version: 1,
    tasks,
    lists: [...d.lists],
    dark: d.dark === true,
    focusMinutes: [15, 25, 45, 60].includes(d.focusMinutes)
      ? d.focusMinutes
      : 25,
    focusSessions:
      Number.isSafeInteger(d.focusSessions) && d.focusSessions >= 0
        ? d.focusSessions
        : 0,
  };
}
export function mergeData(current: Data, incoming: Data): Data {
  const ids = new Set(current.tasks.map((t) => t.id));
  return validateData({
    ...current,
    lists: [...new Set([...current.lists, ...incoming.lists])],
    tasks: [...current.tasks, ...incoming.tasks.filter((t) => !ids.has(t.id))],
  });
}
export function setStatus(t: Task, status: Status): Task {
  return {
    ...t,
    status,
    completed: status === 'done' ? t.completed || new Date().toISOString() : '',
  };
}
