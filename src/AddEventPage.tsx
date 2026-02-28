import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Calendar, User, Plus, X } from "lucide-react";
import { Button } from "./components/Button";
import { cn } from "./lib/utils";
import { FamilyMember } from "./types";
import { motion } from "motion/react";
import { BottomNav } from "./components/BottomNav";
import { DEMO_MEMBERS, isDemoMode } from "./demo-data";

export const AddEventPage: React.FC = () => {
  const navigate = useNavigate();

  // Step 1: Date
  const [calendarType, setCalendarType] = useState<"gregorian" | "lunar">("gregorian");
  const [date, setDate] = useState("");

  // Step 2: Person
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isCustomMember, setIsCustomMember] = useState(false);
  const [customMemberName, setCustomMemberName] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Step 3: Event Name
  const [eventName, setEventName] = useState("");
  const [isCustomEventName, setIsCustomEventName] = useState(false);
  const [customEventNameInput, setCustomEventNameInput] = useState("");
  const [eventNamePresets, setEventNamePresets] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    const defaultPresets = [
      "寿辰 (80大寿)",
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

  const savePresets = (newPresets: string[]) => {
    setEventNamePresets(newPresets);
    localStorage.setItem("customEventPresets", JSON.stringify(newPresets));
  };

  const navLocation = useLocation();
  useEffect(() => {
    const state = navLocation.state as { initialDate?: string } | null;
    if (state?.initialDate) {
      setDate(state.initialDate);
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
    } else {
      const familyId = parseInt(String(parsed?.familyId));
      fetch(`/api/family-members?familyId=${familyId}`)
        .then(res => res.json())
        .then(setMembers)
        .catch(console.error);
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

    if (!date || (!selectedMemberId && !finalCustomMemberName) || !finalEventName) return;

    setIsSubmitting(true);
    try {
      const memberName = isCustomMember
        ? finalCustomMemberName
        : members.find(m => m.id === selectedMemberId)?.name || "家人";

      const finalTitle = `${memberName}的${finalEventName}`;

      const savedUser = localStorage.getItem("currentUser");
      const parsed = savedUser ? JSON.parse(savedUser) : null;
      const familyId = parsed?.familyId;

      const newEvent = {
        family_id: familyId, // 注意：数据库字段是下划线命名
        title: finalTitle,
        date,
        type: finalEventName === "生日" ? "birthday" : "other",
        description: `${calendarType === "lunar" ? "农历" : "公历"} ${date}`,
        isRecurring,
        memberId: isCustomMember ? undefined : selectedMemberId,
        customMemberName: isCustomMember ? finalCustomMemberName : undefined,
        location: eventLocation,
        notes
      };

      if (isDemoMode(parsed)) {
        // NOTE: Demo 模式下将新事件存入 localStorage，而非数据库
        const stored = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
        const id = Date.now(); // 用时间戳作为唯一 ID
        stored.push({ ...newEvent, id });
        localStorage.setItem("demoCustomEvents", JSON.stringify(stored));
        navigate("/square");
      } else {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEvent)
        });
        if (res.ok) {
          navigate("/square");
        } else {
          throw new Error("Failed to add event");
        }
      }
    } catch (e) {
      console.error(e);
      alert("添加失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-slate-900 font-serif pb-32">
      <header className="sticky top-0 z-[60] bg-white/80 backdrop-blur-md px-6 py-5 flex items-center justify-between shadow-sm shrink-0 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 p-2 -ml-3 rounded-full hover:bg-black/5 text-slate-800 transition-colors group">
          <ArrowLeft size={28} className="group-active:-translate-x-1 transition-transform" />
          <span className="text-lg font-black pr-2">返回</span>
        </button>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 px-6 py-4 max-w-lg mx-auto w-full space-y-8">

        <h1 className="text-3xl font-bold text-slate-800">添加大事记</h1>

        {/* Step 1: Person (Moved from Step 3) */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="size-6 rounded-full bg-[#eab308] text-black flex items-center justify-center font-bold text-xs">1</div>
            <h2 className="text-lg font-bold">这是谁的日子？</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => {
                  setSelectedMemberId(member.id);
                  setIsCustomMember(false);
                  setCustomMemberName("");
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all",
                  selectedMemberId === member.id && !isCustomMember
                    ? "border-[#eab308] bg-[#eab308]/5 shadow-md"
                    : "border-transparent bg-white hover:bg-slate-50"
                )}
              >
                <div className="size-10 rounded-full overflow-hidden border border-slate-100">
                  <img
                    src={(currentUser && member.id === currentUser.memberId) ? currentUser.avatar : (member.avatarUrl || `https://picsum.photos/seed/${member.id}/100/100`)}
                    alt={member.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-xs font-bold text-slate-700">{member.name}</span>
              </button>
            ))}

            {isCustomMember ? (
              <div className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-[#eab308] bg-[#eab308]/5 shadow-md relative">
                <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                  <User size={20} />
                </div>
                <input
                  type="text"
                  placeholder="输入名字"
                  className="w-full text-center bg-transparent border-b border-slate-300 focus:border-[#eab308] outline-none text-xs font-bold text-slate-700 pb-1"
                  value={customMemberName}
                  onChange={(e) => setCustomMemberName(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setIsCustomMember(false); setCustomMemberName(""); }}
                  className="absolute -top-2 -right-2 bg-slate-200 rounded-full p-1 text-slate-500 hover:bg-slate-300"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsCustomMember(true);
                  setSelectedMemberId(null);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all border-transparent bg-white hover:bg-slate-50"
                )}
              >
                <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-bold text-slate-700">其他</span>
              </button>
            )}
          </div>
        </section>

        {/* Step 2: Event Name (Moved from Step 1) */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="size-6 rounded-full bg-[#eab308] text-black flex items-center justify-center font-bold text-xs">2</div>
            <h2 className="text-lg font-bold">事件名称</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {eventNamePresets.map(name => (
              <div key={name} className="relative group">
                <button
                  onClick={() => {
                    setEventName(name);
                    setIsCustomEventName(false);
                  }}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-bold text-xs transition-all border-2",
                    eventName === name && !isCustomEventName
                      ? "bg-[#eab308] border-[#eab308] text-black shadow-md"
                      : "bg-white border-transparent text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {name}
                </button>
                <button
                  onClick={(e) => handleDeletePreset(name, e)}
                  className="absolute -top-1.5 -right-1.5 bg-slate-200 rounded-full p-0.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-500"
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            {isCustomEventName ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="输入事件名称"
                    className="h-10 px-3 pr-8 rounded-xl border-2 border-[#eab308] bg-white text-xs font-bold outline-none min-w-[120px] shadow-md"
                    value={customEventNameInput}
                    onChange={(e) => setCustomEventNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmCustomEvent()}
                    autoFocus
                  />
                  <button
                    onClick={() => { setIsCustomEventName(false); setCustomEventNameInput(""); }}
                    className="absolute top-1/2 -translate-y-1/2 right-2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                </div>
                <button
                  onClick={handleConfirmCustomEvent}
                  className="h-10 px-4 bg-[#eab308] text-black rounded-xl font-bold text-xs shadow-md active:scale-95 transition-transform"
                >
                  确认添加
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setCustomEventNameInput("");
                  setIsCustomEventName(true);
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl font-bold text-xs transition-all border-2 bg-white border-transparent text-slate-400 hover:bg-slate-50"
                )}
              >
                + 其他
              </button>
            )}
          </div>
        </section>

        {/* Step 3: Date (Moved from Step 2) */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="size-6 rounded-full bg-[#eab308] text-black flex items-center justify-center font-bold text-xs">3</div>
            <h2 className="text-lg font-bold">设定日期</h2>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl relative w-32 shrink-0">
              <motion.div
                className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm z-0"
                initial={false}
                animate={{
                  left: calendarType === "gregorian" ? "4px" : "50%",
                  width: "calc(50% - 4px)"
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
              <button
                onClick={() => setCalendarType("gregorian")}
                className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold relative z-10 transition-colors", calendarType === "gregorian" ? "text-black" : "text-slate-400")}
              >
                公历
              </button>
              <button
                onClick={() => setCalendarType("lunar")}
                className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold relative z-10 transition-colors", calendarType === "lunar" ? "text-black" : "text-slate-400")}
              >
                农历
              </button>
            </div>

            <div className="relative flex-1 flex items-center justify-end gap-2 pr-2">
              <input
                type="date"
                id="event-date-input"
                className="w-full h-10 bg-transparent text-lg font-bold text-right outline-none text-black cursor-pointer"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Calendar
                size={20}
                className="text-[#eab308] cursor-pointer"
                onClick={() => (document.getElementById('event-date-input') as any)?.showPicker?.()}
              />
            </div>
          </div>
          {calendarType === "lunar" && (
            <p className="text-xs text-[#eab308] font-bold px-2">
              * 系统将自动转换为对应的公历日期进行提醒
            </p>
          )}
        </section>

        {/* Notes (Optional) */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-6 rounded-full bg-[#eab308] text-black flex items-center justify-center font-bold text-xs">+</div>
            <h2 className="text-lg font-bold">更多细节 (选填)</h2>
          </div>

          <div className="space-y-3">
            <textarea
              placeholder="备注 (例如：爷爷喜欢红盒子装的礼物...)"
              className="w-full p-6 rounded-2xl border-none bg-white shadow-sm text-sm focus:ring-2 focus:ring-[#eab308]/20 transition-all font-medium resize-none h-32"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </section>

        {/* Reminder Toggle */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#eab308]/10 rounded-xl text-[#eab308]">
              <Calendar size={18} />
            </div>
            <div>
              <p className="font-bold text-sm">每年提醒</p>
              <p className="text-[10px] text-slate-400">系统将在每年的这一天为您推送提醒</p>
            </div>
          </div>
          <button
            onClick={() => setIsRecurring(!isRecurring)}
            className={cn(
              "w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out relative",
              isRecurring ? "bg-[#eab308]" : "bg-slate-200"
            )}
          >
            <div
              className={cn(
                "w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
                isRecurring ? "translate-x-6" : "translate-x-0"
              )}
            />
          </button>
        </section>

        {/* Actions */}
        <div className="pt-2 flex gap-4">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold"
            onClick={() => navigate(-1)}
          >
            取消
          </Button>
          <Button
            size="lg"
            className="flex-[2] bg-[#eab308] hover:bg-[#d9a306] text-black rounded-2xl font-bold shadow-lg shadow-[#eab308]/20 border-none"
            disabled={!date || (!selectedMemberId && !customMemberName.trim()) || (!eventName && !customEventNameInput.trim()) || isSubmitting}
            onClick={handleAdd}
          >
            {isSubmitting ? "正在创建..." : "确认创建"}
          </Button>
        </div>
      </main>

    </div>
  );
};
