import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { OutputFormat } from '../types/orchestrator';

interface ArtifactRendererProps {
  content: string;
  format: OutputFormat;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="font-mono text-[12px] bg-slate-100 text-slate-800 px-1 py-0.5 rounded"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const ArtifactRenderer: React.FC<ArtifactRendererProps> = ({ content, format }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard fallback ignored
    }
  };

  if (!content.trim()) {
    return null;
  }

  if (format === 'sql') {
    const cleanSql = content
      .replace(/^```sql\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    return (
      <div className="relative bg-slate-900 text-slate-100 rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/80">
          <span className="font-mono text-[11px] text-slate-300">SQL / DDL 脚本产出</span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? '已复制' : '复制代码'}</span>
          </button>
        </div>
        <pre className="p-3 overflow-x-auto font-mono text-[12px] leading-[1.6] text-slate-100 whitespace-pre">
          {cleanSql}
        </pre>
      </div>
    );
  }

  // Render markdown / table / checklist cleanly
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block inside markdown
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={`code-${i}`}
          className="my-2 p-3 rounded-md bg-slate-900 text-slate-100 font-mono text-[12px] leading-relaxed overflow-x-auto"
        >
          {codeLines.join('\n')}
        </pre>,
      );
      continue;
    }

    // Markdown table
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const parseRow = (rowStr: string) =>
        rowStr
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());

      const headers = parseRow(tableLines[0]);
      const rows = tableLines.slice(2).map(parseRow);

      blocks.push(
        <div key={`tbl-${i}`} className="my-2 overflow-x-auto border border-slate-200 rounded-md">
          <table className="w-full text-left border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/70">
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-700 tabular-nums">
                      {renderInlineFormatting(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={`h3-${i}`} className="text-[13.5px] font-semibold text-slate-900 mt-2.5 mb-1">
          {renderInlineFormatting(line.slice(4))}
        </h4>,
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={`h2-${i}`} className="text-[14px] font-semibold text-slate-900 mt-3 mb-1">
          {renderInlineFormatting(line.slice(3))}
        </h3>,
      );
      i++;
      continue;
    }

    if (line.trim().startsWith('- [ ] ') || line.trim().startsWith('- [x] ') || line.trim().startsWith('- [X] ')) {
      const checked = line.trim().startsWith('- [x] ') || line.trim().startsWith('- [X] ');
      const label = line.trim().slice(6);
      blocks.push(
        <div key={`chk-${i}`} className="flex items-start gap-2 py-0.5 text-[13px] text-slate-700">
          <span
            className={`mt-1 w-3.5 h-3.5 rounded border inline-flex items-center justify-center shrink-0 text-[10px] ${
              checked
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-300 bg-white text-transparent'
            }`}
          >
            ✓
          </span>
          <span className="leading-relaxed">{renderInlineFormatting(label)}</span>
        </div>,
      );
      i++;
      continue;
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      blocks.push(
        <div key={`li-${i}`} className="flex items-start gap-2 py-0.5 text-[13px] text-slate-700 pl-1">
          <span className="text-slate-400 select-none mt-0.5">•</span>
          <span className="leading-relaxed">{renderInlineFormatting(line.trim().slice(2))}</span>
        </div>,
      );
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+\.)\s+(.*)$/);
      if (match) {
        blocks.push(
          <div key={`ol-${i}`} className="flex items-start gap-2 py-0.5 text-[13px] text-slate-700 pl-1">
            <span className="font-mono text-[12px] text-slate-500 tabular-nums mt-0.5 shrink-0">
              {match[1]}
            </span>
            <span className="leading-relaxed">{renderInlineFormatting(match[2])}</span>
          </div>,
        );
        i++;
        continue;
      }
    }

    if (!line.trim()) {
      blocks.push(<div key={`sp-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="text-[13px] leading-relaxed text-slate-700">
        {renderInlineFormatting(line)}
      </p>,
    );
    i++;
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={handleCopy}
        title="复制产出内容"
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-0 right-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 rounded transition-opacity cursor-pointer"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>
      <div className="space-y-0.5 pr-12">{blocks}</div>
    </div>
  );
};
