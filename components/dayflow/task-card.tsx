'use client';

import { memo } from 'react';
import { CalendarDays, CheckCheck, Flag, MoreHorizontal, Star } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Task } from '@/lib/tasks';
import { listColor, priorities } from './common';

export type TaskCardActions = {
  onToggle: (id: string, done: boolean) => void;
  onStar: (id: string, starred: boolean) => void;
  onEdit: (task: Task) => void;
};

type Props = {
  task: Task;
  lists: string[];
  today: string;
  board?: boolean;
} & TaskCardActions;

export const TaskCard = memo(function TaskCard({
  task: t,
  lists,
  today,
  board = false,
  onToggle,
  onStar,
  onEdit,
}: Props) {
  return (
    <div
      className={`task-row ${t.status === 'done' ? 'completed' : ''} ${board ? 'board-card' : ''}`}
      draggable={board}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
    >
      <Checkbox
        aria-label={`完成 ${t.title}`}
        checked={t.status === 'done'}
        onCheckedChange={(v) => onToggle(t.id, !!v)}
        className={`task-check ${t.priority}`}
      />
      <button className="task-body" onClick={() => onEdit(t)}>
        <span className="task-title">{t.title}</span>
        <span className="task-meta">
          <span
            className="list-dot"
            style={{ background: listColor(lists, t.list) }}
          />
          {t.list}
          {t.tags.filter(Boolean).map((tag) => (
            <span className="tag" key={tag}>
              #{tag}
            </span>
          ))}
          {t.subtasks.length > 0 && (
            <span>
              <CheckCheck size={13} />
              {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
            </span>
          )}
          {t.date && (
            <span
              className={t.date < today && t.status !== 'done' ? 'late' : ''}
            >
              <CalendarDays size={13} />
              {t.date === today ? '今天' : t.date.slice(5).replace('-', '/')}
            </span>
          )}
        </span>
      </button>
      <span className={`priority-mark ${t.priority}`} title={priorities[t.priority]}>
        <Flag size={14} />
        <span>{priorities[t.priority]}</span>
      </span>
      <button
        className={`icon-button star-button ${t.starred ? 'starred' : ''}`}
        aria-label={t.starred ? '取消重要标记' : '标记重要'}
        onClick={() => onStar(t.id, !t.starred)}
      >
        <Star size={17} fill={t.starred ? 'currentColor' : 'none'} />
      </button>
      <button
        className="icon-button more-button"
        aria-label="编辑任务"
        onClick={() => onEdit(t)}
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
});
