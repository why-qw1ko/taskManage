'use client';

import { Plus, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { setStatus, uid, type Status, type Task } from '@/lib/tasks';
import { useCompositionGuard } from '@/hooks/use-composition-guard';
import { Choice, priorities, statuses } from './common';

type Props = {
  editing: Task | null;
  lists: string[];
  /** 当前编辑的任务是否已存在于数据中（区分新建与编辑） */
  exists: boolean;
  subtask: string;
  onSubtaskChange: (v: string) => void;
  onChange: (t: Task | null) => void;
  onSave: (e: React.FormEvent) => void;
  onDelete: (t: Task) => void;
};

export function EditorDialog({
  editing,
  lists,
  exists,
  subtask,
  onSubtaskChange,
  onChange,
  onSave,
  onDelete,
}: Props) {
  const compositionGuard = useCompositionGuard();
  const patch = (p: Partial<Task>) => editing && onChange({ ...editing, ...p });
  const addSubtask = () => {
    if (!editing || !subtask.trim() || editing.subtasks.length >= 100) return;
    onChange({
      ...editing,
      subtasks: [
        ...editing.subtasks,
        { id: uid(), title: subtask.trim(), done: false },
      ],
    });
    onSubtaskChange('');
  };
  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) onChange(null);
      }}
    >
      <DialogContent className="editor-dialog">
        <DialogTitle>{exists ? '任务详情' : '新建任务'}</DialogTitle>
        <DialogDescription>把下一步写清楚，让行动更轻松。</DialogDescription>
        {editing && (
          <form onSubmit={onSave} className="task-form" {...compositionGuard}>
            <label>
              任务名称
              <input
                autoFocus
                required
                maxLength={200}
                placeholder="你想完成什么？"
                value={editing.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <div className="form-field">
                <span>所属清单</span>
                <Choice
                  label="所属清单"
                  value={editing.list}
                  options={lists.map((l) => [l, l])}
                  onChange={(v) => patch({ list: v })}
                />
              </div>
              <label>
                截止日期
                <input
                  type="date"
                  value={editing.date}
                  onChange={(e) => patch({ date: e.target.value })}
                />
              </label>
              <div className="form-field">
                <span>优先级</span>
                <Choice
                  label="优先级"
                  value={editing.priority}
                  options={Object.entries(priorities)}
                  onChange={(v) => patch({ priority: v as Task['priority'] })}
                />
              </div>
              <div className="form-field">
                <span>状态</span>
                <Choice
                  label="任务状态"
                  value={editing.status}
                  options={Object.entries(statuses)}
                  onChange={(v) => onChange(setStatus(editing, v as Status))}
                />
              </div>
            </div>
            <label>
              备注
              <textarea
                rows={3}
                maxLength={10000}
                placeholder="补充细节、想法或参考信息…"
                value={editing.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </label>
            <label>
              标签 <small>用逗号分隔</small>
              <input
                maxLength={500}
                value={editing.tags.join(',')}
                onChange={(e) =>
                  patch({
                    tags: e.target.value
                      .split(/[,，]/)
                      .slice(0, 20)
                      .map((s) => s.trim().slice(0, 40)),
                  })
                }
                placeholder="工作, 生活, 灵感"
              />
            </label>
            <div className="subtasks">
              <div className="subtasks-head">
                <span>子任务</span>
                <small>
                  {editing.subtasks.filter((s) => s.done).length}/
                  {editing.subtasks.length}
                </small>
              </div>
              {editing.subtasks.length > 0 && (
                <div className="subtask-progress">
                  <span
                    style={{
                      width: `${Math.round(
                        (editing.subtasks.filter((s) => s.done).length /
                          editing.subtasks.length) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              )}
              {editing.subtasks.map((s) => (
                <div
                  className="subtask"
                  key={s.id}
                  onClick={() =>
                    patch({
                      subtasks: editing.subtasks.map((x) =>
                        x.id === s.id ? { ...x, done: !x.done } : x,
                      ),
                    })
                  }
                >
                  <Checkbox
                    checked={s.done}
                    aria-label={s.title}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={(done) =>
                      patch({
                        subtasks: editing.subtasks.map((x) =>
                          x.id === s.id ? { ...x, done: !!done } : x,
                        ),
                      })
                    }
                  />
                  <span className={s.done ? 'crossed' : ''}>{s.title}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="删除子任务"
                    onClick={(e) => {
                      e.stopPropagation();
                      patch({
                        subtasks: editing.subtasks.filter((x) => x.id !== s.id),
                      });
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              {editing.subtasks.length === 0 && (
                <p className="subtasks-empty">
                  还没有子任务，把大任务拆成几个小步骤。
                </p>
              )}
              <div className="subtask-add">
                <input
                  value={subtask}
                  maxLength={200}
                  placeholder="拆解成一个小步骤…"
                  onChange={(e) => onSubtaskChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!subtask.trim() || editing.subtasks.length >= 100}
                  onClick={addSubtask}
                >
                  <Plus size={17} />
                </button>
              </div>
            </div>
            <div className="form-footer">
              {exists && (
                <button
                  type="button"
                  className="danger-link"
                  onClick={() => onDelete(editing)}
                >
                  <Trash2 size={16} />
                  删除
                </button>
              )}
              <button
                type="button"
                className="subtle-button"
                onClick={() => onChange(null)}
              >
                取消
              </button>
              <button className="primary-button" type="submit">
                保存任务
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
