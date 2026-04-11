import React, { useState } from "react";
import { BigCalendar } from "./BigCalendar";
import { FamilyEvent, FamilyMember } from "../types";
import { Calendar as CalendarIcon, ChevronRight, Edit3 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface FamilyDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  calendarType: "gregorian" | "lunar";
  onCalendarTypeChange: (type: "gregorian" | "lunar") => void;
  label?: string;
  id?: string;
  events?: FamilyEvent[];
  members?: FamilyMember[];
  defaultOpen?: boolean; // 🚀 新增：控制日历是否默认展开，有预填日期时默认收起
}

/**
 * 💡 已折叠显示的日期选择器
 * 选择后自动收起，显示精美的已选状态。
 */
export const FamilyDatePicker: React.FC<FamilyDatePickerProps> = ({
  value,
  onChange,
  label = "是什么时候？",
  events = [],
  members = [],
  defaultOpen = true, // 默认展开（向后兼容）
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen); // 🚀 由外部控制初始状态
  const selectedDate = value ? new Date(value.replace(/-/g, '/')) : new Date();

  const handleSelectDay = (day: number) => {
    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
    onChange(dateStr);
    // 选择后自动收起 (根据用户最新反馈：选定日期后可以收起，只要不强制跳转即可)
    setIsOpen(false);
  };

  const handleMonthChange = (date: Date) => {
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(selectedDate.getDate(), lastDayOfMonth);
    const newDate = new Date(date.getFullYear(), date.getMonth(), targetDay);
    const dateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
    onChange(dateStr);
  };

  const getDayOfWeek = (date: Date) => {
    return ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][date.getDay()];
  };

  return (
    <section className="space-y-4">
      {label && (
        <div className="flex items-center gap-3 px-1">
          <div className="size-8 rounded-full bg-[#eab308] text-black flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm shrink-0">
            <CalendarIcon size={16} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">{label}</h2>
        </div>
      )}

      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="calendar-open"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <BigCalendar
              events={events}
              members={members}
              selectedDay={selectedDate.getDate()}
              onSelectDay={handleSelectDay}
              currentDate={selectedDate}
              onMonthChange={handleMonthChange}
              className="shadow-2xl border-amber-100/50"
            />
            {/* 允许手动收起的按钮 */}
            {value && (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full mt-4 py-3 bg-slate-100 rounded-2xl text-slate-400 font-bold text-sm"
              >
                收起日历
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="calendar-closed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="group relative bg-[#eab308] rounded-[2.5rem] p-6 shadow-xl shadow-amber-500/20 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-5">
              <div className="size-16 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                <CalendarIcon size={32} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white/60 font-black text-xs uppercase tracking-[0.2em] mb-1">已选定日期</p>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {selectedDate.getFullYear()}年 {selectedDate.getMonth() + 1}月 {selectedDate.getDate()}日
                </h3>
                <p className="text-white/80 font-bold text-sm mt-0.5">{getDayOfWeek(selectedDate)}</p>
              </div>
            </div>

            <div className="size-12 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:bg-white/30 transition-colors">
              <Edit3 size={20} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
