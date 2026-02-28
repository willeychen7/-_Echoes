import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Phone, Gift, Calendar as LucideCalendar, ArrowLeft, Trash2 } from "lucide-react";
import { FamilyEvent } from "./types";
import { Card } from "./components/Card";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { cn } from "./lib/utils";
import { FamilyMember } from "./types";
import { DEMO_EVENTS, DEMO_MEMBERS, isDemoMode } from "./demo-data";

export const CalendarPage: React.FC = () => {
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [viewRange, setViewRange] = useState<"day" | "month">("day");
  const navigate = useNavigate();

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    const parsed = savedUser ? JSON.parse(savedUser) : null;
    if (parsed) setCurrentUser(parsed);

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
    }
  }, []);


  const handleDeleteEvent = async (eventId: string | number) => {
    if (!window.confirm("确定要删除这条大事记吗？")) return;

    if (isDemoMode(currentUser)) {
      // NOTE: Demo 模式下从前端 state 和 localStorage 中删除
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

  const getZodiac = (year: number) => {
    const zodiacs = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
    return zodiacs[(year - 4) % 12];
  };

  const getLunarDay = (day: number) => {
    const lunarDays = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十", "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];
    const month = currentDate.getMonth() + 1;
    const festivals: Record<string, string> = {
      "1-1": "元旦",
      "5-1": "劳动节",
      "10-1": "国庆",
      "12-25": "圣诞"
    };
    return { lunar: lunarDays[(day - 1) % 30], festival: festivals[`${month}-${day}`] };
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const formattedSelectedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;

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
              <p className="text-xs text-slate-400 font-medium tracking-widest">岁次 · {getZodiac(currentDate.getFullYear())}年</p>
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ChevronRight className="text-slate-400" size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {["日", "一", "二", "三", "四", "五", "六"].map(d => (
              <div key={d} className="text-center text-xs font-bold text-slate-300 py-1">{d}</div>
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

              const { lunar, festival } = getLunarDay(dayNum);

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
                  <span className={cn(
                    "text-lg font-black leading-none",
                    isEvent && !isSelected && "text-[#eab308]"
                  )}>{dayNum}</span>
                  <div className="flex flex-col items-center">
                    <span className={cn(
                      "text-[10px] font-medium scale-90",
                      isSelected ? "text-white/90" : "text-slate-400"
                    )}>
                      {lunar}
                    </span>
                    {festival && (
                      <span className={cn(
                        "text-[10px] font-bold scale-90",
                        isSelected ? "text-white" : "text-red-500"
                      )}>
                        {festival}
                      </span>
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

            <div className="flex bg-slate-100/50 p-1.5 rounded-full gap-1">
              <button
                onClick={() => setViewRange('day')}
                className={cn("px-5 py-2 rounded-full text-sm font-black transition-all", viewRange === 'day' ? "bg-white text-[#eab308] shadow-sm" : "text-slate-400")}
              >
                本日
              </button>
              <button
                onClick={() => setViewRange('month')}
                className={cn("px-5 py-2 rounded-full text-sm font-black transition-all", viewRange === 'month' ? "bg-white text-[#eab308] shadow-sm" : "text-slate-400")}
              >
                本月
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {events.filter(e => {
              const targetDate = `${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
              if (viewRange === 'day') {
                return e.date.endsWith(`-${targetDate}`);
              } else {
                const [, m] = e.date.split("-").map(Number);
                return (m - 1) === currentDate.getMonth();
              }
            }).length === 0 ? (
              <div className="bg-white rounded-[2rem] p-12 text-center border-2 border-dashed border-slate-100">
                <p className="text-slate-300 font-bold text-xl">暂无大事记</p>
              </div>
            ) : (
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
                const displayName = member?.name || event.customMemberName || null;
                const isMe = currentUser && member && member.id == currentUser.memberId;
                const displayAvatar = isMe ? currentUser.avatar : (member?.avatarUrl || null);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const [y, m_val, d_val] = event.date.split("-").map(Number);
                const isActuallyToday = y === today.getFullYear() && (m_val - 1) === today.getMonth() && d_val === today.getDate();

                const rawTip = event.notes || "";
                const displayTip = rawTip.length > 30 ? rawTip.slice(0, 28) + "..." : rawTip;

                const getEventInfo = (type: string, title: string) => {
                  if (type === "birthday") return { label: "生日", color: "bg-pink-50 text-pink-500" };
                  if (type === "graduation") return { label: "毕业礼", color: "bg-blue-50 text-blue-500" };
                  if (title.includes("纪念日") || type === "anniversary") return { label: "纪念日", color: "bg-amber-50 text-amber-500" };
                  return { label: "大事记", color: "bg-emerald-50 text-emerald-500" };
                };
                const eventInfo = getEventInfo(event.type || "", event.title);

                return (
                  <Card key={event.id} className="p-4 border-none shadow-md shadow-slate-100/40 rounded-3xl bg-white flex flex-col justify-between space-y-4">
                    {/* Row 1: Avatar & Name & Trash */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-16 rounded-full border-4 border-white shadow-md overflow-hidden shrink-0 flex items-center justify-center bg-slate-50">
                          {displayAvatar ? (
                            <img src={displayAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-[20px] font-black text-[#eab308]">{displayName?.charAt(0) || "?"}</span>
                          )}
                        </div>
                        <p className="text-4xl font-black text-slate-800 truncate">{displayName}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                        className="size-10 flex items-center justify-center text-slate-200 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={24} />
                      </button>
                    </div>

                    {/* Row 2: Tag & Days Remaining */}
                    <div className="flex items-center justify-between">
                      <div className={cn("px-4 py-1.5 rounded-full text-lg font-black tracking-tight shrink-0", eventInfo.color)}>
                        {displayName ? (event.title.replace(new RegExp(`^${displayName}(的)?`), '') || eventInfo.label) : eventInfo.label}
                      </div>
                      <div className="text-lg font-black text-[#eab308] bg-[#eab308]/5 px-4 py-1.5 rounded-full whitespace-nowrap">
                        {isActuallyToday ? "今天" : `${d_val}日`}
                      </div>
                    </div>

                    {/* Row 3: Event Tip (Conditional) */}
                    {displayTip && (
                      <div className="min-w-0">
                        <p className="text-lg text-slate-400 font-medium leading-relaxed truncate opacity-90">
                          {displayTip}
                        </p>
                      </div>
                    )}

                    {/* Row 4: Actions */}
                    <div className="flex gap-2 pt-2 border-t border-slate-50">
                      <button onClick={() => navigate(`/blessing/${event.id}`)} className="flex-1 py-3 bg-[#eab308]/5 text-[#eab308] rounded-2xl text-xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95">
                        <Gift size={20} /> 祝福
                      </button>
                      <button onClick={() => window.location.href = 'tel:10086'} className="size-14 bg-[#eab308]/5 text-[#eab308] rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95">
                        <Phone size={20} />
                      </button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </section>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/add-event", { state: { initialDate: formattedSelectedDate } })}
          className="fixed bottom-24 right-6 size-14 bg-[#eab308] text-white rounded-full shadow-2xl flex items-center justify-center z-[100] ring-4 ring-white"
        >
          <Plus size={28} strokeWidth={3} />
        </motion.button>
      </main>
    </>
  );
};
