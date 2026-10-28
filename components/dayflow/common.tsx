'use client';

import { useId } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const priorities = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
} as const;
export const statuses = {
  todo: '待开始',
  doing: '进行中',
  done: '已完成',
} as const;
export const colors = [
  '#8993a7',
  '#6c71e6',
  '#e2a34e',
  '#49a995',
  '#cd7d9f',
  '#699dd4',
];
export type Option = [string, string];

export function listColor(lists: string[], list: string) {
  return colors[Math.max(0, lists.indexOf(list)) % colors.length];
}

export function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  label: string;
}) {
  const name = useId();
  if (options.length < 5) {
    return (
      <div className="choice-options" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <label className="choice-option" key={v}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{text}</span>
          </label>
        ))}
      </div>
    );
  }
  if (options.length > 10) {
    return (
      <Combobox.Root
        items={options.map(([v]) => v)}
        value={value}
        itemToStringLabel={(v: string) => options.find(([id]) => id === v)?.[1] ?? v}
        onValueChange={(v) => { if (v !== null) onChange(v); }}
      >
        <Combobox.Input className="choice-search" aria-label={label} placeholder="搜索选项" />
        <Combobox.Portal>
          <Combobox.Positioner className="choice-positioner" sideOffset={4}>
            <Combobox.Popup className="choice-popup">
              <Combobox.Empty className="choice-empty">没有匹配的选项</Combobox.Empty>
              <Combobox.List className="choice-list">
                {(v: string) => <Combobox.Item className="choice-item" key={v} value={v}>{options.find(([id]) => id === v)?.[1] ?? v}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    );
  }
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
    >
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue>
          {options.find((o) => o[0] === value)?.[1] || value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
