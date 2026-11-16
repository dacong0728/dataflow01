import React, { useCallback, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ArchitectureModal } from './components/ArchitectureModal';
import { PipelineCanvas } from './components/PipelineCanvas';
import { SessionChatPanel } from './components/SessionChatPanel';
import { SkillPaletteSidebar } from './components/SkillPaletteSidebar';
import { TopBar } from './components/TopBar';
import {
  createNodeFromSkill,
  INITIAL_SESSIONS,
  SCENARIO_PRESETS,
  SKILLS_CATALOG,
} from './data/skillsCatalog';
import type {
  AgentSession,
  CanvasActionPayload,
  CanvasActionSummary,
  ChatMessage,
  OutputFormat,
  PipelineNode,
  ScenarioId,
  SkillDefinition,
} from './types/orchestrator';

function formatNowTime(): string {
  const now = new Date();
  return now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function makeMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'init-master-1',
    sessionId: 'master',
    role: 'assistant',
    content:
      '主控 Session 已就绪。当前画布已加载「交付型 · 新建模型」链路示例。\n\n你可以：\n1. 从左侧拖拽缺失的 Skill（例如「双表数据对账 two-table-reconciliation」）到 ETL 节点下方，或拖拽调整已有节点顺序；\n2. 点击右上角「一键生成结果」，由我统一分配主/子 Session、根据上下游上下文合成 Prompt 并串联执行；\n3. 直接在右侧与我或任意子 Session 对话，对话中的修改或“新增模块”指令会实时同步更新到画布。',
    timestamp: formatNowTime(),
  },
];

