import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./components/Card";
import { Calendar as CalendarIcon, Phone, Gift, Plus, FolderOpen, Home, CheckCircle, Trash2, Mic, MessageSquare, Camera, Video, Send, X, Heart, Play, Sparkles, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import { FamilyMember, FamilyEvent, Message, MessageType } from "./types";
import { useNavigate, useLocation } from "react-router-dom";
import { cn, getRelativeTime } from "./lib/utils";
import { getRigorousRelationship } from "./lib/relationships";
import confetti from "canvas-confetti";
import { GoogleGenAI } from "@google/genai";
import { DEMO_MEMBERS, DEMO_EVENTS, DEMO_DEFAULT_USER, isDemoMode } from "./demo-data";

// NOTE: 内嵌祝福面板，点击事件卡片上的"祝福"按钮后就地展开，无需跳页
const InlineBlessingPanel: React.FC<{
  event: FamilyEvent;
  currentUser: any;
  onClose: () => void;
}> = ({ event, currentUser, onClose }) => {
  const [inputMode, setInputMode] = useState<"voice" | "text" | "photo" | "video">("voice");
  const [transcription, setTranscription] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showWall, setShowWall] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [showInput, setShowInput] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  // 加载该事件的留言
  useEffect(() => {
    fetch(`/api/messages?eventId=${event.id}`)
      .then(res => res.json())
      .then(data => setMessages(data || []));
  }, [event.id]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.__shouldContinue && (recognitionRef.current.__shouldContinue = false);
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    } else {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { alert("当前浏览器不支持语音识别，请使用 Chrome"); return; }
      setRecordedAudioUrl(null); setIsRecording(true); setTranscription(""); setRecordingTime(0);
      audioChunksRef.current = [];
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mr = new MediaRecorder(stream);
        mediaRecorderRef.current = mr;
        mr.ondataavailable = e => audioChunksRef.current.push(e.data);
        mr.onstop = () => setRecordedAudioUrl(URL.createObjectURL(new Blob(audioChunksRef.current, { type: 'audio/webm' })));
        mr.start();
        const r = new SR(); r.lang = "zh-CN"; r.continuous = true; r.interimResults = true;
        r.onresult = (e: any) => {
          let final = "", interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript;
            else interim += e.results[i][0].transcript;
          }
          setTranscription(prev => (prev + final) + interim);
        };
        recognitionRef.current = r; r.__shouldContinue = true; r.start();
      });
    }
  };

  const handleSend = () => {
    if (!transcription && inputMode === "text") return;
    confetti({ particleCount: 80, spread: 50, origin: { y: 0.8 } });

    const msgData = {
      familyMemberId: event.memberId || 0,
      authorName: currentUser?.name || "家人",
      authorRole: currentUser?.relationship || "家人",
      authorAvatar: currentUser?.avatar,
      content: transcription || (inputMode === "photo" ? "分享了照片" : inputMode === "video" ? "分享了视频" : "留下了祝福"),
      type: inputMode === "voice" ? MessageType.AUDIO : inputMode === "photo" ? MessageType.IMAGE : inputMode === "video" ? MessageType.VIDEO : MessageType.TEXT,
      mediaUrl: inputMode === "photo" ? selectedImage || undefined : inputMode === "video" ? selectedVideo || undefined : inputMode === "voice" ? recordedAudioUrl || undefined : undefined,
      duration: recordingTime,
      eventId: event.id
    };

    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msgData)
    })
      .then(res => res.json())
      .then(data => {
        const newMsg: Message = {
          ...msgData,
          id: data.id,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [newMsg, ...prev]);
      });

    setTranscription(""); setRecordingTime(0); setRecordedAudioUrl(null); setSelectedImage(null); setSelectedVideo(null);
    setShowWall(true);
    setShowInput(false);
  };

  const handleLike = (id: number) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, likes: (m.likes || 0) + (m.isLiked ? -1 : 1), isLiked: !m.isLiked } : m));
  };

  /** 删除留言（仅作者本人可调用） */
  const handleDeleteMessage = (msgId: number) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    // NOTE: 同时尝试从 API 删除，失败也不影响前端显示
    fetch(`/api/messages/${msgId}`, { method: "DELETE" }).catch(console.error);
  };

  const generateAISummary = async () => {
    if (messages.length === 0) {
      alert("还没有人留下祝福哦～请先送出第一条祝福吧！");
      return;
    }
    setIsGeneratingAI(true);
    try {
      const apiKey = localStorage.getItem("GOOGLE_API_KEY") || "";
      const ai = new GoogleGenAI({ apiKey });
      const messageContext = messages.map(m => `${m.authorName} (${m.authorRole}): ${m.content}`).join("\n");
      const prompt = `你是家族记忆整理师。请根据以下家人在${event.title}时的祝福：\n${messageContext}\n\n写一段温馨的家族总结。要求语言温暖、细腻。字数200字左右。`;

      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      setAiSummary(result.text);
      setShowWall(true);
    } catch (e) {
      console.error(e);
      alert("AI 生成失败，请检查 API Key 是否配置正确");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleShareSummary = () => {
    if (!aiSummary) return;
    navigator.clipboard.writeText(aiSummary).then(() => alert("祝福内容已复制！可以去微信分享啦。"));
  };

  const getMsgTypeInfo = (type: MessageType) => {
    switch (type) {
      case MessageType.AUDIO: return { label: "语音", color: "text-blue-500 bg-blue-50" };
      case MessageType.IMAGE: return { label: "照片", color: "text-purple-500 bg-purple-50" };
      case MessageType.VIDEO: return { label: "视频", color: "text-orange-500 bg-orange-50" };
      default: return { label: "文字", color: "text-slate-400 bg-slate-50" };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-6 pt-2 space-y-6 border-t border-slate-100 bg-[#fdfbf7] rounded-b-3xl">

        <AnimatePresence>
          {showInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-6 overflow-hidden"
            >
              {/* 输入模式选择 */}
              <div className="grid grid-cols-4 gap-3 pt-2">
                {[
                  { id: "voice", icon: Mic, label: "语音" },
                  { id: "text", icon: MessageSquare, label: "文字" },
                  { id: "photo", icon: Camera, label: "照片" },
                  { id: "video", icon: Video, label: "视频" },
                ].map(mode => (
                  <button key={mode.id} onClick={() => setInputMode(mode.id as any)} className="flex flex-col items-center gap-2 group">
                    <div className={cn("size-12 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95", inputMode === mode.id ? "bg-[#eab308] text-black scale-105" : "bg-white text-slate-400")}>
                      <mode.icon size={20} />
                    </div>
                    <span className={cn("text-xs font-black tracking-widest", inputMode === mode.id ? "text-[#eab308]" : "text-slate-300")}>{mode.label}</span>
                  </button>
                ))}
              </div>

              {/* 图片/视频预览 */}
              {(selectedImage || selectedVideo) && (
                <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-lg">
                  {selectedImage && <img src={selectedImage} alt="" className="w-full h-auto" />}
                  {selectedVideo && <video src={selectedVideo} controls className="w-full h-auto" />}
                  <button onClick={() => { setSelectedImage(null); setSelectedVideo(null); }} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full"><X size={16} /></button>
                </div>
              )}

              {/* 文字输入区 */}
              <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-50 relative">
                <textarea
                  className="w-full min-h-[100px] text-lg text-slate-700 bg-transparent border-none focus:ring-0 resize-none font-serif leading-relaxed placeholder:text-slate-200"
                  placeholder={inputMode === "voice" ? "录音中，文字将自动显示..." : "写下您的祝福..."}
                  value={transcription}
                  onChange={e => setTranscription(e.target.value)}
                />
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-50">
                  {isRecording && (
                    <span className="text-sm font-black font-mono text-red-500 bg-red-50 px-3 py-1 rounded-full">
                      {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                  <button
                    onClick={toggleRecording}
                    className={cn("size-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90", isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[#eab308]/10 text-[#eab308] hover:bg-[#eab308]/20")}
                  >
                    {isRecording ? <div className="size-4 bg-white rounded-sm" /> : <Mic size={20} />}
                  </button>
                </div>
              </div>

              {/* 发送按钮 */}
              <button
                onClick={handleSend}
                className="w-full py-4 bg-[#eab308] text-black rounded-2xl text-lg font-black shadow-lg shadow-[#eab308]/20 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Send size={18} /> 送出祝福
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!showInput && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowInput(true)}
            className="w-full py-3 border-2 border-dashed border-[#eab308]/40 text-[#eab308] rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-[#eab308]/5 transition-all mt-2"
          >
            <Plus size={16} strokeWidth={3} /> 再写一条留言
          </motion.button>
        )}

        {/* 留言墙折叠展开与AI生成 */}
        <div className="flex items-center justify-between py-2 px-1 border-t border-slate-100 mt-4">
          <button
            onClick={() => setShowWall(v => !v)}
            className="flex items-center gap-1 text-slate-500"
          >
            <span className="text-sm font-black">留言墙 ({messages.length})</span>
            {showWall ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* NOTE: AI 生成祝福按钮 —— 始终可见，无留言时点击给出提示 */}
          <button
            onClick={generateAISummary}
            disabled={isGeneratingAI}
            className="px-4 py-2 bg-[#eab308] text-black rounded-full text-xs font-black shadow-md flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-70"
          >
            <Sparkles size={13} className={isGeneratingAI ? "animate-spin" : ""} />
            {isGeneratingAI ? "生成中..." : "✨ 用AI生成祝福"}
          </button>
        </div>

        {/* 留言墙为空时的小提示 */}
        {messages.length === 0 && (
          <div className="text-center py-6 px-4 bg-amber-50/50 rounded-2xl border border-dashed border-amber-200 mt-2">
            <p className="text-sm font-black text-slate-500 mb-1">还没有人留言</p>
            <p className="text-xs text-slate-400">送出祝福后，点击「用AI生成祝福」生成总结</p>
          </div>
        )}

        {/* AI 生成结果展示 */}
        <AnimatePresence>
          {aiSummary && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-amber-50/60 border border-[#eab308]/30 rounded-2xl p-5 mt-3 space-y-3"
            >
              <p className="text-sm font-black text-[#eab308] flex items-center gap-1"><Sparkles size={13} /> AI 祝福总结</p>
              <p className="text-base text-slate-600 font-serif italic leading-relaxed">"{aiSummary}"</p>
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleShareSummary}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#eab308]/20 text-amber-600 rounded-full text-xs font-black shadow-sm active:scale-95 transition-transform"
                >
                  <Share2 size={12} /> 复制分享
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.length > 0 && (
          <div>
            <AnimatePresence>
              {showWall && (() => {
                const MAX_VISIBLE = 3;
                const hasMore = messages.length > MAX_VISIBLE;
                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    {/* 留言墙顶部关闭按钮 */}
                    <div className="flex items-center justify-between pt-2 pb-3">
                      <span className="text-sm font-black text-slate-500">共 {messages.length} 条留言</span>
                      <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 text-slate-500 rounded-full text-xs font-black flex items-center gap-1 hover:bg-slate-200 transition-colors"
                      >
                        <X size={12} /> 关闭祝福面板
                      </button>
                    </div>

                    <WallMessages
                      messages={messages}
                      currentUser={currentUser}
                      getMsgTypeInfo={getMsgTypeInfo}
                      handleLike={handleLike}
                      onDeleteMessage={handleDeleteMessage}
                      maxVisible={MAX_VISIBLE}
                    />
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * 留言墙子组件 —— 默认显示前 N 条，超出时提供展开/收起按钮
 * 支持真实音频播放和作者专属删除
 */
const WallMessages: React.FC<{
  messages: Message[];
  currentUser: any;
  getMsgTypeInfo: (type: MessageType) => { label: string; color: string };
  handleLike: (id: number) => void;
  onDeleteMessage?: (id: number) => void;
  maxVisible: number;
}> = ({ messages, currentUser, getMsgTypeInfo, handleLike, onDeleteMessage, maxVisible }) => {
  const [expanded, setExpanded] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const visibleMessages = expanded ? messages : messages.slice(0, maxVisible);
  const hasMore = messages.length > maxVisible;

  /** 播放/暂停语音留言 */
  const toggleAudio = (msgId: number, url?: string) => {
    if (!url) return;
    if (playingId === msgId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(msgId);
  };

  return (
    <div className="space-y-5 pt-2">
      {visibleMessages.map((msg, i) => {
        const typeInfo = getMsgTypeInfo(msg.type);
        const isAuthor = currentUser && msg.authorName === currentUser.name;
        const isPlaying = playingId === msg.id;

        return (
          <div key={msg.id} className="flex gap-4">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="size-12 rounded-full overflow-hidden border-2 border-white shadow-md">
                <img src={msg.authorAvatar || `https://picsum.photos/seed/${msg.authorName || i}/100/100`} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <span className="text-[9px] font-black text-[#eab308] bg-[#eab308]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                {isAuthor ? "我" : msg.authorRole}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base font-black text-slate-800">{msg.authorName}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase", typeInfo.color)}>{typeInfo.label}</span>
                <span className="text-[10px] text-slate-300 ml-auto font-bold">{getRelativeTime(msg.createdAt)}</span>
              </div>

              {msg.type === MessageType.TEXT && (
                <p className="text-base text-slate-600 font-serif italic bg-white p-4 rounded-2xl shadow-sm border border-slate-50">"{msg.content}"</p>
              )}
              {msg.type === MessageType.AUDIO && (
                <div className="space-y-2">
                  <div className="bg-[#eab308]/5 p-3 rounded-xl flex items-center gap-3">
                    <button
                      onClick={() => toggleAudio(msg.id, msg.mediaUrl)}
                      className={cn("size-9 rounded-full flex items-center justify-center shadow-md shrink-0 transition-colors", isPlaying ? "bg-red-500" : "bg-[#eab308]")}
                    >
                      {isPlaying ? <div className="size-3 bg-white rounded-sm" /> : <Play size={16} fill="currentColor" />}
                    </button>
                    <div className="flex-1 h-1.5 bg-[#eab308]/20 rounded-full">
                      <div className={cn("h-full bg-[#eab308] rounded-full transition-all", isPlaying ? "w-2/3 animate-pulse" : "w-0")} />
                    </div>
                    <span className="text-xs font-black text-[#eab308]">{msg.duration || 0}"</span>
                  </div>
                  {msg.content && <p className="text-sm text-slate-400 italic pl-1">"{msg.content}"</p>}
                </div>
              )}
              {msg.type === MessageType.IMAGE && msg.mediaUrl && (
                <img src={msg.mediaUrl} alt="" className="rounded-xl shadow-md w-full h-auto border border-white" />
              )}
              {msg.type === MessageType.VIDEO && msg.mediaUrl && (
                <div className="aspect-video bg-black rounded-xl relative flex items-center justify-center overflow-hidden">
                  <video src={msg.mediaUrl} className="w-full h-full object-cover opacity-60" />
                  <Play size={32} className="text-white absolute bg-white/20 p-2.5 rounded-full backdrop-blur-sm" />
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                {/* NOTE: 只有作者本人才能删除自己的留言 */}
                {isAuthor && onDeleteMessage ? (
                  <button
                    onClick={() => { if (window.confirm("确定删除这条留言吗？")) onDeleteMessage(msg.id); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={12} /> 删除
                  </button>
                ) : <div />}
                <button onClick={() => handleLike(msg.id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all active:scale-90", msg.isLiked ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-300 hover:bg-slate-100")}>
                  <Heart size={12} fill={msg.isLiked ? "currentColor" : "none"} strokeWidth={3} />
                  {msg.likes || 0}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* 展开/收起按钮 */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 text-sm font-black text-[#eab308] bg-[#eab308]/5 rounded-2xl hover:bg-[#eab308]/10 transition-colors flex items-center justify-center gap-1"
        >
          {expanded ? (
            <><ChevronUp size={16} /> 收起留言</>
          ) : (
            <><ChevronDown size={16} /> 查看全部 {messages.length} 条留言</>
          )}
        </button>
      )}
    </div>
  );
};

export const FamilySquare: React.FC = () => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [userAvatar, setUserAvatar] = useState("https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y");
  const [currentUser, setCurrentUser] = useState<any>(null);
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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => setActiveActivityIndex(prev => (prev + 1) % activities.length), 4000);
    return () => clearInterval(timer);
  }, [activities.length]);

  useEffect(() => {
    const loadUser = () => {
      const savedUser = localStorage.getItem("currentUser");
      const parsed = savedUser ? JSON.parse(savedUser) : null;

      if (parsed) {
        setCurrentUser(parsed);
        if (parsed.avatar) setUserAvatar(parsed.avatar);
      } else {
        // NOTE: 未登录时使用 Demo 默认用户
        setCurrentUser(DEMO_DEFAULT_USER);
        setUserAvatar(DEMO_DEFAULT_USER.avatar);
      }

      // NOTE: 核心分支 —— Demo 模式用本地数据，注册用户走 API
      if (isDemoMode(parsed)) {
        const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
        setMembers([...DEMO_MEMBERS, ...customMembers]);
        // 合并静态演示数据 + 用户在 Demo 模式下新增的事件
        const customEvents = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
        setEvents([...DEMO_EVENTS, ...customEvents]);
      } else {
        const familyId = parseInt(String(parsed.familyId));
        fetch(`/api/family-members?familyId=${familyId}`).then(res => res.json()).then(data => {
          if (Array.isArray(data)) setMembers(data);
        }).catch(console.error);
        fetch(`/api/events?familyId=${familyId}`).then(res => res.json()).then(data => {
          if (Array.isArray(data)) setEvents(data);
        }).catch(console.error);
      }
    };
    loadUser();

    const h = () => loadUser();
    window.addEventListener('storage', h);
    window.addEventListener('sync-user', h);
    return () => { window.removeEventListener('storage', h); window.removeEventListener('sync-user', h); };
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
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem("GOOGLE_API_KEY") || "";
      if (!apiKey) {
        setEventsSummary("未检测到 AI 密钥。请确保已在设置或环境变量中配置密钥。");
        setSummaryLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        你是一个温暖的家庭小秘书。请根据以下家族大事记列表，生成一个精准、简炼的总结。
        时间跨度：${eventRange === "week" ? "本周" : eventRange === "month" ? "本月" : "本年"}大事记总结
        事件列表：${filteredEvents.map(e => `- ${e.title} (${e.date}, ${e.type}): ${e.description || ""} ${e.notes || ""}`).join("\n")}
        要求：
        1. 语气亲切，用词精准。
        2. 不要啰嗦，去掉所有客套话，直接开门见山总结重点。
        3. 80字以内。
        4. 你的开头必须是：“本${eventRange === "week" ? "周" : eventRange === "month" ? "月" : "年"}家族记忆总结：”
      `;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      setEventsSummary(result.text);
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
        <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-full hover:bg-black/5 text-[#eab308] transition-colors">
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
                  const displayName = linkedMember?.name || event.customMemberName || null;
                  const isMe = currentUser && linkedMember && linkedMember.id == currentUser.memberId;
                  const displayAvatar = isMe ? currentUser.avatar : (linkedMember?.avatarUrl || null);
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
                              <div className="size-16 rounded-full border-4 border-white shadow-md overflow-hidden shrink-0 flex items-center justify-center bg-slate-50">
                                {displayAvatar ? (
                                  <img src={displayAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="text-[20px] font-black text-[#eab308]">{displayName?.charAt(0) || "?"}</span>
                                )}
                              </div>
                              <p className="text-4xl font-black text-slate-800 truncate">{displayName}</p>
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
                            {!isOpen && (
                              <button
                                onClick={() => setOpenBlessingEventId(event.id)}
                                className="flex-1 py-4 rounded-2xl text-xl font-black flex items-center justify-center transition-all active:scale-95 gap-2 bg-[#eab308]/5 text-[#eab308]"
                              >
                                <Gift size={24} />
                                送出祝福
                              </button>
                            )}
                            {!isOpen && (
                              <button
                                onClick={() => window.location.href = 'tel:10086'}
                                className="size-16 bg-[#eab308]/5 text-[#eab308] rounded-2xl flex items-center justify-center shadow-sm transition-transform active:scale-95"
                              >
                                <Phone size={24} />
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
                      <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {member.isRegistered && (
                        <div className="absolute bottom-0 right-0 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                          <CheckCircle size={14} fill="currentColor" className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1.5 mb-2">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-3xl font-black text-slate-800">{member.name}</h3>
                      </div>
                    </div>
                    <p className="text-lg text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
                      {getRigorousRelationship(currentUser?.memberId, member.id, members)}
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
