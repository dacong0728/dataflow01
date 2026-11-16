import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  MessageSquare,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { TRACK_LABELS } from '../data/skillsCatalog';
import type { AgentSession, NodeExecutionStatus, PipelineNode } from '../types/orchestrator';
import { ArtifactRenderer } from './ArtifactRenderer';

interface PipelineCanvasProps {
  taskBrief: string;
  onChangeTaskBrief: (value: string) => void;
  orchestratorName: string;
  nodes: PipelineNode[];
  sessions: AgentSession[];
  runningNodeId: string | null;
  isOrchestrating: boolean;
  onDropFromCatalog: (skillId: string, insertIndex: number) => void;
  onReorderNode: (sourceInstanceId: string, targetIndex: number) => void;
  onMoveNodeStep: (index: number, direction: -1 | 1) => void;
  onRemoveNode: (instanceId: string) => void;
  onChangeNodeSession: (instanceId: string, sessionId: string) => void;
  onChangeNodePrompt: (instanceId: string, prompt: string) => void;
  onRunSingleNode: (instanceId: string) => void;
  onFocusChatForNode: (node: PipelineNode) => void;
  onClearOutputs: () => void;
}

const STATUS_META: Record<
  NodeExecutionStatus,
  { label: string; textClass: string }
> = {
  idle: { label: '待执行', textClass: 'text-slate-500' },
  queued: { label: '排队等待', textClass: 'text-slate-600' },
  planning: { label: '主控分配中', textClass: 'text-[#2563EB]' },
  running: { label: '生成中', textClass: 'text-[#2563EB]' },
  completed: { label: '已产出', textClass: 'text-emerald-700' },
  stale: { label: '上游已变更 · 建议重跑', textClass: 'text-amber-700' },
  error: { label: '执行异常', textClass: 'text-red-600' },
};

