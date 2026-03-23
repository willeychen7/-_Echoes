import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./components/Card";
import { Calendar as CalendarIcon, Phone, Gift, Plus, FolderOpen, Home, CheckCircle, Trash2, Mic, MessageSquare, Camera, Video, Send, X, Heart, Play, Sparkles, ChevronDown, ChevronUp, Share2, Copy, PawPrint, Clock, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { FamilyMember, FamilyEvent, Message, MessageType } from "./types";
import { useNavigate, useLocation } from "react-router-dom";
import { cn, getRelativeTime } from "./lib/utils";
import { getRigorousRelationship, getRelationType, getKinshipLabel } from "./lib/relationships";
import confetti from "canvas-confetti";
import { DEMO_MEMBERS, DEMO_EVENTS, DEMO_DEFAULT_USER, isDemoMode } from "./demo-data";
import { supabase } from "./lib/supabase";
import { DEFAULT_AVATAR, getSafeAvatar } from "./constants";
import { AudioBar, WallMessages, InlineBlessingPanel } from "./components/FamilyEvents";
import { updateAvatarCache } from "./lib/useAvatarCache";
import { createKinshipSearchFilter, generateSmartLayout } from "./lib/kinshipEngine";
import { FamilyMapView } from "./FamilyMapView";
import { BigCalendar } from "./components/BigCalendar";
import { VoiceAssistant } from "./components/VoiceAssistant";
import { BottomNav } from "./components/BottomNav";
import { getLunarDay, getZodiac, formatEventDate } from "./lib/calendarUtils";



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
        <button
          onClick={() => navigate("/family-tree")}
          className="size-11 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#eab308] hover:border-[#eab308]/20 transition-all active:scale-90 shadow-sm shrink-0"
        >
          <Users size={20} />
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
  const [activeTab, setActiveTab] = useState<"events" | "archive">("archive");
  const [archiveView, setArchiveView] = useState<"list" | "map">("list");
  const [eventRange, setEventRange] = useState<"today" | "week" | "month" | "year">("today");
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  // NOTE: 记录当前展开祝福面板的事件 ID，null 表示全部收起
  const [openBlessingEventId, setOpenBlessingEventId] = useState<number | null>(null);
  const [invitingMember, setInvitingMember] = useState<FamilyMember | null>(null);
  const [eventsSummary, setEventsSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sentEventIds, setSentEventIds] = useState<number[]>([]);
  const [expandedNoteIds, setExpandedNoteIds] = useState<number[]>([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [homeMode, setHomeMode] = useState<"normal" | "gallery" | "voice">("normal");

  useEffect(() => {
    // 🚀 核心：监听同步事件，实时刷新定制首页模式
    const syncMode = () => {
        const saved = localStorage.getItem("currentUser");
        const parsed = saved ? JSON.parse(saved) : null;
        if (parsed?.homeMode) {
            setHomeMode(parsed.homeMode);
        }
    };
    syncMode();
    window.addEventListener("sync-user", syncMode);
    return () => window.removeEventListener("sync-user", syncMode);
  }, []);

  const onHomeClick = () => {
    navigate("/");
  };
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
      const modeParsed = currentParsed || parsed;

      if (currentParsed) {
        setCurrentUser(currentParsed);
        setUserAvatar(getSafeAvatar(currentParsed.avatar));
      } else {
        setCurrentUser(DEMO_DEFAULT_USER);
        setUserAvatar(getSafeAvatar(DEMO_DEFAULT_USER.avatar));
      }

      if (isDemoMode(modeParsed)) {
        const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
        const allDemoMembers = [...DEMO_MEMBERS, ...customMembers];
        setMembers(allDemoMembers);
        const customEvents = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
        setEvents([...DEMO_EVENTS, ...customEvents]);
      } else if (modeParsed && modeParsed.familyId) {
        const familyId = parseInt(String(modeParsed.familyId));
        fetch(`/api/family-members?familyId=${familyId}`).then(res => res.json()).then(data => {
          if (Array.isArray(data)) {
            // Keep all members in state for relationship logic and tree integrity
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
            event: '*', // 监听所有变动 (INSERT/UPDATE/DELETE)
            schema: 'public',
            table: 'family_members',
            filter: `family_id=eq.${parsed.familyId}`
          },
          (payload) => {
            console.log('[REALTIME] Family member change:', payload.eventType, payload.new);

            if (payload.eventType === 'INSERT') {
              const newcomer = payload.new as any;
              // 过滤虚拟人物 (同步 loadUser 逻辑)
              const type = newcomer.member_type || newcomer.memberType;
              const name = newcomer.name || "";
              const virtualKeywords = ["的父亲", "的母亲", "的孩子", "的子女", "的兄弟姐妹", "的哥哥", "的姐姐", "的弟弟", "的妹妹", "的爷爷", "的奶奶", "的外公", "的外婆", "的曾祖", "的高祖"];
              const IS_VIRTUAL = type === 'virtual' || virtualKeywords.some(k => name.includes(k));
              if (!IS_VIRTUAL) {
                setMembers(prev => [...prev, newcomer]);
              }
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as any;
              setMembers(prev => prev.map(m =>
                m.id === updated.id
                  ? { ...m, ...updated, avatarUrl: updated.avatar_url, name: updated.name }
                  : m
              ));
              if (updated.id === parsed.memberId) {
                const freshUser = { ...parsed, avatar: updated.avatar_url, name: updated.name };
                localStorage.setItem("currentUser", JSON.stringify(freshUser));
                setCurrentUser(freshUser);
                setUserAvatar(updated.avatar_url);
              }
            } else if (payload.eventType === 'DELETE') {
              setMembers(prev => prev.filter(m => m.id !== payload.old.id));
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
    if (location.hash.startsWith("#archive")) {
      setActiveTab("archive");
      if (location.hash === "#archive-map") setArchiveView("map");
      else setArchiveView("list");
      setTimeout(() => document.getElementById("archive-section")?.scrollIntoView({ behavior: "smooth" }), 100);
    } else {
      setActiveTab("archive");
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
        const targetDate = formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay);
        if (eventRange === "today" || eventRange === "week") {
          if (eventRange === "today") return event.date === targetDate || (event.isRecurring && event.date.endsWith(`-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`));
          return event.daysRemaining <= 7;
        }
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

      <main className="px-6 pt-6 pb-32 space-y-4">
        {/* Toggle - Made Sticky */}
        <div className="sticky top-[64px] z-40 bg-[#fdfbf7] -mx-6 px-6 pt-2 pb-2 backdrop-blur-md rounded-b-[2.5rem]">
          <div className="flex bg-slate-100/80 p-1.5 rounded-2xl gap-1 shadow-sm">
            <button onClick={() => setActiveTab("archive")} className={cn("flex-1 py-3 px-4 rounded-xl text-xl font-black transition-all", activeTab === "archive" ? "bg-white text-[#eab308] shadow-sm" : "text-slate-400")}>记忆档案</button>
            <button onClick={() => setActiveTab("events")} className={cn("flex-1 py-3 px-4 rounded-xl text-xl font-black transition-all", activeTab === "events" ? "bg-white text-[#eab308] shadow-sm" : "text-slate-400")}>家族日历</button>
          </div>
        </div>

        {activeTab === "events" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-32 pt-4">
            <div className="bg-[#fdfbf7] -mx-6 px-6 mb-6 flex flex-col">
              <div className="py-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <CalendarIcon className="text-[#eab308]" size={20} /> 大事记
                    <span className="text-base font-black text-slate-400 ml-1">{new Date().getFullYear()}</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsVoiceAssistantOpen(true)}
                      className="size-9 rounded-full bg-amber-50 text-[#eab308] flex items-center justify-center transition-all active:scale-95 hover:bg-amber-100"
                    >
                      <Mic size={18} strokeWidth={3} />
                    </button>
                    <button onClick={() => navigate("/add-event")} className="bg-[#eab308] text-white px-4 py-2 rounded-full text-base font-black shadow-lg shadow-[#eab308]/20 flex items-center gap-1.5 transition-transform active:scale-95">
                      <Plus size={18} strokeWidth={4} /> 添加
                    </button>
                  </div>
                </div>
                

                <div className="flex bg-slate-100/50 p-1.5 rounded-2xl gap-1">
                  {(["today", "month", "year"] as const).map(range => (
                    <button 
                      key={range} 
                      onClick={() => { setEventRange(range as any); window.scrollTo({ top: 0, behavior: "smooth" }); }} 
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center", 
                        (eventRange === range) ? "bg-white text-[#eab308] shadow-sm" : "text-slate-400"
                      )}
                    >
                      {range === "today" ? "本日" : range === "month" ? "本月" : "本年"}
                    </button>
                  ))}
                </div>

                {/* AI 总结按钮 - 已上挪且支持动态显隐 */}
                {(() => {
                   const hasEventsInRange = events.some(event => {
                      if (eventRange === "today") {
                         const targetDate = formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay);
                         return event.date === targetDate || (event.isRecurring && event.date.endsWith(`-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`));
                      }
                      if (eventRange === "month") {
                         const [, em] = event.date.split("-").map(Number);
                         return em === (calendarDate.getMonth() + 1);
                      }
                      return true;
                   });

                   if (!hasEventsInRange) return null;

                   return (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                        <button
                          onClick={generateEventsSummary}
                          disabled={summaryLoading}
                          className="w-full py-3 bg-gradient-to-r from-[#eab308]/5 to-transparent border-2 border-dashed border-[#eab308]/20 rounded-2xl flex items-center justify-center gap-2 text-[#eab308] font-black group hover:bg-[#eab308]/10 transition-all active:scale-[0.98] text-xs"
                        >
                          <Sparkles size={16} className={cn(summaryLoading && "animate-spin")} />
                          {summaryLoading ? "AI 总结中..." : `本${eventRange === "today" ? "日" : eventRange === "month" ? "月" : "年"}大事记 AI 智能总结`}
                        </button>

                        <AnimatePresence>
                          {eventsSummary && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="mt-4 p-5 bg-amber-50/50 rounded-3xl border border-[#eab308]/10 relative backdrop-blur-sm"
                            >
                              <button onClick={() => setEventsSummary(null)} className="absolute top-4 right-4 text-amber-300 hover:text-amber-500"><X size={16} /></button>
                              <div className="flex gap-3">
                                <div className="size-8 rounded-full bg-white flex items-center justify-center text-[#eab308] shadow-sm shrink-0 border border-amber-100">
                                  <Sparkles size={16} />
                                </div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-black text-amber-700/60 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    AI 智能总结
                                  </p>
                                  <p className="text-slate-700 font-bold leading-relaxed text-xs">
                                    {eventsSummary}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                   );
                })()}
              </div>
              
              {/* === 📅 空状态引导 - 已挪至黄历上方 === */}
              {eventRange === "today" && (() => {
                const targetDate = formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay);
                const todayEvents = events.filter(e => e.date === targetDate || (e.isRecurring && e.date.endsWith(`-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`)));
                if (todayEvents.length === 0) {
                  return (
                    <div className="mb-4 px-1 animate-in fade-in slide-in-from-bottom-1">
                      <button 
                        onClick={() => navigate("/add-event", { state: { initialDate: targetDate } })}
                        className="w-full bg-white/60 backdrop-blur-sm rounded-3xl p-4 border border-[#eab308]/10 flex items-center justify-between group active:scale-[0.98] transition-all shadow-sm"
                      >
                        <div className="flex items-center px-1">
                           <p className="text-slate-400 font-black text-sm">今天还没有记录哦～</p>
                        </div>
                        <div className="size-9 rounded-xl bg-slate-100 text-[#eab308] flex items-center justify-center group-hover:bg-[#eab308] group-hover:text-white transition-all">
                          <Plus size={18} strokeWidth={4} />
                        </div>
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* === 📅 精炼时光视界 (非适老化，标准模式) === */}
              {eventRange === "today" && (() => {
                const year = calendarDate.getFullYear();
                const month = calendarDate.getMonth() + 1;
                const { lunar, festival } = getLunarDay(year, month, selectedDay);
                const dateObj = new Date(year, month - 1, selectedDay);
                const weekDayStr = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][dateObj.getDay()];
                const handlePrevDay = () => { const d = new Date(year, month - 1, selectedDay - 1); setCalendarDate(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDay(d.getDate()); };
                const handleNextDay = () => { const d = new Date(year, month - 1, selectedDay + 1); setCalendarDate(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDay(d.getDate()); };

                return (
                  <div className="mb-6 px-1">
                    <div className="bg-white rounded-[2.5rem] border-4 border-white shadow-xl relative overflow-hidden group">
                      {/* Top Tear Edge Pattern */}
                      <div className="absolute top-0 inset-x-0 h-1.5 flex gap-1 px-1 opacity-20">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={i} className="flex-1 h-full bg-slate-200 rounded-b-full" />
                        ))}
                      </div>

                      <div className="p-6 flex flex-col items-center">
                        {/* Status Header */}
                        <div className="w-full flex justify-between items-center mb-4">
                          <button onClick={handlePrevDay} className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"><ChevronLeft size={24} /></button>
                          <div className="flex flex-col items-center">
                            <span className="text-base font-black text-emerald-600 tracking-tight font-mono">{year}年 {month}月</span>
                          </div>
                          <button onClick={handleNextDay} className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"><ChevronRight size={24} /></button>
                        </div>

                        {/* Central Day Number & Weekday */}
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
                            <div className="mt-6 flex flex-col items-center gap-1 scale-110">
                              <span className="text-3xl font-black text-rose-500 tracking-tighter drop-shadow-sm">{festival}</span>
                              <div className="h-1 w-12 bg-rose-500 rounded-full opacity-30" />
                            </div>
                          )}
                        </div>

                        {/* Lunar Footer */}
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

              {eventRange === "month" && (
                <div className="mb-6">
                  <div className="bg-white/40 rounded-3xl border border-slate-100 p-4 shadow-sm">
                    <BigCalendar 
                      events={events}
                      members={members}
                      selectedDay={selectedDay}
                      onSelectDay={(day) => { 
                        setSelectedDay(day); 
                        // 自动滚动到对应卡片或空状态
                        setTimeout(() => {
                           const element = document.getElementById(`event-card-${day}`);
                           if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                           } else {
                              const listTop = document.getElementById('event-list-top');
                              if (listTop) {
                                 listTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                           }
                        }, 100);
                      }}
                      currentDate={calendarDate}
                      onMonthChange={setCalendarDate}
                      currentUserId={currentUser.id}
                    />
                  </div>
                </div>
              )}

              {eventRange === "year" && (
                <div className="mb-6 px-1">
                  <div className="bg-white/60 rounded-3xl border border-amber-100/50 p-8 flex flex-col items-center shadow-sm backdrop-blur-sm">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em] mb-1">年度大事记</p>
                    <p className="text-2xl font-black text-slate-800 tracking-tighter">{calendarDate.getFullYear()}</p>
                  </div>
                </div>
              )}

            </div>

            <div id="event-list-top" className="grid grid-cols-1 gap-4">
              {(() => {
                const filteredEvents = [...events]
                  .map(event => {
                    const getDaysRemaining = (dStr: string, isRec: boolean) => {
                      if (!dStr) return 999;
                      const today = new Date(); today.setHours(0, 0, 0, 0);
                      const [y, m, d] = dStr.split('-').map(Number);
                      const target = new Date(y, m - 1, d);
                      if (isRec) { target.setFullYear(today.getFullYear()); if (target < today) target.setFullYear(today.getFullYear() + 1); }
                      return Math.floor((target.getTime() - today.getTime()) / 86400000);
                    };
                    return { ...event, daysRemaining: getDaysRemaining(event.date, !!event.isRecurring) };
                  })
                  .filter(event => {
                    if (eventRange === "today") {
                      const targetDate = formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay);
                      return event.date === targetDate || (event.isRecurring && event.date.endsWith(`-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`));
                    }
                    if (eventRange === "month") {
                      const [ey, em, ed] = event.date.split("-").map(Number);
                      return em === (calendarDate.getMonth() + 1);
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    if (eventRange === "year") return b.daysRemaining - a.daysRemaining;
                    return a.daysRemaining - b.daysRemaining;
                  });

                if (filteredEvents.length === 0) {
                  return eventRange === "today" ? null : (
                    <div className="py-20 flex flex-col items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-2">
                       <p className="text-sm font-black text-slate-300">今天还没有记录哦，快来记一笔吧！</p>
                       <button
                          onClick={() => navigate("/add-event", { state: { initialDate: formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay) } })}
                          className="px-8 py-4 bg-[#eab308] text-black font-black rounded-2xl shadow-xl shadow-[#eab308]/20 flex items-center gap-2 active:scale-95 transition-all"
                       >
                          <Plus size={20} />
                          添加家族大事记
                       </button>
                    </div>
                  );
                }

                return filteredEvents.map(event => {
                  const linkedMember = event.memberId ? members.find(m => m.id == event.memberId) : null;
                  const linkedMembers = (event.memberIds && event.memberIds.length > 0)
                    ? members.filter(m => event.memberIds!.includes(m.id))
                    : (linkedMember ? [linkedMember] : []);

                  const displayName = linkedMembers.length > 0
                    ? (linkedMembers.length > 3 ? `${linkedMembers.slice(0, 3).map(m => m.name).join("、")}等${linkedMembers.length}人` : linkedMembers.map(m => m.name).join("、"))
                    : (event.customMemberName || null);

                  const fullNotes = event.notes || "";
                  const isNoteTooLong = fullNotes.length > 40;
                  const isNoteExpanded = expandedNoteIds.includes(Number(event.id));
                  const displayTip = (isNoteTooLong && !isNoteExpanded) ? fullNotes.slice(0, 38) + "..." : fullNotes;
                  const eventInfo = (() => {
                    if (event.type === "birthday") return { label: "生日", color: "bg-pink-50 text-pink-500" };
                    if (event.type === "graduation") return { label: "毕业礼", color: "bg-blue-50 text-blue-500" };
                    if (event.title.includes("纪念日") || event.type === "anniversary") return { label: "纪念日", color: "bg-amber-50 text-amber-500" };
                    return { label: "大事记", color: "bg-emerald-50 text-emerald-500" };
                  })();
                  const isOpen = openBlessingEventId === event.id;

                  return (
                    <div key={event.id} id={`event-card-${event.date.split("-")[2]}`} className={cn("rounded-[2rem] overflow-hidden shadow-xl bg-white border border-slate-50 relative pb-2 transition-all hover:scale-[1.01]", isOpen && "ring-4 ring-[#eab308]/20 shadow-[#eab308]/10")}>
                      <div className="p-5">
                        <div className="flex flex-col h-full gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 min-w-0">
                               <div className="flex -space-x-4">
                                  {linkedMembers.length > 0 ? (
                                    linkedMembers.slice(0, 3).map((m, idx) => (
                                      <div key={m.id} className="size-14 rounded-full border-4 border-white shadow-lg overflow-hidden shrink-0 bg-slate-50 relative z-10" style={{ transform: `scale(${1 - idx * 0.1})` }}>
                                        <img src={getSafeAvatar(m.avatarUrl)} alt="" className="w-full h-full object-cover" />
                                      </div>
                                    ))
                                  ) : (
                                     <div className="size-14 rounded-full bg-slate-100 flex items-center justify-center text-[#eab308] border-2 border-white">
                                        <span className="text-xl font-black">{displayName?.charAt(0) || "?"}</span>
                                     </div>
                                  )}
                               </div>
                               <div className="min-w-0 overflow-hidden">
                                  <h3 className="text-lg font-black text-slate-800 tracking-tight truncate leading-tight mb-1">{event.title}</h3>
                                  <div className="flex items-center gap-2 text-slate-400 font-bold">
                                     <span className="text-[10px] tracking-wide">{event.date}</span>
                                  </div>
                               </div>
                            </div>
                            <button onClick={() => handleDeleteEvent(event.id)} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 hover:text-red-500 transition-all">
                               <Trash2 size={20} />
                            </button>
                          </div>

                          {/* Detail Info Bar */}
                          <div className="flex items-center justify-between border-y border-slate-50 py-3">
                             <div className={cn("flex items-center gap-2 px-4 py-2 rounded-full font-black text-xs", eventInfo.color)}>
                                <Sparkles size={14} />
                                {eventInfo.label}
                             </div>
                             {event.daysRemaining !== undefined && (
                                <div className="text-right">
                                   <div className="flex items-baseline gap-1">
                                      {event.daysRemaining === 0 ? (
                                        <span className="text-2xl font-black italic text-rose-500">今天</span>
                                      ) : event.daysRemaining < 0 ? (
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">已结束</span>
                                      ) : (
                                        <>
                                          <span className="text-2xl font-black italic text-[#eab308]">{event.daysRemaining}</span>
                                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">天后</span>
                                        </>
                                      )}
                                   </div>
                                </div>
                             )}
                          </div>

                          {/* Notes */}
                          {displayTip && (
                            <div className="bg-[#fdfbf7] p-4 rounded-[1.5rem] border border-amber-50/50">
                              <p className="text-sm font-bold text-slate-700 leading-relaxed tracking-tight italic">
                                “ {displayTip} ”
                              </p>
                              {isNoteTooLong && (
                                <button
                                  onClick={() => setExpandedNoteIds(prev => prev.includes(Number(event.id)) ? prev.filter(id => id !== Number(event.id)) : [...prev, Number(event.id)])}
                                  className="text-[10px] font-black text-[#eab308] mt-2 uppercase tracking-widest underline decoration-wavy"
                                >
                                  {isNoteExpanded ? "收起家族记忆" : "阅读完整记忆"}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Reminder Badges */}
                          <div className="flex flex-col gap-2">
                             <div className="flex flex-wrap gap-1.5">
                                {(event.reminderFrequency?.length || 0) > 0 && event.reminderFrequency?.map(f => (
                                   <div key={f} className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-[10px] font-black shadow-sm">
                                      <Clock size={10} strokeWidth={3} />
                                      {f === "year" ? "每年" : f === "month" ? "每月" : "每周"}
                                   </div>
                                ))}
                             </div>

                             {/* Action Buttons */}
                             <div className="flex gap-3 pt-3 border-t border-slate-50">
                                {(!isOpen && !sentEventIds.includes(event.id)) && (
                                  <>
                                    <button
                                      onClick={() => setOpenBlessingEventId(event.id)}
                                      className="flex-1 h-14 rounded-2xl text-lg font-black flex items-center justify-center transition-all active:scale-95 gap-2 bg-[#eab308] text-black shadow-lg shadow-[#eab308]/20"
                                    >
                                      <Gift size={22} />
                                      送出祝福
                                    </button>
                                    <button
                                      className="size-14 rounded-2xl bg-[#eab308]/5 text-[#eab308] flex items-center justify-center shadow-sm active:scale-95 transition-all shrink-0"
                                    >
                                      <Phone size={24} />
                                    </button>
                                  </>
                                )}
                             </div>
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
                });
              })()}

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
          <section id="archive-section" className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-32 pt-4">
            <div className="sticky top-[132px] z-30 bg-[#fdfbf7]/90 backdrop-blur-md -mx-6 px-6 mb-6 shadow-sm border-b border-slate-100 flex flex-col">
              <div className="py-2 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FolderOpen className="text-[#eab308]" size={20} /> <span className="mr-2">家族亲人</span>

                  <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner gap-1">
                    <button
                      onClick={() => setArchiveView("list")}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        archiveView === "list" ? "bg-white text-[#eab308] shadow-sm transform scale-105" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </button>
                    <button
                      onClick={() => setArchiveView("map")}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        archiveView === "map" ? "bg-white text-[#eab308] shadow-sm transform scale-105" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                    </button>
                  </div>
                </h2>
                <button onClick={() => navigate("/add-member")} className="bg-[#eab308] text-white px-4 md:px-6 py-2 rounded-full text-base md:text-lg font-black shadow-lg shadow-[#eab308]/20 flex items-center gap-1.5 transition-transform active:scale-95">
                  <Plus size={20} strokeWidth={4} /> 添加
                </button>
              </div>
              <div className="pb-4 pt-2">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                  <input
                    type="text"
                    placeholder="智能搜索名字或名分称谓 (如: 堂三叔、舅公)..."
                    className="w-full h-12 pl-12 pr-4 bg-white border border-slate-100 rounded-2xl font-bold placeholder:text-slate-300 shadow-sm focus:ring-2 focus:ring-[#eab308]/20 outline-none"
                    value={archiveSearchQuery}
                    onChange={(e) => setArchiveSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {archiveView === "map" ? (
              <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
                {/* 💡 核心：全家福地图渲染，传递闭包内完整的 members 以保证血脉路径完整 */}
                <FamilyMapView members={members.filter(createKinshipSearchFilter(archiveSearchQuery))} />
              </div>
            ) : (
              <div className="space-y-10">
                {(() => {
                  // 🚀 核心纠偏：优先从档案列表中通过 userId 找到当前用户自己的完整节点，确保获取其 logicTag 坐标
                  const meNode = members.find(m =>
                    (m.userId && currentUser?.id && String(m.userId) === String(currentUser.id)) ||
                    (m.id && currentUser?.memberId && String(m.id) === String(currentUser.memberId))
                  ) || currentUser;

                  const searchFilter = createKinshipSearchFilter(archiveSearchQuery);
                  // 🚀 核心纠偏：遵照用户定义，区分“真实档案”与“系统节点”
                  // 真实档案 = (已注册用户) OR (由人类主动创建的 persona 档案，存在 archive_memory_creators 记录)
                  const isRealMember = (m: any) => {
                    const isRegistered = m.is_registered || m.isRegistered;
                    const hasExplicitCreator = !!m.createdByMemberId; // 该字段由 /api/family-members 通过 creator table 拍平得到
                    const isPlaceholder = m.is_placeholder || m.isPlaceholder;

                    // 1. 注册用户（本尊）永远显示
                    if (isRegistered || (m.id >= 1000 && m.id < 2000)) return true;
                    // 2. 占位坑位（辅助节点）永远隐藏
                    if (isPlaceholder) return false;
                    // 3. 核心：只有在 archive_memory_creators 表中有记录的，才是用户真正录入的“档案人”
                    return hasExplicitCreator;
                  };

                  // 定义内部统一渲染函数
                  const renderMemberCard = (member: FamilyMember) => {
                    const rel = getRigorousRelationship(meNode, member, members);
                    const label = getKinshipLabel(meNode, member, members);
                    const isMe = currentUser && (
                      (member.id && currentUser.memberId && String(member.id) === String(currentUser.memberId)) ||
                      (member.userId && currentUser.id && String(member.userId) === String(currentUser.id))
                    );

                    return (
                      <Card
                        key={member.id}
                        className="p-4 border-none shadow-xl shadow-slate-200/40 bg-white rounded-[2.5rem] cursor-pointer hover:shadow-2xl transition-all group overflow-hidden relative"
                        onClick={() => navigate(`/archive/${member.id}`)}
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><FolderOpen size={80} /></div>
                        {label && (
                          <div className={cn(
                            "absolute top-4 left-4 text-[10px] font-black px-2 py-0.5 rounded-full border z-10",
                            label.includes("外") || label.includes("母")
                              ? "bg-purple-50 text-purple-400 border-purple-100"
                              : label.includes("姻")
                                ? "bg-amber-50 text-amber-600 border-amber-100"
                                : "bg-slate-900/5 text-slate-400 border-slate-100"
                          )}>
                            {label}
                          </div>
                        )}
                        <div className="relative z-10 flex flex-col items-center">
                          <div className="size-24 rounded-full border-4 border-white shadow-lg overflow-hidden mb-4 group-hover:scale-105 transition-transform relative">
                            <img
                              src={isMe ? getSafeAvatar(currentUser.avatar) : getSafeAvatar(member.avatarUrl)}
                              alt={member.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {isMe && (
                              <div className="absolute bottom-0 right-0 bg-[#eab308] text-black text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-sm z-20">
                                我
                              </div>
                            )}
                            {member.isRegistered && !isMe && (
                              <div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                                <CheckCircle size={14} fill="currentColor" className="text-white" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-1.5 mb-2 px-1 text-center">
                            <h3 className="text-2xl font-black text-black leading-tight flex items-center justify-center gap-2">
                              {isMe ? currentUser.name : member.name}
                              {member.ancestralHall && (
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">
                                  {member.ancestralHall}
                                </span>
                              )}
                            </h3>
                          </div>
                          <p className={cn(
                            "text-base font-bold uppercase tracking-widest leading-none mt-1",
                            (rel.includes("母") || (rel.includes("外") && !rel.includes("曾")) || rel.includes("姨") || rel.includes("舅"))
                              ? "text-purple-600"
                              : "text-slate-900"
                          )}>
                            {rel}
                          </p>
                        </div>
                      </Card>
                    );
                  };

                  const allReal = members.filter(isRealMember).filter(searchFilter);

                  return (
                    <>
                      {/* 1. 本家至亲 */}
                      {(() => {
                        const direct = allReal.filter(m => getKinshipLabel(meNode, m, members) === "【至亲】");
                        if (direct.length === 0) return null;
                        return (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-black text-[#eab308] uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                              <div className="size-1.5 bg-[#eab308] rounded-full animate-pulse" /> 本家至亲
                            </h3>
                            <div className="grid grid-cols-2 gap-4">{direct.map(renderMemberCard)}</div>
                          </div>
                        );
                      })()}

                      {/* 2. 家族宗亲 */}
                      {(() => {
                        const paternal = allReal.filter(m => getKinshipLabel(meNode, m, members)?.startsWith("【宗亲】"));
                        if (paternal.length === 0) return null;
                        return (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                              <div className="size-1.5 bg-slate-300 rounded-full" /> 家族宗亲
                            </h3>
                            <div className="grid grid-cols-2 gap-4">{paternal.map(renderMemberCard)}</div>
                          </div>
                        );
                      })()}

                      {/* 3. 家族外戚 */}
                      {(() => {
                        const maternal = allReal.filter(m => getKinshipLabel(meNode, m, members)?.startsWith("【外戚】"));
                        if (maternal.length === 0) return null;
                        return (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-black text-purple-400/60 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                              <div className="size-1.5 bg-purple-300 rounded-full" /> 家族外戚
                            </h3>
                            <div className="grid grid-cols-2 gap-4">{maternal.map(renderMemberCard)}</div>
                          </div>
                        );
                      })()}

                      {/* 4. 家族姻亲 */}
                      {(() => {
                        const affinal = allReal.filter(m => getKinshipLabel(meNode, m, members)?.startsWith("【姻】"));
                        if (affinal.length === 0) return null;
                        return (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-black text-amber-700/40 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                              <div className="size-1.5 bg-amber-200 rounded-full" /> 家族姻亲
                            </h3>
                            <div className="grid grid-cols-2 gap-4">{affinal.map(renderMemberCard)}</div>
                          </div>
                        );
                      })()}


                      {/* 5. 社会关系 (朋友) */}
                      {(() => {
                        const friends = allReal.filter(m => {
                          const label = getKinshipLabel(meNode, m, members) || "";
                          return label.startsWith("【友】") || m.kinshipType === 'social' || m.kinship_type === 'social';
                        });
                        if (friends.length === 0) return null;
                        return (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-black text-blue-400/80 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                              <div className="size-1.5 bg-blue-300 rounded-full" /> 社会关系
                            </h3>
                            <div className="grid grid-cols-2 gap-4">{friends.map(renderMemberCard)}</div>
                          </div>
                        );
                      })()}

                      {/* 6. 家族伙伴 (宠物) */}
                      {(() => {
                        const pets = allReal.filter(m => {
                          const label = getKinshipLabel(meNode, m, members) || "";
                          return label.startsWith("【宠】") || m.memberType === 'pet' || m.member_type === 'pet';
                        });
                        if (pets.length === 0) return null;
                        return (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-black text-amber-500/80 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                              <PawPrint size={14} className="text-amber-400" /> 家族伙伴
                            </h3>
                            <div className="grid grid-cols-2 gap-4">{pets.map(renderMemberCard)}</div>
                          </div>
                        );
                      })()}

                      {/* 7. 其他档案 (兜底) */}
                      {(() => {
                        const others = allReal.filter(m => {
                          const label = getKinshipLabel(meNode, m, members) || "";
                          const isKnown = ["【至亲】", "【宗亲】", "【外戚】", "【姻】", "【友】", "【宠】"].some(p => label.startsWith(p));
                          const isMe = currentUser && (
                            (m.id && currentUser.memberId && String(m.id) === String(currentUser.memberId)) ||
                            (m.userId && currentUser.id && String(m.userId) === String(currentUser.id))
                          );
                          return !isMe && !isKnown;
                        });
                        if (others.length === 0) return null;
                        return (
                          <div className="space-y-4 mb-8">
                            <h3 className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                              <div className="size-1.5 bg-slate-200 rounded-full" /> 家族普亲
                            </h3>
                            <div className="grid grid-cols-2 gap-4">{others.map(renderMemberCard)}</div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}

                <Card className="p-6 border-4 border-dashed border-slate-100 bg-slate-50/30 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white hover:border-[#eab308]/30 hover:shadow-xl transition-all group min-h-[100px]" onClick={() => navigate("/add-member")}>
                  <div className="size-10 rounded-full bg-white shadow-md flex items-center justify-center text-[#eab308] group-hover:scale-110 transition-transform"><Plus size={20} strokeWidth={4} /></div>
                  <span className="text-base font-black text-slate-300 group-hover:text-[#eab308] transition-colors">添加家人</span>
                </Card>
              </div>
            )}
          </section>
        )}
      </main>

      <AnimatePresence>
        {invitingMember && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative overflow-hidden"
            >
              <button
                onClick={() => setInvitingMember(null)}
                className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400"
              >
                <X size={20} />
              </button>

              <div className="text-center space-y-6">
                <div className="size-24 rounded-full border-4 border-[#eab308]/20 p-1 mx-auto">
                  <img
                    src={getSafeAvatar(invitingMember.avatarUrl)}
                    className="w-full h-full rounded-full object-cover"
                    alt=""
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800">邀请档案注册加盟</h3>
                  <p className="text-sm text-slate-500">让 {invitingMember.name} 扫码或输入邀请码开启数字化记忆档案。</p>
                </div>

                <div className="bg-white p-4 rounded-3xl shadow-md border border-slate-100 flex flex-col items-center gap-3">
                  <div className="size-40 bg-slate-50 rounded-2xl flex items-center justify-center p-2 border-2 border-dashed border-slate-200">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/register?code=INV-${invitingMember.id}-${currentUser?.memberId}`)}`}
                      alt="Join QR Code"
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none">扫码直接注册</span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">专属邀请码</p>
                  <p className="text-4xl font-black text-[#eab308] tracking-wider mb-2 leading-none">
                    INV-{invitingMember.id}-{currentUser?.memberId}
                  </p>
                </div>

                <button
                  onClick={() => {
                    const code = `INV-${invitingMember.id}-${currentUser?.memberId}`;
                    navigator.clipboard.writeText(code).then(() => alert("邀请码已复制"));
                  }}
                  className="w-full py-4 bg-[#eab308] text-black rounded-2xl font-black shadow-lg shadow-[#eab308]/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <Copy size={18} /> 仅复制邀请码
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <VoiceAssistant 
        isOpen={isVoiceAssistantOpen}
        onClose={() => setIsVoiceAssistantOpen(false)}
        currentUser={currentUser}
        onResult={(res) => {
          if (res.action === 'add-event') {
            navigate("/add-event", { state: { prefill: res.params, feedback: res.feedback } });
          }
        }}
      />
    </>
  );
};
