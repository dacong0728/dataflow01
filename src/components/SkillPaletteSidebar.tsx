import React, { useMemo, useState } from 'react';
import { GripVertical, Image as ImageIcon, Plus, Search } from 'lucide-react';
import { MATURITY_LABELS, TRACK_LABELS } from '../data/skillsCatalog';
import type { SkillDefinition, SkillTrack } from '../types/orchestrator';

interface SkillPaletteSidebarProps {
  skills: SkillDefinition[];
  onAddSkill: (skill: SkillDefinition) => void;
  onOpenDiagram: () => void;
}

const FILTER_OPTIONS: Array<{ id: 'all' | SkillTrack; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'delivery', label: '交付' },
  { id: 'support', label: '支持' },
  { id: 'ops', label: '运维' },
  { id: 'horizontal', label: '横向' },
];

export const SkillPaletteSidebar: React.FC<SkillPaletteSidebarProps> = ({
  skills,
  onAddSkill,
  onOpenDiagram,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState<'all' | SkillTrack>('all');

  const filteredSkills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return skills.filter((skill) => {
      if (trackFilter !== 'all' && skill.track !== trackFilter) {
        return false;
      }
      if (!q) return true;
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.displayName.toLowerCase().includes(q) ||
        skill.stage.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q)
      );
    });
  }, [skills, searchQuery, trackFilter]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, skill: SkillDefinition) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ source: 'catalog', skillId: skill.id }),
    );
  };

  return (
    <aside className="w-[276px] shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13.5px] font-semibold text-slate-900">Skill 资产目录</h2>
          <span className="text-[12px] text-slate-500 tabular-nums">{filteredSkills.length} 项</span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对账、DDL、诊断..."
            className="w-full pl-8 pr-3 py-1.5 text-[12.5px] bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          {FILTER_OPTIONS.map((opt) => {
            const active = trackFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTrackFilter(opt.id)}
                className={`flex-1 py-1 text-[11.5px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {filteredSkills.length === 0 ? (
          <div className="p-6 text-center text-[12.5px] text-slate-500">
            未匹配到相关 Skill，请调整筛选条件。
          </div>
        ) : (
          filteredSkills.map((skill) => {
            const maturityColor =
              skill.maturity === 'existing'
                ? 'text-emerald-700'
                : skill.maturity === 'pending'
                  ? 'text-amber-700'
                  : 'text-slate-500';

            return (
              <div
                key={skill.id}
                draggable
                onDragStart={(e) => handleDragStart(e, skill)}
                className="group px-3.5 py-3 hover:bg-slate-50/90 transition-colors cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900 truncate">
                        {skill.displayName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                        {skill.name}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddSkill(skill)}
                    title="添加到编排链路末尾"
                    className="shrink-0 inline-flex items-center gap-0.5 px-2 py-1 text-[11.5px] font-medium text-[#2563EB] hover:bg-blue-50 rounded transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>加入</span>
                  </button>
                </div>

                <div className="mt-1.5 pl-5 flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                  <span>{TRACK_LABELS[skill.track]}</span>
                  <span aria-hidden="true">·</span>
                  <span>{skill.stage}</span>
                  <span aria-hidden="true">·</span>
                  <span className={maturityColor}>{MATURITY_LABELS[skill.maturity]}</span>
                </div>

                <p className="mt-1 pl-5 text-[11.5px] leading-snug text-slate-500 line-clamp-2">
                  {skill.description}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50/60">
        <button
          type="button"
          onClick={onOpenDiagram}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[12px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>查看数仓 AI 提效架构原图</span>
        </button>
      </div>
    </aside>
  );
};
