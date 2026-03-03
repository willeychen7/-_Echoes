import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./components/Card";
import { Calendar as CalendarIcon, Phone, Gift, Plus, FolderOpen, Home, CheckCircle, Trash2, Mic, MessageSquare, Camera, Video, Send, X, Heart, Play, Sparkles, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import { FamilyMember, FamilyEvent, Message, MessageType } from "./types";
import { useNavigate, useLocation } from "react-router-dom";
import { cn, getRelativeTime } from "./lib/utils";
import { getRigorousRelationship } from "./lib/relationships";
import confetti from "canvas-confetti";
import { DEMO_MEMBERS, DEMO_EVENTS, DEMO_DEFAULT_USER, isDemoMode } from "./demo-data";
import { supabase } from "./lib/supabase";
import { DEFAULT_AVATAR, getSafeAvatar } from "./constants";
import { AudioBar, WallMessages, InlineBlessingPanel } from "./components/FamilyEvents";
import { updateAvatarCache } from "./lib/useAvatarCache";

const getZodiac = (year: number) => {
  const zodiacs = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
  return zodiacs[(year - 4) % 12];
};

const Header: React.FC<{
  userAvatar: string;
  onHomeClick: () => void;
  onArchiveClick: () => void;
}> = ({ userAvatar, onHomeClick, onArchiveClick }) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 glass-morphism px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onHomeClick}
          className="bg-[#eab308] p-2.5 rounded-2xl text-black shadow-lg shadow-[#eab308]/20 active:scale-90 transition-all"
        >
          <Home size={22} fill="currentColor" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tight text-slate-800">家族广场</h1>
          <div className="flex items-center gap-1.5">
            <div className="size-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Family Hub</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/calendar")}
          className="size-11 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#eab308] hover:border-[#eab308]/20 transition-all active:scale-90 shadow-sm"
        >
          <CalendarIcon size={20} />
        </button>
        <button
          onClick={onArchiveClick}
          className="flex items-center gap-2 pl-2 pr-4 py-2 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all group"
        >
          <div className="size-8 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-[#eab308] transition-colors">
            <FolderOpen size={16} />
          </div>
          <span className="text-sm font-black tracking-wide">家族档案</span>
        </button>
      </div>
    </header>
  );
};

