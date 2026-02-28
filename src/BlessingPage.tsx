import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Share2, Mic, MessageSquare, Camera, Video, Sparkles, RotateCcw, Play, Heart, Calendar as IconCalendar, MapPin, FileText, Send, X } from "lucide-react";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import confetti from "canvas-confetti";
import { FamilyEvent, Message, MessageType } from "./types";
import { cn, getRelativeTime } from "./lib/utils";

const PUNCT_END = /[。！？….,!?]$/;

export const BlessingPage: React.FC = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"say" | "questions">("say");
  const [inputMode, setInputMode] = useState<"voice" | "text" | "photo" | "video">("voice");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [event, setEvent] = useState<FamilyEvent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [questions, setQuestions] = useState<string[]>([
    "您还记得家中长辈小时候最喜欢的一件玩具或食物吗？",
    "描述一个让您也感到非常幸福的家人的瞬间。"
  ]);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [eventId]);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recognitionRef = React.useRef<any>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (eventId) {
      const familyId = currentUser?.familyId || "demo";
      fetch(`/api/events?familyId=${familyId}`).then(res => res.json()).then(data => {
        if (Array.isArray(data)) {
          const found = data.find((e: any) => e.id === Number(eventId));
          setEvent(found);
        }
      }).catch(console.error);
      fetch(`/api/messages?eventId=${eventId}`).then(res => res.json()).then(data => {
        if (Array.isArray(data)) {
          setMessages(data.filter((m: any) => m.eventId === Number(eventId)).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } else {
          setMessages([]);
        }
      }).catch(() => setMessages([]));
    }
  }, [eventId, currentUser]);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.__shouldContinue = false;
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      setRecordedAudioUrl(null);
      setIsRecording(true);
      setTranscription("");
      setRecordingTime(0);
      audioChunksRef.current = [];
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);

      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setRecordedAudioUrl(URL.createObjectURL(blob));
        };
        mediaRecorder.start();

        const recognition = new SpeechRecognition();
        recognition.lang = "zh-CN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (e: any) => {
          let interim = "";
          let final = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript;
            else interim += e.results[i][0].transcript;
          }
          setTranscription(prev => (prev + final).replace(/[我说完了|停止录音]/g, "") + interim);
        };
        recognitionRef.current = recognition;
        recognition.start();
      });
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleWarmResponse = () => {
    if (!transcription && inputMode === "text" && !selectedImage && !selectedVideo) return;
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });

    const msgData = {
      familyMemberId: currentUser?.memberId || 1,
      authorName: currentUser?.name || "匿名家人们",
      authorRole: currentUser?.relationship || "家人",
      authorAvatar: currentUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
      content: transcription || (inputMode === "photo" ? "分享了照片" : inputMode === "video" ? "分享了视频" : "留下了祝福"),
      type: inputMode === "voice" ? MessageType.AUDIO :
        inputMode === "photo" ? MessageType.IMAGE :
          inputMode === "video" ? MessageType.VIDEO : MessageType.TEXT,
      mediaUrl: inputMode === "photo" ? selectedImage || undefined :
        inputMode === "video" ? selectedVideo || undefined :
          inputMode === "voice" ? recordedAudioUrl || undefined : undefined,
      duration: recordingTime,
      eventId: Number(eventId)
    };

    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msgData)
    })
      .then(res => res.json())
      .then(data => {
        const newMessage: Message = {
          ...msgData,
          id: data.id,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [newMessage, ...prev]);
      });

    setTranscription("");
    setRecordedAudioUrl(null);
    setRecordingTime(0);
    setSelectedImage(null);
    setSelectedVideo(null);
  };

  const handleLike = (id: number) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, likes: (m.likes || 0) + (m.isLiked ? -1 : 1), isLiked: !m.isLiked } : m));
  };

  const generateAIEcho = async () => {
    // NOTE: 若无留言，给出友好提示引导用户先发送祝福
    if (messages.length === 0) {
      alert("还没有人留下祝福哦～请先送出第一条祝福吧！");
      return;
    }
    setIsSummarizing(true);
    try {
      const apiKey = localStorage.getItem("GOOGLE_API_KEY") || "";
      const ai = new GoogleGenAI({ apiKey });
      const messageContext = messages.map(m => `${m.authorName} (${m.authorRole}): ${m.content}`).join("\n");
      const prompt = `你是家族记忆整理师。请根据以下家人在${event?.title}时的祝福：\n${messageContext}\n\n写一段温馨的家族总结。要求语言温暖、细腻。字数300字左右。`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      setAiSummary(result.text);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "video") => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      if (type === "photo") setSelectedImage(url);
      else setSelectedVideo(url);
    }
  };

  const shuffleQuestions = () => {
    fetch("/api/question-bank?limit=2").then(res => res.json()).then(setQuestions);
  };

  const handleShareToWechat = () => {
    if (!aiSummary) return;
    navigator.clipboard.writeText(aiSummary).then(() => alert("祝福内容已复制！可以去微信分享啦。"));
  };

  if (!event) return null;

  return (
    <div className="bg-[#fdfbfd] min-h-screen flex flex-col">
      <header className="sticky top-0 z-[60] glass-morphism px-6 py-5 flex items-center justify-between shadow-sm shrink-0 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 p-2 -ml-3 rounded-full hover:bg-black/5 text-slate-800 transition-colors group">
          <ArrowLeft size={28} className="group-active:-translate-x-1 transition-transform" />
          <span className="text-lg font-black pr-2">返回</span>
        </button>
        <h1 className="text-xl font-black font-display flex-1 text-center truncate px-2 text-slate-800">
          {event.title}
        </h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 px-6 py-8 space-y-10 max-w-2xl mx-auto w-full">
        {/* Event Header Card */}
        <Card className="p-8 border-none shadow-2xl bg-white rounded-[2.5rem] relative overflow-hidden">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#eab308]/10 rounded-2xl text-[#eab308]"><IconCalendar size={32} /></div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{event.title}</h2>
              <p className="text-base font-bold text-slate-400 mt-1">{event.date} · 2026年</p>
            </div>
          </div>
          {(event.location || event.notes) && (
            <div className="mt-8 pt-8 border-t border-slate-50 space-y-4">
              {event.location && <div className="flex items-center gap-4 text-slate-600 font-bold"><MapPin size={18} /> {event.location}</div>}
              {event.notes && <div className="flex items-center gap-4 text-slate-500 font-serif italic"><FileText size={18} /> “{event.notes}”</div>}
            </div>
          )}
        </Card>

        {/* 1. Input Section - FIRST */}
        <section className="space-y-8">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setTab("say")}
              className={cn("flex-1 py-5 text-xl font-black border-b-4 transition-all", tab === "say" ? "text-[#eab308] border-[#eab308]" : "text-slate-400 border-transparent")}
            >
              我想对他/她说...
            </button>
            <button
              onClick={() => setTab("questions")}
              className={cn("flex-1 py-5 text-xl font-black border-b-4 transition-all", tab === "questions" ? "text-[#eab308] border-[#eab308]" : "text-slate-400 border-transparent")}
            >
              试试推荐问题
            </button>
          </div>

          <AnimatePresence mode="wait">
            {tab === "questions" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} key="questions">
                <Card className="bg-amber-50/50 border-2 border-amber-100 p-8 rounded-[2.5rem] relative">
                  <button onClick={shuffleQuestions} className="absolute top-6 right-6 text-[#eab308] p-2 hover:bg-white rounded-full transition-colors z-10">
                    <RotateCcw size={24} />
                  </button>
                  <ul className="space-y-4 pr-10">
                    {questions.map((q, i) => (
                      <li key={i} className="flex gap-4 text-slate-700 font-black text-xl leading-relaxed">
                        <span className="text-[#eab308] scale-125">{i + 1}.</span> {q}
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-8">
            <div className="grid grid-cols-4 gap-4">
              {[
                { id: "voice", icon: Mic, label: "语音" },
                { id: "text", icon: MessageSquare, label: "文字" },
                { id: "photo", icon: Camera, label: "照片" },
                { id: "video", icon: Video, label: "视频" }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setInputMode(mode.id as any)}
                  className="flex flex-col items-center gap-3 group"
                >
                  <div className={cn("size-16 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95", inputMode === mode.id ? "bg-[#eab308] text-black scale-110" : "bg-white text-slate-400 group-hover:bg-slate-50")}>
                    <mode.icon size={28} />
                  </div>
                  <span className={cn("text-sm font-black uppercase tracking-widest", inputMode === mode.id ? "text-black" : "text-slate-400")}>{mode.label}</span>
                </button>
              ))}
            </div>

            {(selectedImage || selectedVideo) && (
              <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
                {selectedImage && <img src={selectedImage} alt="" className="w-full h-auto" />}
                {selectedVideo && <video src={selectedVideo} controls className="w-full h-auto" />}
                <button onClick={() => { setSelectedImage(null); setSelectedVideo(null); }} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"><X size={20} /></button>
              </div>
            )}

            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border-2 border-slate-50 relative">
              <textarea
                className="w-full min-h-[160px] p-2 text-2xl text-slate-700 bg-transparent border-none focus:ring-0 resize-none font-serif leading-relaxed"
                placeholder="这一刻，您想说些什么？"
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
              />
              <div className="absolute bottom-6 right-6 flex items-center gap-4">
                {isRecording && <span className="text-lg font-black font-mono text-red-500 bg-red-50 px-3 py-1 rounded-full">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>}
                <button onClick={toggleRecording} className={cn("size-16 rounded-full flex items-center justify-center shadow-2xl transition-all", isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[#eab308] text-black hover:scale-105")}>
                  {isRecording ? <div className="size-6 bg-white rounded-md" /> : <Mic size={32} />}
                </button>
              </div>
            </div>

            <Button
              className="w-full py-5 text-xl font-black rounded-2xl bg-[#eab308] hover:bg-[#d9a306] text-black shadow-lg"
              onClick={handleWarmResponse}
            >
              送出祝福
            </Button>
          </div>
        </section>

        {/* 2. Message Wall Section - SECOND */}
        <section className="space-y-8">
          <div className="flex items-center justify-between gap-4 pt-10 border-t border-slate-100">
            <h3 className="text-2xl font-black text-slate-800">留言墙</h3>
            {/* NOTE: 按钮始终可见，无留言时点击会给出友好提示 */}
            <button
              onClick={generateAIEcho}
              disabled={isSummarizing}
              className="px-6 py-3 bg-[#eab308] text-black rounded-full text-sm font-black shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-70"
            >
              <Sparkles size={16} className={isSummarizing ? "animate-spin" : ""} />
              {isSummarizing ? "从简整理..." : "✨ 用AI生成祝福"}
            </button>
          </div>

          <AnimatePresence>
            {aiSummary && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-[#eab308]/20 relative overflow-hidden">
                <div className="font-serif leading-relaxed text-slate-700 italic text-xl whitespace-pre-wrap">“{aiSummary}”</div>
                <div className="mt-8 flex justify-end">
                  <button onClick={handleShareToWechat} className="flex items-center gap-2 px-6 py-3 bg-[#eab308] text-black rounded-full text-sm font-black shadow-lg active:scale-95 transition-transform">
                    <Share2 size={16} /> 分享至微信
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* NOTE: 留言墙为空时展示引导提示，告知用户如何使用AI生成功能 */}
          {messages.length === 0 && (
            <div className="text-center py-12 px-6 bg-amber-50/50 rounded-[2.5rem] border-2 border-dashed border-amber-200">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-lg font-black text-slate-500">还没有人留言</p>
              <p className="text-sm text-slate-400 mt-2">在上方送出第一条祝福，再点击「用AI生成祝福」，AI将为所有祝福写一段温暖总结！</p>
            </div>
          )}

          <div className="space-y-8">
            {messages.map((msg, i) => {
              const getMsgTypeInfo = (type: MessageType) => {
                switch (type) {
                  case MessageType.AUDIO: return { label: "语音", color: "text-blue-500 bg-blue-50" };
                  case MessageType.IMAGE: return { label: "照片", color: "text-purple-500 bg-purple-50" };
                  case MessageType.VIDEO: return { label: "视频", color: "text-orange-500 bg-orange-50" };
                  default: return { label: "文字", color: "text-slate-400 bg-slate-50" };
                }
              };
              const typeInfo = getMsgTypeInfo(msg.type);

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-50 flex gap-5"
                >
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <div className="size-16 rounded-full overflow-hidden border-4 border-white shadow-md">
                      <img src={msg.authorAvatar || `https://picsum.photos/seed/${msg.authorName || i}/100/100`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#eab308]/10 text-[#eab308] text-[10px] font-black">
                      {msg.authorName === currentUser?.name ? "我" : msg.authorRole}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl font-black text-slate-800">{msg.authorName}</span>
                      <span className={cn("px-3 py-0.5 rounded-full text-[10px] font-black uppercase", typeInfo.color)}>
                        {typeInfo.label}
                      </span>
                      <span className="text-[11px] text-slate-300 ml-auto font-black italic">{getRelativeTime(msg.createdAt)}</span>
                    </div>

                    {msg.type === MessageType.TEXT && <p className="text-xl text-slate-600 font-serif italic">“{msg.content}”</p>}
                    {msg.type === MessageType.AUDIO && (
                      <div className="space-y-3">
                        <div className="bg-[#eab308]/5 p-4 rounded-xl flex items-center gap-4">
                          <button className="size-12 rounded-full bg-[#eab308] flex items-center justify-center shadow-lg"><Play size={22} fill="currentColor" /></button>
                          <div className="flex-1 h-2 bg-[#eab308]/20 rounded-full"><div className="w-1/3 h-full bg-[#eab308] rounded-full" /></div>
                          <span className="text-sm font-black text-[#eab308]">{msg.duration || 0}"</span>
                        </div>
                        {msg.content && <p className="text-lg text-slate-400 italic">“{msg.content}”</p>}
                      </div>
                    )}
                    {msg.type === MessageType.IMAGE && (
                      <div className="space-y-4">
                        <img src={msg.mediaUrl} alt="" className="rounded-2xl border-2 border-white shadow-lg w-full h-auto" />
                        {msg.content && <p className="text-xl text-slate-600 font-serif italic">“{msg.content}”</p>}
                      </div>
                    )}
                    {msg.type === MessageType.VIDEO && (
                      <div className="space-y-4 text-center">
                        <div className="aspect-video bg-black rounded-2xl relative flex items-center justify-center overflow-hidden">
                          <video src={msg.mediaUrl} className="w-full h-full object-cover opacity-60" />
                          <Play size={48} className="text-white absolute bg-white/20 p-4 rounded-full backdrop-blur-sm" />
                        </div>
                        {msg.content && <p className="text-xl text-slate-600 font-serif italic">“{msg.content}”</p>}
                      </div>
                    )}

                    <div className="mt-6 flex justify-end">
                      <button onClick={() => handleLike(msg.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-full transition-all active:scale-95", msg.isLiked ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-300")}>
                        <Heart size={16} fill={msg.isLiked ? "currentColor" : "none"} strokeWidth={3} />
                        <span className="text-xs font-black">{msg.likes || 0}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};
