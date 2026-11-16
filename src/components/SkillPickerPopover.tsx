import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { MATURITY_LABELS, TRACK_LABELS } from '../data/skillsCatalog';
import type { SkillDefinition, SkillTrack } from '../types/orchestrator';

interface SkillPickerPopoverProps {
  skills: SkillDefinition[];
  insertIndex: number;
  onSelect: (skill: SkillDefinition, insertIndex: number) => void;
  onClose: () => void;
}

const TRACK_TABS: Array<{ id: 'all' | SkillTrack; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'delivery', label: '交付型' },
  { id: 'support', label: '支持型' },
  { id: 'ops', label: '运维保障' },
  { id: 'horizontal', label: '横向能力' },
];

export const SkillPickerPopover: React.FC<SkillPickerPopoverProps> = ({
  skills,
  insertIndex,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [track, setTrack] = useState<'all' | SkillTrack>('all');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (track !== 'all' && s.track !== track) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q) ||
        s.stage.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    });
  }, [skills, query, track]);

  return (
    <div className="my-2 bg-white border border-[#2563EB]/35 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.08)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="font-semibold text-slate-900">选择要插入的 Skill 模块</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="text-slate-500 tabular-nums">将插入到第 {insertIndex + 1} 步</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
          aria-label="关闭 Skill 选择面板"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pt-3 pb-2.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索名称、阶段或关键字（如：对账、DDL、诊断、DQC）..."
            className="w-full pl-8 pr-3 py-1.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0">
          {TRACK_TABS.map((tab) => {
            const active = track === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTrack(tab.id)}
                className={`px-2.5 py-1 text-[11.5px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.length === 0 ? (
          <div className="col-span-full py-8 text-center text-[12.5px] text-slate-500">
            没有匹配的 Skill，请更换搜索词。
          </div>
        ) : (
          filtered.map((skill) => {
            const maturityColor =
              skill.maturity === 'existing'
                ? 'text-emerald-700'
                : skill.maturity === 'pending'
                  ? 'text-amber-700'
                  : 'text-slate-500';

            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => onSelect(skill, insertIndex)}
                className="group text-left p-3 rounded-lg border border-slate-200/80 hover:border-[#2563EB] hover:bg-blue-50/35 transition-colors flex items-start justify-between gap-2.5 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-900 truncate">
                      {skill.displayName}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                    {skill.name}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span>{TRACK_LABELS[skill.track]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{skill.stage}</span>
                    <span aria-hidden="true">·</span>
                    <span className={maturityColor}>{MATURITY_LABELS[skill.maturity]}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-slate-500 line-clamp-1">
                    {skill.description}
                  </p>
                </div>

                <span className="shrink-0 mt-0.5 inline-flex items-center gap-0.5 px-2 py-1 text-[11.5px] font-medium text-[#2563EB] bg-blue-50/70 group-hover:bg-[#2563EB] group-hover:text-white rounded transition-colors whitespace-nowrap">
                  <Plus className="w-3 h-3" />
                  <span>插入</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
