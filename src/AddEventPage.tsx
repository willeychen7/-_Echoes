import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Calendar, X, Mic, Clock, Tag, Bell, User, Plus, ChevronDown, Check } from "lucide-react";
import { Button } from "./components/Button";
import { cn } from "./lib/utils";
import { FamilyMember, FamilyEvent } from "./types";
import { BottomNav } from "./components/BottomNav";
import { DEMO_MEMBERS, isDemoMode } from "./demo-data";
import { supabase } from "./lib/supabase";
import { getSafeAvatar } from "./constants";
import { FamilyDatePicker } from "./components/FamilyDatePicker";
import { MemberPills } from "./components/MemberPills";
import { motion, AnimatePresence } from "motion/react";

export const AddEventPage: React.FC = () => {
  const navigate = useNavigate();

  // Step 1: Date
  const [calendarType, setCalendarType] = useState<"gregorian" | "lunar">("gregorian");
  // NOTE: 初始化日期：优先使用从广场/日历传入的 prefill 日期，否则默认为今日
  const [date, setDate] = useState(() => {
    const navState = (window.history.state?.usr || window.history.state?.state) as any;
    const prefillDate = navState?.prefill?.date || navState?.initialDate;
    if (prefillDate) return prefillDate;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  // 🚀 标记是否有预填日期：有则日历默认收起，让用户直接看到已选日期
  const [hasDatePrefill] = useState(() => {
    const navState = (window.history.state?.usr || window.history.state?.state) as any;
    return !!(navState?.prefill?.date || navState?.initialDate);
  });

  // Step 2: Person
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  // NOTE: 通知名单，默认全选，用户可单独反选
  const [notifyMemberIds, setNotifyMemberIds] = useState<number[]>([]);
  const [isCustomMember, setIsCustomMember] = useState(false);
  // NOTE: 主角下拉开关状态
  const [isSubjectOpen, setIsSubjectOpen] = useState(false);
  const subjectDropdownRef = useRef<HTMLDivElement>(null);
  const [customMemberName, setCustomMemberName] = useState("");

  // Step 3: Event Name
  const [eventName, setEventName] = useState("");
  const [isCustomEventName, setIsCustomEventName] = useState(false);
  const [customEventNameInput, setCustomEventNameInput] = useState("");
  const [eventNamePresets, setEventNamePresets] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(true);
  const [reminderFrequency, setReminderFrequency] = useState<string[]>([]);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [recurrence, setRecurrence] = useState("none");
  const [isRecurrenceOpen, setIsRecurrenceOpen] = useState(false);
  const [isAutoRecurrence, setIsAutoRecurrence] = useState(false);
  const [eventImage, setEventImage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const eventNameInputRef = useRef<HTMLInputElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  });

  useLayoutEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  // NOTE: 点击下拉外部关闭主角选择器
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(e.target as Node)) {
        setIsSubjectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const defaultPresets = [
      "寿辰",
      "生日",
      "乔迁之喜",
      "退休纪念",
      "结婚周年",
      "全家福拍摄日"
    ];
    const savedPresets = localStorage.getItem("customEventPresets");
    if (savedPresets) {
      setEventNamePresets(JSON.parse(savedPresets));
    } else {
      setEventNamePresets(defaultPresets);
      localStorage.setItem("customEventPresets", JSON.stringify(defaultPresets));
    }
  }, []);

  // NOTE: 🧠 智能语义识别：从事件名称中自动提取“主角”和“重复逻辑”
  useEffect(() => {
    if (!eventName) return;
    const lowerName = eventName.toLowerCase();

    // 1. 自动识别重复逻辑
    const autoKeywords = ["生日", "寿辰", "周年", "百岁", "冥寿", "忌日"];
    if (autoKeywords.some(kw => lowerName.includes(kw))) {
      setRecurrence("year");
      setIsAutoRecurrence(true);
    } else {
      setIsAutoRecurrence(false);
    }

    // 2. 自动识别主角 (支持“姓名”和“称谓”双重匹配)
    if (!isCustomMember) {
      // 找出所有在输入框中被提及的成员（通过姓名或称谓）
      const matchedMembers = members.filter(m => {
        const nameMatch = lowerName.includes(m.name.toLowerCase());
        // 同时也尝试匹配称谓 (relationship)，比如“爷爷”、“老伴”等
        const relationshipMatch = m.relationship && lowerName.includes(m.relationship.toLowerCase());
        return nameMatch || relationshipMatch;
      });

      if (matchedMembers.length > 0) {
        setSelectedMemberIds(matchedMembers.map(m => Number(m.id)));
      }
    }
  }, [eventName, members]);

  // NOTE: 获取推荐的关联人物 (例如 选了爷爷 推荐 奶奶)
  const getRecommendedPartners = () => {
    if (selectedMemberIds.length === 0) return [];

    // 关系配对表
    const pairMap: Record<string, string> = {
      "爷爷": "奶奶", "奶奶": "爷爷",
      "爸爸": "妈妈", "妈妈": "爸爸",
      "公公": "婆婆", "婆婆": "公公",
      "外公": "外婆", "外婆": "外公",
      "老伴": "伴侣", "丈夫": "妻子", "妻子": "丈夫"
    };

    const recommended: FamilyMember[] = [];
    selectedMemberIds.forEach(id => {
      const selected = members.find(m => Number(m.id) === id);
      if (selected?.relationship) {
        const partnerRel = pairMap[selected.relationship];
        if (partnerRel) {
          const partner = members.find(m => m.relationship === partnerRel && !selectedMemberIds.includes(Number(m.id)));
          if (partner) {
            // 避免重复添加同一个推荐
            if (!recommended.find(r => r.id === partner.id)) {
              recommended.push(partner);
            }
          }
        }
      }
    });
    return recommended;
  };

  const savePresets = (newPresets: string[]) => {
    setEventNamePresets(newPresets);
    localStorage.setItem("customEventPresets", JSON.stringify(newPresets));
  };

  const navLocation = useLocation();

  // NOTE: 🚀 核心优化：每次进入页面强制重置表单，确保不保留之前的操作 (Fresh Form Start)
  useEffect(() => {
    // 只有在没有预填充(prefill)的情况下才重置为全新状态
    const state = navLocation.state as { initialDate?: string; prefill?: any; feedback?: string } | null;
    if (!state?.prefill && !state?.initialDate) {
      const now = new Date();
      setDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
      setSelectedMemberIds([]);
      setEventName("");
      setRecurrence("none");
      setIsRecurrenceOpen(false);
      setIsCustomMember(false);
      setCustomMemberName("");
      setIsCustomEventName(false);
      setCustomEventNameInput("");
      setReminderFrequency([]);
      setReminderTime("08:00");
      setEventImage("");
    }
  }, [navLocation.pathname]); // 当路径变化时检查

  useEffect(() => {
    const state = navLocation.state as { initialDate?: string; prefill?: any; feedback?: string } | null;
    if (state?.initialDate) {
      setDate(state.initialDate);
    }
    if (state?.prefill) {
      const { title, date: pDate } = state.prefill;
      if (title) setEventName(title);
      if (pDate) setDate(pDate);
    }
  }, [navLocation.state]);

  const handleConfirmCustomEvent = () => {
    if (customEventNameInput.trim()) {
      const newName = customEventNameInput.trim();
      if (!eventNamePresets.includes(newName)) {
        savePresets([...eventNamePresets, newName]);
      }
      setEventName(newName);
      setIsCustomEventName(false);
      setCustomEventNameInput("");
    }
  };

  const handleDeletePreset = (nameToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPresets = eventNamePresets.filter(n => n !== nameToDelete);
    savePresets(newPresets);
    if (eventName === nameToDelete) {
      setEventName("");
    }
  };


  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    const parsed = savedUser ? JSON.parse(savedUser) : null;
    if (isDemoMode(parsed)) {
      const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
      setMembers([...DEMO_MEMBERS, ...customMembers]);
      // Demo 模式下默认全选通知
      setNotifyMemberIds([...DEMO_MEMBERS, ...customMembers].map(m => Number(m.id)));
    } else {
      const familyId = parseInt(String(parsed?.familyId));
      fetch(`/api/family-members?familyId=${familyId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const realOnes = data.filter(m => {
              const isRegistered = m.isRegistered || m.is_registered;
              const hasExplicitCreator = !!m.createdByMemberId;
              const isPlaceholder = m.isPlaceholder || m.is_placeholder;
              if (isRegistered || (m.id >= 1000 && m.id < 2000)) return true;
              if (isPlaceholder) return false;
              return hasExplicitCreator;
            });
            setMembers(realOnes);
            // 默认全选所有人加入通知名单
            setNotifyMemberIds(realOnes.map(m => Number(m.id)));
          }
        })
        .catch(console.error);

      fetch(`/api/events?familyId=${familyId}`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setEvents(data); })
        .catch(console.error);

      // 实时订阅成员变动
      const channel = supabase
        .channel(`family-${familyId}-add-event-sync`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'family_members', filter: `family_id=eq.${familyId}` },
          (payload) => {
            const updated = payload.new as any;
            setMembers(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated, avatarUrl: updated.avatar_url } : m));
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, []);

  const handleAdd = async () => {
    let finalEventName = eventName;
    if (isCustomEventName && customEventNameInput.trim()) {
      finalEventName = customEventNameInput.trim();
    }

    let finalCustomMemberName = customMemberName;
    if (isCustomMember && customMemberName.trim()) {
      finalCustomMemberName = customMemberName.trim();
    }

    if (!date || (selectedMemberIds.length === 0 && !finalCustomMemberName) || !finalEventName) return;

    setIsSubmitting(true);
    try {
      let finalTitle = "";
      if (isCustomMember) {
        // 🛡️ 语义去重：检查输入中是否已经包含人名，避免出现“陈小明的陈小明毕业礼”
        if (finalEventName.includes(finalCustomMemberName)) {
          finalTitle = finalEventName;
        } else {
          finalTitle = `${finalCustomMemberName}的${finalEventName}`;
        }
      } else {
        const selectedNames = members
          .filter(m => selectedMemberIds.includes(m.id))
          .map(m => m.name);

        const namesStr = selectedNames.join("、");

        // 🛡️ 语义去重：如果输入框里已经写了名字（如“陈小明生日”），就不再加前缀
        const alreadyMentioned = selectedNames.some(name => finalEventName.includes(name));

        if (alreadyMentioned) {
          finalTitle = finalEventName;
        } else if (selectedNames.length > 3) {
          finalTitle = `${selectedNames.slice(0, 3).join("、")}等${selectedNames.length}人的${finalEventName}`;
        } else if (selectedNames.length > 0) {
          finalTitle = `${namesStr}的${finalEventName}`;
        } else {
          finalTitle = finalEventName;
        }
      }

      const savedUser = localStorage.getItem("currentUser");
      const parsed = savedUser ? JSON.parse(savedUser) : null;
      const familyId = parsed?.familyId;

      const newEvent = {
        family_id: familyId, // 注意：数据库字段是下划线命名
        title: finalTitle,
        date,
        type: finalEventName === "生日" ? "birthday" : "other",
        description: `${calendarType === "lunar" ? "农历" : "公历"} ${date}`,
        memberId: isCustomMember ? undefined : selectedMemberIds[0], // 兼容旧逻辑
        memberIds: isCustomMember ? [] : selectedMemberIds,           // 新逻辑：多候选人
        customMemberName: isCustomMember ? finalCustomMemberName : undefined,
        reminderTime,
        reminderFrequency,
        notifyMemberIds,
        notifyAll: notifyMemberIds.length === members.length,
        recurrence,
        isRecurring: recurrence !== "none",
        image_url: eventImage
      };

      if (isDemoMode(parsed)) {
        // NOTE: Demo 模式下将新事件存入 localStorage，而非数据库
        const stored = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
        const id = Date.now(); // 用时间戳作为唯一 ID
        stored.push({ ...newEvent, id });
        localStorage.setItem("demoCustomEvents", JSON.stringify(stored));
        // 🚀 携带日期锚点跳转回日历页签
        navigate("/square#events", { state: { scrollToDate: date } });
      } else {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEvent)
        });
        if (res.ok) {
          // 🏆 增加金粉庆祝效果
          setShowCelebration(true);
          // 🚀 携带日期锚点跳转回日历页签
          setTimeout(() => navigate("/square#events", { state: { scrollToDate: date } }), 800);
        } else {
          throw new Error("Failed to add event");
        }
      }
    } catch (e) {
      console.error(e);
      alert("添加失败，请稍后重试");
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    console.log("[DEBUG] selectedMemberIds updated:", selectedMemberIds);
  }, [selectedMemberIds]);

  // NOTE: 获取预览摘要文字
  const getDraftSummary = () => {
    if (!date) return "请选择一个日子…";
    const d = new Date(date.replace(/-/g, '/'));
    const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

    let person = "";
    if (isCustomMember && customMemberName) {
      person = customMemberName;
    } else if (selectedMemberIds.length > 0) {
      person = members.filter(m => selectedMemberIds.includes(m.id)).map(m => m.name).join("、");
    }

    const eventDetail = eventName || "的大事记";

    if (person) {
      return `正在记录：${dateStr} 是 ${person} 的 ${eventDetail}`;
    }
    return `正在记录：${dateStr} 的大事记…`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-slate-800 pb-32">
      <header className="sticky top-0 z-[60] bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100/10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 p-2 -ml-3 rounded-full hover:bg-slate-100 text-slate-800 transition-all group active:scale-90">
          <div className="size-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-white group-hover:shadow-sm transition-all">
            <ArrowLeft size={22} className="group-active:-translate-x-1 transition-transform" />
          </div>
          <span className="text-base font-black pr-2">返回</span>
        </button>
        <div className="flex-1 text-center pr-12">
          <h1 className="text-lg font-black text-slate-800 tracking-tight">添加大事记</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-lg mx-auto w-full space-y-10">


        {/* Step 1: 是什么时候 — 日期选择 */}
        <div className="space-y-3 relative">
          <FamilyDatePicker
            label="是什么时候？"
            id="event-date-input"
            value={date}
            onChange={(newDate) => {
              setDate(newDate);
            }}
            calendarType={calendarType}
            onCalendarTypeChange={setCalendarType}
            events={events}
            members={members}
            defaultOpen={!hasDatePrefill} // 🚀 有预填日期时默认收起，让用户直接看到已选日期
          />

          {/* 重复周期选择 (Recurrence) - 双层设计 */}
          <div className="absolute top-0 right-1 flex flex-col items-end gap-2">
            {isAutoRecurrence && (
              <span className="text-[10px] text-amber-500 font-bold animate-pulse mb-0.5">
                已自动设为每年重复 ★
              </span>
            )}

            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-sm transition-all">
              <button
                type="button"
                onClick={() => {
                  setRecurrence("none");
                  setIsAutoRecurrence(false);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                  recurrence === "none"
                    ? "bg-[#eab308] text-black shadow-sm"
                    : "text-slate-400 hover:text-slate-500"
                )}
              >
                不重复
              </button>
              <button
                type="button"
                onClick={() => {
                  if (recurrence === "none") {
                    setRecurrence("year");
                    setIsRecurrenceOpen(true);
                  } else {
                    setIsRecurrenceOpen(!isRecurrenceOpen);
                  }
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                  recurrence !== "none"
                    ? "bg-[#eab308] text-black shadow-sm"
                    : "text-slate-400 hover:text-slate-500"
                )}
              >
                {recurrence === "none" ? "重复" : {
                  "week": "每周",
                  "month": "每月",
                  "year": "每年"
                }[recurrence as "week" | "month" | "year"]}
              </button>
            </div>

            {/* 当选择“重复”时展开的二级选项 - 3个Row，垂直排列更省心 */}
            <AnimatePresence mode="popLayout">
              {recurrence !== "none" && isRecurrenceOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -5 }}
                  className="flex flex-col gap-1.5 bg-white/70 backdrop-blur-sm p-1.5 rounded-2xl border border-[#eab308]/30 shadow-md ring-4 ring-[#eab308]/5 w-32"
                >
                  {[
                    { id: "week", label: "每周" },
                    { id: "month", label: "每月" },
                    { id: "year", label: "每年" }
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setRecurrence(r.id);
                        setIsAutoRecurrence(false);
                        setIsRecurrenceOpen(false); // 💡 选择完后收回
                      }}
                      className={cn(
                        "w-full px-4 py-2 rounded-xl text-xs font-black transition-all text-left flex items-center justify-between",
                        recurrence === r.id ? "bg-[#eab308] text-white" : "text-[#eab308] hover:bg-amber-50"
                      )}
                    >
                      {r.label}
                      {recurrence === r.id && <span className="size-1.5 bg-white rounded-full" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Step 2 + 3: 这里的顺序已经根据反馈调换 — 先写，后识主角 */}
        <section className="space-y-6">
          {/* A: 事件名称—轻量化照片入口 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-[#eab308] text-black flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm shrink-0">
                  <Tag size={16} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">记录什么事？</h2>
              </div>

              {/* 📷 真实的本地照片上传处理 */}
              <input
                type="file"
                id="event-image-upload"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      if (event.target?.result) {
                        setEventImage(event.target.result as string);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />

              <button
                type="button"
                onClick={() => {
                  if (eventImage) {
                    setEventImage("");
                  } else {
                    document.getElementById('event-image-upload')?.click();
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border",
                  eventImage
                    ? "bg-rose-50 border-rose-100 text-rose-500"
                    : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-teal-50 hover:text-teal-600 hover:border-teal-100"
                )}
              >
                {eventImage ? <X size={14} /> : <Plus size={14} strokeWidth={3} />}
                <span className="text-[10px] font-black">{eventImage ? "移除照片" : "添加照片"}</span>
              </button>
            </div>

            <div className="relative">
              <input
                ref={eventNameInputRef}
                type="text"
                placeholder="例如：陈大明和李美琴的结婚周年…"
                className="w-full h-16 bg-white rounded-3xl px-8 font-black text-xl text-slate-800 border-2 border-slate-100 focus:border-[#eab308] focus:ring-8 focus:ring-[#eab308]/5 outline-none transition-all placeholder:text-slate-200 placeholder:font-black shadow-xl shadow-slate-200/20"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />

              {/* 🖼️ 原规格预览图：尊重照片原始比例 */}
              <AnimatePresence>
                {eventImage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 relative rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-slate-50 flex items-center justify-center max-h-[400px]">
                      <img
                        src={eventImage}
                        className="w-full h-auto max-h-[400px] object-contain"
                        alt="Event preview"
                      />
                      <div className="absolute inset-0 bg-black/5 pointer-events-none" />
                      <div className="absolute top-3 right-3 p-1.5 bg-teal-500 rounded-full text-white shadow-lg">
                        <Check size={14} strokeWidth={4} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* B: 谁的大日子？（支持多选，通过上面输入框可自动识别人名） */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <div className="size-8 rounded-full bg-[#eab308] text-black flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm shrink-0">
                <User size={16} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">是谁的大日子？（可多选）</h2>
            </div>

            <div className="relative" ref={subjectDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSubjectOpen(prev => !prev)}
                className={cn(
                  "w-full flex items-center gap-5 px-6 py-5 rounded-[2.5rem] border-2 transition-all bg-white text-left",
                  isSubjectOpen
                    ? "border-[#eab308] shadow-2xl shadow-[#eab308]/10 -translate-y-1"
                    : selectedMemberIds.length > 0
                      ? "border-[#eab308]/30 shadow-md"
                      : "border-slate-100 shadow-sm"
                )}
              >
                {selectedMemberIds.length > 0 ? (
                  <div className="flex items-center gap-4 flex-1">
                    {/* 头像堆叠或并列显示 */}
                    <div className="flex -space-x-3 shrink-0">
                      {selectedMemberIds.slice(0, 3).map((mid, idx) => {
                        const m = members.find(mem => Number(mem.id) === mid);
                        if (!m) return null;
                        const avatar = (currentUser && (Number(m.id) === Number(currentUser.memberId) || (m.userId && String(m.userId) === String(currentUser.id)))) ? currentUser.avatar : m.avatarUrl;
                        return (
                          <div key={mid} className="size-14 rounded-2xl overflow-hidden border-2 border-white shadow-md relative group-hover:scale-110 transition-all z-[1]" style={{ zIndex: 10 - idx }}>
                            <img src={getSafeAvatar(avatar)} alt={m.name} className="w-full h-full object-cover" />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-[#eab308] font-black uppercase tracking-widest mb-1 leading-none">选定主角人物</p>
                      <p className="text-xl font-black text-slate-800 truncate">
                        {members.filter(m => selectedMemberIds.includes(Number(m.id))).map(m => m.name).join("、")}
                      </p>
                    </div>
                  </div>
                ) : isCustomMember && customMemberName ? (
                  <>
                    <div className="size-14 rounded-2xl bg-amber-50 border-2 border-white shadow-sm flex items-center justify-center shrink-0">
                      <User size={28} className="text-amber-400/60" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-[#eab308] font-black uppercase tracking-widest mb-1 leading-none">手动输入主角</p>
                      <p className="text-xl font-black text-slate-800">{customMemberName}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="size-14 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center shrink-0">
                      <User size={28} className="text-slate-200" />
                    </div>
                  </>
                )}
                <ChevronDown
                  size={24}
                  className={cn(
                    "text-slate-400 transition-transform duration-300 shrink-0",
                    isSubjectOpen && "rotate-180 text-[#eab308]"
                  )}
                />
              </button>

              {/* 展开后的多选列表 */}
              {isSubjectOpen && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] border border-slate-100 shadow-2xl shadow-slate-300/50 z-50 overflow-hidden ring-4 ring-[#eab308]/5">
                  <div className="py-2 max-h-72 overflow-y-auto">
                    {members.map((member) => {
                      const memberId = Number(member.id);
                      const isSelected = selectedMemberIds.includes(memberId);
                      const avatarSrc = (currentUser && (Number(member.id) === Number(currentUser.memberId) || (member.userId && String(member.userId) === String(currentUser.id))))
                        ? getSafeAvatar(currentUser.avatar)
                        : getSafeAvatar(member.avatarUrl);
                      return (
                        <button
                          key={memberId}
                          type="button"
                          onClick={() => {
                            setIsCustomMember(false);
                            setCustomMemberName("");
                            setSelectedMemberIds(prev =>
                              prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
                            );
                          }}
                          className={cn(
                            "w-full flex items-center gap-4 px-6 py-4 transition-all text-left group",
                            isSelected ? "bg-amber-50/50" : "hover:bg-slate-50"
                          )}
                        >
                          <div className={cn(
                            "size-12 rounded-2xl overflow-hidden border-2 shrink-0 transition-all shadow-sm",
                            isSelected ? "border-[#eab308] scale-110" : "border-white"
                          )}>
                            <img src={avatarSrc} alt={member.name} className="w-full h-full object-cover" />
                          </div>
                          <span className={cn(
                            "flex-1 text-base font-black transition-colors",
                            isSelected ? "text-[#eab308]" : "text-slate-600 group-hover:text-slate-900"
                          )}>{member.name}</span>
                          <div className={cn(
                            "size-6 rounded-lg border-2 flex items-center justify-center transition-all",
                            isSelected ? "bg-[#eab308] border-[#eab308] text-white" : "border-slate-200"
                          )}>
                            {isSelected && <Check size={14} strokeWidth={4} />}
                          </div>
                        </button>
                      );
                    })}

                    <div className="h-px bg-slate-50 mx-6 my-2" />

                    <button
                      type="button"
                      onClick={() => setIsSubjectOpen(false)}
                      className="w-full py-4 text-center text-sm font-black text-[#eab308] hover:bg-amber-50 transition-colors"
                    >
                      选好了，点这里收起
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 🔗 智能关系推荐：如果是特殊的长辈或配偶，推荐另一半 */}
            <AnimatePresence>
              {getRecommendedPartners().length > 0 && !isSubjectOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mt-4 flex items-center gap-3 px-6 py-3 bg-[#eab308]/10 border border-[#eab308]/20 rounded-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-1">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  </div>
                  <div className="flex -space-x-2 shrink-0">
                    {getRecommendedPartners().map(p => (
                      <div key={p.id} className="size-8 rounded-full border-2 border-white overflow-hidden shadow-sm">
                        <img src={getSafeAvatar(p.avatarUrl)} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-black text-amber-700 flex-1">也把 {getRecommendedPartners().map(p => p.name).join("、")} 勾选上吗？</span>
                  <button
                    onClick={() => setSelectedMemberIds(prev => [...prev, ...getRecommendedPartners().map(p => Number(p.id))])}
                    className="px-3 py-1.5 bg-[#eab308] text-black text-[10px] font-black rounded-lg shadow-sm active:scale-95 transition-all"
                  >
                    一键加入主角
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* 层二：选通知名单（多选，默认全选） */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="size-8 rounded-full bg-[#eab308] text-black flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm shrink-0">
              <Bell size={16} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">通知谁参加？</h2>
          </div>
          <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl shadow-slate-100/50 space-y-4">
            <div className="flex items-center justify-between pb-2">
              <p className="text-sm font-black text-slate-800 uppercase tracking-widest opacity-40">谁收通知？</p>
              <button
                type="button"
                onClick={() => {
                  // 🛡️ 只排除大日子主角，当前用户可以出现在通知名单里
                  const notifiables = members.filter(m =>
                    !selectedMemberIds.includes(Number(m.id))
                  );
                  const allSelected = notifiables.every(m => notifyMemberIds.includes(Number(m.id)));
                  if (allSelected) {
                    setNotifyMemberIds([]);
                  } else {
                    setNotifyMemberIds(notifiables.map(m => Number(m.id)));
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-2xl transition-all border-2",
                  (() => {
                    const notifiables = members.filter(m =>
                      !selectedMemberIds.includes(Number(m.id))
                    );
                    return notifiables.length > 0 && notifiables.every(m => notifyMemberIds.includes(Number(m.id)));
                  })()
                    ? "bg-[#eab308] border-[#eab308] text-black shadow-lg shadow-amber-200/50"
                    : "bg-white border-slate-100 text-slate-400"
                )}
              >
                <div className={cn(
                  "size-5 rounded-md border-2 flex items-center justify-center transition-all",
                  (() => {
                    const notifiables = members.filter(m =>
                      !(currentUser && String(m.id) === String(currentUser.memberId)) &&
                      !selectedMemberIds.includes(Number(m.id))
                    );
                    return notifiables.length > 0 && notifiables.every(m => notifyMemberIds.includes(Number(m.id)));
                  })()
                    ? "bg-black border-black text-[#eab308]"
                    : "bg-white border-slate-200"
                )}>
                  {(() => {
                    const notifiables = members.filter(m =>
                      !(currentUser && String(m.id) === String(currentUser.memberId)) &&
                      !selectedMemberIds.includes(Number(m.id))
                    );
                    return notifiables.length > 0 && notifiables.every(m => notifyMemberIds.includes(Number(m.id)));
                  })() && <Check size={14} strokeWidth={4} />}
                </div>
                <span className="text-sm font-black">全选</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {members
                .filter(m =>
                  !selectedMemberIds.includes(Number(m.id)) // 🛡️ 只排除大日子主角
                )
                .map((member) => {
                  const memberId = Number(member.id);
                  const isNotify = notifyMemberIds.includes(memberId);
                  return (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() => setNotifyMemberIds(prev =>
                        prev.includes(memberId) ? prev.filter(x => x !== memberId) : [...prev, memberId]
                      )}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 text-xs font-black transition-all active:scale-95 shadow-sm text-center",
                        isNotify
                          ? "border-[#eab308] bg-[#eab308] text-black"
                          : "border-slate-100 bg-white text-slate-500"
                      )}
                    >
                      <div className="size-10 rounded-xl overflow-hidden border-2 border-white shadow-md bg-white">
                        <img
                          src={getSafeAvatar(member.avatarUrl)}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="truncate w-full px-0.5">{member.name}</span>
                    </button>
                  );
                })}
            </div>
            {notifyMemberIds.length === 0 && (
              <p className="text-[10px] text-rose-400 font-bold">⚠️ 尚未选择任何通知对象</p>
            )}
          </div>
        </section>

        {/* ℹ️ 事件名称已内嵌至上方卡片，段落已删除 */}



        {/* Reminder Toggle */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-8">


          {/* Frequency select */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
                <Calendar size={24} />
              </div>
              <div>
                <p className="font-black text-slate-800">何时提醒我？</p>
              </div>
            </div>
            <div className="flex gap-2 p-1 bg-slate-100/50 rounded-2xl">
              {[
                { id: "2days", label: "提前2天" },
                { id: "1day", label: "提前1天" },
                { id: "today", label: "当天" }
              ].map((f) => {
                const isActive = reminderFrequency.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setReminderFrequency(prev =>
                        prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id]
                      );
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-black transition-all",
                      isActive ? "bg-white text-[#eab308] shadow-md scale-105" : "text-slate-400"
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Time select */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="font-black text-slate-800">提醒时间 </p>
              </div>
            </div>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="bg-slate-50 border-none rounded-xl px-4 py-2 font-black text-slate-800 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </section>

        {/* 🏆 Suggestion 1: 实时大事记预览 - 用极其优雅的方式呈现 */}
        <div className="px-1 group">
          <div className={cn(
            "bg-white rounded-[2.5rem] p-8 shadow-2xl transition-all duration-700 relative overflow-hidden border-2",
            (date && (selectedMemberIds.length > 0 || customMemberName) && eventName)
              ? "border-amber-400 ring-8 ring-[#eab308]/5 shadow-amber-500/10 scale-102"
              : "border-slate-50 opacity-60 grayscale-[0.3]"
          )}>
            <div className={cn(
              "absolute top-0 left-0 w-2 h-full transition-colors duration-700",
              (date && (selectedMemberIds.length > 0 || customMemberName) && eventName) ? "bg-[#eab308]" : "bg-slate-200"
            )} />
            <div className="flex items-start gap-4">
              <div className={cn(
                "size-12 rounded-2xl flex items-center justify-center transition-all duration-700 shrink-0 shadow-sm border",
                (date && (selectedMemberIds.length > 0 || customMemberName) && eventName)
                  ? "bg-amber-50 text-amber-500 border-amber-100"
                  : "bg-slate-50 text-slate-300 border-slate-100"
              )}>
                <Calendar size={24} strokeWidth={3} />
              </div>
              <div>
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-[0.3em] mb-2 leading-none transition-colors duration-700",
                  (date && (selectedMemberIds.length > 0 || customMemberName) && eventName) ? "text-amber-400" : "text-slate-300"
                )}>大事记摘要</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={getDraftSummary()}
                    initial={{ opacity: 0, y: 5, filter: 'blur(5px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={cn(
                      "text-2xl font-black leading-tight tracking-tight transition-colors duration-700",
                      (date && (selectedMemberIds.length > 0 || customMemberName) && eventName) ? "text-slate-800" : "text-slate-300"
                    )}
                  >
                    {getDraftSummary()}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Actions - 底栏美化 */}
        <div className="pt-6 flex gap-4">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1 h-16 bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-400 rounded-3xl font-black text-lg transition-all active:scale-95"
            onClick={() => navigate(-1)}
          >
            取消
          </Button>
          <Button
            size="lg"
            className={cn(
              "flex-[2.5] h-16 rounded-3xl font-black text-xl shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 relative overflow-hidden",
              isSubmitting ? "bg-slate-100 text-slate-300" : "bg-[#eab308] hover:bg-[#d9a306] text-black shadow-amber-500/20"
            )}
            disabled={!date || (selectedMemberIds.length === 0 && !customMemberName.trim()) || (!eventName && !customEventNameInput.trim()) || isSubmitting}
            onClick={handleAdd}
          >
            {isSubmitting ? (
              <div className="size-6 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
            ) : (
              <>
                <Plus size={24} strokeWidth={3} />
                保存并发布
                {/* 🏆 金粉特效组件 */}
                {showCelebration && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                        animate={{
                          scale: [0, 1.5, 0],
                          x: (Math.random() - 0.5) * 150,
                          y: (Math.random() - 0.5) * 150,
                          opacity: 0
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-2 bg-amber-400 rounded-full blur-[1px]"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};