export const FamilySquare: React.FC = () => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [userAvatar, setUserAvatar] = useState(() => {
    const saved = localStorage.getItem("currentUser");
    const parsed = saved ? JSON.parse(saved) : null;
    return getSafeAvatar(parsed?.avatar);
  });
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  });
  const [activities, setActivities] = useState<any[]>([
    { id: 1, user: "陈小明", action: "添加了大事记", target: "爷爷的生日", time: "10分钟前", icon: "➕" },
    { id: 2, user: "李美芳", action: "在档案里留言", target: "林月娥", time: "30分钟前", icon: "💬" },
    { id: 3, user: "王志强", action: "点赞了留言", target: "陈建国", time: "1小时前", icon: "❤️" },
    { id: 4, user: "陈兴华", action: "更新了个人资料", target: "爷爷", time: "2小时前", icon: "👤" }
  ]);
  const [activeActivityIndex, setActiveActivityIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"events" | "archive">("events");
  const [eventRange, setEventRange] = useState<"week" | "month" | "year">("month");
  // NOTE: 记录当前展开祝福面板的事件 ID，null 表示全部收起
  const [openBlessingEventId, setOpenBlessingEventId] = useState<number | null>(null);
  const [invitingMember, setInvitingMember] = useState<FamilyMember | null>(null);
  const [eventsSummary, setEventsSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sentEventIds, setSentEventIds] = useState<number[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setActiveActivityIndex(prev => (prev + 1) % activities.length), 4000);
    return () => clearInterval(timer);
  }, [activities.length]);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    const parsed = savedUser ? JSON.parse(savedUser) : null;

    const loadUser = () => {
      const currentSavedUser = localStorage.getItem("currentUser");
      const currentParsed = currentSavedUser ? JSON.parse(currentSavedUser) : null;

      if (currentParsed) {
        setCurrentUser(currentParsed);
        setUserAvatar(getSafeAvatar(currentParsed.avatar));
      } else {
        setCurrentUser(DEMO_DEFAULT_USER);
        setUserAvatar(getSafeAvatar(DEMO_DEFAULT_USER.avatar));
      }

      const modeParsed = currentParsed || parsed;
      if (isDemoMode(modeParsed)) {
        const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
        setMembers([...DEMO_MEMBERS, ...customMembers]);
        const customEvents = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
        setEvents([...DEMO_EVENTS, ...customEvents]);
      } else if (modeParsed && modeParsed.familyId) {
        const familyId = parseInt(String(modeParsed.familyId));
        fetch(`/api/family-members?familyId=${familyId}`).then(res => res.json()).then(data => {
          if (Array.isArray(data)) {
            setMembers(data);
            data.forEach((m: any) => {
              if (m.id && (m.avatar_url || m.avatarUrl)) {
                updateAvatarCache(m.id, m.avatar_url || m.avatarUrl);
              }
            });
          }
          fetch(`/api/events?familyId=${familyId}`).then(res => res.json()).then(data => {
            if (Array.isArray(data)) setEvents(data);
          }).catch(console.error);

          fetch(`/api/messages`).then(res => res.json()).then(data => {
            if (Array.isArray(data)) {
              const mySentIds = data
                .filter((m: any) => m.authorName === (currentParsed?.name || parsed?.name) && m.eventId)
                .map((m: any) => m.eventId);
              setSentEventIds(mySentIds);
            }
          }).catch(console.error);
        });
      }
    };
    loadUser();

    const h = () => loadUser();
    window.addEventListener('storage', h);
    window.addEventListener('sync-user', h);

    // 核心修复：开启 Supabase Realtime 订阅，监听整个家族的成员变动
    let channel: any = null;
    if (parsed && parsed.familyId && !isDemoMode(parsed)) {
      channel = supabase
        .channel(`family-${parsed.familyId}-sync`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'family_members',
            filter: `family_id=eq.${parsed.familyId}`
          },
          (payload) => {
            console.log('[REALTIME] Family member updated:', payload);
            const updated = payload.new as any;
            // 实时更新本地成员列表
            setMembers(prev => prev.map(m =>
              m.id === updated.id
                ? { ...m, ...updated, avatarUrl: updated.avatar_url, name: updated.name, relationship: updated.relationship }
                : m
            ));
            // 同步更新全局头像缓存
            if (updated.avatar_url) {
              updateAvatarCache(updated.id, updated.avatar_url);
            }
            // 如果更新的是我自己，同步我的个人资料
            if (updated.id === parsed.memberId) {
              const freshUser = { ...parsed, avatar: updated.avatar_url, name: updated.name };
              localStorage.setItem("currentUser", JSON.stringify(freshUser));
              setCurrentUser(freshUser);
              setUserAvatar(updated.avatar_url);
            }
          }
        )
        .subscribe();
    }

    const handleSent = (e: any) => setSentEventIds(prev => [...prev, e.detail.eventId]);
    window.addEventListener('blessing-sent' as any, handleSent);

    return () => {
      window.removeEventListener('storage', h);
      window.removeEventListener('sync-user', h);
      window.removeEventListener('blessing-sent' as any, handleSent);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (location.hash === "#archive") {
      setActiveTab("archive");
      setTimeout(() => document.getElementById("archive-section")?.scrollIntoView({ behavior: "smooth" }), 100);
    } else {
      setActiveTab("events");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.hash, location.pathname]);

  const generateEventsSummary = async () => {
    setSummaryLoading(true);
    setEventsSummary(null);

    const filteredEvents = [...events]
      .map(event => {
        const getDaysRemaining = (dStr: string, isRec: boolean) => {
          if (!dStr) return 999;
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const [y, m, d] = dStr.split('-').map(Number);
          const target = new Date(y, m - 1, d);
          if (isRec) { target.setFullYear(today.getFullYear()); if (target < today) target.setFullYear(today.getFullYear() + 1); }
          return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
        };
        return { ...event, daysRemaining: getDaysRemaining(event.date, !!event.isRecurring) };
      })
      .filter(event => {
        if (eventRange === "week") return event.daysRemaining <= 7;
        if (eventRange === "month") return event.daysRemaining <= 31;
        return true;
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    if (filteredEvents.length === 0) {
      setEventsSummary("近期没有已安排的家族大事记。");
      setSummaryLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "family-secretary",
          eventRange,
          events: filteredEvents
        })
      });
      const data = await res.json();
      if (data.text) {
        setEventsSummary(data.text);
      } else {
        setEventsSummary(data.error || "生成失败");
      }
    } catch (e: any) {
      console.error("[AI Summary Error]:", e);
      setEventsSummary(`AI 生成失败: ${e.message || "未知错误"}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string | number) => {
    if (!window.confirm("确定要删除这条大事记吗？")) return;

    if (isDemoMode(currentUser)) {
      // NOTE: Demo 模式下直接从前端 state 中删除，同时清理 localStorage
      setEvents(prev => prev.filter(e => e.id !== eventId));
      const stored = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
      const updated = stored.filter((e: any) => e.id !== eventId);
      localStorage.setItem("demoCustomEvents", JSON.stringify(updated));
    } else {
      try {
        const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
        if (res.ok) setEvents(prev => prev.filter(e => e.id !== eventId));
      } catch (e) { console.error(e); }
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 glass-morphism px-6 py-4 flex items-center shadow-sm shrink-0 transition-colors">
        <button
          onClick={() => {
            const sc = document.querySelector('.scroll-container');
            if (sc) sc.scrollTo({ top: 0, behavior: "smooth" });
            else window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 text-[#eab308] transition-colors"
        >
          <Home size={24} />
        </button>
        <h1 className="text-xl font-bold font-display flex-1 text-center text-slate-800 transition-all">家族广场</h1>
        <button onClick={() => navigate("/profile")} className="size-10 rounded-full border-2 border-white shadow-md overflow-hidden hover:opacity-80 transition-opacity">
          <img src={userAvatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </button>
      </header>

      <main className="px-6 py-6 space-y-4">
        {/* Toggle - Made Sticky */}
        <div className="sticky top-[64px] z-40 bg-[#fdfbf7] -mx-6 px-6 pt-2 pb-2 backdrop-blur-md rounded-b-[2.5rem]">
          <div className="flex bg-slate-100/80 p-1.5 rounded-2xl gap-1 shadow-sm">
            <button onClick={() => setActiveTab("events")} className={cn("flex-1 py-3 px-4 rounded-xl text-xl font-black transition-all", activeTab === "events" ? "bg-white text-[#eab308] shadow-sm" : "text-slate-400")}>家族大事记</button>
            <button onClick={() => setActiveTab("archive")} className={cn("flex-1 py-3 px-4 rounded-xl text-xl font-black transition-all", activeTab === "archive" ? "bg-white text-[#eab308] shadow-sm" : "text-slate-400")}>记忆档案</button>
          </div>
        </div>

        {activeTab === "events" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 pt-4">
            <div className="sticky top-[132px] z-30 bg-[#fdfbf7]/90 backdrop-blur-md -mx-6 px-6 mb-6 shadow-sm border-b border-slate-100 divide-y divide-slate-100 flex flex-col">
              <div className="py-2 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <CalendarIcon className="text-[#eab308]" size={20} /> 大事记
                  <span className="text-base font-black text-slate-400 ml-1">{new Date().getFullYear()}</span>
                </h2>
                <button onClick={() => navigate("/add-event")} className="bg-[#eab308] text-white px-6 py-2 rounded-full text-lg font-black shadow-lg shadow-[#eab308]/20 flex items-center gap-2 transition-transform active:scale-95">
                  <Plus size={22} strokeWidth={4} /> 添加
                </button>
              </div>
              <div className="pb-4 pt-0">
                <div className="flex bg-slate-100/50 p-1.5 rounded-2xl gap-1">
                  {(["week", "month", "year"] as const).map(range => (
                    <button key={range} onClick={() => { setEventRange(range); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={cn("flex-1 py-2.5 rounded-xl text-sm font-black transition-all", eventRange === range ? "bg-white text-[#eab308] shadow-sm" : "text-slate-400")}>
                      {range === "week" ? "本周" : range === "month" ? "本月" : "本年"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <button
                onClick={generateEventsSummary}
                disabled={summaryLoading}
                className="w-full py-4 bg-gradient-to-r from-[#eab308]/5 to-transparent border-2 border-dashed border-[#eab308]/30 rounded-[2rem] flex items-center justify-center gap-2 text-[#eab308] font-black group hover:bg-[#eab308]/10 transition-all active:scale-[0.98]"
              >
                <Sparkles size={20} className={cn(summaryLoading && "animate-spin")} />
                {summaryLoading ? "AI 总结中..." : `本${eventRange === "week" ? "周" : eventRange === "month" ? "月" : "年"}事件总结`}
              </button>

              <AnimatePresence>
                {eventsSummary && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="mt-4 p-6 bg-amber-50 rounded-[2rem] border border-[#eab308]/20 relative"
                  >
                    <button onClick={() => setEventsSummary(null)} className="absolute top-4 right-4 text-amber-300 hover:text-amber-500"><X size={18} /></button>
                    <div className="flex gap-3">
                      <div className="size-10 rounded-full bg-white flex items-center justify-center text-[#eab308] shadow-sm shrink-0 border border-amber-100">
                        <Sparkles size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-amber-700/60 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                          AI 智能总结
                        </p>
                        <p className="text-slate-700 font-bold leading-relaxed text-sm">
                          {eventsSummary}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[...events]
                .map(event => {
                  const getDaysRemaining = (dStr: string, isRec: boolean) => {
                    if (!dStr) return 999;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const [y, m, d] = dStr.split('-').map(Number);
                    const target = new Date(y, m - 1, d);
                    if (isRec) { target.setFullYear(today.getFullYear()); if (target < today) target.setFullYear(today.getFullYear() + 1); }
                    return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86400000));
                  };
                  return { ...event, daysRemaining: getDaysRemaining(event.date, !!event.isRecurring) };
                })
                .filter(event => {
                  if (eventRange === "week") return event.daysRemaining <= 7;
                  if (eventRange === "month") return event.daysRemaining <= 31;
                  return true;
                })
                .sort((a, b) => a.daysRemaining - b.daysRemaining)
                .map(event => {
                  const linkedMember = event.memberId ? members.find(m => m.id == event.memberId) : null;
                  const linkedMembers = (event.memberIds && event.memberIds.length > 0)
                    ? members.filter(m => event.memberIds!.includes(m.id))
                    : (linkedMember ? [linkedMember] : []);

                  const displayName = linkedMembers.length > 0
                    ? (linkedMembers.length > 3 ? `${linkedMembers.slice(0, 3).map(m => m.name).join("、")}等${linkedMembers.length}人` : linkedMembers.map(m => m.name).join("、"))
                    : (event.customMemberName || null);

                  const displayTip = (event.notes || "").length > 30 ? (event.notes || "").slice(0, 28) + "..." : event.notes || "";
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
                      {/* 卡片主体 —— 不再整张可点击跳转 */}
                      <div className="p-3">
                        <div className="relative z-10 flex flex-col h-full">
                          {/* Row 1: Avatar & Name & Trash */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="flex -space-x-4">
                                {linkedMembers.length > 0 ? (
                                  linkedMembers.slice(0, 3).map((m, idx) => {
                                    const isMee = currentUser && m.id == currentUser.memberId;
                                    const mAvatar = isMee ? currentUser.avatar : m.avatarUrl;
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

                          {/* Row 2: Tag & Days Remaining */}
                          <div className="flex items-center justify-between mb-3">
                            <div className={cn("px-5 py-2 rounded-full text-lg font-black tracking-tight", eventInfo.color)}>
                              {displayName ? (event.title.replace(new RegExp(`^${displayName}(的)?`), '') || eventInfo.label) : eventInfo.label}
                            </div>
                            <div className="text-lg font-black text-[#eab308] bg-[#eab308]/5 px-5 py-2 rounded-full whitespace-nowrap">
                              {event.daysRemaining === 0 ? "今天" : `剩${event.daysRemaining}天`}
                            </div>
                          </div>

                          {/* Row 3: 日期信息（月/日/星期）+ 打电话按钮 */}
                          {event.date && (() => {
                            const [y, m, d] = event.date.split('-').map(Number);
                            const dateObj = new Date(y, m - 1, d);
                            const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
                            return (
                              <div className="flex items-center justify-between mb-3 ml-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-black text-slate-700">{m}月{d}日</span>
                                  <span className="text-lg font-bold text-slate-400">{weekdays[dateObj.getDay()]}</span>
                                </div>
                                {isOpen && (
                                  <button
                                    onClick={() => window.location.href = 'tel:10086'}
                                    className="flex items-center gap-2 px-5 py-2 bg-[#eab308]/5 text-[#eab308] rounded-full text-lg font-black shadow-sm transition-transform active:scale-95"
                                  >
                                    <Phone size={20} /> 打电话
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {displayTip && (
                            <div className="min-w-0 mb-5 ml-1">
                              <p className="text-xl text-slate-500 font-medium leading-relaxed tracking-tight line-clamp-2">{displayTip}</p>
                            </div>
                          )}

                          {/* Row 4: Action Buttons */}
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

                      {/* 内嵌祝福面板 */}
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
                })}

              <Card
                className="p-10 border-4 border-dashed border-slate-100 bg-slate-50/30 rounded-[3rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white hover:border-[#eab308]/30 hover:shadow-xl transition-all group"
                onClick={() => navigate("/add-event")}
              >
                <div className="size-20 rounded-full bg-white shadow-md flex items-center justify-center text-[#eab308] group-hover:scale-110 transition-transform">
                  <Plus size={48} strokeWidth={4} />
                </div>
                <span className="text-3xl font-black text-slate-300 group-hover:text-[#eab308] transition-colors">添加家族大事记</span>
              </Card>
            </div>
          </section>
        )}

        {activeTab === "archive" && (
          <section id="archive-section" className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 pt-4">
            <div className="sticky top-[132px] z-30 bg-[#fdfbf7]/90 backdrop-blur-md -mx-6 px-6 mb-6 shadow-sm border-b border-slate-100 flex flex-col">
              <div className="py-2 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FolderOpen className="text-[#eab308]" size={20} /> 家族亲人
                </h2>
                <button onClick={() => navigate("/add-member")} className="bg-[#eab308] text-white px-6 py-2 rounded-full text-lg font-black shadow-lg shadow-[#eab308]/20 flex items-center gap-2 transition-transform active:scale-95">
                  <Plus size={22} strokeWidth={4} /> 添加家人
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {members.map(member => (
                <Card
                  key={member.id}
                  className="p-4 border-none shadow-xl shadow-slate-200/40 bg-white rounded-[2.5rem] cursor-pointer hover:shadow-2xl transition-all group overflow-hidden relative"
                  onClick={() => navigate(`/archive/${member.id}`)}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><FolderOpen size={80} /></div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="size-24 rounded-full border-4 border-white shadow-lg overflow-hidden mb-4 group-hover:scale-105 transition-transform relative">
                      {/* 核心增强：双重校验身份，确保头像同步 */}
                      <img
                        src={(currentUser && (
                          (member.id && currentUser.memberId && String(member.id) === String(currentUser.memberId)) ||
                          (member.userId && currentUser.id && String(member.userId) === String(currentUser.id)) ||
                          (member.name === currentUser.name && member.isRegistered)
                        )) ? getSafeAvatar(currentUser.avatar) : getSafeAvatar(member.avatarUrl)}
                        alt={member.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />

                      {/* “我” 标识 */}
                      {(currentUser && (
                        (member.id && currentUser.memberId && String(member.id) === String(currentUser.memberId)) ||
                        (member.userId && currentUser.id && String(member.userId) === String(currentUser.id)) ||
                        (member.name === currentUser.name && member.isRegistered)
                      )) && (
                          <div className="absolute bottom-0 right-0 bg-[#eab308] text-black text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-sm z-20">
                            我
                          </div>
                        )}

                      {member.isRegistered && !(currentUser && (
                        (member.id && currentUser.memberId && String(member.id) === String(currentUser.memberId)) ||
                        (member.userId && currentUser.id && String(member.userId) === String(currentUser.id)) ||
                        (member.name === currentUser.name && member.isRegistered)
                      )) && (
                          <div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                            <CheckCircle size={14} fill="currentColor" className="text-white" />
                          </div>
                        )}
                    </div>
                    <div className="flex flex-col items-center gap-1.5 mb-2">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-3xl font-black text-slate-800">
                          {(currentUser && (
                            (member.id && currentUser.memberId && String(member.id) === String(currentUser.memberId)) ||
                            (member.userId && currentUser.id && String(member.userId) === String(currentUser.id))
                          )) ? currentUser.name : member.name}
                        </h3>
                      </div>
                    </div>
                    <p className="text-lg text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
                      {getRigorousRelationship(currentUser, member, members)}
                    </p>
                  </div>
                </Card>
              ))}

              <Card className="p-6 border-4 border-dashed border-slate-100 bg-slate-50/30 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white hover:border-[#eab308]/30 hover:shadow-xl transition-all group min-h-[240px]" onClick={() => navigate("/add-member")}>
                <div className="size-16 rounded-full bg-white shadow-md flex items-center justify-center text-[#eab308] group-hover:scale-110 transition-transform"><Plus size={36} strokeWidth={4} /></div>
                <span className="text-xl font-black text-slate-300 group-hover:text-[#eab308] transition-colors">添加家人</span>
              </Card>
            </div>


          </section>
        )}
      </main>
      {/* Invitation Modal */}
      <AnimatePresence>
        {invitingMember && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative overflow-hidden"
            >
              <button onClick={() => setInvitingMember(null)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400"><X size={20} /></button>

              <div className="text-center space-y-6">
                <div className="size-24 rounded-full border-4 border-[#eab308]/20 p-1 mx-auto">
                  <img src={invitingMember.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800">邀请 {invitingMember.name} 加入</h3>
                  <p className="text-sm text-slate-500">{invitingMember.name} 尚未注册账号，您可以分享邀请码让她加入家族。</p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">专属邀请码</p>
                  <p className="text-4xl font-black text-[#eab308] tracking-wider mb-2">
                    INV-{invitingMember.id}-{currentUser?.memberId}
                  </p>
                  <p className="text-[10px] text-slate-400 line-clamp-2">此码包含了您与 {invitingMember.name} 的关联信息，注册时系统将自动排布辈分。</p>
                </div>

                <button
                  onClick={() => {
                    const code = `INV-${invitingMember.id}-${currentUser?.memberId}`;
                    navigator.clipboard.writeText(code).then(() => alert("邀请码已复制"));
                  }}
                  className="w-full py-4 bg-[#eab308] text-black rounded-2xl font-black shadow-lg shadow-[#eab308]/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Share2 size={18} /> 复制并去发送
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
