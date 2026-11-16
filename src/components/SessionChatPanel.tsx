import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, ArrowRight } from 'lucide-react';
import type { AgentSession, ChatMessage } from '../types/orchestrator';

interface SessionChatPanelProps {
  sessions: AgentSession[];
  activeSessionId: string;
  onSelectSession: (sessionId: string) => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isSending: boolean;
  onLocateNode: (instanceId: string) => void;
}

const QUICK_COMMANDS = [
  '我需要增加一个数据对账模块，并生成对账 SQL',
  '在 ETL 后面增加数据验收校验和 DQC 规则',
  '把 ETL SQL 改成过滤测试账号且按 dt 增量覆盖',
  '检查当前链路还缺哪些交付或上线保障环节',
];

export const SessionChatPanel: React.FC<SessionChatPanelProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  messages,
  onSendMessage,
  isSending,
  onLocateNode,
}) => {
  const [inputValue, setInputValue] = useState('');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const sessionMessages = messages.filter((m) => m.sessionId === activeSessionId);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionMessages.length, activeSessionId, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;
    setInputValue('');
    await onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  return (
    <aside className="w-[400px] shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Session Switcher Header */}
      <div className="p-4 border-b border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[13.5px] font-semibold text-slate-900">
            Session 实时协同对话
          </h2>
          <span className="text-[11.5px] text-slate-500">
            修改实时同步至左侧画布
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isBusy = session.status !== 'idle';
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession(session.id)}
                className={`px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>
                  {session.id === 'master'
                    ? '主控 Session'
                    : session.name.replace('Session · ', '')}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-[11.5px] text-slate-500 leading-snug">
          当前会话：<span className="font-medium text-slate-800">{activeSession.name}</span>
          <span aria-hidden="true"> · </span>
          <span>{activeSession.specialty}</span>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]/50">
        {sessionMessages.length === 0 ? (
          <div className="py-8 px-3 text-center space-y-2">
            <p className="text-[13px] font-medium text-slate-700">
              开始与 {activeSession.name} 协同
            </p>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              你可以直接对话修改它负责的模块产出，或直接要求增删模块（例如“我需要增加一个数据对账”），左侧编排图会自动同步生成新模块与结果。
            </p>
          </div>
        ) : (
          sessionMessages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="border border-slate-200 bg-white rounded-md p-3 text-[12px] text-slate-700 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-medium text-[#2563EB]">主控调度分配记录</span>
                    <span className="tabular-nums">{msg.timestamp}</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    isUser
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {msg.actionsApplied && msg.actionsApplied.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="text-[11px] font-medium text-emerald-700">
                        已实时同步至可视化编排画布：
                      </div>
                      {msg.actionsApplied.map((act, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 text-[11.5px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded"
                        >
                          <span className="truncate">{act.summary}</span>
                          {act.targetNodeId && (
                            <button
                              type="button"
                              onClick={() => onLocateNode(act.targetNodeId!)}
                              className="inline-flex items-center gap-0.5 text-[#2563EB] hover:underline shrink-0 cursor-pointer"
                            >
                              <span>定位</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="mt-1 text-[11px] text-slate-400 tabular-nums px-1">
                  {isUser ? '你' : activeSession.name} · {msg.timestamp}
                </span>
              </div>
            );
          })
        )}

        {isSending && (
          <div className="flex items-start">
            <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-[12.5px] text-slate-500 inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
              <span>{activeSession.name} 正在推演并同步画布...</span>
            </div>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Quick Prompts & Composer */}
      <div className="p-3.5 border-t border-slate-200 bg-white space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {QUICK_COMMANDS.map((cmd, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSending}
              onClick={() => void onSendMessage(cmd)}
              className="px-2.5 py-1 text-[11.5px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-40"
            >
              {cmd}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="relative">
          <textarea
            rows={3}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            placeholder={`向 ${activeSession.name} 下达指令：修改某个模块 SQL，或说“我需要增加一个数据对账”...`}
            className="w-full pr-11 pl-3 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:bg-white resize-none transition-colors"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSending}
            title="发送指令"
            className="absolute right-2.5 bottom-2.5 p-2 rounded-md bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </aside>
  );
};
