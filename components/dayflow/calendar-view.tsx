'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { dateKey, type Task } from '@/lib/tasks';
import { TaskCard, type TaskCardActions } from './task-card';

type Props = {
  month: Date;
  onMonthChange: (d: Date) => void;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  onResetMonth: () => void;
  today: string;
  tasks: Task[];
  lists: string[];
  listScope: string;
  filtered: Task[];
  onAdd: (date: string) => void;
} & TaskCardActions;

export function CalendarView({
  month,
  onMonthChange,
  selectedDay,
  onSelectDay,
  onResetMonth,
  today,
  tasks,
  lists,
  listScope,
  filtered,
  onAdd,
  ...actions
}: Props) {
  const days = useMemo(() => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(monthStart);
    start.setDate(1 - ((monthStart.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [month]);

  return (
    <div className="calendar-view">
      <div className="calendar-heading">
        <h3>
          {month.getFullYear()} 年 {month.getMonth() + 1} 月
        </h3>
        <div>
          <button
            className="icon-button"
            aria-label="上个月"
            onClick={() =>
              onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button onClick={onResetMonth}>本月</button>
          <button
            className="icon-button"
            aria-label="下个月"
            onClick={() =>
              onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="month-grid">
        {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
          <div className="weekday" key={d}>
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = dateKey(d);
          const count = tasks.filter(
            (t) => t.date === key && (!listScope || t.list === listScope),
          ).length;
          return (
            <button
              key={key}
              className={`month-day ${d.getMonth() !== month.getMonth() ? 'muted-day' : ''} ${key === today ? 'today' : ''} ${selectedDay === key ? 'selected-day' : ''}`}
              onClick={() => onSelectDay(selectedDay === key ? '' : key)}
            >
              <span>{d.getDate()}</span>
              {count > 0 && <small>{count} 项任务</small>}
            </button>
          );
        })}
      </div>
      <div className="calendar-selection">
        <span>{selectedDay ? `${selectedDay} 的任务` : '当前筛选的任务'}</span>
        <button onClick={() => onAdd(selectedDay || today)}>
          <Plus size={15} />
          添加日程
        </button>
      </div>
      {filtered.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          lists={lists}
          today={today}
          {...actions}
        />
      ))}
      {filtered.length === 0 && (
        <p className="calendar-empty">当天没有安排，享受一点自由时间。</p>
      )}
    </div>
  );
}
