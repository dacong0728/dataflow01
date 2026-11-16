import React, { useCallback, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ArchitectureModal } from './components/ArchitectureModal';
import { PipelineCanvas } from './components/PipelineCanvas';
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
  OutputFormat,
  PipelineNode,
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

export default function App() {
  const [taskBrief, setTaskBrief] = useState<string>(
    SCENARIO_PRESETS.delivery.defaultTaskBrief,
  );
  const [nodes, setNodes] = useState<PipelineNode[]>(() =>
    SCENARIO_PRESETS.delivery.nodes.map((n) => ({ ...n })),
  );
  const [sessions] = useState<AgentSession[]>(INITIAL_SESSIONS);

  const [isOrchestrating, setIsOrchestrating] = useState<boolean>(false);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
  const [isApplyingCommand, setIsApplyingCommand] = useState<boolean>(false);
  const [lastCommandNote, setLastCommandNote] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState<boolean>(false);

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
    }, 2600);
  }, []);

  const handleResetExample = () => {
    if (isOrchestrating) return;
    setTaskBrief(SCENARIO_PRESETS.delivery.defaultTaskBrief);
    setNodes(SCENARIO_PRESETS.delivery.nodes.map((n) => ({ ...n })));
    setLastCommandNote(null);
    setErrorMessage(null);
  };

  const handleInsertSkillAt = (skill: SkillDefinition, insertIndex: number) => {
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
    setLastCommandNote(null);
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
    setLastCommandNote(null);
    setIsOrchestrating(true);
    setProgressLabel('主控分配 Session 与 Prompt...');

    try {
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
        throw new Error(planData.error || '主控调度分配失败');
      }

      const planMap = new Map<
        string,
        { assignedSessionId: string; synthesizedPrompt: string }
      >();
      for (const item of planData.plan || []) {
        planMap.set(item.instanceId, item);
      }

      const plannedNodes: PipelineNode[] = nodes.map((n) => {
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
      if (planData.masterSummary) {
        setLastCommandNote(`主控调度完成：${planData.masterSummary}`);
      }

      const workingNodes = [...plannedNodes];
      for (let i = 0; i < workingNodes.length; i++) {
        setProgressLabel(`执行 (${i + 1}/${workingNodes.length}) ${workingNodes[i].displayName}`);
        const updated = await executeSingleNodeRequest(workingNodes, i);
        workingNodes[i] = updated;
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '一键生成结果失败');
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
      setRunningNodeId(null);
    }
  };

  const applyCanvasActions = (
    actions: CanvasActionPayload[],
    actorSessionName: string,
  ): PipelineNode[] => {
    let nextNodes = [...nodes];
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

        for (let d = idx + 1; d < nextNodes.length; d++) {
          if (nextNodes[d].executionStatus === 'completed') {
            nextNodes[d] = { ...nextNodes[d], executionStatus: 'stale' };
          }
        }
        focusInstanceId = existing.instanceId;
      } else if (action.type === 'remove_block' && action.targetInstanceId) {
        nextNodes = nextNodes.filter(
          (n) => n.instanceId !== action.targetInstanceId,
        );
      } else if (
        action.type === 'assign_session' &&
        action.targetInstanceId &&
        action.assignedSessionId
      ) {
        nextNodes = nextNodes.map((n) =>
          n.instanceId === action.targetInstanceId
            ? { ...n, assignedSessionId: action.assignedSessionId!, isHighlighted: true }
            : n,
        );
        focusInstanceId = action.targetInstanceId;
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
      }, 2800);
    }

    return nextNodes;
  };

  const handleRunAgentCommand = async (
    commandText: string,
    targetNode?: PipelineNode,
  ) => {
    if (isApplyingCommand || isOrchestrating) return;

    const targetSession = targetNode
      ? sessions.find((s) => s.id === targetNode.assignedSessionId) || sessions[0]
      : sessions[0];

    const composedMessage = targetNode
      ? `请针对模块「${targetNode.displayName} (${targetNode.name})，instanceId="${targetNode.instanceId}"」执行以下修改并同步更新其产出：${commandText}`
      : commandText;

    setIsApplyingCommand(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/session-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: targetSession,
          message: composedMessage,
          history: [],
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
        throw new Error(data.error || '指令同步失败');
      }

      const actions: CanvasActionPayload[] = Array.isArray(data.actions)
        ? data.actions
        : [];
      if (actions.length > 0) {
        const updatedNodes = applyCanvasActions(actions, targetSession.name);
        setNodes(updatedNodes);
      }

      setLastCommandNote(data.reply || '已同步更新画布。');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '指令执行失败');
    } finally {
      setIsApplyingCommand(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F4F6F9]">
      <TopBar
        onRunAll={() => void handleRunAll()}
        onOpenDiagram={() => setIsDiagramModalOpen(true)}
        onResetExample={handleResetExample}
        onClearOutputs={handleClearOutputs}
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

      <PipelineCanvas
        taskBrief={taskBrief}
        onChangeTaskBrief={setTaskBrief}
        nodes={nodes}
        sessions={sessions}
        runningNodeId={runningNodeId}
        isOrchestrating={isOrchestrating}
        isApplyingCommand={isApplyingCommand}
        lastCommandNote={lastCommandNote}
        onInsertSkillAt={handleInsertSkillAt}
        onReorderNode={handleReorderNode}
        onMoveNodeStep={handleMoveNodeStep}
        onRemoveNode={handleRemoveNode}
        onChangeNodeSession={handleChangeNodeSession}
        onChangeNodePrompt={handleChangeNodePrompt}
        onRunSingleNode={(id) => void handleRunSingleNode(id)}
        onRunAgentCommand={handleRunAgentCommand}
      />

      <ArchitectureModal
        isOpen={isDiagramModalOpen}
        onClose={() => setIsDiagramModalOpen(false)}
      />
    </div>
  );
}
