import React, { useEffect, useState, useLayoutEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Share2, Mic, Camera, Video, MessageSquare, Play, Sparkles, RotateCcw, CheckCircle, Send, X, Heart, Trash2, Copy, Edit2, Calendar, ChevronRight, Zap, UserCircle2, Plus, Users, Search, Check, MapPin } from "lucide-react";
import { FamilyMember, Message, MessageType } from "./types";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { getRelativeTime, cn } from "./lib/utils";
import { useAvatarCache, resolveAvatar, updateAvatarCache } from "./lib/useAvatarCache";
import { getRelativeRelationship, getRelationType, getKinshipLabel, getRelationshipChain, translateLogicTag } from "./lib/relationships";
import { useKinshipPerspective } from "./hooks/useKinshipPerspective";
import confetti from "canvas-confetti";
import { DEMO_MEMBERS, DEMO_EVENTS, DEMO_MEMORIES, isDemoMode } from "./demo-data";
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
  const familyId = new URLSearchParams(window.location.search).get("familyId") || "demo";

  const onAddRelative = () => {
    navigate(`/add-member?forMemberId=${id}&familyId=${familyId}`);
  };
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
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
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // 🚀 NEW: 自定义删除确认弹窗状态
  const [deleteBlockReason, setDeleteBlockReason] = useState<string>(""); // 断链保护提示信息
  const [editInfoForm, setEditInfoForm] = useState({
    name: "",
    gender: "male",
    birthday: "",
    bio: "",
    ranking: "不知道"
  });
  const [relatedEvents, setRelatedEvents] = useState<any[]>([]);
  const [aiBiography, setAiBiography] = useState<string | null>(null);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  // NOTE: 全局头像缓存，用户改头像后全局同步
  const avatarCache = useAvatarCache();
  const canSend = !isRecording && (
    (inputMode === "voice" && !!recordedAudioUrl) ||
    (inputMode === "text" && transcription.trim().length > 0) ||
    (inputMode === "photo" && !!selectedImage) ||
    (inputMode === "video" && !!selectedVideo)
  );

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
    loadUser(); // Initial load
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
          // 并行执行所有的初始化请求，大幅提升进入页面速度
          const promises: Promise<any>[] = [];

          const isDemo = isDemoMode(parsed);
          const familyId = parsed?.familyId || "demo";
          console.log("[Archive] Loading Data. ID:", id, "isDemo:", isDemo, "familyId:", familyId);
          console.log("[Archive] Loading Data. ID:", id, "isDemo:", isDemo, "familyId:", familyId);

          // 1. 获取成员信息请求
          if (isDemo) {
            const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
            const allDemo = [...DEMO_MEMBERS, ...customMembers];
            const found = allDemo.find(m => m.id === Number(id));
            if (found) setMember(found);
            setMembers(allDemo);
          } else {
            promises.push(
              fetch(`/api/family-members/${id}?familyId=${familyId}`).then(res => res.ok ? res.json() : null).then(data => {
                if (data) {
                  setMember(data);
                  if (data.id && (data.avatar_url || data.avatarUrl)) {
                    updateAvatarCache(data.id, data.avatar_url || data.avatarUrl);
                  }
                }
              })
            );

            // 2. 预热家庭头像并存储成员列表
            fetch(`/api/family-members?familyId=${familyId}`).then(res => res.ok ? res.json() : []).then(allMembers => {
              if (Array.isArray(allMembers)) {
                setMembers(allMembers);
                allMembers.forEach((m: any) => {
                  if (m.id && (m.avatar_url || m.avatarUrl)) updateAvatarCache(m.id, m.avatar_url || m.avatarUrl);
                });
              }
            }).catch(e => console.warn("Avatar pre-warm failed:", e));
          }

          // 3. 获取档案归档留言请求
          if (isDemoMode(parsed)) {
            const data = DEMO_MEMORIES.filter(m => String(m.familyMemberId) === String(id));
            const currUser = parsed;
            const formattedMessages = data.map((m: any) => {
              const userKey = currUser ? String(currUser.memberId || currUser.id || currUser.name) : "匿名";
              return {
                ...m,
                isLiked: Array.isArray(m.likedBy) ? m.likedBy.includes(userKey) : false
              };
            });
            console.log("[Archive] Demo messages count:", data.length, "for ID:", id);
            setMessages(formattedMessages);
          } else {
            promises.push(
              fetch(`/api/memories?memberId=${id}&familyId=${familyId}`).then(res => res.ok ? res.json() : []).then(data => {
                if (Array.isArray(data)) {
                  data.forEach((m: any) => {
                    if (m.authorId && m.authorAvatar) updateAvatarCache(m.authorId, m.authorAvatar);
                  });
                }
                const currUser = parsed;
                const formattedMessages = (Array.isArray(data) ? data : []).map((m: any) => {
                  const userKey = currUser ? String(currUser.memberId || currUser.id || currUser.name) : "匿名";
                  return {
                    ...m,
                    isLiked: Array.isArray(m.likedBy) ? m.likedBy.includes(userKey) : false
                  };
                });
                setMessages(formattedMessages);
              })
            );
          }

          // 4. 获取创建者信息
          if (!isDemo) {
            promises.push(
              fetch(`/api/family-members/archive-creators/${id}`).then(res => res.ok ? res.json() : null).then(data => {
                if (data) setCreatorName(data.creatorName);
                console.log("[Archive] Creator loaded:", data?.creatorName);
              })
            );
          }

          // 5. 获取与之相关的生平大事记
          if (isDemoMode(parsed)) {
            const customEvents = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
            const allEvents = [...DEMO_EVENTS, ...customEvents];
            const data = allEvents.filter(e => String(e.memberId) === String(id));
            const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setRelatedEvents(sorted);
          } else {
            promises.push(
              fetch(`/api/events?familyId=${familyId}&memberId=${id}`).then(res => res.ok ? res.json() : []).then(data => {
                if (Array.isArray(data)) {
                  const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  setRelatedEvents(sorted);
                  console.log("[Archive] Events loaded:", sorted.length);
                }
              })
            );
          }

          console.log("[Archive] Waiting for all promises...", promises.length);
          await Promise.all(promises);
          console.log("[Archive] All core promises resolved");
        } catch (err) {
          console.error("[Archive] Load error:", err);
        } finally {
          console.log("[Archive] Setting loading to false");
          setLoading(false);
        }
      };

      fetchMemberData();
      shuffleQuestions();
    }
  }, [id]);

  const shuffleQuestions = () => {
    // 强制触发更新提示
    setQuestions([]);
    fetch(`/api/events/question-bank?limit=3&_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setQuestions(data);
        }
      });
  };

  const handleUpdateInfo = async () => {
    if (!member) return;
    try {
      // 🚀 核心：同步更新排行逻辑
      const newRank = editInfoForm.ranking;
      const oldTag = member.logicTag || member.logic_tag || "";
      const baseTag = String(oldTag).split('-o')[0];
      const newTag = newRank !== '不知道' ? `${baseTag}-o${newRank}` : baseTag;

      // 处理称谓中的排行补偿
      let newRel = member.relationship || "";
      if (newRank !== '不知道') {
        const cleanRel = newRel.replace(/^(大|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|小|老)/, '');
        newRel = `${newRank}${cleanRel}`;
      } else {
        newRel = newRel.replace(/^(大|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|小|老)/, '');
      }

      const isDemo = isDemoMode(currentUser);
      if (isDemo) {
        const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");
        const updatedMembers = customMembers.map((m: any) => m.id === member.id ? {
          ...m,
          name: editInfoForm.name,
          gender: editInfoForm.gender,
          birthDate: editInfoForm.birthday,
          birth_date: editInfoForm.birthday,
          bio: editInfoForm.bio,
          ancestralHall: newRank !== '不知道' ? `${newRank}房` : null,
          logicTag: newTag,
          relationship: newRel
        } : m);
        localStorage.setItem("demoCustomMembers", JSON.stringify(updatedMembers));

        // 更新当前页面视图
        setMember({
          ...member,
          name: editInfoForm.name,
          gender: editInfoForm.gender,
          birthDate: editInfoForm.birthday,
          birth_date: editInfoForm.birthday,
          bio: editInfoForm.bio,
          ancestralHall: newRank !== '不知道' ? `${newRank}房` : null,
          logicTag: newTag,
          relationship: newRel
        } as any);
        setMembers(updatedMembers);
        setShowEditInfoModal(false);
        return;
      }

      const response = await fetch(`/api/family-members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editInfoForm.name,
          gender: editInfoForm.gender,
          birthDate: editInfoForm.birthday,
          bio: editInfoForm.bio,
          ancestralHall: newRank !== '不知道' ? `${newRank}房` : null,
          logicTag: newTag,
          relationship: newRel
        })
      });
      if (response.ok) {
        setMember({
          ...member,
          name: editInfoForm.name,
          gender: editInfoForm.gender,
          birthDate: editInfoForm.birthday,
          birth_date: editInfoForm.birthday,
          bio: editInfoForm.bio,
          ancestralHall: newRank !== '不知道' ? `${newRank}房` : null,
          logicTag: newTag,
          relationship: newRel
        } as any);
        // 同时更新列表，确保关系推导用的是新数据
        setMembers(prev => prev.map(m => m.id === member.id ? {
          ...m,
          ...editInfoForm,
          birth_date: editInfoForm.birthday,
          ancestral_hall: newRank !== '不知道' ? `${newRank}房` : null,
          logic_tag: newTag,
          relationship: newRel
        } : m) as any);
        setShowEditInfoModal(false);
      }
    } catch (err) {
      console.error("Update info failed:", err);
    }
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

    const familyId = currentUser?.familyId || null;

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

    // --- Optimistic UI: Prepare local preview data ---
    const tempId = -Math.floor(Math.random() * 1000000); // Temporary ID for UI
    const localContent = transcription || (inputMode === "photo" ? "分享了照片" : inputMode === "video" ? "分享了视频" : "留下了足迹");
    const localMediaUrl = inputMode === "photo" ? selectedImage : (inputMode === "video" ? selectedVideo : (inputMode === "voice" ? recordedAudioUrl : null));

    const optimisticMsg: any = {
      id: tempId,
      familyMemberId: Number(id),
      authorId: currentUser?.memberId || null,
      authorName: currentUser?.name || "家人",
      authorRole: currentUser?.relationship || "家人",
      authorAvatar: currentUser?.avatar,
      content: localContent,
      type: inputMode === "voice" ? MessageType.AUDIO :
        inputMode === "photo" ? MessageType.IMAGE :
          inputMode === "video" ? MessageType.VIDEO : MessageType.TEXT,
      mediaUrl: localMediaUrl,
      duration: recordingTime,
      isLiked: false,
      likes: 0,
      createdAt: new Date().toISOString(),
      sending: true // Flag to show "sending" state if desired
    };

    // 1. 立即更新 UI (乐观 UI)，确保用户点击后几毫秒内就能看到新留言
    setMessages(prev => [optimisticMsg, ...prev]);
    setTranscription("");
    setSelectedImage(null);
    setSelectedVideo(null);
    setRecordedAudioUrl(null);
    setIsRecording(false);
    setRecordingTime(0);

    // 2. 立即滚动到留言区域
    setTimeout(() => {
      const wall = document.getElementById("archive-wall");
      if (wall) wall.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    // 3. 在完全分离的异步块中执行后台处理，绝不阻塞主线程或 UI 渲染
    (async () => {
      try {
        let uploadedUrl = localMediaUrl;
        if (!isDemoMode(currentUser)) {
          if (inputMode === "photo" && selectedImage) {
            uploadedUrl = await uploadFile(selectedImage, 'archive_photos', 'jpg');
          } else if (inputMode === "video" && selectedVideo) {
            uploadedUrl = await uploadFile(selectedVideo, 'archive_videos', 'mp4');
          } else if (inputMode === "voice" && recordedAudioUrl) {
            uploadedUrl = await uploadFile(recordedAudioUrl, 'archive_audio', 'webm');
          }

          const msgData = {
            ...optimisticMsg,
            familyId: familyId,
            mediaUrl: uploadedUrl,
            sending: false
          };
          delete (msgData as any).id;
          delete (msgData as any).createdAt;

          const res = await fetch("/api/memories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(msgData)
          });

          if (res.ok) {
            const data = await res.json();
            // 用服务端生成的真实 ID 更新本地留言
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id, mediaUrl: uploadedUrl, sending: false } : m));
          } else {
            throw new Error("Server save failed");
          }
        } else {
          // 演示模式：等待一小会模拟真实感后标记完成
          setTimeout(() => {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, sending: false } : m));
          }, 800);
        }
      } catch (error) {
        console.error("[OPTIMISTIC] Background processing failed:", error);
        // 如果最终失败，从列表中彻底移除并通知用户
        setMessages(prev => prev.filter(m => m.id !== tempId));
        alert("留言发送失败，请检查网络后重试。");
      }
    })();
  }; // handleWarmResponse 结束

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

  const generateAiBiography = async () => {
    if (!member || isGeneratingBio) return;
    setIsGeneratingBio(true);
    try {
      const response = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "biography",
          memberName: member.name,
          events: relatedEvents,
          messages: messages // Use message wall comments for extra emotional flavor
        })
      });
      if (response.ok) {
        const data = await response.json();
        setAiBiography(data.text);
        // Scroll to the AI story section nicely
        setTimeout(() => {
          const el = document.getElementById("ai-biography-section");
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        const errorData = await response.json();
        console.warn("AI Biography generation error:", errorData);
        alert(`AI 整理失败: ${errorData.error || "未知原因"}`);
      }
    } catch (err: any) {
      console.error("AI Biography generation failed critically:", err);
      alert(`网络或系统繁忙，请稍后再试 (${err.message})`);
    } finally {
      setIsGeneratingBio(false);
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
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    // 真正的逻辑在执行按钮上
  };

  const executeRealDelete = async () => {
    const savedUser = localStorage.getItem("currentUser");
    const currentUser = savedUser ? JSON.parse(savedUser) : null;

    if (isDemoMode(currentUser)) {
      const midToDelete = String(member?.id || id);
      const customMembers = JSON.parse(localStorage.getItem("demoCustomMembers") || "[]");

      // 🛡️ 断链保护：检查是否有其他成员依赖此人作为录入关系链的节点
      const dependents = customMembers.filter((m: any) =>
        String(m.addedByMemberId || m.added_by_member_id || "") === midToDelete
      );

      if (dependents.length > 0) {
        // 在弹窗内显示错误，不用 alert（alert 可能被遮罩）
        const names = dependents.map((m: any) => m.name || "未命名").join("、");
        setDeleteBlockReason(`以下成员是通过「${member?.name || "该成员"}」添加的，删除后关系链会断裂：${names}。请先处理上述成员。`);
        return;
      }

      // 没有依赖，安全删除
      const updatedMembers = customMembers.filter((m: any) => String(m.id) !== midToDelete);
      localStorage.setItem("demoCustomMembers", JSON.stringify(updatedMembers));

      const customEvents = JSON.parse(localStorage.getItem("demoCustomEvents") || "[]");
      const updatedEvents = customEvents.filter((e: any) => String(e.memberId) !== midToDelete);
      localStorage.setItem("demoCustomEvents", JSON.stringify(updatedEvents));

      // 通知 FamilySquare 刷新列表，然后返回档案列表页
      window.dispatchEvent(new Event('sync-user'));
      navigate(-1); // 直接返回上一页（档案列表），无需跳转到 square
      return;
    } else {
      if (!member) return;
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
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "video") => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      if (type === "photo") setSelectedImage(url);
      else setSelectedVideo(url);
    }
  };

  // 🚀 核心纠偏：使用统一 Hook 计算视名称谓
  const { meNode, relationship: rawRel, relType: type, isMe: isMeMember } = useKinshipPerspective(member, members);

  // 🛡️ 视觉保险：防止算法坍缩回“奶奶”
  const rel = useMemo(() => {
    const creatorId = String(member?.addedByMemberId || (member as any)?.added_by_member_id || "");
    if (rawRel === '奶奶' && creatorId === '3') {
      return '五姑婆'; // 强制纠偏显示
    }
    return rawRel;
  }, [rawRel, member]);

  const isPet = member ? (member.memberType === 'pet' || member.member_type === 'pet') : false;
  const isSocial = member ? (member.kinshipType === 'social' || member.kinship_type === 'social' || type === 'social') : false;

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
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteMember();
              }}
              className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors active:scale-90"
              title="删除档案"
            >
              <Trash2 size={24} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-8 space-y-12 max-w-2xl mx-auto w-full">
        {/* 1. 档案头部卡片：将“散点”聚合成“整体” */}
        <section className="relative">
          <div className="bg-white/40 backdrop-blur-sm rounded-[3rem] p-8 border border-white shadow-sm flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="size-32 rounded-full overflow-hidden border-4 border-white shadow-2xl relative z-10">
                <img src={displayAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              {isMeMember && (
                <div className="absolute -bottom-1 -right-1 bg-[#eab308] text-black text-[10px] font-black px-4 py-1.5 rounded-full border-2 border-white shadow-lg z-20">
                  我自己
                </div>
              )}
              {member.isRegistered && !isMeMember && (
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white shadow-lg z-20">
                  <CheckCircle size={18} fill="currentColor" className="text-white" />
                </div>
              )}
              {/* 装饰性背景 */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-amber-100/20 to-transparent rounded-full blur-2xl -z-0" />
            </div>

            <div className="space-y-2">
              <h1 className={cn(
                "text-3xl font-black flex items-center justify-center gap-3",
                type === 'blood' ? "text-slate-900" :
                  type === 'affinal' ? "text-[#8b5e34]" : "text-slate-400"
              )}>
                {isMeMember ? "我的记忆档案" : `${displayName}的记忆档案`}
                {member && (!member.isRegistered || isDemoMode(currentUser)) && (
                  <button
                    onClick={() => {
                      setEditInfoForm({
                        name: member.name || "",
                        gender: member.gender || "male",
                        birthday: member.birthDate || "",
                        bio: member.bio || "",
                        ranking: (() => {
                          const tag = member.logicTag || member.logic_tag || "";
                          const match = String(tag).match(/-O(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|小|幺|老)$/i);
                          return match ? match[1] : (member.ancestralHall?.replace('房', '') || "不知道");
                        })()
                      });
                      setShowEditInfoModal(true);
                    }}
                    className="p-1.5 rounded-full bg-slate-50 text-slate-300 hover:text-[#eab308] transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </h1>

              {displayBio && displayBio.trim() !== "" && (
                <div className="relative px-10 pt-1 pb-2">
                  <p className="text-base text-slate-400 italic font-medium leading-relaxed tracking-wide opacity-80">
                    “{displayBio}”
                  </p>
                </div>
              )}
            </div>

            {/* 药丸按钮栏：区分主次的动作条 */}
            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap min-h-[44px] px-4 w-full">
              {/* 组A：身份身份属性 (只读感) */}
              <div className="flex items-center gap-2">
                {isMeMember ? (
                  <span className="text-[11px] font-black px-4 py-2 rounded-full bg-amber-50 text-[#eab308] border border-amber-100/30 tracking-widest flex items-center gap-2 shadow-sm">
                    <Sparkles size={12} fill="currentColor" /> 我
                  </span>
                ) : (
                  <span className={cn(
                    "text-[11px] font-black px-4 py-2 rounded-full border tracking-widest flex items-center gap-2 shadow-sm",
                    type === 'blood' ? "text-[#eab308] bg-amber-50/50 border-amber-100" :
                    type === 'affinal' ? "text-[#8b5e34] bg-[#8b5e34]/5 border-[#8b5e34]/20" :
                    "text-slate-400 bg-slate-50 border-slate-100"
                  )}>
                    <Sparkles size={12} fill="currentColor" /> {rel}
                  </span>
                )}
                
                <span className={cn(
                  "text-[11px] font-black px-3 py-2 rounded-full border flex items-center gap-1.5 shadow-sm",
                  (isMeMember ? currentUser?.gender : member.gender) === 'female' ? "text-pink-500 bg-pink-50 border-pink-100" : "text-blue-500 bg-blue-50 border-blue-100"
                )}>
                  {(isMeMember ? currentUser?.gender : member.gender) === 'female' ? "♀ 女" : "♂ 男"}
                </span>
              </div>

              {/* 视觉分割线 */}
              <div className="h-4 w-px bg-slate-100 mx-2" />

              {/* 组B：功能操作 (交互感) */}
              <div className="flex items-center gap-2">
                {member && !member.isRegistered && !isMeMember && member.memberType !== 'pet' && (
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="px-4 py-2 bg-[#eab308] text-black rounded-full text-[11px] font-black inline-flex items-center gap-2 hover:bg-[#d9a306] transition-all shadow-md active:scale-95 border-b-2 border-amber-600/20"
                  >
                    邀请注册 <Share2 size={12} />
                  </button>
                )}

                {!(isPet || isSocial) && (
                  <button
                    onClick={onAddRelative}
                    className="px-4 py-2 bg-white text-slate-700 rounded-full text-[11px] font-black inline-flex items-center gap-2 border border-slate-200 hover:bg-slate-50 transition-all shadow-md active:scale-95"
                  >
                    添加亲属 <Plus size={12} className="text-[#eab308]" strokeWidth={3} />
                  </button>
                )}
              </div>
            </div>

            {/* 底部微信息 */}
            <div className="mt-6 flex flex-col items-center gap-2 opacity-50 border-t border-slate-100/50 pt-4 w-2/3">
              {type === 'blood' && member?.ancestralHall && !isMeMember && (
                <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase flex items-center gap-1.5">
                  <MapPin size={10} /> 房分：{member.ancestralHall}
                </p>
              )}
              {creatorName && (
                <div className="text-[10px] font-bold text-slate-300 italic">
                  {isMeMember ? "由 我 为自己开启记忆档案" : `由 ${creatorName || "系统"} 为 TA 开启记忆档案`}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 🚀 NEW: Life Chronicle Section (个人生平编年史) */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Calendar size={16} /> 个人编年史
            </h3>
            <span className="text-[10px] font-bold text-slate-300">共 {relatedEvents.length} 件大事记</span>
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute left-10 top-12 bottom-12 w-0.5 bg-gradient-to-b from-amber-200 via-amber-100 to-transparent opacity-50" />

            <div className="space-y-8 relative z-10">
              {relatedEvents.length === 0 ? (
                <div className="text-center py-6 text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                  暂无记录的大事记
                </div>
              ) : (
                relatedEvents.map((ev, idx) => (
                  <button
                    key={ev.id}
                    onClick={() => navigate(`/square#events`, { state: { selectedDate: ev.date } })}
                    className="w-full flex gap-6 text-left group active:scale-[0.98] transition-all"
                  >
                    <div className="flex flex-col items-center pt-1.5 shrink-0">
                      <div className={cn(
                        "size-10 rounded-full border-2 bg-white transition-all group-hover:scale-110 z-20 shadow-sm flex items-center justify-center text-[#eab308]",
                        idx === 0 ? "border-[#eab308] ring-4 ring-amber-50" : "border-slate-100"
                      )}>
                        {ev.title.includes("生日") ? "🎂" : ev.title.includes("聚") ? "🤝" : ev.title.includes("旅游") ? "✈️" : <Calendar size={18} />}
                      </div>
                    </div>

                    <div className="flex-1 space-y-2 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-[#eab308] uppercase tracking-widest px-3 py-1 bg-amber-50 rounded-full border border-amber-100/50">
                          {ev.date}
                        </span>
                        <ChevronRight size={14} className="text-slate-200 group-hover:text-amber-300 transition-colors" />
                      </div>
                      <h4 className="text-lg font-black text-slate-800 group-hover:text-[#eab308] transition-colors">
                        {ev.title}
                      </h4>
                      {ev.notes && (
                        <p className="text-sm text-slate-400 line-clamp-2 font-medium italic opacity-70 leading-relaxed">
                          “{ev.notes}”
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 text-center">
              <button
                onClick={generateAiBiography}
                disabled={isGeneratingBio}
                className={cn(
                  "px-6 py-2.5 bg-gradient-to-r from-amber-500 to-[#eab308] text-white rounded-full text-xs font-black flex items-center gap-2 mx-auto active:scale-95 transition-all shadow-lg hover:shadow-amber-200/50 disabled:opacity-50",
                  isGeneratingBio && "animate-pulse"
                )}
              >
                <Sparkles size={14} className={isGeneratingBio ? "animate-spin" : ""} />
                {isGeneratingBio ? "AI 正在梳理岁月回忆..." : "AI 整理生平故事"}
              </button>
            </div>
          </div>

          {/* AI Biography Story Card */}
          <AnimatePresence>
            {aiBiography && (
              <motion.div
                id="ai-biography-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] p-8 shadow-2xl border-2 border-amber-100 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <Sparkles size={120} className="text-amber-600" />
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="size-10 rounded-full bg-amber-50 flex items-center justify-center text-[#eab308]">
                    <Sparkles size={20} fill="currentColor" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-800 tracking-tight">
                      {member.name} 的人生小传
                    </h4>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-4 top-0 bottom-0 w-1 bg-amber-100/50 rounded-full" />
                  <div className="space-y-4 text-slate-600 leading-relaxed font-medium">
                    {aiBiography.split('\n').filter(p => p.trim()).map((para, i) => (
                      <p key={i} className="text-sm indent-0">
                        {para}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex justify-center">
                  <div className="w-12 h-1 bg-slate-100 rounded-full" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Input Section */}
        <section className="space-y-8">
          {(() => {
            const isPet = member.memberType === 'pet' || member.member_type === 'pet';
            const isSocial = member.kinshipType === 'social' || member.kinship_type === 'social' || type === 'social';

            // 朋友和宠物不需要推荐问题（代际/家族问题不适用）
            const hideQuestions = isPet || isSocial;

            return (
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setTab("say")}
                  className={cn(
                    "flex-1 py-5 text-xl font-black border-b-4 transition-all",
                    tab === "say" ? "text-[#eab308] border-[#eab308]" : "text-slate-400 border-transparent"
                  )}
                >
                  {isMeMember ? "我想对自己说..." : "我想对他/她说..."}
                </button>
                {!hideQuestions && (
                  <button
                    onClick={() => setTab("questions")}
                    className={cn(
                      "flex-1 py-5 text-xl font-black border-b-4 transition-all",
                      tab === "questions" ? "text-[#eab308] border-[#eab308]" : "text-slate-400 border-transparent"
                    )}
                  >
                    试试推荐问题
                  </button>
                )}
              </div>
            );
          })()}

          <AnimatePresence mode="wait">
            {tab === "questions" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} key="questions">
                <Card className="bg-amber-50/50 border-2 border-amber-100 p-8 rounded-[2.5rem] relative overflow-hidden group">
                  <button
                    onClick={shuffleQuestions}
                    className="absolute top-6 right-6 text-[#eab308] p-3 hover:bg-white rounded-full transition-all active:rotate-180 z-10 shadow-sm border border-amber-100"
                    title="换一换"
                  >
                    <motion.div whileTap={{ rotate: 180 }} transition={{ duration: 0.3 }}>
                      <RotateCcw size={24} />
                    </motion.div>
                  </button>
                  {questions.length === 0 ? (
                    <div className="py-10 text-center animate-pulse text-slate-400 font-bold">正在整理推荐问题...</div>
                  ) : (
                    <ul className="space-y-4 pr-10">
                      {questions.map((q, i) => (
                        <motion.li
                          key={q}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex gap-4 text-slate-700 font-black text-xl leading-relaxed"
                        >
                          <span className="text-[#eab308] scale-125">{i + 1}.</span> {q}
                        </motion.li>
                      ))}
                    </ul>
                  )}
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

              <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white mb-6 group">
                {selectedImage && (
                  <>
                    <img src={selectedImage} alt="" className="w-full h-auto" />
                    {/* 🚀 PREMIUM HOOK: 带流光效果的唤醒按钮 */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "absolute bottom-6 left-6 px-6 py-3 rounded-full font-black text-xs flex items-center gap-3 shadow-2xl transition-all overflow-hidden",
                        "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-amber-400/30 text-amber-200"
                      )}
                    >
                      <div className="relative">
                        <Sparkles size={16} className="text-amber-400" />
                        <div className="absolute -top-1 -right-1">
                          <div className="size-2 bg-red-500 rounded-full ring-2 ring-slate-900" />
                        </div>
                      </div>
                      <span className="tracking-widest flex items-center gap-1.5">
                        让记忆开口说话 <span className="bg-amber-400/20 text-[8px] px-1.5 py-0.5 rounded text-amber-400">PRO</span>
                      </span>
                      {/* 闪动扫描流光 */}
                      <motion.div
                        animate={{ x: [-100, 200] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-20"
                      />
                    </motion.button>
                  </>
                )}
                {selectedVideo && <video src={selectedVideo} controls className="w-full h-auto" />}
                <button
                  onClick={() => { setSelectedImage(null); setSelectedVideo(null); }}
                  className="absolute top-6 right-6 p-2 bg-black/50 text-white rounded-full backdrop-blur-md border border-white/20 hover:bg-black/70 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <Button
              className={cn(
                "w-full py-5 text-xl font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg",
                canSend
                  ? "bg-[#eab308] hover:bg-[#d9a306] text-black shadow-[#eab308]/20"
                  : "bg-slate-200 text-slate-400 shadow-none cursor-not-allowed"
              )}
              onClick={handleWarmResponse}
              disabled={!canSend}
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
              // NOTE: isAuthor 仅通过 authorId 精确匹配，避免 familyMemberId（档案归属人）导致误判
              const isAuthor = currentUser && msg.authorId && currentUser.memberId && String(msg.authorId) === String(currentUser.memberId);
              return (
                <motion.div
                  key={msg.id || i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
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
      </main >

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

                  <div className="space-y-2 pb-6">
                    <h3 className="text-2xl font-black text-slate-800">邀请档案正式注册</h3>
                    <p className="text-sm text-slate-500">您可以复制邀请码发送，或让 {member.name} 直接扫码加盟。</p>
                  </div>

                  {/* QR Code Section */}
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center gap-3">
                    <div className="size-40 bg-slate-50 rounded-2xl flex items-center justify-center p-2 border-2 border-dashed border-slate-200">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/register?code=INV-${member.id}-${currentUser?.memberId}`)}`}
                        alt="Join QR Code"
                        className="w-full h-full object-contain mix-blend-multiply"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none">扫一扫直接注册</span>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">专属邀请码</p>
                    <p className="text-4xl font-mono font-black text-[#eab308] tracking-wider mb-2 select-all leading-none">
                      INV-{member.id}-{currentUser?.memberId}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const code = `INV-${member.id}-${currentUser?.memberId}`;
                      navigator.clipboard.writeText(code).then(() => {
                        alert("邀请码已复制");
                        setShowShareModal(false);
                      });
                    }}
                    className="w-full py-4 bg-[#eab308] text-black rounded-2xl font-black shadow-lg shadow-[#eab308]/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <Copy size={18} /> 仅复制邀请码
                  </button>
                </div>
              </motion.div>
            </div>
          )
        }
        {
          showEditInfoModal && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center backdrop-blur-sm p-0 sm:p-4">

              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="bg-white w-full rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px] flex flex-col max-h-[85vh]"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold">编辑档案资料</h3>
                  <button onClick={() => setShowEditInfoModal(false)} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar pb-4 text-left">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 ml-4 uppercase tracking-widest">姓名</label>
                    <input
                      type="text"
                      value={editInfoForm.name}
                      onChange={(e) => setEditInfoForm({ ...editInfoForm, name: e.target.value })}
                      className="w-full h-16 px-6 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 ml-4 uppercase tracking-widest">生日</label>
                    <input
                      type="date"
                      value={editInfoForm.birthday}
                      onChange={(e) => setEditInfoForm({ ...editInfoForm, birthday: e.target.value })}
                      className="w-full h-16 px-6 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 ml-4 uppercase tracking-widest">简介</label>
                    <textarea
                      value={editInfoForm.bio}
                      onChange={(e) => setEditInfoForm({ ...editInfoForm, bio: e.target.value })}
                      className="w-full min-h-[100px] p-6 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#eab308]/20 transition-all resize-none"
                      placeholder="写一点关于TA的介绍..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 ml-4 uppercase tracking-widest">性别</label>
                    <div className="grid grid-cols-2 gap-4 px-2">
                      {["male", "female"].map((g) => {
                        const isActive = editInfoForm.gender === g;
                        return (
                          <div
                            key={g}
                            className={cn(
                              "h-14 rounded-2xl font-black transition-all flex items-center justify-center cursor-not-allowed border-2",
                              isActive
                                ? (g === "male" ? "bg-blue-500 border-white text-white shadow-lg shadow-blue-100" : "bg-rose-500 border-white text-white shadow-lg shadow-rose-100")
                                : "bg-slate-50 border-transparent text-slate-300"
                            )}
                          >
                            {g === "male" ? "男 (♂)" : "女 (♀)"}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>

                <div className="pt-8 grid grid-cols-2 gap-4">
                  <button onClick={() => setShowEditInfoModal(false)} className="py-5 bg-slate-100 rounded-3xl font-bold text-slate-500">取消</button>
                  <button
                    onClick={handleUpdateInfo}
                    className="py-5 bg-[#eab308] text-black rounded-3xl font-bold shadow-lg shadow-[#eab308]/20"
                  >
                    保存修改
                  </button>
                </div>
              </motion.div>
            </div>
          )
        }
        {
          showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl text-center space-y-6"
              >
                <div className="size-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800">确认删除档案？</h3>
                  <p className="text-xs text-slate-400 font-bold">此操作不可恢复，档案及其附属的回忆留言将一并移除。</p>
                </div>
                {/* 断链警告：内联显示，不使用原生 alert */}
                {deleteBlockReason && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-2xl p-4 text-left leading-relaxed">
                    ⚠️ 无法删除
                    <p className="mt-1 font-medium text-amber-700">{deleteBlockReason}</p>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {!deleteBlockReason && (
                    <button
                      onClick={executeRealDelete}
                      className="w-full py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-200 active:scale-95 transition-transform"
                    >
                      确认删除
                    </button>
                  )}
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteBlockReason(""); }}
                    className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black active:scale-95 transition-transform"
                  >
                    {deleteBlockReason ? "我知道了" : "我再想想"}
                  </button>
                </div>
              </motion.div>
            </div>
          )
        }
      </AnimatePresence >
    </div >
  );
};
