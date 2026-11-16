import React from 'react';
import { Loader2, Play } from 'lucide-react';
import type { ScenarioId } from '../types/orchestrator';

interface TopBarProps {
  activeScenario: ScenarioId;
  onSelectScenario: (id: ScenarioId) => void;
  onRunAll: () => void;
  isOrchestrating: boolean;
  progressLabel: string;
  hasNodes: boolean;
}

const SCENARIO_TABS: Array<{ id: ScenarioId; label: string }> = [
  { id: 'delivery', label: '交付型主线' },
  { id: 'support', label: '支持型主线' },
  { id: 'ops', label: '运维保障主线' },
  { id: 'custom', label: '自定义画布' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeScenario,
  onSelectScenario,
  onRunAll,
  isOrchestrating,
  progressLabel,
  hasNodes,
}) => {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Brand Title */}
      <a
        href="#top"
        onClick={(e) => e.preventDefault()}
        className="text-[16px] font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
      >
        数仓 Skill 编排台
      </a>

      {/* Zone 2: Scenario Tabs (4 concise single-line links) */}
      <nav aria-label="业务场景预设" className="flex items-center gap-6 overflow-x-auto">
        {SCENARIO_TABS.map((tab) => {
          const isActive = activeScenario === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectScenario(tab.id)}
              className={`relative py-4 text-[13.5px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive ? 'text-[#2563EB]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2563EB]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single Primary Action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onRunAll}
          disabled={isOrchestrating || !hasNodes}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
        >
          {isOrchestrating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{progressLabel || '主控调度执行中...'}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>一键生成结果</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