export default function App() {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>('delivery');
  const [taskBrief, setTaskBrief] = useState<string>(
    SCENARIO_PRESETS.delivery.defaultTaskBrief,
  );
  const [orchestratorName, setOrchestratorName] = useState<string>(
    SCENARIO_PRESETS.delivery.orchestratorName,
  );
  const [nodes, setNodes] = useState<PipelineNode[]>(() =>
    SCENARIO_PRESETS.delivery.nodes.map((n) => ({ ...n })),
  );
  const [sessions, setSessions] = useState<AgentSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>('master');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  const [isOrchestrating, setIsOrchestrating] = useState<boolean>(false);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState<boolean>(false);

  const setSessionStatus = useCallback(
    (sessionId: string, status: AgentSession['status']) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status } : s)),
      );
    },
    [],
  );

  const highlightAndScrollNode = useCallback((instanceId: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.instanceId === instanceId ? { ...n, isHighlighted: true } : n,
      ),
    );
    setTimeout(() => {
      const el = document.getElementById(`pipeline-node-${instanceId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    setTimeout(() => {
      setNodes((prev) =>
        prev.map((n) =>
          n.instanceId === instanceId ? { ...n, isHighlighted: false } : n,
        ),
      );
    }, 2800);
  }, []);

  const handleSelectScenario = (scenarioId: ScenarioId) => {
    if (isOrchestrating) return;
    const preset = SCENARIO_PRESETS[scenarioId];
    setActiveScenario(scenarioId);
    setTaskBrief(preset.defaultTaskBrief);
    setOrchestratorName(preset.orchestratorName);
    setNodes(preset.nodes.map((n) => ({ ...n })));
    setErrorMessage(null);
  };

  const handleAddSkillToEnd = (skill: SkillDefinition) => {
    const newNode = createNodeFromSkill(skill);
    setNodes((prev) => [...prev, newNode]);
    highlightAndScrollNode(newNode.instanceId);
  };

  const handleDropFromCatalog = (skillId: string, insertIndex: number) => {
    const skill = SKILLS_CATALOG.find((s) => s.id === skillId);
    if (!skill) return;
    const newNode = createNodeFromSkill(skill);
    setNodes((prev) => {
      const next = [...prev];
      const clampedIdx = Math.max(0, Math.min(insertIndex, next.length));
      next.splice(clampedIdx, 0, newNode);
      return next;
    });
    highlightAndScrollNode(newNode.instanceId);
  };

  const handleReorderNode = (sourceInstanceId: string, targetSlotIndex: number) => {
    setNodes((prev) => {
      const fromIndex = prev.findIndex((n) => n.instanceId === sourceInstanceId);
      if (fromIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      const adjustedIndex =
        targetSlotIndex > fromIndex ? targetSlotIndex - 1 : targetSlotIndex;
      const clamped = Math.max(0, Math.min(adjustedIndex, next.length));
      next.splice(clamped, 0, moved);
      return next;
    });
  };

  const handleMoveNodeStep = (index: number, direction: -1 | 1) => {
    setNodes((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleRemoveNode = (instanceId: string) => {
    setNodes((prev) => prev.filter((n) => n.instanceId !== instanceId));
  };

  const handleChangeNodeSession = (instanceId: string, sessionId: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.instanceId === instanceId ? { ...n, assignedSessionId: sessionId } : n,
      ),
    );
  };

  const handleChangeNodePrompt = (instanceId: string, prompt: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.instanceId === instanceId ? { ...n, prompt } : n,
      ),
    );
  };

  const handleClearOutputs = () => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        executionStatus: 'idle',
        outputSummary: '',
        outputContent: '',
        updatedAt: '尚未执行',
        updatedBy: '已清空',
      })),
    );
  };

  const handleFocusChatForNode = (node: PipelineNode) => {
    setActiveSessionId(node.assignedSessionId || 'master');
  };

  const executeSingleNodeRequest = async (
    currentNodes: PipelineNode[],
    nodeIndex: number,
  ): Promise<PipelineNode> => {
    const targetNode = currentNodes[nodeIndex];
    const upstreamNodes = currentNodes.slice(0, nodeIndex);
    const assignedSession =
      sessions.find((s) => s.id === targetNode.assignedSessionId) || sessions[0];

    setRunningNodeId(targetNode.instanceId);
    setSessionStatus(assignedSession.id, 'running');
    setNodes((prev) =>
      prev.map((n) =>
        n.instanceId === targetNode.instanceId
          ? { ...n, executionStatus: 'running' }
          : n,
      ),
    );

    try {
      const res = await fetch('/api/execute-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskBrief,
          node: targetNode,
          upstreamNodes,
          session: assignedSession,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '节点执行失败');
      }

      const validFormat: OutputFormat =
        data.outputFormat === 'sql' ||
        data.outputFormat === 'table' ||
        data.outputFormat === 'checklist'
          ? data.outputFormat
          : 'markdown';

      const completedNode: PipelineNode = {
        ...targetNode,
        executionStatus: 'completed',
        outputSummary: data.outputSummary || '',
        outputContent: data.outputContent || '',
        outputFormat: validFormat,
        handoffLabel: data.handoffLabel || targetNode.handoffLabel,
        updatedAt: formatNowTime(),
        updatedBy: assignedSession.name,
      };

      setNodes((prev) =>
        prev.map((n) =>
          n.instanceId === targetNode.instanceId ? completedNode : n,
        ),
      );
      return completedNode;
    } catch (err) {
      setNodes((prev) =>
        prev.map((n) =>
          n.instanceId === targetNode.instanceId
            ? { ...n, executionStatus: 'error' }
            : n,
        ),
      );
      throw err;
    } finally {
      setRunningNodeId(null);
      setSessionStatus(assignedSession.id, 'idle');
    }
  };

  const handleRunSingleNode = async (instanceId: string) => {
    if (isOrchestrating) return;
    const idx = nodes.findIndex((n) => n.instanceId === instanceId);
    if (idx === -1) return;

    setErrorMessage(null);
    setIsOrchestrating(true);
    setProgressLabel(`执行 ${nodes[idx].displayName}...`);

    try {
      await executeSingleNodeRequest(nodes, idx);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '单步执行失败');
    } finally {
      setIsOrchestrating(false);
      setProgressLabel('');
    }
  };

  const handleRunAll = async () => {
    if (isOrchestrating || nodes.length === 0) return;

    setErrorMessage(null);
    setIsOrchestrating(true);
    setProgressLabel('主控 Session 正在统筹分配...');
    setSessionStatus('master', 'thinking');
    setActiveSessionId('master');

    try {
      // Step 1: Master Session Orchestration Plan (assign sessions + synthesize prompts)
      setNodes((prev) =>
        prev.map((n) => ({ ...n, executionStatus: 'planning' })),
      );

      const planRes = await fetch('/api/orchestrate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskBrief,
          nodes,
          sessions,
          preserveManualAssignments: false,
        }),
      });
      const planData = await planRes.json();
      if (!planRes.ok) {
        throw new Error(planData.error || '主控分配调度失败');
      }

      const planMap = new Map<
        string,
        { assignedSessionId: string; synthesizedPrompt: string; rationale: string }
      >();
      for (const item of planData.plan || []) {
        planMap.set(item.instanceId, item);
      }

      let plannedNodes: PipelineNode[] = nodes.map((n) => {
        const match = planMap.get(n.instanceId);
        if (!match) return { ...n, executionStatus: 'queued' };
        const validSessionId = sessions.some((s) => s.id === match.assignedSessionId)
          ? match.assignedSessionId
          : n.assignedSessionId;
        return {
          ...n,
          assignedSessionId: validSessionId,
          prompt: n.prompt?.trim() ? n.prompt : match.synthesizedPrompt,
          executionStatus: 'queued',
        };
      });

      setNodes(plannedNodes);
      setSessionStatus('master', 'idle');

      // Log Master Session's delegation decision in chat
      const allocationLines = plannedNodes
        .map((n, idx) => {
          const sName =
            sessions.find((s) => s.id === n.assignedSessionId)?.name ||
            n.assignedSessionId;
          const rationale = planMap.get(n.instanceId)?.rationale || '按链路上下文分配';
          return `${idx + 1}. ${n.name} → ${sName}（${rationale}）`;
        })
        .join('\n');

      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId(),
          sessionId: 'master',
          role: 'system',
          content: `${planData.masterSummary || '主控 Session 已完成链路分析与任务分配：'}\n\n${allocationLines}`,
          timestamp: formatNowTime(),
        },
      ]);

      // Step 2: Sequential Execution with Chained Upstream Context
      const workingNodes = [...plannedNodes];
      for (let i = 0; i < workingNodes.length; i++) {
        setProgressLabel(`执行 (${i + 1}/${workingNodes.length}) ${workingNodes[i].displayName}`);
        const updated = await executeSingleNodeRequest(workingNodes, i);
        workingNodes[i] = updated;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId(),
          sessionId: 'master',
          role: 'assistant',
          content: `已完成全部 ${workingNodes.length} 个 Skill 模块的串联执行与产出汇总。你可以点击任意模块右侧的「对话修改」，或直接在这里告诉我需要补充或调整的环节。`,
          timestamp: formatNowTime(),
        },
      ]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '一键编排执行失败');
      setNodes((prev) =>
        prev.map((n) =>
          n.executionStatus === 'planning' || n.executionStatus === 'queued'
            ? { ...n, executionStatus: 'idle' }
            : n,
        ),
      );
    } finally {
      setIsOrchestrating(false);
      setProgressLabel('');
      setSessionStatus('master', 'idle');
      setRunningNodeId(null);
    }
  };

  const applyCanvasActions = (
    actions: CanvasActionPayload[],
    actorSessionName: string,
  ): { nextNodes: PipelineNode[]; summaries: CanvasActionSummary[] } => {
    let nextNodes = [...nodes];
    const summaries: CanvasActionSummary[] = [];
    let focusInstanceId: string | null = null;

    for (const action of actions) {
      if (action.type === 'add_block' && action.skillId) {
        const skill = SKILLS_CATALOG.find((s) => s.id === action.skillId);
        if (!skill) continue;

        const validFormat: OutputFormat =
          action.outputFormat === 'sql' ||
          action.outputFormat === 'table' ||
          action.outputFormat === 'checklist'
            ? action.outputFormat
            : skill.defaultFormat;

        const validSessionId =
          action.assignedSessionId &&
          sessions.some((s) => s.id === action.assignedSessionId)
            ? action.assignedSessionId
            : skill.defaultSessionId;

        const newNode = createNodeFromSkill(skill, {
          assignedSessionId: validSessionId,
          prompt: action.prompt || '',
          outputSummary: action.outputSummary || '',
          outputContent: action.outputContent || '',
          outputFormat: validFormat,
          handoffLabel: action.handoffLabel || skill.outputArtifactType,
          executionStatus: action.outputContent ? 'completed' : 'idle',
          updatedAt: action.outputContent ? formatNowTime() : '尚未执行',
          updatedBy: actorSessionName,
          isHighlighted: true,
        });

        let insertIdx = nextNodes.length;
        if (action.insertAfterInstanceId) {
          const afterIdx = nextNodes.findIndex(
            (n) => n.instanceId === action.insertAfterInstanceId,
          );
          if (afterIdx !== -1) insertIdx = afterIdx + 1;
        } else if (action.insertBeforeInstanceId) {
          const beforeIdx = nextNodes.findIndex(
            (n) => n.instanceId === action.insertBeforeInstanceId,
          );
          if (beforeIdx !== -1) insertIdx = beforeIdx;
        }

        nextNodes.splice(insertIdx, 0, newNode);
        focusInstanceId = newNode.instanceId;
        summaries.push({
          type: 'add_block',
          targetNodeId: newNode.instanceId,
          skillName: skill.name,
          summary: `已新增模块：${skill.displayName} (${skill.name})`,
        });
      } else if (action.type === 'update_block' && action.targetInstanceId) {
        const idx = nextNodes.findIndex(
          (n) => n.instanceId === action.targetInstanceId,
        );
        if (idx === -1) continue;

        const existing = nextNodes[idx];
        const validFormat: OutputFormat =
          action.outputFormat === 'sql' ||
          action.outputFormat === 'table' ||
          action.outputFormat === 'checklist' ||
          action.outputFormat === 'markdown'
            ? action.outputFormat
            : existing.outputFormat;

        nextNodes[idx] = {
          ...existing,
          prompt: action.prompt ?? existing.prompt,
          outputSummary: action.outputSummary ?? existing.outputSummary,
          outputContent: action.outputContent ?? existing.outputContent,
          outputFormat: validFormat,
          handoffLabel: action.handoffLabel ?? existing.handoffLabel,
          executionStatus: 'completed',
          updatedAt: formatNowTime(),
          updatedBy: actorSessionName,
          isHighlighted: true,
        };

        // Mark completed downstream blocks as stale so chain dependency is transparent
        for (let d = idx + 1; d < nextNodes.length; d++) {
          if (nextNodes[d].executionStatus === 'completed') {
            nextNodes[d] = { ...nextNodes[d], executionStatus: 'stale' };
          }
        }

        focusInstanceId = existing.instanceId;
        summaries.push({
          type: 'update_block',
          targetNodeId: existing.instanceId,
          skillName: existing.name,
          summary: `已同步更新：${existing.displayName} (${existing.name})`,
        });
      } else if (action.type === 'remove_block' && action.targetInstanceId) {
        const removed = nextNodes.find(
          (n) => n.instanceId === action.targetInstanceId,
        );
        if (!removed) continue;
        nextNodes = nextNodes.filter(
          (n) => n.instanceId !== action.targetInstanceId,
        );
        summaries.push({
          type: 'remove_block',
          skillName: removed.name,
          summary: `已移除模块：${removed.displayName} (${removed.name})`,
        });
      } else if (action.type === 'assign_session' && action.targetInstanceId && action.assignedSessionId) {
        const target = nextNodes.find(
          (n) => n.instanceId === action.targetInstanceId,
        );
        if (!target) continue;
        nextNodes = nextNodes.map((n) =>
          n.instanceId === action.targetInstanceId
            ? { ...n, assignedSessionId: action.assignedSessionId!, isHighlighted: true }
            : n,
        );
        focusInstanceId = target.instanceId;
        const sName =
          sessions.find((s) => s.id === action.assignedSessionId)?.name ||
          action.assignedSessionId;
        summaries.push({
          type: 'assign_session',
          targetNodeId: target.instanceId,
          summary: `已重新分配 ${target.displayName} → ${sName}`,
        });
      } else if (
        action.type === 'reorder_blocks' &&
        Array.isArray(action.orderedInstanceIds)
      ) {
        const ordered: PipelineNode[] = [];
        for (const id of action.orderedInstanceIds) {
          const found = nextNodes.find((n) => n.instanceId === id);
          if (found) ordered.push(found);
        }
        for (const remaining of nextNodes) {
          if (!ordered.some((o) => o.instanceId === remaining.instanceId)) {
            ordered.push(remaining);
          }
        }
        nextNodes = ordered;
        summaries.push({
          type: 'reorder_blocks',
          summary: '已按对话指令调整模块编排顺序',
        });
      }
    }

    if (focusInstanceId) {
      const targetId = focusInstanceId;
      setTimeout(() => {
        const el = document.getElementById(`pipeline-node-${targetId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 90);
      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) =>
            n.instanceId === targetId ? { ...n, isHighlighted: false } : n,
          ),
        );
      }, 3000);
    }

    return { nextNodes, summaries };
  };

  const handleSendMessage = async (text: string) => {
    if (isSendingChat) return;

    const currentSession =
      sessions.find((s) => s.id === activeSessionId) || sessions[0];
    const userMsg: ChatMessage = {
      id: makeMessageId(),
      sessionId: activeSessionId,
      role: 'user',
      content: text,
      timestamp: formatNowTime(),
    };

    const historyForSession = [...messages, userMsg]
      .filter((m) => m.sessionId === activeSessionId && m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setIsSendingChat(true);
    setSessionStatus(activeSessionId, 'thinking');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/session-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: currentSession,
          message: text,
          history: historyForSession,
          taskBrief,
          nodes,
          catalogSkills: SKILLS_CATALOG.map((s) => ({
            id: s.id,
            name: s.name,
            displayName: s.displayName,
            stage: s.stage,
            track: s.track,
            description: s.description,
            defaultFormat: s.defaultFormat,
            defaultSessionId: s.defaultSessionId,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Session 对话请求失败');
      }

      const actions: CanvasActionPayload[] = Array.isArray(data.actions)
        ? data.actions
        : [];
      let appliedSummaries: CanvasActionSummary[] = [];

      if (actions.length > 0) {
        const { nextNodes, summaries } = applyCanvasActions(
          actions,
          currentSession.name,
        );
        setNodes(nextNodes);
        appliedSummaries = summaries;
      }

      const assistantMsg: ChatMessage = {
        id: makeMessageId(),
        sessionId: activeSessionId,
        role: 'assistant',
        content: data.reply || '已处理你的请求。',
        timestamp: formatNowTime(),
        actionsApplied: appliedSummaries,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '对话同步失败');
    } finally {
      setIsSendingChat(false);
      setSessionStatus(activeSessionId, 'idle');
    }
  };

  const handleLocateNode = (instanceId: string) => {
    highlightAndScrollNode(instanceId);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F8FAFC]">
      <TopBar
        activeScenario={activeScenario}
        onSelectScenario={handleSelectScenario}
        onRunAll={() => void handleRunAll()}
        isOrchestrating={isOrchestrating}
        progressLabel={progressLabel}
        hasNodes={nodes.length > 0}
      />

      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between gap-4 text-[12.5px] text-red-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1 hover:bg-red-100 rounded transition-colors cursor-pointer"
            aria-label="关闭错误提示"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <SkillPaletteSidebar
          skills={SKILLS_CATALOG}
          onAddSkill={handleAddSkillToEnd}
          onOpenDiagram={() => setIsDiagramModalOpen(true)}
        />

        <PipelineCanvas
          taskBrief={taskBrief}
          onChangeTaskBrief={setTaskBrief}
          orchestratorName={orchestratorName}
          nodes={nodes}
          sessions={sessions}
          runningNodeId={runningNodeId}
          isOrchestrating={isOrchestrating}
          onDropFromCatalog={handleDropFromCatalog}
          onReorderNode={handleReorderNode}
          onMoveNodeStep={handleMoveNodeStep}
          onRemoveNode={handleRemoveNode}
          onChangeNodeSession={handleChangeNodeSession}
          onChangeNodePrompt={handleChangeNodePrompt}
          onRunSingleNode={(id) => void handleRunSingleNode(id)}
          onFocusChatForNode={handleFocusChatForNode}
          onClearOutputs={handleClearOutputs}
        />

        <SessionChatPanel
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          messages={messages}
          onSendMessage={handleSendMessage}
          isSending={isSendingChat}
          onLocateNode={handleLocateNode}
        />
      </div>

      <ArchitectureModal
        isOpen={isDiagramModalOpen}
        onClose={() => setIsDiagramModalOpen(false)}
      />
    </div>
  );
}
