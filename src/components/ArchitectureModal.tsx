import React from 'react';
import { X } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">
              数仓 AI 提效整体架构（第二批）参考原图
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              左侧 Skill 资产目录与三大主线预设均已同步自此架构图
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            aria-label="关闭原图弹窗"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-start justify-center">
          <img
            src="/assets/aistudio/image_d70efc8c.png"
            alt="数仓AI提效整体架构第二批"
            referrerPolicy="no-referrer"
            className="max-w-full h-auto border border-slate-200 rounded bg-white"
          />
        </div>
      </div>
    </div>
  );
};
