import React from "react";
import { Plus, X, Check, User } from "lucide-react";
import { cn } from "../lib/utils";
import { FamilyMember } from "../types";
import { getSafeAvatar } from "../constants";

interface MemberPillsProps {
  members: FamilyMember[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  currentUser?: any;
  isCustom?: boolean;
  onCustomToggle?: (active: boolean) => void;
  customName?: string;
  onCustomNameChange?: (name: string) => void;
  label?: string;
  descriptionRight?: React.ReactNode;
  allowMultiple?: boolean;
}

/**
 * 💡 通用家人头像选择横向列表
 * 支持：单选/多选模式、自定义输入“其他”人员、当前用户高亮、状态同步。
 */
export const MemberPills: React.FC<MemberPillsProps> = ({
  members,
  selectedIds,
  onToggle,
  currentUser,
  isCustom,
  onCustomToggle,
  customName,
  onCustomNameChange,
  label = "这是谁的日子？",
  descriptionRight,
  allowMultiple = true
}) => {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-3 shrink-0">
          <div className="size-6 rounded-full bg-[#eab308] text-black flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
            <User size={12} />
          </div>
          <h2 className="text-lg font-black text-slate-800">{label}</h2>
        </div>
        {descriptionRight && (
          <div className="flex items-center gap-2">
            {descriptionRight}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5">
        {members.map((member) => {
          const memberId = Number(member.id);
          const isSelected = selectedIds.includes(memberId);

          return (
            <button
              key={memberId}
              type="button"
              onClick={() => onToggle(memberId)}
              className={cn(
                "flex items-center gap-2 p-1.5 pr-4 rounded-full border-2 transition-all relative",
                isSelected
                  ? "border-[#eab308] bg-[#eab308]/10 text-slate-900 shadow-md transform scale-105 z-10"
                  : "border-transparent bg-white shadow-sm text-slate-500 hover:bg-slate-50 active:scale-95"
              )}
            >
              <div className={cn(
                "size-8 rounded-full overflow-hidden border-2 transition-all shrink-0",
                isSelected ? "border-[#eab308]" : "border-white shadow-sm"
              )}>
                <img
                  src={(currentUser && (Number(member.id) === Number(currentUser.memberId) || (member.userId && String(member.userId) === String(currentUser.id)))) ? getSafeAvatar(currentUser.avatar) : getSafeAvatar(member.avatarUrl)}
                  alt={member.name}
                  className="w-full h-full object-cover pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className={cn(
                "text-sm font-black transition-colors pointer-events-none whitespace-nowrap",
                isSelected ? "text-slate-900" : "text-slate-500"
              )}>
                {member.name}
              </span>
              {isSelected && (
                <div className="absolute -top-1 -right-1 bg-[#eab308] text-white p-0.5 rounded-full shadow-sm z-20">
                  <Check size={10} strokeWidth={4} />
                </div>
              )}
            </button>
          );
        })}

        {/* 其他（手动输入） */}
        {onCustomToggle && (
          isCustom ? (
            <div className="flex items-center gap-2 p-1.5 pr-8 rounded-full border-2 border-[#eab308] bg-[#eab308]/5 shadow-sm relative animate-in fade-in zoom-in duration-200">
              <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border-2 border-white shadow-sm">
                <User size={14} />
              </div>
              <input
                type="text"
                placeholder="输入姓名"
                className="w-20 bg-transparent border-none outline-none text-sm font-black text-slate-700 placeholder:text-slate-400 p-0 focus:ring-0"
                value={customName}
                onChange={(e) => onCustomNameChange?.(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCustomToggle(false); onCustomNameChange?.(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-200 rounded-full p-1 text-slate-500 hover:bg-slate-300"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onCustomToggle(true);
                if (!allowMultiple) onToggle(-1); // 如果单选，清空已选
              }}
              className="flex items-center gap-2 p-1.5 pr-4 rounded-full border-2 transition-all border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-500"
            >
              <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                <Plus size={14} />
              </div>
              <span className="text-sm font-black whitespace-nowrap">其他...</span>
            </button>
          )
        )}
      </div>
    </section>
  );
};
