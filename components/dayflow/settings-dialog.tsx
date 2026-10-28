'use client';

import { useRef } from 'react';
import { Download, FolderClosed, Trash2, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { mergeData, seed, validateData, type Data } from '@/lib/tasks';
import { Choice } from './common';

export type ConfirmRequest = {
  title: string;
  body: string;
  action: () => void;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Data;
  today: string;
  listScope: string;
  storageBlocked: boolean;
  update: (fn: (d: Data) => Data) => Promise<boolean>;
  toast: (message: string) => void;
  onConfirm: (c: ConfirmRequest) => void;
  onFocusMinutesChange: (minutes: number) => void;
  navigate: (scope: string) => void;
};

function download(raw: string, name: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsDialog({
  open,
  onOpenChange,
  data,
  today,
  listScope,
  storageBlocked,
  update,
  toast,
  onConfirm,
  onFocusMinutesChange,
  navigate,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error('请选择小于 5 MB 的备份');
      const incoming = validateData(JSON.parse(await file.text()));
      if (await update((d) => mergeData(d, incoming)))
        toast('备份已合并，同 ID 的已有任务保留');
    } catch (e) {
      toast(e instanceof Error ? e.message : '导入失败');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="settings-dialog">
        <DialogTitle>设置与数据</DialogTitle>
        <DialogDescription>
          数据保存在本机 SQLite 数据库中，请定期导出备份。
        </DialogDescription>
        <div className="setting-row">
          <span>界面主题</span>
          <Choice
            label="界面主题"
            value={data.dark ? 'dark' : 'light'}
            options={[
              ['light', '浅色'],
              ['dark', '深色'],
            ]}
            onChange={(v) => update((d) => ({ ...d, dark: v === 'dark' }))}
          />
        </div>
        <div className="setting-row">
          <span>每次专注时长</span>
          <Choice
            label="专注时长"
            value={String(data.focusMinutes)}
            options={[15, 25, 45, 60].map((n) => [String(n), `${n} 分钟`])}
            onChange={async (v) => {
              if (await update((d) => ({ ...d, focusMinutes: Number(v) })))
                onFocusMinutesChange(Number(v));
            }}
          />
        </div>
        <div className="backup-buttons">
          <button
            className="subtle-button"
            disabled={storageBlocked}
            onClick={() =>
              download(JSON.stringify(data, null, 2), `序日备份-${today}.json`)
            }
          >
            <Download size={16} />
            导出备份
          </button>
          <button
            className="subtle-button"
            disabled={storageBlocked}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} />
            导入并合并
          </button>
          <input
            hidden
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => importFile(e.target.files?.[0])}
          />
        </div>
        <p className="setting-hint">
          相同 ID
          的任务保留当前版本；新任务和清单会加入。计时器在关闭或刷新页面后重置。
        </p>
        <div className="manage-lists">
          <h3>管理清单</h3>
          {data.lists
            .filter((l) => l !== '收集箱')
            .map((l) => (
              <div className="setting-row" key={l}>
                <span>
                  <FolderClosed size={15} />
                  {l}
                </span>
                <button
                  className="icon-button"
                  aria-label={`删除清单 ${l}`}
                  onClick={() =>
                    onConfirm({
                      title: '删除清单？',
                      body: '其中的任务会移入收集箱，不会被删除。',
                      action: async () => {
                        const saved = await update((d) => ({
                          ...d,
                          lists: d.lists.filter((x) => x !== l),
                          tasks: d.tasks.map((t) =>
                            t.list === l ? { ...t, list: '收集箱' } : t,
                          ),
                        }));
                        if (saved && listScope === l) navigate('all');
                      },
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
        </div>
        <button
          className="danger-link"
          onClick={() =>
            onConfirm({
              title: '清除示例任务？',
              body: '只会移除首次打开时提供的示例任务，你新建的任务会保留。',
              action: () => {
                update((d) => ({
                  ...d,
                  tasks: d.tasks.filter((t) => !t.demo),
                }));
              },
            })
          }
        >
          清除示例任务
        </button>
        <button
          className="danger-link"
          onClick={() =>
            onConfirm({
              title: '重置所有本地数据？',
              body: '所有任务、清单和设置将被清除。请先导出备份，此操作无法撤销。',
              action: async () => {
                if (await update(() => ({ ...seed(), tasks: [] }))) {
                  window.location.reload();
                }
              },
            })
          }
        >
          重置所有数据
        </button>
      </DialogContent>
    </Dialog>
  );
}
