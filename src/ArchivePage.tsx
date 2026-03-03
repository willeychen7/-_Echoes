import React, { useEffect, useState, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Share2, Mic, Camera, Video, MessageSquare, Play, Sparkles, RotateCcw, CheckCircle, Send, X, Heart, Trash2 } from "lucide-react";
import { FamilyMember, Message, MessageType } from "./types";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { getRelativeTime, cn } from "./lib/utils";
import { useAvatarCache, resolveAvatar, updateAvatarCache } from "./lib/useAvatarCache";
import { getRelativeRelationship } from "./lib/relationships";
import confetti from "canvas-confetti";
import { DEMO_MEMBERS, isDemoMode } from "./demo-data";
import { supabase } from "./lib/supabase";
import { AudioBar } from "./components/FamilyEvents";
import { getSafeAvatar } from "./constants";

interface MemoryArchive {
  title: string;
  subtitle: string;
  dateLine: string;
  tags: string[];
  oneLineHook: string;
  storyParagraphs: string[];
  familyNotes: Array<{ name: string; relation: string; line: string; date: string }>;
  audioScript: string;
}

export const ArchivePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState<"say" | "questions">("say");
  const [inputMode, setInputMode] = useState<"voice" | "text" | "photo" | "video">("voice");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [questions, setQuestions] = useState<string[]>([
    "您还记得TA小时候最喜欢的一件玩具或食物吗？",
    "描述一个让您感到自豪的时刻。",
    "TA对您影响最深的一句话是什么？"
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [archiveData, setArchiveData] = useState<MemoryArchive | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  });
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  // NOTE: 全局头像缓存，用户改头像后全局同步
  const avatarCache = useAvatarCache();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recognitionRef = React.useRef<any>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const baseTextRef = React.useRef<string>("");

  const hasUnsavedContent = () => {
    if (inputMode === 'text' && transcription.trim()) return true;
    if (inputMode === 'voice' && (recordedAudioUrl || transcription.trim())) return true;
    if (inputMode === 'photo' && selectedImage) return true;
    if (inputMode === 'video' && selectedVideo) return true;
    return false;
  };

  const resetCurrentInputData = () => {
    setTranscription("");
    setRecordedAudioUrl(null);
    setRecordingTime(0);
    setSelectedImage(null);
    setSelectedVideo(null);
  };

  const handleInputModeChange = (mode: "voice" | "text" | "photo" | "video") => {
    if (mode === inputMode) return;

    if (hasUnsavedContent()) {
      if (!window.confirm("切换模式将清空当前已写的内容，确定要切换吗？")) {
        return;
      }
    }

    resetCurrentInputData();
    setInputMode(mode);

    if (mode === "video") {
      setTranscription("视频上传功能正在开发中，当前版本暂未开放...");
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // 在前端统一将图片转为 base64 发给服务器存储（类似注册头像）
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  useEffect(() => {
    const loadUser = () => {
      const savedUser = localStorage.getItem("currentUser");
      if (savedUser) setCurrentUser(JSON.parse(savedUser));
    };
    window.addEventListener('storage', loadUser);
    window.addEventListener('sync-user', loadUser);
    return () => {
      window.removeEventListener('storage', loadUser);
      window.removeEventListener('sync-user', loadUser);
    };
  }, []);

  useLayoutEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      const savedUser = localStorage.getItem("currentUser");
      const parsed = savedUser ? JSON.parse(savedUser) : null;

      const fetchMemberData = async () => {
        try {
          if (isDemoMode(parsed)) {
            const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
            const found = [...DEMO_MEMBERS, ...customMembers].find(m => m.id === Number(id));
            if (found) setMember(found);
          } else {
            const res = await fetch(`/api/family-members/${id}`);
            if (res.ok) {
              const data = await res.json();
              setMember(data);
              // NOTE: 同步全局头像缓存，确保其他地方看到的头像也是最新的
              if (data.id && (data.avatar_url || data.avatarUrl)) {
                updateAvatarCache(data.id, data.avatar_url || data.avatarUrl);
              }
            }

            // --- 新增：预热整个家庭的头像缓存，确保留言作者的头像也是最新的 ---
            const familyId = parsed?.familyId || "demo";
            if (!isDemoMode(parsed)) {
              const allMemRes = await fetch(`/api/family-members?familyId=${familyId}`);
              if (allMemRes.ok) {
                const allMembers = await allMemRes.json();
                if (Array.isArray(allMembers)) {
                  allMembers.forEach((m: any) => {
                    if (m.id && (m.avatar_url || m.avatarUrl)) {
                      updateAvatarCache(m.id, m.avatar_url || m.avatarUrl);
                    }
                  });
                }
              }
            }
          }

          const msgRes = await fetch(`/api/memories?memberId=${id}`);
          if (msgRes.ok) {
            const data = await msgRes.json();
            // 同步这些过往留言所属作者的头像到本地缓存
            if (Array.isArray(data)) {
              data.forEach((m: any) => {
                if (m.authorId && m.authorAvatar) {
                  updateAvatarCache(m.authorId, m.authorAvatar);
                }
              });
            }
            const currUser = parsed;
            const formattedMessages = (Array.isArray(data) ? data : []).map((m: any) => {
              const userKey = currUser ? String(currUser.memberId || currUser.id || currUser.name) : "匿名";
              return {
                ...m,
                isLiked: m.likedBy?.includes(userKey) || false
              };
            });
            setMessages(formattedMessages);
          }

          if (!isDemoMode(parsed)) {
            const creatorRes = await fetch(`/api/archive-creators/${id}`);
            if (creatorRes.ok) {
              const creatorData = await creatorRes.json();
              setCreatorName(creatorData.creatorName);
            }
          }
        } catch (err) {
          console.error("Archive load error:", err);
        } finally {
          setLoading(false);
        }
      };

      fetchMemberData();
      shuffleQuestions();
    }
  }, [id]);

  const shuffleQuestions = () => {
    fetch("/api/question-bank?limit=2").then(res => res.json()).then(setQuestions);
  };

  const handleWarmResponse = async () => {
    if (inputMode === "text" && !transcription.trim()) {
      alert("请输入内容！");
      return;
    }
    if (inputMode === "photo" && !selectedImage) {
      alert("请选择要上传的照片！");
      return;
    }

    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });

    const familyId = currentUser?.familyId || 1;

    // --- 核心隐私与持久化逻辑：媒体上传 ---
    const uploadFile = async (dataUrl: string, folder: string, ext: string) => {
      const isDemo = isDemoMode(currentUser);
      if (isDemo) {
        console.log("[STORAGE] Demo mode detected. Skipping cloud upload.");
        return dataUrl;
      }

      try {
        console.log(`[STORAGE] Attempting upload for family: ${familyId}...`);
        const res = await fetch(dataUrl);
        if (!res.ok) throw new Error(`Fetch local fail: ${res.status}`);
        const blob = await res.blob();

        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filePath = `${familyId}/${folder}/${fileName}`;

        const { error } = await supabase.storage
          .from('family_media')
          .upload(filePath, blob, {
            cacheControl: '3600',
            upsert: false,
            contentType: blob.type
          });

        if (error) {
          console.error("[STORAGE] Supabase upload error:", error);
          throw error;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('family_media')
          .getPublicUrl(filePath);

        console.log("[STORAGE] Upload success:", publicUrl);
        return publicUrl;
      } catch (err: any) {
        console.error("[STORAGE] Upload failed critically:", err);
        return dataUrl;
      }
    };

    let uploadedUrl = undefined;
    if (inputMode === "photo" && selectedImage) {
      uploadedUrl = await uploadFile(selectedImage, 'archive_photos', 'jpg');
    } else if (inputMode === "video" && selectedVideo) {
      uploadedUrl = await uploadFile(selectedVideo, 'archive_videos', 'mp4');
    } else if (inputMode === "voice" && recordedAudioUrl) {
      uploadedUrl = await uploadFile(recordedAudioUrl, 'archive_audio', 'webm');
    }

    const msgData = {
      familyMemberId: Number(id),
      authorId: currentUser?.memberId || null,
      authorName: currentUser?.name || "家人",
      authorRole: currentUser?.relationship || "家人",
      authorAvatar: currentUser?.avatar,
      content: transcription || (inputMode === "photo" ? "分享了照片" : inputMode === "video" ? "分享了视频" : "留下了足迹"),
      type: inputMode === "voice" ? MessageType.AUDIO :
        inputMode === "photo" ? MessageType.IMAGE :
          inputMode === "video" ? MessageType.VIDEO : MessageType.TEXT,
      mediaUrl: uploadedUrl || null,
      duration: recordingTime,
      eventId: null
    };

    try {
      if (!isDemoMode(currentUser)) {
        console.log("[POST] Sending memory to API:", msgData);
        const res = await fetch("/api/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msgData)
        });
        if (res.ok) {
          const data = await res.json();
          const newMessage: Message = {
            ...msgData,
            id: data.id,
            createdAt: new Date().toISOString()
          };
          setMessages(prev => [newMessage, ...prev]);

          // 发送成功后平滑滚动到留言墙
          setTimeout(() => {
            const wall = document.getElementById("archive-wall");
            if (wall) wall.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 300);
        } else {
          const err = await res.json();
          console.error("[POST] Memory error response:", err);
          alert(`留言失败: ${err.error || '服务器错误'}`);
        }
      } else {
        const newMessage: Message = {
          ...msgData,
          id: Date.now(),
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [newMessage, ...prev]);

        setTimeout(() => {
          const wall = document.getElementById("archive-wall");
          if (wall) wall.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 300);
      }
    } catch (error) {
      console.error("[POST] Critical network error:", error);
      alert("网络错误，留言未能送达，请重试。查看控制台了解详情。");
    }

    setTranscription("");
    setIsRecording(false);
    setRecordingTime(0);
    setRecordedAudioUrl(null);
    setSelectedImage(null);
    setSelectedVideo(null);
  };

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
      baseTextRef.current = transcription;
      setTranscription("");
      setRecordingTime(0);
      audioChunksRef.current = [];

      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);

      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mediaRecorder.onstop = () => {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          setRecordedAudioUrl(URL.createObjectURL(blob));
        };
        mediaRecorder.start();

        const recognition = new SpeechRecognition();
        recognition.lang = "zh-CN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (e: any) => {
          let finalStr = "";
          let interimStr = "";
          for (let i = 0; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript;
            if (e.results[i].isFinal) {
              finalStr += transcript;
            } else {
              interimStr += transcript;
            }
          }

          if (finalStr) {
            finalStr = finalStr.replace(/[我说完了|停止录音]/g, "");
            const PUNCT_END = /[。？！]$/;
            if (finalStr && !PUNCT_END.test(finalStr)) finalStr += "。";
          }

          setTranscription(baseTextRef.current + finalStr + interimStr);
        };
        recognitionRef.current = recognition;
        recognition.start();
      });
    }
  };

  const handleAiArchive = async () => {
    if (!member) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "biography",
          messages,
          memberName: member.name
        })
      });
      const data = await res.json();
      if (data.text) {
        setArchiveData({
          title: `${member.name}的流金岁月`,
          subtitle: "家族记忆博物馆收藏",
          dateLine: "2026年 整理归档",
          tags: ["坚韧", "和善", "智慧"],
          oneLineHook: "岁月从不败美人，爱是唯一的永恒。",
          storyParagraphs: data.text.split("\n\n"),
          familyNotes: [],
          audioScript: ""
        });
      } else {
        alert(data.error || "生成失败");
      }
    } catch (e) {
      console.error(e);
      alert("AI生成失败，网络错误");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLike = async (mid: string) => {
    // 乐观更新
    setMessages(prev => prev.map(m => m.id.toString() === mid ? { ...m, likes: (m.likes || 0) + (m.isLiked ? -1 : 1), isLiked: !m.isLiked } : m));

    if (!isDemoMode(currentUser)) {
      try {
        const res = await fetch(`/api/memories/${mid}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderName: currentUser?.name || "有人",
            senderAvatar: currentUser?.avatar || "",
            senderId: currentUser?.memberId || currentUser?.id || currentUser?.name || ""
          })
        });
        const data = await res.json();
        if (data.likes !== undefined) {
          setMessages(prev => prev.map(m => m.id.toString() === mid ? { ...m, likes: data.likes, isLiked: data.isLiked } : m));
        }
      } catch (e) {
        console.error("Like error:", e);
      }
    }
  };

  const onDeleteMessage = async (mid: number) => {
    if (!window.confirm("确定要删除这条记忆瞬间吗？")) return;
    setMessages(prev => prev.filter(m => m.id !== mid));
    if (!isDemoMode(currentUser)) {
      await fetch(`/api/memories/${mid}`, { method: "DELETE" }).catch(console.error);
    }
  };

  const handleDeleteMember = async () => {
    if (window.confirm("确定要删除这位亲人档案吗？此操作不可恢复。")) {
      const savedUser = localStorage.getItem("currentUser");
      const currentUser = savedUser ? JSON.parse(savedUser) : null;

      if (isDemoMode(currentUser)) {
        const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
        const updatedMembers = customMembers.filter((m: any) => m.id !== member.id);
        localStorage.setItem("demoCustomMembers", JSON.stringify(updatedMembers));

        const customEvents = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
        const updatedEvents = customEvents.filter((e: any) => e.memberId !== member.id);
        localStorage.setItem("demoCustomEvents", JSON.stringify(updatedEvents));
      } else {
        try {
          const res = await fetch(`/api/family-members/${member.id}`, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "删除失败");
          }
          alert("档案已删除。");
          navigate("/square#archive");
        } catch (e: any) {
          console.error("Delete member failed:", e);
          alert(e.message || "删除失败，您可能无权删除此档案。");
        }
      }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfbfd]">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="size-12 border-4 border-[#eab308]/20 border-t-[#eab308] rounded-full"
          />
          <p className="text-slate-400 font-bold">寻觅岁月记忆中...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-[#fdfbfd]">
        <p className="text-xl font-bold text-slate-500">档案已损坏或不存在。</p>
        <button
          onClick={async () => {
            if (window.confirm("确定要删除此损坏档案吗？")) {
              const savedUser = localStorage.getItem("currentUser");
              const currentUser = savedUser ? JSON.parse(savedUser) : null;

              if (isDemoMode(currentUser)) {
                const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
                const updatedMembers = customMembers.filter((m: any) => m.id !== Number(id) && m.id !== String(id));
                localStorage.setItem("demoCustomMembers", JSON.stringify(updatedMembers));

                const customEvents = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
                const updatedEvents = customEvents.filter((e: any) => e.memberId !== Number(id) && e.memberId !== String(id));
                localStorage.setItem("demoCustomEvents", JSON.stringify(updatedEvents));
              } else {
                try {
                  await fetch(`/api/family-members/${id}`, { method: "DELETE" });
                } catch (e) {
                  console.error("Clear broken member failed:", e);
                }
              }

              alert("已成功清理损坏档案。");
              navigate("/square#archive");
            }
          }}
          className="px-6 py-3 bg-red-50 text-red-500 font-bold rounded-xl shadow-sm hover:bg-red-100 transition-colors"
        >
          清理此档案
        </button>
        <button
          onClick={() => navigate("/square#archive")}
          className="px-6 py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
        >
          返回列表
        </button>
      </div>
    );
  }

  const isMeMember = currentUser && (member.id == currentUser.memberId || (member.userId && member.userId === currentUser.id));
  const displayAvatar = isMeMember ? getSafeAvatar(currentUser.avatar) : getSafeAvatar(member.avatarUrl);
  const displayName = isMeMember ? currentUser.name : member.name;
  const displayBio = (isMeMember && currentUser.bio) ? currentUser.bio : (member.bio || "热爱生活，记录美好。");

  // 只有非演示模式下的未注册成员（或符合演示 ID 逻辑的演示成员），且当前用户是创建者或无创建者信息时，才允许删除
  const canDelete = !member.isRegistered &&
    currentUser &&
    (!isDemoMode(currentUser) || member.id > 1000) &&
    (!member.createdByMemberId || member.createdByMemberId === currentUser.memberId);

  return (
    <div className="bg-[#fdfbfd] min-h-screen flex flex-col">
      <header className="sticky top-0 z-[60] glass-morphism px-6 py-5 flex items-center justify-between shadow-sm shrink-0 border-b border-slate-100">
        <button onClick={() => navigate("/square#archive")} className="flex items-center gap-1 p-2 -ml-3 rounded-full hover:bg-black/5 text-slate-800 transition-colors group">
          <ArrowLeft size={28} className="group-active:-translate-x-1 transition-transform" />
          <span className="text-lg font-black pr-2">返回</span>
        </button>
        <h1 className="text-xl font-black font-display flex-1 text-center truncate px-2 text-slate-800">
          记忆档案
        </h1>
        <div className="w-20 pr-1 flex justify-end">
          {canDelete && (
            <button onClick={handleDeleteMember} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors" title="删除档案">
              <Trash2 size={24} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-8 space-y-10 max-w-2xl mx-auto w-full">
        {/* Header Section */}
        <div className="text-center relative flex flex-col items-center">
          <div className="relative inline-block mx-auto mb-4">
            <div className="size-28 rounded-full overflow-hidden border-4 border-white shadow-xl">
              <img src={displayAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            {isMeMember && (
              <div className="absolute bottom-1 right-1 bg-[#eab308] text-black text-[10px] font-bold px-3 py-1 rounded-full border-2 border-white shadow-sm flex items-center gap-1 z-20">
                我
              </div>
            )}
            {member.isRegistered && !isMeMember && (
              <div className="absolute bottom-1 right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                <CheckCircle size={16} fill="currentColor" className="text-white" />
              </div>
            )}
          </div>
          <h1 className="text-3xl font-black text-slate-800">
            {isMeMember ? "我的记忆档案" : `${displayName}的记忆档案`}
          </h1>
          {displayBio && displayBio.trim() !== "" && (
            <p className="text-sm text-slate-400 italic mt-3 mb-2">“{displayBio}”</p>
          )}

          {member.isRegistered ? (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-500 rounded-full text-[10px] font-black inline-flex items-center gap-1">
              <CheckCircle size={12} fill="currentColor" /> 已注册
            </span>
          ) : (
            !isMeMember && (
              <button
                onClick={() => setShowShareModal(true)}
                className="px-4 py-1.5 bg-slate-50 border border-slate-100 text-slate-400 rounded-full text-[10px] shadow-sm font-black inline-flex items-center gap-1.5 hover:bg-[#eab308]/10 hover:text-[#eab308] hover:border-[#eab308]/20 transition-colors"
              >
                未注册 <Share2 size={12} />
              </button>
            )
          )}

          {creatorName && (
            <div className="mt-4 px-3 py-1 bg-amber-50/50 rounded-full text-[10px] font-black text-amber-600/60 flex items-center gap-1.5 ring-1 ring-amber-100 italic">
              {isMeMember ? "由 我 为自己开启了记忆档案" : `由 ${creatorName || "系统"} 为 TA 开启了记忆档案`}
            </div>
          )}
        </div>

        {/* Input Section */}
        <section className="space-y-8">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setTab("say")}
              className={cn("flex-1 py-5 text-xl font-black border-b-4 transition-all", tab === "say" ? "text-[#eab308] border-[#eab308]" : "text-slate-400 border-transparent")}
            >
              {isMeMember ? "我想对自己说..." : "我想对他/她说..."}
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

          <div className="space-y-8 pt-4">
            <div className="grid grid-cols-4 gap-4">
              <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handlePhotoChange} />
              {[
                { id: "voice", icon: Mic, label: "语音" },
                { id: "text", icon: MessageSquare, label: "文字" },
                { id: "photo", icon: Camera, label: "照片" },
                { id: "video", icon: Video, label: "视频" }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => handleInputModeChange(mode.id as any)}
                  className="flex flex-col items-center gap-3 group"
                >
                  <div className={cn("size-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95", inputMode === mode.id ? "bg-[#eab308] text-black scale-110" : "bg-white text-slate-400 group-hover:bg-slate-50")}>
                    <mode.icon size={24} />
                  </div>
                  <span className={cn("text-xs font-black tracking-widest uppercase", inputMode === mode.id ? "text-[#eab308]" : "text-slate-300")}>{mode.label}</span>
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

            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border-2 border-slate-50 relative min-h-[220px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {(inputMode === "voice" && !isRecording && !recordedAudioUrl) ? (
                  <motion.div
                    key="voice-init"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <button
                      onClick={toggleRecording}
                      className="size-20 rounded-full bg-[#eab308]/10 text-[#eab308] flex items-center justify-center hover:bg-[#eab308]/20 transition-all active:scale-95 group"
                    >
                      <Mic size={32} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <p className="text-xs font-black text-slate-300 tracking-widest uppercase">点击开始录音</p>
                  </motion.div>
                ) : (inputMode === "photo" && !selectedImage) ? (
                  <motion.div
                    key="photo-init"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="size-20 rounded-full bg-purple-50 text-purple-400 flex items-center justify-center hover:bg-purple-100 transition-all active:scale-95 group"
                    >
                      <Camera size={32} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <p className="text-xs font-black text-slate-300 tracking-widest uppercase">选择照片</p>
                  </motion.div>
                ) : (inputMode === "voice" && (isRecording || recordedAudioUrl)) ? (
                  <motion.div
                    key="voice-active"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col gap-4"
                  >
                    {isRecording && (
                      <div className="flex flex-col items-center justify-center py-2 space-y-4">
                        <motion.button
                          onClick={toggleRecording}
                          animate={{
                            scale: [1, 1.05, 1],
                            boxShadow: [
                              "0px 0px 0px 0px rgba(234, 179, 8, 0.2)",
                              "0px 0px 0px 20px rgba(234, 179, 8, 0)",
                              "0px 0px 0px 0px rgba(234, 179, 8, 0.2)"
                            ]
                          }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="size-16 bg-[#eab308] text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white transition-transform active:scale-95"
                        >
                          <div className="size-5 bg-white rounded-md animate-pulse" />
                        </motion.button>
                        <div className="flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                          <div className="size-1.5 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-sm font-black font-mono text-red-500">
                            正在录音 {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                    )}

                    {!isRecording && recordedAudioUrl && (
                      <div className="flex justify-center pt-2">
                        <AudioBar
                          url={recordedAudioUrl}
                          duration={recordingTime}
                          isPlaying={playingId === -1}
                          onToggle={() => setPlayingId(playingId === -1 ? null : -1)}
                        />
                      </div>
                    )}

                    <textarea
                      className="w-full flex-1 min-h-[120px] text-2xl text-slate-700 bg-amber-50/20 p-4 rounded-3xl border-2 border-dashed border-amber-200/50 focus:ring-0 resize-none font-serif leading-relaxed placeholder:text-slate-300"
                      placeholder="语音正在转出文字..."
                      value={transcription}
                      onChange={(e) => setTranscription(e.target.value)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="input-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col gap-4"
                  >
                    <textarea
                      className="w-full min-h-[140px] text-2xl text-slate-700 bg-transparent border-none focus:ring-0 resize-none font-serif leading-relaxed placeholder:text-slate-200"
                      placeholder={inputMode === "video" ? "功能开发中..." : "留下一份温暖记忆..."}
                      value={transcription}
                      onChange={(e) => setTranscription(e.target.value)}
                      disabled={inputMode === "video"}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="absolute bottom-6 right-6 flex items-center gap-4">
                {/* 仅在初始化状态或录制中不显示，其他情况显示小功能的辅助入口 */}
                {!(inputMode === "voice" && !recordedAudioUrl) && !(inputMode === "photo" && !selectedImage) && (
                  <button
                    onClick={toggleRecording}
                    disabled={inputMode === "video" || inputMode === "photo"}
                    className={cn(
                      "size-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90",
                      isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[#eab308]/10 text-[#eab308]"
                    )}
                  >
                    {isRecording ? <div className="size-3 bg-white rounded-sm" /> : <Mic size={24} />}
                  </button>
                )}
              </div>
            </div>

            <Button
              className="w-full py-5 text-xl font-black rounded-2xl bg-[#eab308] hover:bg-[#d9a306] text-black shadow-lg shadow-[#eab308]/20 flex items-center justify-center gap-2 transition-all active:scale-95"
              onClick={handleWarmResponse}
            >
              <Send size={24} /> 温暖回应
            </Button>
          </div>
        </section>

        {/* Co-creation Section */}
        <section id="archive-wall" className="space-y-8">
          <div className="flex items-center justify-between gap-4 pt-10 border-t border-slate-100">
            <h3 className="text-2xl font-black text-slate-800">家人的共创</h3>
            <button
              onClick={handleAiArchive}
              disabled={isGenerating || messages.length === 0}
              className="px-6 py-3 bg-[#eab308] text-black rounded-full text-sm font-black shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Sparkles size={16} className={isGenerating ? "animate-spin" : ""} />
              {isGenerating ? "正在生成..." : "生成人物故事"}
            </button>
          </div>

          <AnimatePresence>
            {archiveData && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-[#eab308]/20 relative overflow-hidden">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-black text-slate-800">{archiveData.title}</h2>
                  <p className="text-[#eab308] font-black italic">{archiveData.subtitle}</p>
                  <div className="p-6 bg-slate-50 rounded-2xl text-xl leading-relaxed italic text-slate-600">“{archiveData.oneLineHook}”</div>
                  <div className="text-left space-y-6 pt-6">
                    {archiveData.storyParagraphs.map((p, k) => <p key={k} className="text-lg leading-loose">{p}</p>)}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
              const isAuthor = currentUser && (
                (msg.authorId && String(msg.authorId) === String(currentUser.id)) ||
                (msg.familyMemberId && Number(msg.familyMemberId) === Number(currentUser.memberId)) ||
                (String(msg.authorName) === String(currentUser.name))
              );
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
                      <img
                        src={isAuthor ? getSafeAvatar(currentUser.avatar) : resolveAvatar(avatarCache, msg.authorId, msg.authorAvatar, msg.authorName || String(i))}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#eab308]/10 text-[#eab308] text-[10px] font-black">
                      {isAuthor ? "我" : (msg.familyMemberId === Number(id) && msg.authorName === member?.name ? "原作者" : msg.authorRole)}
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

                    {/* 优先显示文字 */}
                    {msg.content && msg.content !== "分享了照片" && msg.content !== "分享了视频" && msg.type !== MessageType.AUDIO && (
                      <p className="text-xl text-slate-600 font-serif italic mb-4">“{msg.content}”</p>
                    )}

                    {msg.type === MessageType.AUDIO && (
                      <div className="space-y-4 mt-4">
                        <AudioBar
                          url={msg.mediaUrl || ""}
                          duration={msg.duration || 0}
                          isPlaying={playingId === msg.id}
                          onToggle={() => setPlayingId(playingId === msg.id ? null : msg.id)}
                        />
                        {msg.content && <p className="text-lg text-slate-600 font-serif italic mb-2">“{msg.content}”</p>}
                      </div>
                    )}
                    {msg.type === MessageType.IMAGE && (
                      <div className="space-y-4">
                        {msg.mediaUrl && <img src={msg.mediaUrl} alt="" className="rounded-2xl border-2 border-white shadow-lg w-full h-auto" />}
                      </div>
                    )}
                    {msg.type === MessageType.VIDEO && (
                      <div className="space-y-4">
                        <div className="aspect-video rounded-2xl bg-slate-100 flex items-center justify-center relative shadow-lg overflow-hidden border-2 border-white">
                          <video src={msg.mediaUrl} controls className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-50">
                      <button
                        onClick={() => handleLike(msg.id.toString())}
                        className={cn("flex items-center gap-2 transition-all active:scale-90", msg.isLiked ? "text-rose-500 scale-110" : "text-slate-400")}
                      >
                        <Heart size={22} fill={msg.isLiked ? "currentColor" : "none"} />
                        <span className="text-sm font-black">{msg.likes || 0}</span>
                      </button>
                      <button className="flex items-center gap-2 text-slate-400">
                        <MessageSquare size={22} />
                        <span className="text-sm font-black">互动</span>
                      </button>

                      {msg.authorName === currentUser?.name && (
                        <button
                          onClick={() => onDeleteMessage(msg.id)}
                          className="ml-auto flex items-center gap-2 text-slate-200 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Share Modal */}
      <AnimatePresence>
        {
          showShareModal && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative overflow-hidden"
              >
                <button onClick={() => setShowShareModal(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400"><X size={20} /></button>

                <div className="text-center space-y-6">
                  <div className="size-24 rounded-full border-4 border-[#eab308]/20 p-1 mx-auto">
                    <img src={member.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-800">邀请 {member.name} 加入</h3>
                    <p className="text-sm text-slate-500">{member.name} 尚未注册账号。发送邀请码，他们可以借此加入家族网络。</p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">专属邀请码</p>
                    <p className="text-4xl font-mono font-black text-[#eab308] tracking-wider mb-2 select-all">
                      {member.inviteCode || `INV-${member.id}-${currentUser?.memberId}`}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const code = member.inviteCode || `INV-${member.id}-${currentUser?.memberId}`;
                      navigator.clipboard.writeText(code).then(() => {
                        alert("邀请码已复制");
                        setShowShareModal(false);
                      });
                    }}
                    className="w-full py-4 bg-[#eab308] text-black rounded-2xl font-black shadow-lg shadow-[#eab308]/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Share2 size={18} /> 复制并去发送
                  </button>
                </div>
              </motion.div>
            </div>
          )
        }
      </AnimatePresence>
    </div>
  );
};
