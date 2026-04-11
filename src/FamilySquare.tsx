import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./components/Card";
import { Calendar as CalendarIcon, Phone, Gift, Plus, FolderOpen, Home, CheckCircle, Trash2, Mic, MessageSquare, Camera, Video, Send, X, Heart, Play, Sparkles, ChevronDown, ChevronUp, Share2, Copy, PawPrint, Clock, Users, ChevronLeft, ChevronRight, Settings, RefreshCw } from "lucide-react";
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
import FamilyAlmanac from "./components/FamilyAlmanac";
import { VoiceAssistant } from "./components/VoiceAssistant";
import { BottomNav } from "./components/BottomNav";
import { getLunarDay, getZodiac, formatEventDate } from "./lib/calendarUtils";
import { VoiceWaveform } from "./components/VoiceWaveform";
import { MagicPortrait } from "./components/MagicPortrait";
import { MagicCollections } from "./components/MagicCollections";



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
          onClick={() => {
            navigate("/square#events");
          }}
          className="size-11 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#eab308] hover:border-[#eab308]/20 transition-all active:scale-90 shadow-sm"
        >
          <CalendarIcon size={20} />
        </button>
        <button
          onClick={onArchiveClick}
          className="flex items-center gap-2 pl-2 pr-4 py-2 bg-gradient-to-br from-slate-900 to-black text-white rounded-2xl shadow-xl active:scale-95 transition-all group border border-amber-400/20"
        >
          <div className="size-8 rounded-xl bg-amber-400/10 flex items-center justify-center group-hover:bg-[#eab308] transition-colors">
            <FolderOpen size={16} className="text-amber-400 group-hover:text-black" />
          </div>
          <span className="text-sm font-black tracking-wide bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent">家族档案</span>
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

