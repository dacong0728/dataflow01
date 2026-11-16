import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  GripVertical,
  Loader2,
  Play,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { SKILLS_CATALOG, TRACK_LABELS } from '../data/skillsCatalog';
import type {
  AgentSession,
  NodeExecutionStatus,
  PipelineNode,
  SkillDefinition,
} from '../types/orchestrator';
import { ArtifactRenderer } from './ArtifactRenderer';
import { SkillPickerPopover } from './SkillPickerPopover';

interface PipelineCanvasProps {
  taskBrief: string;
  onChangeTaskBrief: (value: string) => void;
  nodes: PipelineNode[];
  sessions: AgentSession[];
  runningNodeId: string | null;
  isOrchestrating: boolean;
  isApplyingCommand: boolean;
  lastCommandNote: string | null;
  onInsertSkillAt: (skill: SkillDefinition, insertIndex: number) => void;
  onReorderNode: (sourceInstanceId: string, targetSlotIndex: number) => void;
  onMoveNodeStep: (index: number, direction: -1 | 1) => void;
  onRemoveNode: (instanceId: string) => void;
  onChangeNodeSession: (instanceId: string, sessionId: string) => void;
  onChangeNodePrompt: (instanceId: string, prompt: string) => void;
  onRunSingleNode: (instanceId: string) => void;
  onRunAgentCommand: (commandText: string, targetNode?: PipelineNode) => Promise<void>;
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
  nodes,
  sessions,
  runningNodeId,
  isOrchestrating,
  isApplyingCommand,
  lastCommandNote,
  onInsertSkillAt,
  onReorderNode,
  onMoveNodeStep,
  onRemoveNode,
  onChangeNodeSession,
  onChangeNodePrompt,
  onRunSingleNode,
  onRunAgentCommand,
}) => {
  const [openInsertSlot, setOpenInsertSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [nodeInstruction, setNodeInstruction] = useState<string>('');
  const [globalCommand, setGlobalCommand] = useState<string>('');

  const togglePrompt = (instanceId: string) => {
    setExpandedPrompts((prev) => ({ ...prev, [instanceId]: !prev[instanceId] }));
  };

  const handleSelectSkillFromPicker = (skill: SkillDefinition, insertIndex: number) => {
    onInsertSkillAt(skill, insertIndex);
    setOpenInsertSlot(null);
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
        source: 'canvas';
        instanceId?: string;
      };
      if (payload.source === 'canvas' && payload.instanceId) {
        onReorderNode(payload.instanceId, slotIndex);
      }
    } catch {
      // Ignore invalid payload
    }
  };

  const handleSubmitGlobalCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = globalCommand.trim();
    if (!trimmed || isApplyingCommand || isOrchestrating) return;
    setGlobalCommand('');
    await onRunAgentCommand(trimmed);
  };

  const handleSubmitNodeEdit = async (e: React.FormEvent, node: PipelineNode) => {
    e.preventDefault();
    const trimmed = nodeInstruction.trim();
    if (!trimmed || isApplyingCommand || isOrchestrating) return;
    setNodeInstruction('');
    setEditingNodeId(null);
    await onRunAgentCommand(trimmed, node);
  };

  const renderInsertionSlot = (
    slotIndex: number,
    options: { showConnector: boolean; upstreamLabel?: string; buttonLabel?: string },
  ) => {
    const isOver = dragOverSlot === slotIndex;
    const isPickerOpen = openInsertSlot === slotIndex;

    return (
      <div
        key={`slot-${slotIndex}`}
        onDragOver={(e) => {
          if (!draggingInstanceId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverSlot !== slotIndex) setDragOverSlot(slotIndex);
        }}
        onDragLeave={() => {
          if (dragOverSlot === slotIndex) setDragOverSlot(null);
        }}
        onDrop={(e) => handleDropOnSlot(e, slotIndex)}
        className="relative"
      >
        {isOver ? (
          <div className="my-2 h-11 rounded-lg border-2 border-dashed border-[#2563EB] bg-blue-50/70 flex items-center justify-center text-[12px] font-medium text-[#2563EB]">
            释放以移动到此处
          </div>
        ) : (
          <div className="py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              {options.showConnector && (
                <>
                  <div className="w-5 flex justify-center shrink-0">
                    <span className="h-5 w-px bg-slate-300 block" />
                  </div>
                  <span className="text-[12px] text-slate-400 truncate">
                    串联输出 → {options.upstreamLabel || '上游上下文'}
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setOpenInsertSlot(isPickerOpen ? null : slotIndex)
              }
              disabled={isOrchestrating}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isPickerOpen
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200/90 text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB] shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{options.buttonLabel || '在此处插入 Skill'}</span>
            </button>
          </div>
        )}

        {isPickerOpen && (
          <SkillPickerPopover
            skills={SKILLS_CATALOG}
            insertIndex={slotIndex}
            onSelect={handleSelectSkillFromPicker}
            onClose={() => setOpenInsertSlot(null)}
          />
        )}
      </div>
    );
  };

  const completedCount = nodes.filter((n) => n.executionStatus === 'completed').length;

  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F6F9]">
      <div className="max-w-[900px] mx-auto px-6 py-7 space-y-5 pb-20">
        {/* Top Unified Context & Natural-Language Instruction Card */}
        <section className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[16px] font-semibold text-slate-900">
                Skill 编排与产出串联链路
              </h1>
              <p className="text-[12.5px] text-slate-500 mt-0.5 tabular-nums">
                共 {nodes.length} 个 Skill 节点 · {completedCount} 个已生成产出 · 点击节点上下「插入 Skill」或拖拽调整顺序
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="task-brief-input"
              className="block text-[12px] font-medium text-slate-600"
            >
              任务上下文（主控 Session 将根据此目标与上游产出合成各节点 Prompt）
            </label>
            <textarea
              id="task-brief-input"
              rows={2}
              value={taskBrief}
              onChange={(e) => onChangeTaskBrief(e.target.value)}
              placeholder="输入本次数仓任务需求、目标表名、指标口径或排障告警..."
              className="w-full px-3.5 py-2.5 text-[13px] leading-relaxed bg-slate-50/80 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white resize-none transition-colors"
            />
          </div>

          {/* Lightweight Inline Local-Agent Command Strip */}
          <form
            onSubmit={(e) => void handleSubmitGlobalCommand(e)}
            className="pt-2 border-t border-slate-100 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={globalCommand}
              onChange={(e) => setGlobalCommand(e.target.value)}
              disabled={isApplyingCommand || isOrchestrating}
              placeholder="直接对本地 Agent 下达编排或修改指令（例：在 ETL 后面增加一个数据对账模块 / 调整某节点顺序）..."
              className="flex-1 px-3.5 py-2 text-[12.5px] bg-slate-50/80 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={!globalCommand.trim() || isApplyingCommand || isOrchestrating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isApplyingCommand ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>同步画布中...</span>
                </>
              ) : (
                <>
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>应用指令</span>
                </>
              )}
            </button>
          </form>

          {lastCommandNote && (
            <div className="text-[12px] text-emerald-700 bg-emerald-50/60 border border-emerald-200/70 rounded-lg px-3.5 py-2">
              {lastCommandNote}
            </div>
          )}
        </section>

        {/* Pipeline Blocks */}
        {nodes.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-3">
            <h2 className="text-[15px] font-semibold text-slate-900">
              当前链路暂无 Skill 模块
            </h2>
            <p className="text-[13px] text-slate-500 max-w-md mx-auto leading-relaxed">
              点击下方按钮插入第一个 Skill 模块，或直接在上方指令框输入你想完成的数仓任务。
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setOpenInsertSlot(0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>添加第一个 Skill 模块</span>
              </button>
            </div>
            {openInsertSlot === 0 && (
              <div className="text-left pt-3">
                <SkillPickerPopover
                  skills={SKILLS_CATALOG}
                  insertIndex={0}
                  onSelect={handleSelectSkillFromPicker}
                  onClose={() => setOpenInsertSlot(null)}
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            {renderInsertionSlot(0, {
              showConnector: false,
              buttonLabel: '在顶部插入 Skill',
            })}

            {nodes.map((node, index) => {
              const statusMeta = STATUS_META[node.executionStatus];
              const isRunning =
                runningNodeId === node.instanceId ||
                node.executionStatus === 'running' ||
                node.executionStatus === 'planning';
              const isPromptExpanded = Boolean(expandedPrompts[node.instanceId]);
              const isEditingThisNode = editingNodeId === node.instanceId;
              const isDragging = draggingInstanceId === node.instanceId;

              return (
                <React.Fragment key={node.instanceId}>
                  <article
                    id={`pipeline-node-${node.instanceId}`}
                    draggable={!isOrchestrating}
                    onDragStart={(e) => handleDragStartNode(e, node.instanceId)}
                    onDragEnd={handleDragEndNode}
                    className={`bg-white border rounded-xl transition-all divide-y divide-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${
                      node.isHighlighted
                        ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20'
                        : isRunning
                          ? 'border-[#2563EB]'
                          : 'border-slate-200/90 hover:border-slate-300'
                    } ${isDragging ? 'opacity-45' : 'opacity-100'}`}
                  >
                    {/* Block Header */}
                    <div className="px-5 py-3.5 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          title="拖拽调整编排顺序"
                          className="mt-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[12.5px] font-semibold text-slate-400 tabular-nums">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <h3 className="text-[15px] font-semibold text-slate-900">
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
                                  {node.updatedAt}（{node.updatedBy}）
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Order, Session & Removal Controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          aria-label="分配执行 Session"
                          value={node.assignedSessionId}
                          onChange={(e) => onChangeNodeSession(node.instanceId, e.target.value)}
                          disabled={isOrchestrating}
                          className="px-2.5 py-1 text-[12px] bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-[#2563EB] cursor-pointer"
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
                          className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveNodeStep(index, 1)}
                          disabled={index === nodes.length - 1 || isOrchestrating}
                          title="下移一步"
                          className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveNode(node.instanceId)}
                          disabled={isOrchestrating}
                          title="移除此模块"
                          className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Prompt & Action Bar */}
                    <div className="px-5 py-2.5 bg-slate-50/50">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => togglePrompt(node.instanceId)}
                          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 hover:text-slate-900 min-w-0 cursor-pointer"
                        >
                          {isPromptExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="truncate">
                            Prompt 上下文
                            {!isPromptExpanded && node.prompt
                              ? `：${node.prompt}`
                              : !node.prompt
                                ? '（点击「一键生成结果」将由主控按上下游自动合成）'
                                : ''}
                          </span>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNodeId(isEditingThisNode ? null : node.instanceId);
                              setNodeInstruction('');
                            }}
                            disabled={isOrchestrating}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              isEditingThisNode
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            <span>微调产出</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onRunSingleNode(node.instanceId)}
                            disabled={isOrchestrating}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium text-[#2563EB] bg-blue-50/80 hover:bg-blue-100/80 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>{node.outputContent ? '重跑本步' : '执行本步'}</span>
                          </button>
                        </div>
                      </div>

                      {isPromptExpanded && (
                        <div className="mt-2.5">
                          <textarea
                            rows={2}
                            value={node.prompt}
                            onChange={(e) => onChangeNodePrompt(node.instanceId, e.target.value)}
                            placeholder="可编辑此节点的执行 Prompt，或留空由主控 Session 根据上下文自动生成..."
                            className="w-full px-3 py-2 text-[12.5px] bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] resize-y"
                          />
                        </div>
                      )}

                      {isEditingThisNode && (
                        <form
                          onSubmit={(e) => void handleSubmitNodeEdit(e, node)}
                          className="mt-2.5 flex items-center gap-2"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={nodeInstruction}
                            onChange={(e) => setNodeInstruction(e.target.value)}
                            placeholder={`对「${node.displayName}」输入修改要求（例如：增加一个渠道字段 / 改为增量分区写法）...`}
                            className="flex-1 px-3 py-1.5 text-[12.5px] bg-white border border-[#2563EB]/50 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB]"
                          />
                          <button
                            type="submit"
                            disabled={!nodeInstruction.trim() || isApplyingCommand}
                            className="px-3 py-1.5 text-[12px] font-medium bg-[#2563EB] text-white rounded-md hover:bg-[#1D4ED8] disabled:opacity-40 whitespace-nowrap cursor-pointer"
                          >
                            {isApplyingCommand ? '更新中...' : '同步更新'}
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Skill Output Artifact */}
                    <div className="px-5 py-4">
                      {isRunning ? (
                        <div className="py-3 space-y-2">
                          <div className="h-3.5 bg-slate-100 rounded w-2/3 animate-pulse" />
                          <div className="h-3 bg-slate-100 rounded w-full animate-pulse" />
                          <div className="h-3 bg-slate-100 rounded w-5/6 animate-pulse" />
                        </div>
                      ) : node.outputContent ? (
                        <div className="space-y-3">
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
                        <div className="py-2 text-[12.5px] text-slate-400">
                          等待生成产出。可点击右上角「一键生成结果」串联执行，或点击本步「执行本步」。
                        </div>
                      )}
                    </div>
                  </article>

                  {renderInsertionSlot(index + 1, {
                    showConnector: index < nodes.length - 1,
                    upstreamLabel: node.handoffLabel || node.outputSummary,
                    buttonLabel:
                      index < nodes.length - 1 ? '在中间插入 Skill' : '在末尾追加 Skill',
                  })}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};
