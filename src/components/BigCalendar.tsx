import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import {
  getZodiac,
  getLunarDay,
  getDaysInMonth,
  getFirstDayOfMonth,
  formatEventDate
} from "../lib/calendarUtils";
import { FamilyEvent, FamilyMember } from "../types";

interface BigCalendarProps {
  events: FamilyEvent[];
  members: FamilyMember[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  className?: string;
  currentUserId?: string | number;
}

/**
 * 适老化全屏大日历组件 (BigCalendar)
 * 核心设计：文字较适中、对比度清晰、周末红色区分
 */
export const BigCalendar: React.FC<BigCalendarProps> = ({
  events,
  members,
  selectedDay,
  onSelectDay,
  currentDate,
  onMonthChange,
  className,
  currentUserId
}) => {
  const getMemberColor = (event: FamilyEvent) => {
    // 如果是与当前用户相关的事件（本人或涉及本人），使用热情的玫瑰红
    const isRelated = currentUserId && (
      String(event.memberId) === String(currentUserId) ||
      (event.memberIds && event.memberIds.map(String).includes(String(currentUserId)))
    );

    if (isRelated) return { bg: "bg-rose-500", text: "text-white" };

    // 其他成员按 ID 分配颜色，确保多样性
    const mid = event.memberId || (event.memberIds && event.memberIds[0]) || 0;
    const colors = [
      { bg: "bg-blue-100", text: "text-blue-600" },
      { bg: "bg-emerald-100", text: "text-emerald-600" },
      { bg: "bg-indigo-100", text: "text-indigo-600" },
      { bg: "bg-pink-100", text: "text-pink-600" },
      { bg: "bg-amber-100", text: "text-amber-600" },
      { bg: "bg-violet-100", text: "text-violet-600" },
    ];
    return colors[Number(mid) % colors.length];
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const numDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const nextMonth = () => {
    onMonthChange(new Date(year, month + 1, 1));
  };

  const prevMonth = () => {
    onMonthChange(new Date(year, month - 1, 1));
  };

  const getEventOnDay = (day: number) => {
    return events.find(e => {
      const [ey, em, ed] = e.date.split('-').map(Number);
      const matchMonthDay = em === (month + 1) && ed === day;
      return e.isRecurring ? matchMonthDay : (ey === year && matchMonthDay);
    });
  };

  const today = new Date();
  const isToday = (day: number) => {
    return today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year;
  };

  return (
    <div className={cn("bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 max-w-[360px] mx-auto", className)}>
      {/* Month Header */}
      <div className="bg-gradient-to-b from-white to-slate-50/50 p-4 flex items-center justify-between border-b border-slate-100/50">
        <button
          onClick={prevMonth}
          className="size-8 rounded-full bg-transparent flex items-center justify-center text-[#eab308] hover:bg-amber-500/5 transition-colors active:scale-90"
        >
          <ChevronLeft size={24} strokeWidth={3} />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1 text-2xl font-black text-[#eab308]">
            {/* 年份选择器 - 统一样式 */}
            <select
              value={year}
              onChange={(e) => onMonthChange(new Date(Number(e.target.value), month, 1))}
              className="bg-transparent border-none p-0 cursor-pointer focus:ring-0 text-[#eab308] font-black outline-none"
            >
              {Array.from({ length: 151 }, (_, i) => 1930 + i).map(y => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>

            {/* 月份选择器 */}
            <select
              value={month}
              onChange={(e) => onMonthChange(new Date(year, Number(e.target.value), 1))}
              className="bg-transparent border-none p-0 cursor-pointer focus:ring-0 text-[#eab308] font-black outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i).map(m => (
                <option key={m} value={m}>{m + 1}月</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={nextMonth}
          className="size-8 rounded-full bg-transparent flex items-center justify-center text-[#eab308] hover:bg-amber-500/5 transition-colors active:scale-90"
        >
          <ChevronRight size={24} strokeWidth={3} />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 p-2 bg-slate-50/30">
        {["日", "一", "二", "三", "四", "五", "六"].map((d, i) => (
          <div key={d} className={cn(
            "text-center py-2 text-sm font-black tracking-tight",
            (i === 0 || i === 6) ? "text-rose-500" : "text-slate-300"
          )}>
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-0 p-0">
        {[...Array(firstDay)].map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {[...Array(numDays)].map((_, i) => {
          const day = i + 1;
          const selected = selectedDay === day;
          const eventOnDay = getEventOnDay(day);
          const { lunar, festival } = getLunarDay(year, month + 1, day);
          const dayOfWeek = (firstDay + i) % 7;
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          return (
            <button
              key={day}
              onClick={() => onSelectDay(day)}
              className={cn(
                "aspect-square rounded-[1rem] flex flex-col items-center justify-center relative transition-all active:scale-95 group p-1",
                selected
                  ? "bg-[#eab308] text-white shadow-xl shadow-amber-500/20 scale-110 z-10"
                  : "bg-white border border-slate-50",
                isToday(day) && !selected && "bg-amber-50 text-amber-600 font-bold"
              )}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className={cn(
                  "text-xl font-black leading-none",
                  selected ? "text-white" : "text-slate-800"
                )}>
                  {day}
                </span>

                {festival ? (
                  <div className="flex flex-col items-center gap-0 w-full px-0.5 min-w-[34px]">
                    {festival.split(" | ").map((f, idx) => {
                      const isL = f === "龙抬头" || f === "元宵节" || f === "端午节" || f === "除夕";
                      return (
                        <span key={idx} className={cn(
                          "text-[11px] font-black tracking-tighter leading-tight truncate w-full text-center",
                          selected ? "text-white" : (isL ? "text-rose-500" : "text-amber-500")
                        )}>
                          {f.slice(0, 3)}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  lunar && (
                    <span className={cn(
                      "text-[10px] font-bold tracking-tighter leading-none h-[12px]",
                      selected ? "text-white/80" : "text-slate-300"
                    )}>
                      {lunar}
                    </span>
                  )
                )}
              </div>

              {/* 大事记极简小点或药丸 */}
              {eventOnDay && (() => {
                const mColor = getMemberColor(eventOnDay);
                return (
                  <div className={cn(
                    "mt-1 px-1 rounded-full w-full max-w-[28px] overflow-hidden",
                    selected ? "bg-white/30" : mColor.bg
                  )}>
                    <p className={cn(
                      "text-[6px] font-black truncate text-center",
                      selected ? "text-white" : mColor.text
                    )}>
                      ●
                    </p>
                  </div>
                );
              })()}
            </button>
          );
        })}
      </div>

    </div>
  );
};
