'use client';

import {
  ArrowRight,
  CalendarDays,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  Target,
} from 'lucide-react';
import { dateKey, type Task } from '@/lib/tasks';
import { Choice, type Option } from './common';

type Props = {
  today: string;
  tasks: Task[];
  pending: Task[];
  remaining: number;
  running: boolean;
  focusTask: string;
  sessions: number;
  onFocusTaskChange: (v: string) => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onShowCalendar: (base?: Date, day?: string) => void;
  onShowUpcoming: () => void;
  onEditTask: (t: Task) => void;
};

export function RightPanel({
  today,
  tasks,
  pending,
  remaining,
  running,
  focusTask,
  sessions,
  onFocusTaskChange,
  onToggleTimer,
  onResetTimer,
  onShowCalendar,
  onShowUpcoming,
  onEditTask,
}: Props) {
  return (
    <aside className="right-panel">
      <div className="aside-date">
        <span className="eyebrow">TODAY’S OVERVIEW</span>
        <h2>今天，也在前进</h2>
      </div>
      <section className="week-card">
        <div className="section-title">
          <span>
            {new Date(today + 'T12:00:00').toLocaleDateString('zh-CN', {
              month: 'long',
            })}
          </span>
          <button
            onClick={() => onShowCalendar()}
            className="icon-button"
            aria-label="打开月历"
          >
            <CalendarDays size={17} />
          </button>
        </div>
        <div className="week-strip">
          {Array.from({ length: 7 }, (_, i) => {
            const base = new Date(today + 'T12:00:00');
            base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + i);
            const k = dateKey(base);
            return (
              <button
                key={k}
                className={k === today ? 'current' : ''}
                onClick={() => onShowCalendar(base, k)}
              >
                <small>{['一', '二', '三', '四', '五', '六', '日'][i]}</small>
                <strong>{base.getDate()}</strong>
                <span
                  className={
                    tasks.some((t) => t.date === k && t.status !== 'done')
                      ? 'has-task'
                      : ''
                  }
                />
              </button>
            );
          })}
        </div>
      </section>
      <section className="focus-card">
        <div className="section-title">
          <span>
            <Target size={17} />
            专注时刻
          </span>
          <span className="focus-label">FOCUS</span>
        </div>
        <p>一次只做一件事，就很好。</p>
        <div className={`timer ${running ? 'running' : ''}`}>
          {String(Math.floor(remaining / 60)).padStart(2, '0')}
          <span>:</span>
          {String(remaining % 60).padStart(2, '0')}
        </div>
        <Choice
          label="选择专注任务"
          value={pending.some((t) => t.id === focusTask) ? focusTask : 'none'}
          onChange={onFocusTaskChange}
          options={[
            ['none', '选择一项任务，开始专注'],
            ...pending.map((t) => [t.id, t.title] as Option),
          ]}
        />
        <div className="timer-controls">
          <button className="primary-button" onClick={onToggleTimer}>
            {running ? <Pause size={16} /> : <Play size={16} />}{' '}
            {running ? '暂停专注' : '开始专注'}
          </button>
          <button
            className="reset-button"
            aria-label="重置计时"
            onClick={onResetTimer}
          >
            <RotateCcw size={17} />
          </button>
        </div>
        <small>
          <Coffee size={14} />
          累计完成 {sessions} 次专注
        </small>
      </section>
      <section className="up-next">
        <div className="section-title">
          <span>接下来</span>
          <button onClick={onShowUpcoming}>
            查看全部
            <ArrowRight size={14} />
          </button>
        </div>
        {pending
          .filter((t) => t.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 3)
          .map((t) => (
            <button
              className="upcoming-item"
              key={t.id}
              onClick={() => onEditTask(t)}
            >
              <span className={`timeline-dot ${t.priority}`} />
              <div>
                <small>
                  {t.date === today
                    ? '今天'
                    : t.date.slice(5).replace('-', '月') + '日'}
                  <span> · {t.list}</span>
                </small>
                <p>{t.title}</p>
              </div>
            </button>
          ))}
        {!pending.some((t) => t.date >= today) && (
          <p className="muted">暂时没有日程安排。</p>
        )}
      </section>
      <div className="daily-note">
        <span>给今天的一句话</span>
        <p>
          不必一下子看见整段阶梯，
          <br />
          只需迈出第一步。
        </p>
        <div>MAKE ROOM FOR WHAT MATTERS</div>
      </div>
    </aside>
  );
}
