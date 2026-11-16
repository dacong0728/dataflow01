import React from 'react';
import { Loader2, Play } from 'lucide-react';

interface TopBarProps {
  onRunAll: () => void;
  onOpenDiagram: () => void;
  onResetExample: () => void;
  onClearOutputs: () => void;
  isOrchestrating: boolean;
  progressLabel: string;
  hasNodes: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onRunAll,
  onOpenDiagram,
  onResetExample,
  onClearOutputs,
  isOrchestrating,
  progressLabel,
  hasNodes,
}) => {
  return (
    <header className="h-14 shrink-0 bg-white/95 backdrop-blur-sm border-b border-slate-200/90 px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Brand Title */}
      <a
        href="#top"
        onClick={(e) => e.preventDefault()}
        className="text-[15.5px] font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
      >
        数仓 Skill 编排台
      </a>

      {/* Zone 2: Clean single-line utility text links */}
      <nav aria-label="画布操作" className="flex items-center gap-6">
        <button
          type="button"
          onClick={onOpenDiagram}
          className="text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          参考架构图
        </button>
        <button
          type="button"
          onClick={onResetExample}
          disabled={isOrchestrating}
          className="text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:underline underline-offset-4 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          恢复默认链路
        </button>
        <button
          type="button"
          onClick={onClearOutputs}
          disabled={isOrchestrating || !hasNodes}
          className="text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:underline underline-offset-4 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          清空产出
        </button>
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
              <span>{progressLabel || '主控执行中...'}</span>
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
