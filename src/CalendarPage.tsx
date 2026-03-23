import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Phone, Gift, Calendar as LucideCalendar, ArrowLeft, Trash2, MessageSquare, ChevronUp, ChevronDown, Sparkles, X } from "lucide-react";
import { FamilyEvent, FamilyMember } from "./types";
import { Card } from "./components/Card";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { DEMO_EVENTS, DEMO_MEMBERS, isDemoMode } from "./demo-data";
import { InlineBlessingPanel } from "./components/FamilyEvents";
import { getSafeAvatar } from "./constants";
import { getLunarDay, getZodiac, formatEventDate } from "./lib/calendarUtils";

export const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [viewRange, setViewRange] = useState<"day" | "month">("day");
  const [openBlessingEventId, setOpenBlessingEventId] = useState<number | null>(null);
  const [sentEventIds, setSentEventIds] = useState<number[]>([]);
  const [expandedNoteIds, setExpandedNoteIds] = useState<number[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    const parsed = savedUser ? JSON.parse(savedUser) : null;
    if (parsed) setCurrentUser(parsed);

    const loadData = () => {
      if (isDemoMode(parsed)) {
        const customEvents = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
        setEvents([...DEMO_EVENTS, ...customEvents]);
        setMembers(DEMO_MEMBERS);
      } else {
        const familyId = parseInt(String(parsed.familyId));
        fetch(`/api/events?familyId=${familyId}`).then(res => res.json()).then(data => {
          if (Array.isArray(data)) setEvents(data);
        }).catch(console.error);
        fetch(`/api/family-members?familyId=${familyId}`).then(res => res.json()).then(data => {
          if (Array.isArray(data)) setMembers(data);
        }).catch(console.error);

        // Fetch messages to see which events I've addressed
        fetch(`/api/messages`).then(res => res.json()).then(data => {
          if (Array.isArray(data)) {
            const mySentIds = data
              .filter((m: any) => m.authorName === parsed.name && m.eventId)
              .map((m: any) => m.eventId);
            setSentEventIds(mySentIds);
          }
        }).catch(console.error);
      }
    };

    loadData();

    const handleSent = (e: any) => setSentEventIds(prev => [...prev, e.detail.eventId]);
    window.addEventListener('blessing-sent' as any, handleSent);

    return () => {
      window.removeEventListener('blessing-sent' as any, handleSent);
    };
  }, []);


  const handleDeleteEvent = async (eventId: string | number) => {
    if (!window.confirm("确定要删除这条大事记吗？")) return;

    if (isDemoMode(currentUser)) {
      setEvents(prev => prev.filter(e => e.id !== eventId));
      const stored = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
      const updated = stored.filter((e: any) => e.id !== eventId);
      localStorage.setItem("demoCustomEvents", JSON.stringify(updated));
    } else {
      try {
        const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
        if (res.ok) {
          setEvents(prev => prev.filter(e => e.id !== eventId));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const nextMonth = () => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(next);
  };

  const prevMonth = () => {
    const prev = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(prev);
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const formattedSelectedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;

  const generateAiSummary = async () => {
    setSummaryLoading(true);
    setAiSummary(null);
    const dayEvents = events.filter(e => {
       const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
       return e.date === dateStr || (e.isRecurring && e.date.endsWith(`-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`));
    });
    
    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "family-secretary", eventRange: "today", events: dayEvents })
      });
      const data = await res.json();
      setAiSummary(data.text || data.error || "生成总结失败");
    } catch (e) {
      setAiSummary("AI 总结请求失败");
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 glass-morphism px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 p-2 -ml-3 rounded-full hover:bg-black/5 text-slate-800 transition-colors group">
            <ArrowLeft size={28} className="group-active:-translate-x-1 transition-transform" />
            <span className="text-lg font-black pr-2">返回</span>
          </button>
          <div className="bg-[#eab308]/10 p-2 rounded-xl text-[#eab308]">
            <LucideCalendar size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">家族日历</h1>
        </div>
        <button
          onClick={() => navigate("/add-event", { state: { initialDate: formattedSelectedDate } })}
          className="w-10 h-10 rounded-full bg-[#eab308]/10 text-[#eab308] flex items-center justify-center transition-all"
        >
          <Plus size={24} />
        </button>
      </header>

      <main className="p-6 space-y-8">
        <Card className="p-3 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
          <div className="flex items-center justify-between mb-4 px-2">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ChevronLeft className="text-slate-400" size={20} />
            </button>
            <div className="text-center">
              <h2 className="text-xl font-bold">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2>
              <p className="text-xs text-slate-400 font-medium tracking-widest leading-relaxed">
                岁次 · {getZodiac(currentDate.getFullYear())}年
              </p>
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ChevronRight className="text-slate-400" size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {["日", "一", "二", "三", "四", "五", "六"].map((d, i) => (
              <div key={d} className={cn(
                "text-center text-xs font-bold py-1",
                (i === 0 || i === 6) ? "text-rose-500" : "text-slate-300"
              )}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {[...Array(firstDayOfMonth)].map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {[...Array(daysInMonth(currentDate.getFullYear(), currentDate.getMonth()))].map((_, i) => {
              const dayNum = i + 1;
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const isToday = dayNum === today.getDate() &&
                currentDate.getMonth() === today.getMonth() &&
                currentDate.getFullYear() === today.getFullYear();

              const isSelected = dayNum === selectedDay;

              const isEvent = events.some(e => {
                const [y, m, d] = e.date.split('-').map(Number);
                const isRecurring = !!e.isRecurring;
                const matchMonthDay = m === (currentDate.getMonth() + 1) && d === dayNum;
                return isRecurring ? matchMonthDay : (y === currentDate.getFullYear() && matchMonthDay);
              });

              const { lunar, festival } = getLunarDay(currentDate.getFullYear(), currentDate.getMonth() + 1, dayNum);

              return (
                <button
                  key={dayNum}
                  onClick={() => setSelectedDay(dayNum)}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative group",
                    isSelected ? "bg-[#eab308] text-white shadow-lg shadow-[#eab308]/30" : "hover:bg-slate-50",
                    isEvent && !isSelected && "bg-[#eab308]/10",
                    isToday && !isSelected && "ring-2 ring-[#eab308]/20"
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                    <span className={cn(
                      "text-lg font-black leading-none",
                      isEvent && !isSelected && "text-[#eab308]"
                    )}>{dayNum}</span>
                    
                    {festival ? (
                      <div className="flex flex-col items-center gap-0 w-full overflow-hidden">
                         {festival.split(" | ").map((f, idx) => {
                            const isL = f === "龙抬头" || f === "元宵节" || f === "端午节" || f === "除夕";
                            return (
                              <span key={idx} className={cn(
                                "text-[7px] font-black tracking-tighter leading-tight truncate w-full text-center",
                                isSelected ? "text-white" : (isL ? "text-rose-500" : "text-emerald-500")
                              )}>{f.slice(0, 3)}</span>
                            );
                         })}
                      </div>
                    ) : (
                      <span className={cn(
                        "text-[9px] font-medium tracking-tighter leading-none h-[11px] block",
                        isSelected ? "text-white/90" : "text-slate-400"
                      )}>{lunar}</span>
                    )}
                  </div>
                  {isEvent && !isSelected && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#eab308] rounded-full ring-2 ring-white" />}
                </button>
              );
            })}
          </div>
        </Card>

        <section className="space-y-4 pb-24">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#eab308]/10 rounded-lg text-[#eab308]">
                <Gift size={16} />
              </div>
              <h3 className="text-lg font-bold">{viewRange === 'day' ? `${selectedDay}日` : '本月'}的大事记</h3>
            </div>

            <div className="flex bg-slate-100/50 p-1 rounded-2xl gap-0.5">
              <button
                onClick={() => setViewRange('day')}
                className={cn("px-4 py-1.5 rounded-xl text-xs font-black transition-all", viewRange === 'day' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400")}
              >
                本日
              </button>
              <button
                onClick={() => setViewRange('month')}
                className={cn("px-4 py-1.5 rounded-xl text-xs font-black transition-all", viewRange === 'month' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400")}
              >
                本月
              </button>
            </div>
          </div>

          {/* === 📅 空状态引导 - 已挪至黄历上方 === */}
          {(() => {
            const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
            const todayEvents = events.filter(e => {
              if (viewRange === 'day') return e.date === dateStr || (e.isRecurring && e.date.endsWith(`-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`));
              const [, m] = e.date.split("-").map(Number);
              return (m - 1) === currentDate.getMonth();
            });
            
            if (todayEvents.length === 0) {
              return (
                <div className="mb-4 px-1 animate-in fade-in slide-in-from-bottom-1">
                  <button 
                    onClick={() => navigate("/add-event", { state: { initialDate: formattedSelectedDate } })}
                    className="w-full bg-white/60 backdrop-blur-sm rounded-3xl p-4 border border-[#eab308]/10 flex items-center justify-between group active:scale-[0.98] transition-all shadow-sm"
                  >
                    <div className="flex flex-col items-start px-2">
                       <p className="text-slate-400 font-black text-sm">今天还没有记录哦～</p>
                    </div>
                    <div className="size-9 rounded-xl bg-slate-100 text-[#eab308] flex items-center justify-center group-hover:bg-[#eab308] group-hover:text-white transition-all">
                      <Plus size={18} strokeWidth={4} />
                    </div>
                  </button>
                </div>
              );
            }
            
            return (
              <div className="mb-4 px-1 animate-in fade-in slide-in-from-bottom-1">
                <button
                  onClick={() => generateAiSummary()}
                  className="w-full py-4 bg-gradient-to-r from-[#eab308]/5 to-transparent border-2 border-dashed border-[#eab308]/20 rounded-3xl flex items-center justify-center gap-2 text-[#eab308] font-black group hover:bg-[#eab308]/10 transition-all active:scale-[0.98]"
                >
                  <Sparkles size={16} className={cn("text-[#eab308]", summaryLoading && "animate-spin")} />
                  {summaryLoading ? "AI 正在回味家族记忆..." : "本日大事记 AI 智能总结"}
                </button>
                <AnimatePresence>
                  {aiSummary && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 p-5 bg-amber-50/50 rounded-3xl border border-amber-100/20 relative"
                    >
                      <button onClick={() => setAiSummary(null)} className="absolute top-4 right-4 text-amber-300 hover:text-amber-500"><X size={14} /></button>
                      <div className="flex gap-2">
                        <div className="size-8 rounded-full bg-white flex items-center justify-center text-[#eab308] shadow-sm shrink-0">
                           <Sparkles size={14} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-amber-600/40 uppercase tracking-widest mb-1 flex items-center gap-1">AI 智能总结</p>
                          <p className="text-slate-700 font-bold text-xs leading-relaxed">{aiSummary}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}

          {viewRange === 'day' && (() => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const weekDayStr = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][new Date(year, month - 1, selectedDay).getDay()];
            const { lunar, festival } = getLunarDay(year, month, selectedDay);

            return (
              <div className="mb-6 px-1">
                <div className="bg-white rounded-[2.5rem] border-4 border-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1.5 flex gap-1 px-1 opacity-20">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="flex-1 h-full bg-slate-200 rounded-b-full" />
                    ))}
                  </div>

                  <div className="p-6 flex flex-col items-center">
                    <div className="w-full flex justify-between items-center mb-4">
                      <button 
                        onClick={() => {
                          const prev = new Date(year, month - 1, selectedDay - 1);
                          setCurrentDate(prev);
                          setSelectedDay(prev.getDate());
                        }}
                        className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <div className="flex flex-col items-center">
                        <span className="text-base font-black text-emerald-600 tracking-tight font-mono">{year}年 {month}月</span>
                      </div>
                      <button 
                         onClick={() => {
                          const next = new Date(year, month - 1, selectedDay + 1);
                          setCurrentDate(next);
                          setSelectedDay(next.getDate());
                        }}
                        className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </div>

                    <div className="flex flex-col items-center my-2">
                      <motion.span 
                        key={selectedDay}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-[110px] font-black leading-none text-emerald-500 tracking-tighter"
                      >
                        {selectedDay}
                      </motion.span>
                      <span className="text-xl font-black text-slate-400 -mt-2 uppercase tracking-widest">{weekDayStr}</span>
                      {festival && (
                        <div className="mt-8 flex flex-col items-center gap-4 w-full px-4">
                          {festival.split(" | ").map((f, idx) => {
                            const isLunar = f === "龙抬头" || f === "元宵节" || f === "端午节" || f === "七夕" || f === "中秋" || f === "重阳" || f === "冬至" || f === "除夕";
                            return (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={cn(
                                  "flex items-center gap-3 px-6 py-3 rounded-2xl shadow-sm border-2 w-full max-w-[280px]",
                                  isLunar ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-emerald-50 border-emerald-100 text-emerald-600"
                                )}
                              >
                                <span className={cn(
                                  "text-sm font-black px-2 py-0.5 rounded-lg",
                                  isLunar ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-600"
                                )}>
                                  {isLunar ? "农历" : "公历"}
                                </span>
                                <span className="text-2xl font-black tracking-tighter flex-1 text-center pr-6">
                                  {f}
                                </span>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="w-full mt-4 pt-4 border-t-2 border-dashed border-slate-50 flex flex-col items-center">
                      <div className="flex items-center gap-2">
                         <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                         <span className="text-lg font-black text-slate-700 tracking-widest">{lunar}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 gap-4">
            {events.filter(e => {
              const targetDate = `${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
              if (viewRange === 'day') {
                return e.date.endsWith(`-${targetDate}`);
              } else {
                const [, m] = e.date.split("-").map(Number);
                return (m - 1) === currentDate.getMonth();
              }
            }).length === 0 ? null : (
              events.filter(e => {
                const targetDate = `${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
                if (viewRange === 'day') {
                  return e.date.endsWith(`-${targetDate}`);
                } else {
                  const [, m] = e.date.split("-").map(Number);
                  return (m - 1) === currentDate.getMonth();
                }
              }).sort((a, b) => {
                const dayA = Number(a.date.split('-')[2]);
                const dayB = Number(b.date.split('-')[2]);
                return dayA - dayB;
              }).map((event) => {
                const member = members.find(m => m.id == event.memberId);
                const linkedMembers = (event.memberIds && event.memberIds.length > 0)
                  ? members.filter(m => event.memberIds!.includes(m.id))
                  : (member ? [member] : []);

                const displayName = linkedMembers.length > 0
                  ? (linkedMembers.length > 3 ? `${linkedMembers.slice(0, 3).map(m => m.name).join("、")}等${linkedMembers.length}人` : linkedMembers.map(m => m.name).join("、"))
                  : (event.customMemberName || null);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const [y, m_val, d_val] = event.date.split("-").map(Number);
                const isActuallyToday = y === today.getFullYear() && (m_val - 1) === today.getMonth() && d_val === today.getDate();

                const fullNotes = event.notes || "";
                const isNoteTooLong = fullNotes.length > 40;
                const isNoteExpanded = expandedNoteIds.includes(Number(event.id));
                const displayTip = (isNoteTooLong && !isNoteExpanded) ? fullNotes.slice(0, 38) + "..." : fullNotes;

                const getEventInfo = (type: string, title: string) => {
                  if (type === "birthday") return { label: "生日", color: "bg-pink-50 text-pink-500" };
                  if (type === "graduation") return { label: "毕业礼", color: "bg-blue-50 text-blue-500" };
                  if (title.includes("纪念日") || type === "anniversary") return { label: "纪念日", color: "bg-amber-50 text-amber-500" };
                  return { label: "大事记", color: "bg-emerald-50 text-emerald-500" };
                };
                const eventInfo = getEventInfo(event.type || "", event.title);
                const isOpen = openBlessingEventId === event.id;

                return (
                  <div key={event.id} className={cn("rounded-3xl overflow-hidden shadow-md bg-white transition-shadow", isOpen && "shadow-xl shadow-[#eab308]/10 ring-2 ring-[#eab308]/20")}>
                    <div className="p-3">
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="flex -space-x-4">
                              {linkedMembers.length > 0 ? (
                                linkedMembers.slice(0, 3).map((m, idx) => {
                                  const isMee = currentUser && (
                                    (m.id && currentUser.memberId && String(m.id) === String(currentUser.memberId)) ||
                                    (m.userId && currentUser.id && String(m.userId) === String(currentUser.id))
                                  );
                                  const mAvatar = isMee ? getSafeAvatar(currentUser.avatar) : getSafeAvatar(m.avatarUrl);
                                  return (
                                    <div key={m.id} className="size-16 rounded-full border-4 border-white shadow-md overflow-hidden shrink-0 bg-slate-50 relative" style={{ zIndex: 10 - idx }}>
                                      <img src={mAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="size-16 rounded-full border-4 border-white shadow-md overflow-hidden shrink-0 flex items-center justify-center bg-slate-50">
                                  <span className="text-[20px] font-black text-[#eab308]">{displayName?.charAt(0) || "?"}</span>
                                </div>
                              )}
                              {linkedMembers.length > 3 && (
                                <div className="size-16 rounded-full border-4 border-white shadow-md flex items-center justify-center bg-slate-100 text-slate-400 text-xs font-black" style={{ zIndex: 5 }}>
                                  +{linkedMembers.length - 3}
                                </div>
                              )}
                            </div>
                            <p className={cn("font-black text-slate-800 truncate", (displayName || "").length > 6 ? "text-2xl" : "text-4xl")}>{displayName}</p>
                          </div>
                          <button onClick={() => handleDeleteEvent(event.id)} className="size-12 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors">
                            <Trash2 size={28} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mb-3">
                          <div className={cn("px-5 py-2 rounded-full text-lg font-black tracking-tight", eventInfo.color)}>
                            {displayName ? (event.title.replace(new RegExp(`^${displayName}(的)?`), '') || eventInfo.label) : eventInfo.label}
                          </div>
                          <div className="text-lg font-black text-[#eab308] bg-[#eab308]/5 px-5 py-2 rounded-full whitespace-nowrap">
                            {isActuallyToday ? "今天" : `${d_val}日`}
                          </div>
                        </div>

                        {displayTip && (
                          <div className="min-w-0 mb-5 ml-1">
                            <p className={cn(
                              "text-xl text-slate-500 font-medium leading-relaxed tracking-tight break-all",
                              !isNoteExpanded && "line-clamp-2"
                            )}>
                              {displayTip}
                            </p>
                            {isNoteTooLong && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const eid = Number(event.id);
                                  setExpandedNoteIds(prev =>
                                    isNoteExpanded ? prev.filter(id => id !== eid) : [...prev, eid]
                                  );
                                }}
                                className="text-[#eab308] mt-1 text-base font-black flex items-center gap-1 hover:opacity-80 active:scale-95 transition-all"
                              >
                                {isNoteExpanded ? (
                                  <><ChevronUp size={14} /> 收起详情</>
                                ) : (
                                  <><ChevronDown size={14} /> 展开全文</>
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        <div className="flex gap-3 mt-auto pt-3 border-t border-slate-50">
                          {(!isOpen && !sentEventIds.includes(event.id)) && (
                            <button
                              onClick={() => setOpenBlessingEventId(event.id)}
                              className="flex-1 py-4 rounded-2xl text-xl font-black flex items-center justify-center transition-all active:scale-95 gap-2 bg-[#eab308]/5 text-[#eab308]"
                            >
                              <Gift size={24} />
                              送出祝福
                            </button>
                          )}
                          {(!isOpen && !sentEventIds.includes(event.id)) && (
                            <button
                              onClick={() => window.location.href = 'tel:10086'}
                              className="size-16 bg-[#eab308]/5 text-[#eab308] rounded-2xl flex items-center justify-center shadow-sm transition-transform active:scale-95"
                            >
                              <Phone size={24} />
                            </button>
                          )}
                          {(!isOpen && sentEventIds.includes(event.id)) && (
                            <button
                              onClick={() => setOpenBlessingEventId(event.id)}
                              className="flex-1 py-4 rounded-2xl text-xl font-black flex items-center justify-center transition-all active:scale-95 gap-2 bg-[#eab308]/5 text-[#eab308]"
                            >
                              <MessageSquare size={24} />
                              留言墙
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isOpen && (
                        <InlineBlessingPanel
                          event={event}
                          currentUser={currentUser}
                          onClose={() => setOpenBlessingEventId(null)}
                          hasSentBlessing={sentEventIds.includes(event.id)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </section>


      </main>
    </>
  );
};
