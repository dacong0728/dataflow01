import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface NodeInput {
  instanceId: string;
  skillId: string;
  name: string;
  displayName: string;
  stage: string;
  track: string;
  assignedSessionId: string;
  prompt?: string;
  outputSummary?: string;
  outputContent?: string;
  outputFormat?: string;
  handoffLabel?: string;
}

interface SessionInput {
  id: string;
  name: string;
  role: string;
  specialty: string;
}

interface CatalogSkillInput {
  id: string;
  name: string;
  displayName: string;
  stage: string;
  track: string;
  description: string;
  defaultFormat: string;
  defaultSessionId: string;
}

function formatUpstreamContext(nodes: NodeInput[]): string {
  if (!nodes || nodes.length === 0) {
    return '（当前为链路起始节点，暂无上游产出）';
  }
  return nodes
    .map((n, idx) => {
      const content = n.outputContent?.trim()
        ? n.outputContent.slice(0, 1400)
        : n.outputSummary?.trim() || '（尚未生成产出）';
      return `[上游 ${idx + 1}: ${n.name} (${n.displayName}) · 阶段: ${n.stage}]\n摘要: ${n.outputSummary || '无'}\n产出内容:\n${content}`;
    })
    .join('\n\n---\n\n');
}

function formatPipelineSnapshot(nodes: NodeInput[]): string {
  if (!nodes || nodes.length === 0) {
    return '当前画布为空，没有任何 Skill 节点。';
  }
  return nodes
    .map((n, idx) => {
      const contentPreview = n.outputContent
        ? n.outputContent.slice(0, 700)
        : '（尚未产出）';
      return `${idx + 1}. instanceId="${n.instanceId}" | skillId="${n.skillId}" | name="${n.name}" (${n.displayName}) | stage="${n.stage}" | assignedSession="${n.assignedSessionId}"
   当前 Prompt: ${n.prompt || '未生成'}
   当前摘要: ${n.outputSummary || '未生成'}
   当前产出预览: ${contentPreview}`;
    })
    .join('\n\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Master Session Orchestration Plan
  app.post('/api/orchestrate-plan', async (req, res) => {
    try {
      const { taskBrief, nodes, sessions, preserveManualAssignments } = req.body as {
        taskBrief: string;
        nodes: NodeInput[];
        sessions: SessionInput[];
        preserveManualAssignments?: boolean;
      };

      if (!nodes || nodes.length === 0) {
        return res.status(400).json({ error: '画布中还没有任何 Skill 模块，请先拖拽或添加模块。' });
      }

      const ai = getAiClient();

      const sessionListText = sessions
        .map((s) => `- id="${s.id}" | name="${s.name}" | role="${s.role}" | 职责="${s.specialty}"`)
        .join('\n');

      const nodeListText = nodes
        .map(
          (n, idx) =>
            `${idx + 1}. instanceId="${n.instanceId}", skill="${n.name}" (${n.displayName}), 阶段="${n.stage}", 当前分配Session="${n.assignedSessionId}", 用户自定义Prompt="${n.prompt || ''}"`,
        )
        .join('\n');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `你是数仓 AI 编排台的主控 Agent（Master Session）。用户点击了「一键生成结果」，你需要审查当前链路顺序，为每个 Skill 模块分配最合适的执行 Session（可以由 master 主控自己执行，也可以分配给专职子 Session），并根据任务背景与上下游串联关系，为每个节点合成具体的执行 Prompt。

任务背景 (Task Brief):
${taskBrief || '通用数仓模型开发与数据交付'}

可用 Session 列表:
${sessionListText}

当前画布编排顺序 (从上游到下游):
${nodeListText}

分配原则:
${preserveManualAssignments ? '- 请尽量尊重节点当前已分配的 Session（除非明显不合理或为空）。' : '- 需求澄清、建表DDL、找表探查通常可由 session-modeling 或 master 执行；ETL SQL 由 session-etl 执行；对账/DQC/验收由 session-qa 执行；Zeus调度/飞书交付/排障由 session-ops 执行；横向规范检查或总控任务可由 master 自己执行。'}
- 每个节点的 synthesizedPrompt 必须具体，明确指出要承接哪些上游节点的产出（例如引用上游建表字段、表名、口径要求），不要空泛模板化。`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              masterSummary: {
                type: Type.STRING,
                description: '主控 Session 向用户汇报的简明调度分配说明（中文，2-3句话）。',
              },
              plan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    instanceId: { type: Type.STRING },
                    assignedSessionId: { type: Type.STRING },
                    synthesizedPrompt: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ['instanceId', 'assignedSessionId', 'synthesizedPrompt', 'rationale'],
                },
              },
            },
            required: ['masterSummary', 'plan'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json(parsed);
    } catch (err) {
      console.error('Error in /api/orchestrate-plan:', err);
      const message = err instanceof Error ? err.message : 'Master orchestration failed';
      return res.status(500).json({ error: message });
    }
  });

  // 2. Execute Single Skill Node with Chained Upstream Context
  app.post('/api/execute-node', async (req, res) => {
    try {
      const { taskBrief, node, upstreamNodes, session } = req.body as {
        taskBrief: string;
        node: NodeInput;
        upstreamNodes: NodeInput[];
        session?: SessionInput;
      };

      const ai = getAiClient();
      const upstreamContext = formatUpstreamContext(upstreamNodes || []);

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `你当前扮演数仓本地 Agent 执行节点「${session?.name || '主控 Session'}」（职责: ${session?.specialty || '全栈数仓研发'}）。
你需要严格执行 Skill：「${node.name}」（${node.displayName}，所属阶段：${node.stage}）。

全局任务背景:
${taskBrief || '数仓 AI 研发交付任务'}

主控分配的执行 Prompt:
${node.prompt || `请根据任务背景和上游产出，高质量完成 ${node.displayName} (${node.name}) 的产出。`}

上游链路已传递的真实产出:
${upstreamContext}

产出要求:
1. 必须严格承接上游产出中的真实表名、字段名、口径逻辑与依赖关系，体现“结果串联”的连贯性。
2. 如果是 SQL / DDL / 对账 SQL / 补数脚本 类 Skill，请在 outputContent 中直接给出可直接审阅或执行的规范 SQL（含中文注释），outputFormat 设为 "sql"。
3. 如果是 需求文档 / 技术方案 / 排障报告 / 交付文档 / 飞书回复，请给出结构清晰、细节详实的 Markdown，outputFormat 设为 "markdown"。
4. 如果是 校验清单 / 确认单，使用 Markdown 检查项列表，outputFormat 设为 "checklist"；如果是 影响矩阵 / DQC 规则集 / 历史 Case 匹配，使用 Markdown 表格，outputFormat 设为 "table"。
5. outputSummary 用一句话精炼概括本节点核心产出（不超过 45 字）。
6. handoffLabel 用 6-14 个字说明本节点传递给下游的产物名称（例如："标准建表 DDL Schema"、"双表对账 SQL 与偏差报告"）。`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              outputSummary: { type: Type.STRING },
              outputContent: { type: Type.STRING },
              outputFormat: {
                type: Type.STRING,
                description: 'One of: markdown, sql, table, checklist',
              },
              handoffLabel: { type: Type.STRING },
            },
            required: ['outputSummary', 'outputContent', 'outputFormat', 'handoffLabel'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json(parsed);
    } catch (err) {
      console.error('Error in /api/execute-node:', err);
      const message = err instanceof Error ? err.message : 'Node execution failed';
      return res.status(500).json({ error: message });
    }
  });

  // 3. Live Bidirectional Session Chat <-> Visual Canvas Sync
  app.post('/api/session-chat', async (req, res) => {
    try {
      const { session, message, history, taskBrief, nodes, catalogSkills } = req.body as {
        session: SessionInput;
        message: string;
        history: Array<{ role: string; content: string }>;
        taskBrief: string;
        nodes: NodeInput[];
        catalogSkills: CatalogSkillInput[];
      };

      const ai = getAiClient();

      const catalogText = catalogSkills
        .map(
          (s) =>
            `- skillId="${s.id}" | name="${s.name}" (${s.displayName}) | stage="${s.stage}" | defaultSession="${s.defaultSessionId}" | format="${s.defaultFormat}" | desc="${s.description}"`,
        )
        .join('\n');

      const historyText = (history || [])
        .slice(-8)
        .map((h) => `${h.role === 'user' ? '用户' : session.name}: ${h.content}`)
        .join('\n');

      const pipelineText = formatPipelineSnapshot(nodes || []);

      const systemInstruction = `你是「数仓 Skill 编排台」中的智能 Agent：${session.name}（角色: ${session.role === 'master' ? '主控编排器 Master Session' : '专职执行子 Session'}，专长: ${session.specialty}）。

你的核心能力是**对话与可视化画布的实时双向同步**：
1. 当用户与你讨论修改某个模块的内容时（例如："把 ETL SQL 改成过滤测试账号"、"DDL 增加一个物流公司字段 carrier_name"、"修改对账 SQL 增加金额汇总对比"），你不仅要在 reply 中回应用户，还**必须**在 actions 数组中返回一个 \`update_block\` 操作，给出更新后的完整 \`outputContent\` 和 \`outputSummary\`，这样画布上的对应模块会自动实时更新！
2. 当用户没有自己拖拽，而是在对话中表达**需要新增、插入、删除或调整模块顺序**时（例如："我需要增加一个数据对账"、"帮我在 ETL 后面加上数据验收校验和 DQC 规则"、"缺少源数据探查，补到建表前面"、"把调度节点删掉"）：
   - 请从下方「可用 Skill 目录」中精确挑选最匹配的 \`skillId\`（例如数据对账对应 \`two-table-reconciliation\`，数据验收对应 \`data-acceptance-validator\`，DQC 对应 \`dqc-rule-builder\`，源数据探查对应 \`data-exploration\`）。
   - 返回 \`add_block\` 操作，合理设置 \`insertAfterInstanceId\`（放在哪一个已有节点之后，若放最前面则为 null 或使用 \`insertBeforeInstanceId\`）以及 \`assignedSessionId\`。
   - **极其重要**：对于 \`add_block\`，你必须同时结合全局任务背景和上游节点内容，直接合成该新模块的 \`prompt\`、\`outputSummary\`、\`outputContent\`、\`outputFormat\` 和 \`handoffLabel\`，让可视化界面上立刻出现该模块及其完整产出！
3. 如果用户只是咨询问题或讨论思路，不需要改动画布，则返回空数组 \`actions: []\`。
4. 即使当前对话的是某个子 Session，如果用户明确要求调整模块或修改自己负责模块的产出，也可以直接返回对应的 \`actions\` 同步到画布。`;

      const promptPayload = `全局任务背景:
${taskBrief || '数仓开发与运维协同任务'}

当前可视化画布上的 Skill 链路状态:
${pipelineText}

可用 Skill 目录 (供 add_block 挑选 skillId):
${catalogText}

近期对话记录:
${historyText || '（新会话开始）'}

用户最新消息:
${message}`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: promptPayload,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: '用清晰、专业的中文回复用户，说明已执行哪些修改或新增了什么模块。',
              },
              actions: {
                type: Type.ARRAY,
                description: '同步到可视化编排画布的操作指令列表。若无需修改画布则为空数组。',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description:
                        'One of: add_block, update_block, remove_block, reorder_blocks, assign_session',
                    },
                    skillId: {
                      type: Type.STRING,
                      description: 'Required for add_block. Must match a skillId from catalog.',
                    },
                    targetInstanceId: {
                      type: Type.STRING,
                      description:
                        'Required for update_block, remove_block, assign_session. Must match an existing instanceId on canvas.',
                    },
                    insertAfterInstanceId: {
                      type: Type.STRING,
                      description:
                        'Optional for add_block. InstanceId of the upstream block to insert right after.',
                    },
                    insertBeforeInstanceId: {
                      type: Type.STRING,
                      description:
                        'Optional for add_block. InstanceId of the block to insert right before.',
                    },
                    assignedSessionId: {
                      type: Type.STRING,
                      description:
                        'Session ID (master, session-modeling, session-etl, session-qa, session-ops).',
                    },
                    prompt: {
                      type: Type.STRING,
                      description: 'Context-aware prompt for the block.',
                    },
                    outputSummary: {
                      type: Type.STRING,
                      description: 'Concise 1-line summary of the block output.',
                    },
                    outputContent: {
                      type: Type.STRING,
                      description: 'Full updated or newly generated artifact content (SQL/Markdown/Checklist/Table).',
                    },
                    outputFormat: {
                      type: Type.STRING,
                      description: 'One of: markdown, sql, table, checklist',
                    },
                    handoffLabel: {
                      type: Type.STRING,
                      description: 'Short label for downstream context handoff.',
                    },
                    orderedInstanceIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Used only for reorder_blocks.',
                    },
                  },
                  required: ['type'],
                },
              },
            },
            required: ['reply', 'actions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json(parsed);
    } catch (err) {
      console.error('Error in /api/session-chat:', err);
      const message = err instanceof Error ? err.message : 'Session chat failed';
      return res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