const FamilyMemoryBoard: React.FC<{ members: FamilyMember[], events: FamilyEvent[] }> = React.memo(({ members, events }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const boardItems = React.useMemo(() => {
    const photoMembers = members.filter(m => (m.avatarUrl || (m as any).avatar_url || (m as any).avatar) && (m.memberType as string) !== 'placeholder' && (m as any).member_type !== 'placeholder').slice(0, 10);
    const upcomingEvents = events.filter(e => e.title).slice(0, 6);

    return [
      ...photoMembers.map((m, i) => ({ type: 'member', data: m, key: `mem-${m.id || i}` })),
      ...upcomingEvents.map((e, i) => ({ type: 'event', data: e, key: `evt-${e.id || i}` }))
    ];
  }, [members, events]);

  useEffect(() => {
    if (boardItems.length <= 5) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % boardItems.length);
    }, 8500); // 留出足够的时间让悬浮动效展现
    return () => clearInterval(timer);
  }, [boardItems.length]);

  if (boardItems.length === 0) return null;

  // 每次显示 7 个项目，完美覆盖视野
  const getVisibleItems = () => {
    const items = [];
    const count = Math.min(7, boardItems.length);
    for (let i = 0; i < count; i++) {
      items.push(boardItems[(currentIndex + i) % boardItems.length]);
    }
    return items;
  };

  const visibleItems = getVisibleItems();

  const itemVariants: any = {
    initial: (custom: any) => ({
      opacity: 0,
      scale: 0.6,
      y: 40,
      rotate: custom.rotation * 2,
      filter: "blur(12px)"
    }),
    enter: (custom: any) => ({
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: custom.rotation,
      filter: "blur(0px)",
      transition: {
        duration: 1.8,
        delay: custom.index * 0.15,
        ease: [0.34, 1.56, 0.64, 1]
      }
    }),
    exit: {
      opacity: 0,
      scale: 1.2,
      y: -60,
      filter: "blur(30px)",
      transition: { duration: 1.0 }
    },
    dangling: (custom: any) => ({
      rotate: [custom.rotation - 2.5, custom.rotation + 2.5, custom.rotation - 2.5],
      y: [0, -10, 0],
      transition: {
        duration: 5 + (custom.index % 3) * 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    })
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden pb-40 pt-10 px-4">
      <AnimatePresence mode="popLayout" initial={false}>
        {visibleItems.map((item, idx) => {
          // 对应 7 个精选位置，避开核心 row 按钮区
          const positions = [
            { left: '4%', top: '2%', rotation: -8 },     // 左上
            { left: '45%', top: '2%', rotation: 5 },      // 中上
            { right: '4%', top: '2%', rotation: -4 },    // 右上
            { left: '2%', top: '25%', rotation: 12 },     // 左中
            { right: '2%', top: '25%', rotation: -10 },   // 右中
            { left: '2%', bottom: '12%', rotation: -5 },   // 左下
            { right: '3%', bottom: '12%', rotation: 10 }    // 右下
          ];
          const pos = positions[idx % positions.length];
          // 优化 Key 逻辑，确保切换时有平滑的 AnimatePresence 效果
          const key = `pos-${idx}-${item.key}`;

          return (
            <motion.div
              key={key}
              variants={itemVariants}
              initial="initial"
              animate={["enter", "dangling"]}
              exit="exit"
              custom={{ index: idx, rotation: pos.rotation }}
              style={{
                position: 'absolute',
                ...pos,
                transformOrigin: "top center",
                zIndex: 20 + idx
              }}
              className="pointer-events-auto"
            >
              {/* 细尼龙绳 */}
              <div className="absolute -top-[600px] left-1/2 -translate-x-1/2 w-[0.5px] h-[600px] bg-gradient-to-t from-slate-300/15 to-transparent" />

              <div className={cn(
                "relative rounded-xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18)] bg-white border-[4px] border-white p-0 w-[100px] md:w-[130px] transition-all group",
                item.type === 'event' ? "bg-amber-50/10 backdrop-blur-sm" : ""
              )}>
                {item.type === 'member' ? (
                  <div className="flex flex-col">
                    <div className="aspect-[3/4] relative overflow-hidden bg-slate-100">
                      <img
                        key={(item.data as FamilyMember).avatarUrl || (item.data as any).avatar_url || (item.data as any).avatar}
                        src={getSafeAvatar((item.data as FamilyMember).avatarUrl || (item.data as any).avatar_url || (item.data as any).avatar)}
                        className="w-full h-full object-cover transition-transform duration-[1500ms]"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
                    </div>
                    <div className="py-2 px-2 text-center bg-white">
                      <p className="text-[11px] font-black text-slate-700 tracking-tight truncate">{(item.data as FamilyMember).name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center aspect-[3/4] bg-gradient-to-br from-amber-50/40 to-white/90">
                    <div className="size-8 rounded-full bg-white shadow-sm flex items-center justify-center mb-2">
                      <CalendarIcon size={14} className="text-amber-500" />
                    </div>
                    <h4 className="text-[10px] font-black text-slate-800 leading-tight line-clamp-2">{(item.data as FamilyEvent).title}</h4>
                    <span className="mt-2 text-[7px] font-black text-amber-600/40 uppercase tracking-widest">Notable</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

const MemoryFlash: React.FC<{ members: FamilyMember[], events: FamilyEvent[] }> = React.memo(({ members, events }) => {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  // 🚀 核心逻辑：合并档案中的真实人物和近期的大事记
  const items = React.useMemo(() => {
    // 过滤出有照片或简介的真实人物
    const seenIds = new Set();
    const realMembers = members.filter(m => {
      if (!m.id || seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      // 🚀 核心纠偏：修正类型检查，避免与 placeholder 冲突
      return (m as any).memberType !== 'placeholder' && (m.avatarUrl || m.bio);
    }).slice(0, 8);

    // 过滤出有标题的大事记
    const seenEIds = new Set();
    const topEvents = events.filter(e => {
      if (!e.id || seenEIds.has(e.id)) return false;
      seenEIds.add(e.id);
      return !!e.title;
    }).slice(0, 8);

    const combined = [];
    const max = Math.max(realMembers.length, topEvents.length);
    for (let i = 0; i < max; i++) {
      if (realMembers[i]) combined.push({ type: 'member', data: realMembers[i] });
      if (topEvents[i]) combined.push({ type: 'event', data: topEvents[i] });
    }
    return combined;
  }, [members, events]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 6000); // 慢镜头，更具情感深度
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[index];

  return (
    <div className="px-6 mt-0">
      <div
        className="relative w-full h-[220px] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200/50 cursor-pointer group opacity-85 transition-all duration-700 hover:opacity-100 hover:scale-[1.02] grayscale-[0.1] hover:grayscale-0"
        onClick={() => {
          if (current.type === 'member') navigate(`/archive/${current.data.id}`);
          else navigate(`/square#events`);
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0"
          >
            {current.type === 'member' ? (
              <img
                src={getSafeAvatar(current.data.avatarUrl)}
                className="w-full h-full object-cover filter brightness-[0.7] contrast-[1] transition-transform duration-[8000ms] ease-out group-hover:scale-110"
                alt={current.data.name}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e1b4b] flex items-center justify-center">
                <Sparkles className="text-white/10 absolute top-8 right-8" size={60} />
                <CalendarIcon className="text-white/5 absolute -bottom-4 -left-4" size={120} />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstripe.png')] opacity-10" />
              </div>
            )}

            {/* 高端层次感渐变 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                {/* Content UI */}
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <div className="flex items-end justify-between">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="size-2 bg-[#eab308] rounded-full animate-pulse shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#eab308]">家族记忆 · 回响</span>
                      </div>

                      <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2 flex items-center gap-2">
                        {current.type === 'member' ? (
                          <>{current.data.name}</>
                        ) : (
                          <>{current.data.title}</>
                        )}
                      </h2>

                      <p className="text-xs md:text-sm text-white/70 font-bold leading-relaxed max-w-[90%] line-clamp-2 italic font-display">
                        “ {current.type === 'member' ? (current.data.bio || "在这片土地上，留下了最深的情谊。") : (current.data.description || "岁月留声，铭记每一个重要的瞬间。")} ”
                      </p>
                    </motion.div>

                    {/* 🚀 模拟收藏按钮 */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 1.2 }}
                      className={cn(
                        "size-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg border-2 mb-2",
                        "bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20"
                      )}
                      onClick={(e) => {
                         e.stopPropagation();
                         const btn = e.currentTarget;
                         btn.style.backgroundColor = '#fb7185';
                         btn.style.borderColor = '#fb7185';
                         btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.505 4.04 3 5.5L12 21l9-7Z"></path></svg>';
                      }}
                    >
                      <Heart size={28} />
                    </motion.button>
                  </div>
                </div>

            {/* Pagination Dots */}
            <div className="absolute top-8 left-8 flex gap-2">
              {items.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-700",
                    i === index ? "w-8 bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.5)]" : "w-1.5 bg-white/30"
                  )}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
});

export const FamilySquare: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  // Agent/Voice States for Square Mode
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [transcription, setTranscription] = useState("");
  const transcriptionRef = useRef(""); // To prevent stale state in session
  const [agentStatus, setAgentStatus] = useState<"idle" | "listening" | "thinking" | "responding" | "success">("idle");
  const [agentFeedback, setAgentFeedback] = useState("");
  const recognitionRef = useRef<any>(null);

  // 🚀 交互空闲状态监测：长久不操作进入“呼吸”提示
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<any>(null);

  useEffect(() => {
    const handleInteraction = () => {
      setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 6000); // 6秒无操作进入呼吸模式
    };
    handleInteraction();
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, handleInteraction));
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(e => window.removeEventListener(e, handleInteraction));
    };
  }, []);


  const startVoiceSession = () => {
    console.log("[Voice] startVoiceSession called");
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("您的浏览器不支持语音功能，请使用 Chrome 或 Safari。");
      return;
    }
    setTranscription("");
    transcriptionRef.current = "";
    setAgentFeedback("");
    setIsRecording(true);
    isRecordingRef.current = true;
    setAgentStatus("listening");

    const r = new SR();
    r.lang = "zh-CN";
    r.continuous = false;
    r.interimResults = true;

    r.onresult = (e: any) => {
      let sessionFinal = "";
      let sessionInterim = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) sessionFinal += e.results[i][0].transcript;
        else sessionInterim += e.results[i][0].transcript;
      }
      const full = sessionFinal + sessionInterim;
      setTranscription(full);
      transcriptionRef.current = full;
    };

    r.onend = () => {
      if (isRecordingRef.current) {
        setIsRecording(false);
        isRecordingRef.current = false;
        setTimeout(() => {
          if (transcriptionRef.current.trim()) processAgentCommand(transcriptionRef.current);
          else setAgentStatus("idle");
        }, 500);
      }
    };

    recognitionRef.current = r;
    r.start();
  };

  const stopVoiceSession = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);

    // DELAY processing to allow the final 'onresult' to settle and update the Ref
    setTimeout(() => {
      const finalVal = transcriptionRef.current.trim();
      if (finalVal) {
        processAgentCommand(finalVal);
      } else {
        setAgentStatus("idle");
      }
    }, 500);
  };

  const playFishAudio = async (text: string): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        // 🚀 解析标签：提取正文，丢弃方括号里的元数据 (TTS 不需要读标签)
        const cleanText = text.replace(/\[.*?\]/g, "").trim();
        if (!cleanText) return resolve(true);

        console.log(`[FishAudio] Fetching voice for: "${cleanText.slice(0, 30)}..."`);
        const res = await fetch("/api/tts/fish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "TTS proxy failed");
        }

        const blob = await res.blob();
        console.log(`[FishAudio] Success! Blob size: ${blob.size} bytes`);

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.oncanplaythrough = () => {
          console.log("[FishAudio] Playing audio now...");
          audio.play();
        };
        audio.onended = () => resolve(true);
        audio.onerror = () => resolve(true);
      } catch (e) {
        console.error("Fish Audio Error:", e);
        // 兜底方案：使用系统原生 TTS
        const utterance = new SpeechSynthesisUtterance(text.replace(/\[.*?\]/g, ""));
        utterance.lang = "zh-CN";
        utterance.onend = () => resolve(true);
        utterance.onerror = () => resolve(true);
        window.speechSynthesis.speak(utterance);
      }
    });
  };

  const handleBaoBaoClick = async () => {
    if (agentStatus !== "idle" || isRecording) return;
    setAgentStatus("responding");
    setAgentFeedback("包包来了，有什么吩咐吗");
    await playFishAudio("包包来了，有什么吩咐吗");
    setAgentStatus("idle");
    setAgentFeedback("");
    startVoiceSession();
  };

  const processAgentCommand = async (text: string) => {
    setAgentStatus("thinking");
    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "voice-assistant-command",
          text: text,
          currentUser
        })
      });
      const data = await res.json();

      if (data.error) {
        setAgentFeedback(data.error || "抱歉，包包由于网络原因暂时断开连接了～");
        setAgentStatus("responding");
        setTimeout(() => setAgentStatus("idle"), 4000);
        return;
      }

      if (data.text) {
        const jsonStr = data.text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(jsonStr);

        setAgentFeedback(parsed.feedback || "好哒，包包明白啦～");
        setAgentStatus("responding");

        // 🔊 Professional Audio Dialog: Call Fish Audio (Cai Xukun)
        if (parsed.feedback) {
          await playFishAudio(parsed.feedback);
        }

        // Action Handling
        if (parsed.action === 'add-event') {
          setTimeout(() => {
            navigate("/add-event", { state: { prefill: parsed.params, feedback: parsed.feedback } });
            setAgentStatus("idle");
          }, 2000);
        } else if (parsed.action === 'navigate' && parsed.params?.path) {
          setTimeout(() => {
            navigate(parsed.params.path);
            setAgentStatus("idle");
          }, 2000);
        } else {
          // Just chatting or unknown
          setTimeout(() => {
            setAgentStatus("idle");
            setAgentFeedback("");
          }, 6000);
        }
      } else {
        throw new Error("Empty AI response");
      }
    } catch (e) {
      console.error(e);
      setAgentFeedback("哎呀，网路出小差了，请再说一次话哟～");
      setAgentStatus("responding");
      setTimeout(() => setAgentStatus("idle"), 3000);
    }
  };

  const [activeTab, setActiveTab] = useState<"events" | "archive">("events");
  const [eventRange, setEventRange] = useState<"today" | "week" | "month" | "year">("month");
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
  // 🛡️ 自定义删除确认弹层：防止 window.confirm 闪退问题
  const [pendingDeleteId, setPendingDeleteId] = useState<string | number | null>(null);

  // 🚀 核心：同步 URL Hash 到 activeTab 状态
  useEffect(() => {
    if (location.hash === "#events") {
      setActiveTab("events");
    } else if (location.hash === "#archive") {
      setActiveTab("archive");
    }
  }, [location.hash]);

  const onHomeClick = () => {
    navigate("/");
  };

  useEffect(() => {
    const timer = setInterval(() => setActiveActivityIndex(prev => (prev + 1) % activities.length), 4000);
    return () => clearInterval(timer);
  }, [activities.length]);

  useEffect(() => {
    setEventsSummary(null);
  }, [eventRange, selectedDay, calendarDate, activeTab]);

  // 🚀 核心：处理从“添加大事记”跳回来的定位与庆祝逻辑
  useEffect(() => {
    const state = (location.state as any);
    if (state?.scrollToDate) {
      console.log("[ANCHOR] Scrolling to date:", state.scrollToDate);
      const [y, m, d] = state.scrollToDate.split("-").map(Number);
      
      // 1. 同步日历状态：设置为本月视图并选中对应日期
      setCalendarDate(new Date(y, m - 1, 1));
      setSelectedDay(d);
      setEventRange("month"); // 🚀 保持“本月”视野，符合用户期望
      
      // 2. 撒花庆祝
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#eab308', '#fb7185', '#2dd4bf']
      });

      // 3. 物理定位：滚动到对应的卡片位置
      setTimeout(() => {
        const element = document.getElementById(`event-card-${String(d).padStart(2, '0')}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500); // 略微延迟，等待列表渲染完成

      // 4. 清理 state，防止重复触发
      navigate(location.pathname + location.hash, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    const handleBaoBaoClick = () => {
      setAgentFeedback("包包来了，有什么吩咐吗");
      setAgentStatus("responding");
      setTimeout(() => {
        setAgentStatus("idle");
        setAgentFeedback("");
      }, 5000);
    };
    window.addEventListener("click-assistant", handleBaoBaoClick);
    return () => window.removeEventListener("click-assistant", handleBaoBaoClick);
  }, []);

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

  const isSquareMode = !location.hash;

  // 🚀 性能优化：使用 useMemo 缓存大事记列表过滤逻辑，避免无效重复计算
  const filteredEventsForList = React.useMemo(() => {
    return [...events]
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
  }, [events, eventRange, selectedDay, calendarDate]);

  // 🚀 性能优化：缓存档案列表的复杂亲属关系计算，防止切换 Tab 时递归计算导致的 UI 阻塞
  const filteredArchiveMembers = React.useMemo(() => {
    const meNode = members.find(m =>
      (m.userId && currentUser?.id && String(m.userId) === String(currentUser.id)) ||
      (m.id && currentUser?.memberId && String(m.id) === String(currentUser.memberId))
    ) || currentUser;

    const searchFilter = createKinshipSearchFilter(archiveSearchQuery);
    const isRealMember = (m: any) => {
      if (currentUser?.familyId === 'demo' || isDemoMode(currentUser)) {
        return m.memberType !== 'placeholder' && m.member_type !== 'placeholder' && !m.is_placeholder && !m.isPlaceholder;
      }
      const isRegistered = m.is_registered || m.isRegistered;
      const hasExplicitCreator = !!m.createdByMemberId;
      const isPlaceholder = m.is_placeholder || m.isPlaceholder;
      if (isRegistered || (m.id >= 1000 && m.id < 2000)) return true;
      if (isPlaceholder) return false;
      return hasExplicitCreator;
    };

    return members
      .filter(isRealMember)
      .filter(searchFilter)
      .map(member => {
        const rel = getRigorousRelationship(meNode, member, members);
        const label = getKinshipLabel(meNode, member, members);
        const isMe = currentUser && (
          (member.id && currentUser.memberId && String(member.id) === String(currentUser.memberId)) ||
          (member.userId && currentUser.id && String(member.userId) === String(currentUser.id))
        );
        return { ...member, relationshipCalculated: rel, kinshipLabel: label, isMe };
      });
  }, [members, currentUser, archiveSearchQuery]);

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (location.hash.startsWith("#archive")) {
      setActiveTab("archive");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setActiveTab("events");
      window.scrollTo({ top: 0, behavior: "smooth" });

      const st = location.state as { selectedDate?: string } | null;
      if (st && st.selectedDate) {
        const [y, m, d] = st.selectedDate.split('-').map(Number);
        if (y && m && d) {
          setCalendarDate(new Date(y, m - 1, 1));
          setSelectedDay(d);
          setEventRange("today");
        }
      }
    }
  }, [location.hash, location.pathname, location.state]);

  const generateEventsSummary = async () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth() + 1;

    const filteredEvents = events.filter(event => {
      if (eventRange === "today") {
        const targetDate = formatEventDate(year, month, selectedDay);
        return event.date === targetDate || (event.isRecurring && event.date.endsWith(`-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`));
      }
      if (eventRange === "month") {
        const [, em] = event.date.split("-").map(Number);
        return em === month;
      }
      return true;
    });

    setSummaryLoading(true);
    setEventsSummary(null);

    // 🌙 获取黄历数据，结合家族大事给出更有文化底蕴的建议
    const almanacDay = eventRange === "today" ? selectedDay : new Date().getDate();
    const almanacMonth = eventRange === "today" ? month : new Date().getMonth() + 1;
    const almanacYear = eventRange === "today" ? year : new Date().getFullYear();
    const lunarData = getLunarDay(almanacYear, almanacMonth, almanacDay);

    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "family-secretary",
          eventRange,
          events: filteredEvents,
          // NOTE: 传入黄历数据，让 AI 能结合时令宜忌给出建议
          almanac: {
            date: `${almanacYear}-${String(almanacMonth).padStart(2, '0')}-${String(almanacDay).padStart(2, '0')}`,
            lunarDate: `${lunarData.lunarMonth}月${lunarData.lunarDay}`,
            gzYear: lunarData.gzYear,
            gzDay: lunarData.gzDay,
            nayin: lunarData.nayin,
            clash: lunarData.clash,
            gods: lunarData.gods,
            festival: lunarData.festival || "",
          }
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
    // NOTE: 使用自定义弹层确认，避免 window.confirm 引起页面重渲染导致对话框闪退
    setPendingDeleteId(eventId);
  };

  const confirmDelete = async () => {
    const eventId = pendingDeleteId;
    if (!eventId) return;
    setPendingDeleteId(null);

    if (isDemoMode(currentUser)) {
      setEvents(prev => prev.filter(e => e.id !== eventId));
      const stored = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
      localStorage.setItem("demoCustomEvents", JSON.stringify(stored.filter((e: any) => e.id !== eventId)));
    } else {
      try {
        const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
        if (res.ok) setEvents(prev => prev.filter(e => e.id !== eventId));
      } catch (e) { console.error(e); }
    }
  };

  if (isSquareMode) {
    return (
      <div className="w-full h-[100dvh] relative bg-[#fdfbf0] flex flex-col items-center overflow-hidden">
        {/* Layer 0: 全局艺术背景 (已移除) */}

        {/* Layer 1.5: 岁月刻度 - 在星系中漂浮的年份 */}
        <div className="absolute inset-0 pointer-events-none z-[3] overflow-hidden">
          {/* 中间超大背景文字 “家” */}
          <div
            className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[320px] font-display pointer-events-none opacity-[0.08] select-none text-amber-900"
            style={{ fontFamily: 'Noto Serif SC, serif' }}
          >
            家
          </div>

          {(() => {
            const cy = new Date().getFullYear();
            const yearMeta = [
              { year: cy - 1, x: '12%', y: '15%', delay: 0 },
              { year: cy, x: '82%', y: '18%', delay: 2 },
              { year: cy + 1, x: '18%', y: '72%', delay: 1.5 },
              { year: cy + 2, x: '78%', y: '75%', delay: 3 }
            ];
            return yearMeta.map((n, i) => (
              <motion.div
                key={n.year}
                onClick={() => { setActiveTab("archive"); navigate("/square#archive", { replace: true }); }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.2, 0.6, 0.2] }}
                transition={{ duration: 5, delay: n.delay, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: 'absolute',
                  left: n.x,
                  top: n.y,
                  fontFamily: 'Newsreader, serif',
                }}
                className="flex flex-col items-center gap-1 pointer-events-auto cursor-pointer hover:scale-125 active:scale-95 transition-transform duration-300 z-10"
              >
                <div className="size-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                <span className="text-[18px] font-black text-amber-900/50 uppercase tracking-[0.3em] italic hover:text-amber-600 transition-colors">{n.year}</span>
              </motion.div>
            ));
          })()}
        </div>

        {/* Layer 1.6: 核心光晕层 (The Central Glow) - 位于语音球正后方 */}
        <div
          className="absolute top-[65%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] pointer-events-none z-[4]"
          style={{
            background: 'radial-gradient(circle, rgba(255,191,0,0.22) 0%, rgba(255,191,0,0) 32%)',
            filter: 'blur(10px)'
          }}
        />

        {/* Layer 2: 独立顶部标题 */}
        <div className="absolute top-[env(safe-area-inset-top,1.5rem)] inset-x-0 z-[60] flex justify-center pointer-events-none pt-2">
          <span className="text-[11px] font-black text-amber-700/50 uppercase tracking-[0.5em]">时光 · 记忆档案</span>
        </div>

        {/* Layer 2.1: 独立日期按钮（替代原本的气泡，固定在此处） */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute top-[6%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] flex justify-center pointer-events-none whitespace-nowrap"
        >
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/50 border border-white/40 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] active:scale-95 transition-all cursor-pointer hover:bg-white/90 pointer-events-auto"
            onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
          >
            <div className="size-2 bg-[#eab308] rounded-full animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
            <span className="text-[12px] font-black text-slate-700 uppercase tracking-widest leading-none mt-[1px]">
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} &nbsp; {new Date().toLocaleDateString('zh-CN', { weekday: 'long' })} &nbsp; • &nbsp; {new Date().getFullYear()}
            </span>
            <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-300", isHeaderMenuOpen && "rotate-180")} />
          </div>
        </motion.div>

        {/* 顶部下拉菜单（独立绝对定位） */}
        <AnimatePresence>
          {isHeaderMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: -20, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              /* 菜单紧邻日期按钮下方显示 */
              className="absolute top-[calc(6%+2.2rem)] left-1/2 -translate-x-1/2 w-64 bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl p-2 z-[55] pointer-events-auto overflow-hidden text-center max-h-[360px] flex flex-col"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-30" />

              {(() => {
                const today = new Date();
                const targetDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const todayEvents = events.filter(e => e.date === targetDateStr || (e.isRecurring && e.date.endsWith(`-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)));

                if (todayEvents.length === 0) {
                  return <p className="text-sm font-bold text-slate-800 my-4">今天暂时没有安排哦～</p>;
                }

                return (
                  <div className="space-y-3 mb-4 max-h-[180px] overflow-y-auto pr-1 text-left custom-scrollbar">
                    {todayEvents.map(e => (
                      <div key={e.id} className="flex items-center gap-3 bg-amber-50/50 p-2 rounded-xl border border-amber-100/30">
                        <div className="size-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                          <Sparkles size={14} className="text-amber-500" />
                        </div>
                        <span className="text-[13px] font-black text-slate-800 line-clamp-1">{e.title}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    setActiveTab("events");
                    setEventRange("today");
                    navigate("/square#events", { replace: true });
                  }}
                  className="w-full py-2.5 bg-slate-900 border border-slate-800 text-white rounded-2xl text-[11px] font-black tracking-widest hover:bg-black transition-colors"
                >
                  今日日历
                </button>
                <button
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    const targetDate = formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay);
                    navigate("/add-event", { state: { prefill: { date: targetDate } } });
                  }}
                  className="w-full py-2.5 bg-[#eab308] text-white rounded-2xl text-[11px] font-black tracking-widest hover:opacity-90 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <Plus size={14} strokeWidth={4} /> 添加记录
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Layer 4: AI 状态反馈（语音状态时显示） */}
        {agentStatus !== 'idle' && (
          <div className="absolute top-[78%] inset-x-0 z-[25] flex justify-center px-8 pointer-events-none">
            <AnimatePresence mode="wait">
              {agentStatus === 'listening' && (
                <motion.div key="listening" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                  <span className="text-[12px] font-black text-amber-600 uppercase tracking-widest animate-pulse">正在倾听...</span>
                  <p className="text-[14px] font-bold text-slate-500 tracking-tight text-center px-4 max-w-[280px] line-clamp-1">{transcription || "告诉我想了解或记录的事情..."}</p>
                </motion.div>
              )}
              {agentStatus === 'thinking' && (
                <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <div className="size-2 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="size-2 bg-amber-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="size-2 bg-amber-500 rounded-full animate-bounce" />
                </motion.div>
              )}
              {agentStatus === 'responding' && (
                <motion.div key="responding" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/95 backdrop-blur-xl rounded-[24px] px-6 py-4 border border-amber-100 shadow-xl max-w-[320px]">
                  <p className="text-[15px] font-bold text-slate-800 text-center">{agentFeedback}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Layer 5 (已被日期组件替代) */}

        {/* Layer 5.5: 中央语音球（独立绝对定位，下移避开菜单） */}
        <div className="absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[30] pointer-events-auto">
          <div className="relative">
            {/* 发光圈（背景）- 强化主角光环 */}
            <motion.div
              animate={{
                scale: isRecording ? [1, 1.6, 1] : (isIdle ? [1.1, 1.45, 1.1] : [1, 1.15, 1]),
                opacity: isRecording ? [0.6, 0.8, 0.6] : (isIdle ? [0.25, 0.45, 0.25] : [0.15, 0.25, 0.15])
              }}
              transition={{
                duration: isRecording ? 1.5 : (isIdle ? 3.5 : 5),
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={cn(
                "absolute inset-[-84px] rounded-full blur-[70px] transition-colors duration-700",
                isRecording ? "bg-amber-400" : "bg-amber-300"
              )}
            />

            {/* 核心语音按钮 */}
            <motion.button
              onPointerDown={startVoiceSession}
              onPointerUp={stopVoiceSession}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              animate={isRecording ? {
                scale: [1, 1.05, 1],
                boxShadow: [
                  "0 0 40px rgba(245, 158, 11, 0.4)",
                  "0 0 80px rgba(245, 158, 11, 0.7)",
                  "0 0 40px rgba(245, 158, 11, 0.4)"
                ]
              } : (isIdle ? { y: [0, -10, 0] } : { y: 0 })}
              transition={isRecording ? {
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              } : {
                y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }}
              className={cn(
                "relative size-[120px] rounded-full flex items-center justify-center transition-all duration-500 z-10",
                isRecording
                  ? "bg-[#FFD04A]"
                  : "bg-gradient-to-b from-[#FFD04A] to-[#F59E0B] shadow-[0_45px_100px_-15px_rgba(245,158,11,0.6),0_0_0_12px_rgba(245,158,11,0.15)]"
              )}
            >
              <AnimatePresence mode="wait">
                {isRecording ? (
                  <motion.div
                    key="waveform"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center"
                  >
                    <VoiceWaveform isRecording={true} className="h-16 w-32" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mic"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Mic size={54} strokeWidth={2.5} className="text-white drop-shadow-2xl" />
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.button>
          </div>
        </div>

        {/* Layer 5.8: AI 魔法映像馆入口 (移动至录音按钮下方) */}
        {activeTab === 'events' && (
          <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700">
            <MagicPortrait className="shadow-2xl shadow-orange-200/50" />
          </div>
        )}

        {/* 珍藏馆入口：彻底沉底到 APP 容器内的右下角，避免遮挡语音球 */}
        {activeTab === 'events' && (
          <div className="absolute bottom-10 right-6 z-[60] animate-in fade-in slide-in-from-right-8 duration-1000 delay-700">
            <MagicCollections />
          </div>
        )}

        {/* Layer 6: 底部 Agent + 导航一体区 */}
        <div className="absolute bottom-0 inset-x-0 z-[30] flex flex-col items-center pb-[env(safe-area-inset-bottom,0px)]">

          {/* 底部一体栏：[记忆档案] [包包管家] [家族日历] */}
          <div className="w-full flex items-center justify-between px-6 pb-4 gap-3">
            {/* 记忆档案 按钮 */}
            <button
              onClick={() => { setActiveTab("archive"); navigate("/square#archive", { replace: true }); }}
              className="group flex-1 flex flex-col items-center justify-center gap-2 bg-white/25 backdrop-blur-md shadow-[0_12px_44px_rgba(0,0,0,0.06),inset_0_1px_1px_0_rgba(255,255,255,0.5)] text-slate-950 h-[88px] rounded-[32px] font-black text-[12px] border border-white/40 active:scale-[0.92] hover:scale-[1.03] transition-all mb-[280px]"
            >
              <div className="size-12 rounded-2xl bg-amber-400/10 flex items-center justify-center group-hover:bg-amber-400/10 transition-colors">
                <CalendarIcon size={26} className="text-amber-600" />
              </div>
              <span className="tracking-widest">记忆档案</span>
            </button>

            <div
              onClick={handleBaoBaoClick}
              className="shrink-0 size-[120px] rounded-full overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.8),0_12px_32px_rgba(0,0,0,0.12)] cursor-pointer active:scale-105 transition-transform mb-[402px]"
            >
              <img
                key="baobao-assistant"
                src="/secretary.jpg"
                className="w-full h-full object-cover scale-[1.55] pointer-events-none select-none"
                draggable="false"
              />
            </div>

            {/* 家族日历 按钮 */}
            <button
              onClick={() => { setActiveTab("events"); navigate("/square#events", { replace: true }); }}
              className="group flex-1 flex flex-col items-center justify-center gap-2 bg-white/25 backdrop-blur-md shadow-[0_12px_44px_rgba(0,0,0,0.06),inset_0_1px_1px_0_rgba(255,255,255,0.5)] text-slate-950 h-[88px] rounded-[32px] font-black text-[12px] border border-white/40 active:scale-[0.92] hover:scale-[1.03] transition-all mb-[280px]"
            >
              <div className="size-12 rounded-2xl bg-amber-400/10 flex items-center justify-center group-hover:bg-amber-400/0 transition-colors">
                <FolderOpen size={26} className="text-amber-600" />
              </div>
              <span className="tracking-widest">家族日历</span>
            </button>
          </div>
        </div>
      </div>
    );
  }



  return (
    <>
      <header className="sticky top-0 z-50 glass-morphism px-6 py-4 flex items-center shadow-sm shrink-0 transition-colors">
        <button
          onClick={() => {
            navigate("/square", { replace: true });
          }}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 text-[#eab308] transition-colors"
        >
          <Home size={24} />
        </button>
        <h1 className="text-xl font-bold font-display flex-1 text-center text-slate-800 transition-all">家族广场</h1>
        <button
          onClick={() => navigate("/profile")}
          className="size-10 rounded-full border-2 border-white shadow-md overflow-hidden hover:opacity-80 transition-opacity"
        >
          <img src={userAvatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </button>
      </header>

      <main className="px-6 pt-2 pb-32 space-y-4">
        {/* Toggle - Made Sticky */}
        <div className="sticky top-[64px] z-40 bg-[#fdfbf7] -mx-6 px-6 pt-2 pb-2 backdrop-blur-md rounded-b-[2.5rem]">
          <div className="flex bg-slate-100/80 p-1.5 rounded-2xl gap-1 shadow-sm">
            <button onClick={() => { setActiveTab("archive"); navigate("/square#archive", { replace: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={cn("flex-1 py-3 px-4 rounded-xl text-xl font-black transition-all", activeTab === "archive" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}>记忆档案</button>
            <button onClick={() => { setActiveTab("events"); navigate("/square#events", { replace: true }); }} className={cn("flex-1 py-3 px-4 rounded-xl text-xl font-black transition-all", activeTab === "events" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400")}>家族日历</button>
          </div>
        </div>

        {/* 🚀 家族闪一闪：展示档案照片与大事记 */}
        {isSquareMode && <MemoryFlash members={members} events={events} />}

        {activeTab === "events" && (
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-32 pt-4">
            <div className="bg-[#fdfbf7] -mx-6 px-6 mb-6 flex flex-col gap-6">
              {/* 1. 顶部标题行 (大事记 2026 + 添加按钮) */}
              <div className="flex items-center justify-between w-full px-1">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={22} className="text-[#eab308]" strokeWidth={3} />
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-800 tracking-tight">大事记</span>
                    <span className="text-xl font-bold text-slate-300 tracking-tighter">{new Date().getFullYear()}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const targetDate = formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay);
                    navigate("/add-event", { state: { prefill: { date: targetDate } } });
                  }}
                  className="bg-[#eab308] text-white px-5 py-2 rounded-full text-base font-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-transform active:scale-95 whitespace-nowrap"
                >
                  <Plus size={18} strokeWidth={4} /> 添加大事记
                </button>
              </div>

              {/* 2. 时段切换开关 (今日/本月/本年) */}
              <div className="flex items-center justify-center -mt-2">
                <div className="flex bg-slate-100/50 p-1.5 rounded-2xl gap-1 w-full max-w-[360px] shadow-inner">
                  {(["today", "month", "year"] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => {
                        setEventRange(range as any);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        // 🚀 如果点击的是“今日”，则自动回位到真实的今天
                        if (range === "today") {
                          const now = new Date();
                          setCalendarDate(new Date(now.getFullYear(), now.getMonth(), 1));
                          setSelectedDay(now.getDate());
                        }
                      }}
                      className={cn(
                        "flex-1 py-1.5 rounded-xl text-lg font-black transition-all flex items-center justify-center",
                        (eventRange === range) ? "bg-[#eab308] text-white shadow-md scale-[1.02]" : "text-slate-400"
                      )}
                    >
                      {range === "today" ? "今日" : range === "month" ? "本月" : "本年"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. AI 总结按钮逻辑 */}
              {(() => {
                const hasEventsInRange = events.some(event => {
                  const year = calendarDate.getFullYear();
                  const month = calendarDate.getMonth() + 1;
                  if (eventRange === "today") {
                    const targetDate = formatEventDate(year, month, selectedDay);
                    return event.date === targetDate || (event.isRecurring && event.date.endsWith(`-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`));
                  }
                  if (eventRange === "month") {
                    const [, em] = event.date.split("-").map(Number);
                    return em === month;
                  }
                  return true;
                });

                const currentTargetDate = formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay);

                return (
                  <div className="space-y-3 -mt-2 px-1">
                    <button
                      onClick={generateEventsSummary}
                      disabled={summaryLoading}
                      className="w-full py-3 bg-gradient-to-r from-amber-500/5 to-transparent border-2 border-dashed border-amber-500/20 rounded-2xl flex items-center justify-center gap-2 text-amber-600 font-black group hover:bg-amber-500/10 transition-all active:scale-[0.98] text-sm shadow-sm"
                    >
                      <Sparkles size={18} className={cn(summaryLoading && "animate-spin")} />
                      {summaryLoading ? "AI 总结中..." : `${eventRange === "today" ? "今日" : eventRange === "month" ? "本月" : "本年度"}大事记 AI 智能总结`}
                    </button>                    <AnimatePresence>
                      {eventsSummary && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="p-5 bg-amber-50/50 rounded-3xl border border-amber-500/10 relative backdrop-blur-sm shadow-xl shadow-amber-900/5"
                        >
                          <button onClick={() => setEventsSummary(null)} className="absolute top-4 right-4 text-amber-300 hover:text-amber-500"><X size={16} /></button>
                          <div className="flex gap-3">
                            <div className="size-8 rounded-full bg-white flex items-center justify-center text-amber-600 shadow-sm shrink-0 border border-amber-100">
                              <Sparkles size={16} />
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-amber-700/60 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                AI 智能总结
                              </p>
                              <p className="text-slate-700 font-bold leading-relaxed text-xs">
                                {(() => {
                                  if (!eventsSummary) return null;
                                  const parts = eventsSummary.split(/(\*\*.*?\*\*)/g);
                                  return parts.map((part, index) => {
                                    if (part.startsWith('**') && part.endsWith('**')) {
                                      return <strong key={index} className="text-[#b45309] font-black">{part.slice(2, -2)}</strong>;
                                    }
                                    return part;
                                  });
                                })()}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
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
                  <div className="mb-0 px-1">
                    <FamilyAlmanac
                      familyId={currentUser?.familyId}
                      date={formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay)}
                      onPrev={handlePrevDay}
                      onNext={handleNextDay}
                    />
                  </div>
                );
              })()}

              {eventRange === "month" && (
                <div className="mb-0">
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
                <div className="mb-0 px-1 invisible h-0 overflow-hidden">
                  {/* 年度导航已省略 */}
                </div>
              )}

            </div>

            <div id="event-list-top" className="grid grid-cols-1 gap-4 -mt-2">
              {(() => {
                const filteredEvents = filteredEventsForList;

                if (filteredEvents.length === 0) {
                  return null;
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
                    return { label: "大事记", color: "bg-amber-50 text-amber-500" };
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
                            <button onClick={() => setPendingDeleteId(event.id)} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 hover:text-red-500 transition-all">
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

              <div className="flex justify-center py-6">
                <button
                  onClick={() => {
                    const targetDate = formatEventDate(calendarDate.getFullYear(), calendarDate.getMonth() + 1, selectedDay);
                    navigate("/add-event", { state: { prefill: { date: targetDate } } });
                  }}
                  className="px-8 py-4 bg-[#eab308] text-black font-black rounded-2xl shadow-xl shadow-[#eab308]/20 flex items-center gap-2 active:scale-95 transition-all"
                >
                  <Plus size={20} strokeWidth={4} />
                  添加大事记
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === "archive" && (
          <section id="archive-section" className="animate-in fade-in slide-in-from-bottom-2 duration-500 pb-32 pt-0">
            <div className="sticky top-[132px] z-30 bg-[#fdfbf7]/90 backdrop-blur-md -mx-6 px-6 mb-2 shadow-sm border-b border-slate-100 flex flex-col">
              <div className="pb-3 pt-0 flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                  <input
                    type="text"
                    placeholder="按姓名或称谓搜索 (如: 爸爸、妈妈)..."
                    className="w-full h-14 pl-12 pr-4 bg-white border border-slate-100 rounded-[22px] font-bold placeholder:text-slate-300 shadow-sm focus:ring-2 focus:ring-[#eab308]/20 outline-none transition-all"
                    value={archiveSearchQuery}
                    onChange={(e) => setArchiveSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => navigate("/add-member")}
                  className="size-14 bg-[#eab308] text-white rounded-[22px] font-black shadow-lg shadow-[#eab308]/20 flex items-center justify-center transition-transform active:scale-95 shrink-0 border-4 border-white"
                >
                  <Plus size={28} strokeWidth={4} />
                </button>
              </div>
            </div>

            <div className="space-y-10">
              {(() => {
                const allReal = filteredArchiveMembers;

                if (allReal.length === 0) {
                  return (
                    <div className="text-center py-20 bg-slate-100/50 rounded-[3rem] border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold">没有找到匹配的家族成员哦～</p>
                    </div>
                  );
                }

                const renderMemberCard = (member: any) => (
                  <Card
                    key={member.id}
                    className="p-4 border-none shadow-xl shadow-slate-200/40 bg-white rounded-[2.5rem] cursor-pointer hover:shadow-2xl transition-all group overflow-hidden relative"
                    onClick={() => navigate(`/archive/${member.id}`)}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><FolderOpen size={80} /></div>
                    {member.kinshipLabel && (
                      <div className={cn(
                        "absolute top-4 left-4 text-[10px] font-black px-2 py-0.5 rounded-full border z-10",
                        member.kinshipLabel.includes("外") || member.kinshipLabel.includes("母")
                          ? "bg-purple-50 text-purple-400 border-purple-100"
                          : member.kinshipLabel.includes("姻")
                            ? "bg-amber-50 text-amber-600 border-amber-100"
                            : "bg-slate-900/5 text-slate-400 border-slate-100"
                      )}>
                        {member.kinshipLabel}
                      </div>
                    )}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="relative mb-4 group-hover:scale-105 transition-transform z-10 flex flex-col items-center">
                        <div className="size-24 rounded-full border-4 border-white shadow-lg overflow-hidden relative">
                          <img
                            key={member.id}
                            src={getSafeAvatar(member.isMe ? currentUser.avatar : member.avatarUrl)}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {member.isMe && (
                          <div className="absolute -bottom-1 -right-1 bg-gradient-to-tr from-amber-500 via-yellow-200 to-amber-600 text-black text-[12px] font-black px-2.5 py-0.5 rounded-full border-2 border-white shadow-md z-20 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                            我
                          </div>
                        )}
                        {member.isRegistered && !member.isMe && (
                          <div className="absolute -bottom-1 -right-1 bg-[#eab308] text-white p-1 rounded-full border-2 border-white shadow-sm z-20">
                            <CheckCircle size={14} fill="currentColor" className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-1.5 mb-2 px-1 text-center">
                        <h3 className="text-2xl font-black text-black leading-tight flex items-center justify-center gap-2">
                          {member.isMe ? currentUser.name : member.name}
                        </h3>
                      </div>
                      <p className={cn(
                        "text-base font-bold uppercase tracking-widest leading-none mt-1",
                        (member.relationshipCalculated.includes("母") || (member.relationshipCalculated.includes("外") && !member.relationshipCalculated.includes("曾")) || member.relationshipCalculated.includes("姨") || member.relationshipCalculated.includes("舅"))
                          ? "text-purple-600"
                          : "text-slate-900"
                      )}>
                        {member.isMe ? "我" : member.relationshipCalculated}
                      </p>
                    </div>
                  </Card>
                );

                return (
                  <>
                    {/* 1. 本家至亲 */}
                    {(() => {
                      const direct = allReal.filter(m => m.kinshipLabel === "【至亲】");
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
                      const paternal = allReal.filter(m => m.kinshipLabel?.startsWith("【宗亲】"));
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
                      const maternal = allReal.filter(m => m.kinshipLabel?.startsWith("【外戚】"));
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
                      const affinal = allReal.filter(m => m.kinshipLabel?.startsWith("【姻】"));
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
                        const label = m.kinshipLabel || "";
                        return label.startsWith("【友】") || (m as any).kinshipType === 'social' || (m as any).kinship_type === 'social';
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
                        const label = m.kinshipLabel || "";
                        return label.startsWith("【宠】") || m.memberType === 'pet' || (m as any).member_type === 'pet';
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
                        const label = m.kinshipLabel || "";
                        const isKnown = ["【至亲】", "【宗亲】", "【外戚】", "【姻】", "【友】", "【宠】"].some(p => label.startsWith(p));
                        return !m.isMe && !isKnown;
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

              <div className="flex justify-center py-8">
                <button
                  onClick={() => navigate("/add-member")}
                  className="px-8 py-4 bg-[#eab308] text-black font-black rounded-2xl shadow-xl shadow-[#eab308]/20 flex items-center gap-2 active:scale-95 transition-all"
                >
                  <Plus size={20} strokeWidth={4} />
                  添加家人
                </button>
              </div>
            </div>
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

      {/* 🛡️ 自定义删除确认弹层：超滑 无闪退 */}
      <AnimatePresence>
        {pendingDeleteId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setPendingDeleteId(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="w-full max-w-sm bg-white rounded-t-[2.5rem] p-8 pb-12 space-y-5 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="size-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                  <Trash2 size={24} className="text-red-400" />
                </div>
                <h3 className="text-xl font-black text-slate-800">确定删除这条大事记？</h3>
                <p className="text-sm text-slate-400 font-bold">删除后无法恢复，请谨慎操作。</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-base active:scale-95 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black text-base shadow-lg shadow-red-200 active:scale-95 transition-all"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
