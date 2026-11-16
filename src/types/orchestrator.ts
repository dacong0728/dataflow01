export type SkillTrack = 'delivery' | 'support' | 'ops' | 'horizontal';

export type SkillMaturity = 'existing' | 'pending' | 'non_skill';

export type NodeExecutionStatus =
  | 'idle'
  | 'queued'
  | 'planning'
  | 'running'
  | 'completed'
  | 'stale'
  | 'error';

export type OutputFormat = 'markdown' | 'sql' | 'table' | 'checklist';

export type ScenarioId = 'delivery' | 'support' | 'ops' | 'custom';

export interface SkillDefinition {
  id: string;
  name: string;
  displayName: string;
  track: SkillTrack;
  stage: string;
  maturity: SkillMaturity;
  priority?: string;
  description: string;
  inputContract: string;
  outputArtifactType: string;
  defaultFormat: OutputFormat;
  defaultSessionId: string;
}

export interface PipelineNode {
  instanceId: string;
  skillId: string;
  name: string;
  displayName: string;
  track: SkillTrack;
  stage: string;
  maturity: SkillMaturity;
  assignedSessionId: string;
  executionStatus: NodeExecutionStatus;
  prompt: string;
  outputSummary: string;
  outputContent: string;
  outputFormat: OutputFormat;
  handoffLabel: string;
  updatedAt: string;
  updatedBy: string;
  isHighlighted?: boolean;
}

export interface AgentSession {
  id: string;
  name: string;
  role: 'master' | 'worker';
  specialty: string;
  status: 'idle' | 'thinking' | 'running';
}

export interface CanvasActionSummary {
  type:
    | 'add_block'
    | 'update_block'
    | 'remove_block'
    | 'reorder_blocks'
    | 'assign_session'
    | 'orchestrate_plan';
  targetNodeId?: string;
  skillName?: string;
  summary: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actionsApplied?: CanvasActionSummary[];
}

export interface CanvasActionPayload {
  type: 'add_block' | 'update_block' | 'remove_block' | 'reorder_blocks' | 'assign_session';
  skillId?: string;
  targetInstanceId?: string;
  insertAfterInstanceId?: string | null;
  insertBeforeInstanceId?: string | null;
  assignedSessionId?: string;
  prompt?: string;
  outputSummary?: string;
  outputContent?: string;
  outputFormat?: OutputFormat;
  handoffLabel?: string;
  orderedInstanceIds?: string[];
}

export interface ScenarioPreset {
  id: ScenarioId;
  label: string;
  orchestratorName: string;
  defaultTaskBrief: string;
  nodes: PipelineNode[];
}