export const PipelineCanvas: React.FC<PipelineCanvasProps> = ({
  taskBrief,
  onChangeTaskBrief,
  orchestratorName,
  nodes,
  sessions,
  runningNodeId,
  isOrchestrating,
  onDropFromCatalog,
  onReorderNode,
  onMoveNodeStep,
  onRemoveNode,
  onChangeNodeSession,
  onChangeNodePrompt,
  onRunSingleNode,
  onFocusChatForNode,
  onClearOutputs,
}) => {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);

  const togglePrompt = (instanceId: string) => {
    setExpandedPrompts((prev) => ({ ...prev, [instanceId]: !prev[instanceId] }));
  };

  const handleDragStartNode = (
    e: React.DragEvent<HTMLElement>,
    instanceId: string,
  ) => {
    setDraggingInstanceId(instanceId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ source: 'canvas', instanceId }),
    );
  };

  const handleDragEndNode = () => {
    setDraggingInstanceId(null);
    setDragOverSlot(null);
  };

  const handleDropOnSlot = (e: React.DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(null);
    setDraggingInstanceId(null);

    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as {
        source: 'catalog' | 'canvas';
        skillId?: string;
        instanceId?: string;
      };
      if (payload.source === 'catalog' && payload.skillId) {
        onDropFromCatalog(payload.skillId, slotIndex);
      } else if (payload.source === 'canvas' && payload.instanceId) {
        onReorderNode(payload.instanceId, slotIndex);
      }
    } catch {
      // Ignore invalid drag payload
    }
  };

  const renderDropSlot = (slotIndex: number, showConnectorArrow: boolean, upstreamLabel?: string) => {
    const isOver = dragOverSlot === slotIndex;
    return (
      <div
        key={`slot-${slotIndex}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = draggingInstanceId ? 'move' : 'copy';
          if (dragOverSlot !== slotIndex) {
            setDragOverSlot(slotIndex);
          }
        }}
        onDragLeave={() => {
          if (dragOverSlot === slotIndex) {
            setDragOverSlot(null);
          }
        }}
        onDrop={(e) => handleDropOnSlot(e, slotIndex)}
        className={`relative transition-all ${
          isOver ? 'py-3' : showConnectorArrow ? 'py-2' : 'py-1'
        }`}
      >
        {isOver ? (
          <div className="h-10 rounded-md border-2 border-dashed border-[#2563EB] bg-blue-50/70 flex items-center justify-center text-[12px] font-medium text-[#2563EB]">
            释放以放置在此位置
          </div>
        ) : showConnectorArrow ? (
          <div className="flex items-center justify-center gap-2 text-[11.5px] text-slate-400 select-none">
            <span className="h-4 w-px bg-slate-200" />
            <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate max-w-[340px]">
              串联传递：{upstreamLabel || '上游上下文产出'}
            </span>
          </div>
        ) : null}
      </div>
    );
  };

  const completedCount = nodes.filter((n) => n.executionStatus === 'completed').length;

  return (
    <main className="flex-1 min-w-0 bg-[#F8FAFC] flex flex-col h-full overflow-hidden">
      {/* Orchestration Context & Brief Bar */}
      <section className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-1.5">
              <div className="flex items-center gap-2 text-[12px] text-slate-500">
                <span className="font-semibold text-slate-800">任务上下文</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11.5px] text-slate-600">{orchestratorName}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {nodes.length} 个 Skill 模块（{completedCount} 已产出）
                </span>
              </div>

              {nodes.length > 0 && (
                <button
                  type="button"
                  onClick={onClearOutputs}
                  disabled={isOrchestrating}
                  className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-900 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>清空产出结果</span>
                </button>
              )}
            </div>

            <textarea
              rows={2}
              value={taskBrief}
              onChange={(e) => onChangeTaskBrief(e.target.value)}
              placeholder="输入本次数仓任务需求、目标表名、指标口径或排障告警描述，主控 Session 将基于此生成各环节 Prompt..."
              className="w-full px-3 py-2 text-[13px] leading-relaxed bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white resize-none transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Sequential Pipeline Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {nodes.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverSlot(0);
            }}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(e) => handleDropOnSlot(e, 0)}
            className={`max-w-3xl mx-auto mt-8 border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragOverSlot === 0
                ? 'border-[#2563EB] bg-blue-50/50'
                : 'border-slate-300 bg-white'
            }`}
          >
            <h3 className="text-[15px] font-semibold text-slate-900">
              画布暂无编排模块
            </h3>
            <p className="text-[13px] text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              请从左侧目录拖拽 Skill 模块到此处按顺序串联，或直接在右侧对话窗口告诉主控 Session 你想完成的任务与需要的模块（例如：“我需要增加一个数据对账”）。
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto pb-12">
            {renderDropSlot(0, false)}

            {nodes.map((node, index) => {
              const statusMeta = STATUS_META[node.executionStatus];
              const isRunning =
                runningNodeId === node.instanceId ||
                node.executionStatus === 'running' ||
                node.executionStatus === 'planning';
              const isPromptExpanded = Boolean(expandedPrompts[node.instanceId]);
              const isDragging = draggingInstanceId === node.instanceId;

              return (
                <React.Fragment key={node.instanceId}>
                  <article
                    id={`pipeline-node-${node.instanceId}`}
                    draggable={!isOrchestrating}
                    onDragStart={(e) => handleDragStartNode(e, node.instanceId)}
                    onDragEnd={handleDragEndNode}
                    className={`bg-white border rounded-lg transition-all divide-y divide-slate-100 ${
                      node.isHighlighted
                        ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20'
                        : isRunning
                          ? 'border-[#2563EB]'
                          : 'border-slate-200 hover:border-slate-300'
                    } ${isDragging ? 'opacity-45' : 'opacity-100'}`}
                  >
                    {/* Block Header */}
                    <div className="px-4 py-3 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          title="拖拽调整编排顺序"
                          className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[12px] font-semibold text-slate-400 tabular-nums">
                              {String(index + 1).padStart(2, '0')}.
                            </span>
                            <h3 className="text-[14.5px] font-semibold text-slate-900">
                              {node.displayName}
                            </h3>
                            <span className="font-mono text-[12px] text-slate-500">
                              {node.name}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-[12px] text-slate-500 flex-wrap">
                            <span>{TRACK_LABELS[node.track]}</span>
                            <span aria-hidden="true">·</span>
                            <span>{node.stage}</span>
                            <span aria-hidden="true">·</span>
                            <span className={`inline-flex items-center gap-1 font-medium ${statusMeta.textClass}`}>
                              {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>{statusMeta.label}</span>
                            </span>
                            {node.updatedAt !== '尚未执行' && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums text-slate-400">
                                  更新于 {node.updatedAt}（{node.updatedBy}）
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Block Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          aria-label="分配执行 Session"
                          value={node.assignedSessionId}
                          onChange={(e) => onChangeNodeSession(node.instanceId, e.target.value)}
                          disabled={isOrchestrating}
                          className="px-2 py-1 text-[12px] bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-[#2563EB] cursor-pointer"
                        >
                          {sessions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.id === 'master' ? '主控自执行' : s.name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => onMoveNodeStep(index, -1)}
                          disabled={index === 0 || isOrchestrating}
                          title="上移一步"
                          className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveNodeStep(index, 1)}
                          disabled={index === nodes.length - 1 || isOrchestrating}
                          title="下移一步"
                          className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveNode(node.instanceId)}
                          disabled={isOrchestrating}
                          title="移除此模块"
                          className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Prompt Context Section (Collapsible / Editable) */}
                    <div className="px-4 py-2 bg-slate-50/50">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => togglePrompt(node.instanceId)}
                          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          {isPromptExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                          <span>
                            执行 Prompt 上下文
                            {!isPromptExpanded && node.prompt
                              ? `：${node.prompt.slice(0, 56)}${node.prompt.length > 56 ? '...' : ''}`
                              : !node.prompt
                                ? '（点击「一键生成结果」将由主控根据上下文自动合成）'
                                : ''}
                          </span>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onFocusChatForNode(node)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11.5px] font-medium text-slate-600 hover:text-[#2563EB] hover:bg-blue-50/60 rounded transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>对话修改</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onRunSingleNode(node.instanceId)}
                            disabled={isOrchestrating}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium text-[#2563EB] bg-blue-50/70 hover:bg-blue-100/80 disabled:opacity-40 rounded transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Play className="w-3 h-3" />
                            <span>{node.outputContent ? '重跑本步' : '执行本步'}</span>
                          </button>
                        </div>
                      </div>

                      {isPromptExpanded && (
                        <div className="mt-2">
                          <textarea
                            rows={2}
                            value={node.prompt}
                            onChange={(e) => onChangeNodePrompt(node.instanceId, e.target.value)}
                            placeholder="可手动微调本模块的执行 Prompt，或留空由主控 Session 根据上游产出自动生成..."
                            className="w-full px-3 py-2 text-[12.5px] bg-white border border-slate-200 rounded text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] resize-y"
                          />
                        </div>
                      )}
                    </div>

                    {/* Skill Output Artifact Body */}
                    <div className="px-4 py-3.5">
                      {isRunning ? (
                        <div className="py-4 space-y-2">
                          <div className="h-3.5 bg-slate-100 rounded w-2/3 animate-pulse" />
                          <div className="h-3 bg-slate-100 rounded w-full animate-pulse" />
                          <div className="h-3 bg-slate-100 rounded w-5/6 animate-pulse" />
                        </div>
                      ) : node.outputContent ? (
                        <div className="space-y-2.5">
                          {node.outputSummary && (
                            <div className="text-[12.5px] font-medium text-slate-800 pb-2 border-b border-slate-100">
                              产出摘要：{node.outputSummary}
                            </div>
                          )}
                          <ArtifactRenderer
                            content={node.outputContent}
                            format={node.outputFormat}
                          />
                        </div>
                      ) : (
                        <div className="py-3 text-[12.5px] text-slate-400">
                          暂无执行产出。点击上方「一键生成结果」由主控自动调度，或点击本步右侧「执行本步」单独生成。
                        </div>
                      )}
                    </div>
                  </article>

                  {renderDropSlot(
                    index + 1,
                    index < nodes.length - 1,
                    node.handoffLabel || node.outputSummary,
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};
