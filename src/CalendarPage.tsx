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
import { BigCalendar } from "./components/BigCalendar";
import FamilyAlmanac from "./components/FamilyAlmanac";

export const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [viewRange, setViewRange] = useState<"day" | "month" | "year">("month");
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
        const familyId = parsed.familyId;
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

  const formattedSelectedDate = formatEventDate(currentDate.getFullYear(), currentDate.getMonth() + 1, selectedDay);

  // === 计算当前视图下是否有活动 ===
  const currentEvents = events.filter(e => {
    const [y, m, d] = e.date.split("-").map(Number);
    if (viewRange === 'day') {
      const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
      return e.date === dateStr || (e.isRecurring && e.date.endsWith(`-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`));
    } else if (viewRange === 'month') {
      return (m - 1) === currentDate.getMonth();
    } else {
      // Year view
      return y === currentDate.getFullYear();
    }
  });
  const hasEvents = currentEvents.length > 0;

  const generateAiSummary = async () => {
    if (currentEvents.length === 0) {
      setSummaryLoading(true);
      setAiSummary(null);
      setTimeout(() => {
        setAiSummary("近期没有已安排的家族大事记。");
        setSummaryLoading(false);
      }, 300); // 极速 AI 响应动画
      return;
    }

    setSummaryLoading(true);
    setAiSummary(null);

    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "family-secretary",
          eventRange: viewRange === 'day' ? 'today' : viewRange,
          events: currentEvents
        })
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
          <button onClick={() => navigate("/square")} className="flex items-center gap-1 p-2 -ml-3 rounded-full hover:bg-black/5 text-slate-800 transition-colors group">
            <ArrowLeft size={28} className="group-active:-translate-x-1 transition-transform" />
            <span className="text-lg font-black pr-2">返回</span>
          </button>
          <div className="bg-[#eab308]/10 p-2 rounded-xl text-[#eab308]">
            <LucideCalendar size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">家族日历</h1>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <div className="bg-[#fdfbf7] -mx-6 px-6 py-4 flex flex-col gap-4">
          {/* 1. 顶部大事记标题行 (复刻自图片样式) */}
          <div className="flex items-center justify-between w-full max-w-[400px] mx-auto px-1">
            <div className="flex items-center gap-2">
              <LucideCalendar size={24} className="text-[#eab308]" strokeWidth={3} />
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800 tracking-tight">大事记</span>
                <span className="text-xl font-bold text-slate-300 tracking-tighter">{currentDate.getFullYear()}</span>
              </div>
            </div>
            <button
              onClick={() => navigate("/add-event", { state: { initialDate: formattedSelectedDate } })}
              className="bg-[#eab308] text-white px-5 py-2 rounded-full text-base font-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-transform active:scale-95 whitespace-nowrap"
            >
              <Plus size={18} strokeWidth={4} /> 添加大事记
            </button>
          </div>

          {/* 2. 统一的主题开关 (今日/本月/本年) */}
          <div className="flex bg-slate-100/50 p-1.5 rounded-2xl gap-1 w-full max-w-[360px] mx-auto shadow-inner">
            <button
              onClick={() => setViewRange('day')}
              className={cn("flex-1 py-1.5 rounded-xl text-base font-black transition-all flex items-center justify-center", viewRange === 'day' ? "bg-[#eab308] text-white shadow-md scale-[1.02]" : "text-slate-400")}
            >
              今日
            </button>
            <button
              onClick={() => setViewRange('month')}
              className={cn("flex-1 py-1.5 rounded-xl text-base font-black transition-all flex items-center justify-center", viewRange === 'month' ? "bg-[#eab308] text-white shadow-md scale-[1.02]" : "text-slate-400")}
            >
              本月
            </button>
            <button
              onClick={() => setViewRange('year')}
              className={cn("flex-1 py-1.5 rounded-xl text-base font-black transition-all flex items-center justify-center", viewRange === 'year' ? "bg-[#eab308] text-white shadow-md scale-[1.02]" : "text-slate-400")}
            >
              本年
            </button>
          </div>

          <div className="w-full space-y-3">
            {/* 2. AI 总结按钮 */}
            <button
              onClick={() => generateAiSummary()}
              disabled={summaryLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500/5 to-transparent border-2 border-dashed border-amber-500/20 rounded-2xl flex items-center justify-center gap-2 text-amber-600 font-black group hover:bg-amber-500/10 transition-all active:scale-[0.98] text-sm shadow-sm"
            >
              <Sparkles size={18} className={cn(summaryLoading && "animate-spin")} />
              {summaryLoading ? "AI 总结中..." : `${viewRange === 'day' ? '今日' : viewRange === 'month' ? '本月' : '本年'}大事记 AI 智能总结`}
            </button>

            <AnimatePresence>
              {aiSummary && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="p-5 bg-amber-50/50 rounded-3xl border border-amber-500/10 relative backdrop-blur-sm shadow-xl shadow-amber-900/5"
                >
                  <button onClick={() => setAiSummary(null)} className="absolute top-4 right-4 text-amber-300 hover:text-amber-500"><X size={16} /></button>
                  <div className="flex gap-3">
                    <div className="size-8 rounded-full bg-white flex items-center justify-center text-amber-600 shadow-sm shrink-0 border border-amber-100">
                      <Sparkles size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-amber-700/60 uppercase tracking-widest mb-1 flex items-center gap-1.5">AI 智能总结</p>
                      <p className="text-slate-700 font-bold leading-relaxed text-xs">{aiSummary}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 2. 家族黄历 - 复刻记忆档案排版 (仅在本日视图显示) */}
        {viewRange === 'day' && (
          <div className="mb-0">
            <FamilyAlmanac
              familyId={currentUser?.familyId === 'demo' ? undefined : currentUser?.familyId}
              date={formattedSelectedDate}
              onPrev={() => {
                const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay - 1);
                setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                setSelectedDay(d.getDate());
              }}
              onNext={() => {
                const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay + 1);
                setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                setSelectedDay(d.getDate());
              }}
            />
          </div>
        )}

        {viewRange === 'month' && (
          <div className="space-y-6">
            <BigCalendar
              events={events}
              members={members}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              currentDate={currentDate}
              onMonthChange={setCurrentDate}
              currentUserId={currentUser?.id}
            />
          </div>
        )}

        {viewRange === 'year' && (
          <div className="px-1 invisible h-0 overflow-hidden">
            {/* 年度导航移至开关下方或省略，此处暂不显示具体标题 */}
          </div>
        )}

        <section className="space-y-4 pb-24 -mt-3">
          {/* 3. 本日动态标题 */}
          {hasEvents && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="p-1 px-3 bg-amber-50 text-[#eab308] rounded-full text-[10px] font-black uppercase tracking-widest">
                {viewRange === 'day' ? `${selectedDay}日 动态` : viewRange === 'month' ? '本月动态' : '本年动态'}
              </div>
            </div>
          )}


          <div className="grid grid-cols-1 gap-4">
            {(() => {
              const targetDateShort = `${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
              const filteredList = events.filter(e => {
                const [y, m, d] = e.date.split("-").map(Number);
                if (viewRange === 'day') {
                  return e.date.endsWith(`-${targetDateShort}`);
                } else if (viewRange === 'month') {
                  return (m - 1) === currentDate.getMonth();
                } else {
                  return y === currentDate.getFullYear();
                }
              }).sort((a, b) => {
                if (viewRange === 'year') {
                  const dateA = new Date(a.date).getTime();
                  const dateB = new Date(b.date).getTime();
                  return dateA - dateB;
                }
                const dayA = Number(a.date.split('-')[2]);
                const dayB = Number(b.date.split('-')[2]);
                return dayA - dayB;
              });

              if (filteredList.length === 0) return null;

              return filteredList.map((event) => {
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
              });
            })()}
          </div>
        </section>


      </main>
    </>
  );
};
