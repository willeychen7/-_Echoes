import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
    Play, Plus, Trash2, Heart, Mic, Camera, Video, Smile, Send,
    ChevronRight, ChevronUp, ChevronDown, MessageCircle, X, Sparkles, Share2
} from "lucide-react";
import { FamilyEvent, Message, MessageType } from "../types";
import { cn } from "../lib/utils";
import { getRelativeTime } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { isDemoMode } from "../demo-data";
import { useAvatarCache, resolveAvatar } from "../lib/useAvatarCache";
import { getSafeAvatar } from "../constants";
import confetti from "canvas-confetti";

/**
 * 语音消息条组件：支持播放/暂停及进度显示
 */
export const AudioBar: React.FC<{
    url: string;
    duration: number;
    isPlaying: boolean;
    onToggle: () => void;
}> = ({ url, duration, isPlaying, onToggle }) => {
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const onToggleRef = useRef(onToggle);
    onToggleRef.current = onToggle;

    // NOTE: 核心修复 —— 将音频初始化与播放逻辑分离，防止 re-render 导致的播放冲突或卡顿
    useEffect(() => {
        if (!url) return;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.loop = false; // 明确禁用循环

        audio.onended = () => {
            setProgress(0);
            onToggleRef.current(); // 播放结束，通知父组件重置状态
        };

        audio.ontimeupdate = () => {
            if (audio.duration) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };

        audio.onerror = (e) => {
            console.error("[AUDIO] Playback error:", e);
            alert("语音播放失败，可能是格式暂不支持或网络连接问题");
            onToggleRef.current();
        };

        return () => {
            audio.pause();
            audio.onended = null;
            audio.ontimeupdate = null;
            audio.onerror = null;
            audioRef.current = null;
        };
    }, [url]);

    // 独立处理播放/暂停，避免对 Audio 对象的重复操作
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.play().catch(err => {
                console.error("[AUDIO] Play failed:", err);
                onToggleRef.current();
            });
        } else {
            audio.pause();
        }
    }, [isPlaying]);

    // 缩减波纹数量，确保右侧文字显示完整
    const waveHeights = [14, 28, 16, 32, 20, 36, 14, 24, 18, 30, 16, 28, 22, 14];

    return (
        <div
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="bg-[#eab308]/5 p-2 rounded-2xl flex items-center gap-3 w-full max-w-[280px] cursor-pointer hover:bg-[#eab308]/10 transition-all active:scale-95 border border-[#eab308]/10 group"
        >
            <div className={cn(
                "size-12 rounded-full flex items-center justify-center shadow-lg transition-all shrink-0",
                isPlaying ? "bg-red-500 scale-105 shadow-red-200" : "bg-[#eab308] shadow-amber-100"
            )}>
                {isPlaying ? <div className="size-4 bg-white rounded-sm" /> : <Play size={22} fill="currentColor" className="ml-1" />}
            </div>
            <div className="flex-1 flex items-center justify-between gap-[4px] h-8 px-1 overflow-hidden">
                {waveHeights.map((h, i) => {
                    const barProgress = (i / waveHeights.length) * 100;
                    const isActive = barProgress <= progress;
                    return (
                        <motion.div
                            key={i}
                            className={cn(
                                "w-1 rounded-full transition-colors duration-300",
                                isActive ? "bg-[#eab308]" : "bg-slate-200"
                            )}
                            animate={{
                                height: isPlaying ? [h * 0.4, h, h * 0.4] : h * 0.4
                            }}
                            transition={{
                                repeat: isPlaying ? Infinity : 0,
                                duration: 0.6,
                                delay: i * 0.05,
                                ease: "easeInOut"
                            }}
                        />
                    );
                })}
            </div>
            <span className="text-sm font-black text-[#eab308] min-w-[36px] text-right pr-2 shrink-0">{Math.round(duration || 0)}"</span>
        </div>
    );
};

/**
 * 留言列表子组件
 */
export const WallMessages: React.FC<{
    messages: Message[];
    currentUser: any;
    getMsgTypeInfo: (type: MessageType) => { label: string; color: string };
    handleLike: (id: number) => void;
    onDeleteMessage?: (id: number) => void;
    maxVisible: number;
}> = ({ messages, currentUser, getMsgTypeInfo, handleLike, onDeleteMessage, maxVisible }) => {
    const [expanded, setExpanded] = useState(false);
    const [playingId, setPlayingId] = useState<number | null>(null);
    const avatarCache = useAvatarCache();

    const visibleMessages = expanded ? messages : messages.slice(0, maxVisible);
    const hasMore = messages.length > maxVisible;

    return (
        <div className="space-y-5 pt-2">
            {visibleMessages.map((msg, i) => {
                const typeInfo = getMsgTypeInfo(msg.type);
                const isAuthor = currentUser && (
                    (msg.authorId && String(msg.authorId) === String(currentUser.id)) ||
                    (msg.familyMemberId && Number(msg.familyMemberId) === Number(currentUser.memberId)) ||
                    (String(msg.authorName) === String(currentUser.name))
                );
                const isPlaying = playingId === msg.id;

                return (
                    <div key={msg.id} className="flex gap-4">
                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                            <div className="size-12 rounded-full overflow-hidden border-2 border-white shadow-md">
                                <img
                                    src={isAuthor ? getSafeAvatar(currentUser.avatar) : resolveAvatar(avatarCache, msg.authorId || msg.familyMemberId, msg.authorAvatar, msg.authorName || String(i))}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
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
                                <p className="text-xl text-slate-600 font-serif italic mb-2">“{msg.content}”</p>
                            )}
                            {msg.type === MessageType.AUDIO && (
                                <div className="space-y-4">
                                    <AudioBar
                                        url={msg.mediaUrl || ""}
                                        duration={msg.duration || 0}
                                        isPlaying={playingId === msg.id}
                                        onToggle={() => setPlayingId(playingId === msg.id ? null : msg.id)}
                                    />
                                    {msg.content && <p className="text-xl text-slate-600 font-serif italic">“{msg.content}”</p>}
                                </div>
                            )}
                            {msg.type === MessageType.IMAGE && msg.mediaUrl && (
                                <div className="space-y-3">
                                    <img src={msg.mediaUrl} alt="" className="rounded-xl shadow-md w-full h-auto border border-white" />
                                    {msg.content && msg.content !== "分享了照片" && (
                                        <p className="text-xl text-slate-600 font-serif italic mb-2">“{msg.content}”</p>
                                    )}
                                </div>
                            )}
                            {msg.type === MessageType.VIDEO && msg.mediaUrl && (
                                <div className="space-y-3">
                                    <div className="aspect-video bg-black rounded-xl relative flex items-center justify-center overflow-hidden">
                                        <video src={msg.mediaUrl} controls className="w-full h-full object-cover opacity-60" />
                                    </div>
                                    {msg.content && msg.content !== "分享了视频" && (
                                        <p className="text-xl text-slate-600 font-serif italic mb-2">“{msg.content}”</p>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-3">
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

export const InlineBlessingPanel: React.FC<{
    event: FamilyEvent;
    currentUser: any;
    onClose: () => void;
    hasSentBlessing: boolean;
}> = ({ event, currentUser, onClose, hasSentBlessing }) => {
    const [inputMode, setInputMode] = useState<"voice" | "text" | "photo" | "video">("voice");
    const [transcription, setTranscription] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
    const [showWall, setShowWall] = useState(hasSentBlessing);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiSummary, setAiSummary] = useState("");
    const [showInput, setShowInput] = useState(!hasSentBlessing);
    const [playingId, setPlayingId] = useState<number | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        fetch(`/api/messages?eventId=${event.id}`)
            .then(res => res.json())
            .then(data => {
                const mappedMessages = (Array.isArray(data) ? data : []).map((m: any) => {
                    const userKey = currentUser ? String(currentUser.memberId || currentUser.id || currentUser.name) : "匿名";
                    return {
                        ...m,
                        isLiked: m.likedBy?.includes(userKey) || false
                    };
                });
                setMessages(mappedMessages);
            });
    }, [event.id, currentUser]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const VIDEO_NOTICE = "视频上传功能正在开发中...";

    const hasUnsavedContent = () => {
        if (inputMode === 'text' && transcription.trim()) return true;
        if (inputMode === 'voice' && (recordedAudioUrl || transcription.trim())) return true;
        if (inputMode === 'photo' && selectedImage) return true;
        if (inputMode === 'video' && (selectedVideo || (transcription !== "" && transcription !== VIDEO_NOTICE))) return true;
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
            setTranscription(VIDEO_NOTICE);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setSelectedImage(reader.result as string);
            reader.readAsDataURL(file);
        }
        if (e.target) e.target.value = '';
    };

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.__shouldContinue && (recognitionRef.current.__shouldContinue = false);
            recognitionRef.current?.stop();
            if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            setIsRecording(false);
        } else {
            const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const currentBase = transcription;
            setRecordedAudioUrl(null); setIsRecording(true); setRecordingTime(0);
            audioChunksRef.current = [];
            timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                const mr = new MediaRecorder(stream);
                mediaRecorderRef.current = mr;
                mr.ondataavailable = e => audioChunksRef.current.push(e.data);
                mr.onstop = () => {
                    const mimeType = mr.mimeType || 'audio/webm';
                    const blob = new Blob(audioChunksRef.current, { type: mimeType });
                    setRecordedAudioUrl(URL.createObjectURL(blob));
                };
                mr.start();
                const r = new SR(); r.lang = "zh-CN"; r.continuous = true; r.interimResults = true;
                r.onresult = (e: any) => {
                    let sessionFinal = "";
                    let sessionInterim = "";
                    for (let i = 0; i < e.results.length; i++) {
                        const transcript = e.results[i][0].transcript;
                        if (e.results[i].isFinal) {
                            sessionFinal += transcript;
                        } else {
                            sessionInterim += transcript;
                        }
                    }
                    if (sessionFinal) {
                        sessionFinal = sessionFinal.replace(/[我说完了|停止录音]/g, "");
                        if (!/[。？！，、]$/.test(sessionFinal.trim())) {
                            sessionFinal = sessionFinal.trim() + "。";
                        }
                    }
                    setTranscription(currentBase + sessionFinal + sessionInterim);
                };
                recognitionRef.current = r; r.__shouldContinue = true; r.start();
            });
        }
    };

    const handleSend = async () => {
        // NOTE: 为确保数据隐私和持久化，我们将媒体文件上传到 Supabase Storage
        // 路径格式：family_media/[familyId]/[timestamp]_[filename]
        const familyId = currentUser?.familyId;
        if (!familyId && !isDemoMode(currentUser)) {
            alert("家族信息丢失，请重新登录后再试");
            return;
        }

        let finalAudioUrl = recordedAudioUrl;
        let finalImageUrl = selectedImage;
        let finalRecordingTime = recordingTime;

        // 停止录音并处理
        if (isRecording) {
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            recognitionRef.current?.__shouldContinue && (recognitionRef.current.__shouldContinue = false);
            recognitionRef.current?.stop();

            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                const stopPromise = new Promise<string>((resolve) => {
                    const mr = mediaRecorderRef.current!;
                    const originalOnStop = mr.onstop;
                    mr.onstop = (e) => {
                        if (originalOnStop) (originalOnStop as any)(e);
                        const url = URL.createObjectURL(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
                        resolve(url);
                    };
                    mr.stop();
                });
                finalAudioUrl = await stopPromise;
            }
        }

        if (inputMode === "text" && !transcription.trim()) {
            alert("请输入祝福内容！");
            return;
        }
        if (inputMode === "photo" && !selectedImage) {
            alert("请选择要上传的照片！");
            return;
        }
        if (inputMode === "voice" && !finalAudioUrl && !transcription.trim()) {
            alert("请录制语音或输入文字！");
            return;
        }

        // --- 核心隐私与持久化逻辑：媒体上传 ---
        const uploadFile = async (dataUrl: string, folder: string, ext: string) => {
            const isDemo = isDemoMode(currentUser);
            if (isDemo) {
                console.log("[STORAGE] Demo mode detected (familyId:", familyId, "). Skipping cloud upload.");
                return dataUrl;
            }

            try {
                console.log(`[STORAGE] Attempting upload to family_media bucket for family: ${familyId}...`);

                const res = await fetch(dataUrl);
                if (!res.ok) throw new Error("Failed to fetch local file data for upload");
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
                    console.error("[STORAGE] Supabase Storage Error:", error.message, error);
                    throw error;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('family_media')
                    .getPublicUrl(filePath);

                console.log("[STORAGE] Cloud synchronization successful:", publicUrl);
                return publicUrl;
            } catch (err: any) {
                console.error("[STORAGE] Upload failed. Reason:", err.message);
                console.warn("[STORAGE] Using local blob URL as fallback. Note: This will not persist after refresh.");
                return dataUrl;
            }
        };

        // 执行上传
        if (inputMode === "voice" && finalAudioUrl && !isDemoMode(currentUser)) {
            finalAudioUrl = await uploadFile(finalAudioUrl, 'audio', 'webm');
        }
        if (inputMode === "photo" && finalImageUrl && !isDemoMode(currentUser)) {
            finalImageUrl = await uploadFile(finalImageUrl, 'images', 'jpg');
        }

        confetti({ particleCount: 80, spread: 50, origin: { y: 0.8 } });

        const finalContent = transcription.trim() || (inputMode === "photo" ? "分享了照片" : inputMode === "video" ? "分享了视频" : "留下了祝福");

        const msgData = {
            familyMemberId: event.memberId,
            authorName: currentUser?.name || "家人",
            authorRole: currentUser?.relationship || "家人",
            authorAvatar: currentUser?.avatar,
            content: finalContent,
            type: inputMode === "voice" ? MessageType.AUDIO : inputMode === "photo" ? MessageType.IMAGE : inputMode === "video" ? MessageType.VIDEO : MessageType.TEXT,
            mediaUrl: inputMode === "photo" ? finalImageUrl || undefined : inputMode === "voice" ? finalAudioUrl || undefined : undefined,
            duration: finalRecordingTime,
            eventId: event.id
        };

        setShowInput(false);
        setShowWall(true);
        resetCurrentInputData();

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
                window.dispatchEvent(new CustomEvent('blessing-sent', { detail: { eventId: event.id } }));
            });
    };

    const handleLike = async (id: number) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, likes: (m.likes || 0) + (m.isLiked ? -1 : 1), isLiked: !m.isLiked } : m));

        if (!isDemoMode(currentUser)) {
            try {
                const res = await fetch(`/api/messages/${id}/like`, {
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
                    setMessages(prev => prev.map(m => m.id === id ? { ...m, likes: data.likes, isLiked: data.isLiked } : m));
                }
            } catch (e) {
                console.error("Like sync error:", e);
            }
        }
    };

    const handleDeleteMessage = (msgId: number) => {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        fetch(`/api/messages/${msgId}`, { method: "DELETE" }).catch(console.error);
    };

    const generateAISummary = async () => {
        if (messages.length === 0) {
            alert("还没有人留下祝福哦～请先送出第一条祝福吧！");
            return;
        }
        setIsGeneratingAI(true);
        try {
            const res = await fetch("/api/ai-generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "summary",
                    messages,
                    eventTitle: event.title
                })
            });
            const data = await res.json();
            if (data.text) {
                setAiSummary(data.text);
                setShowWall(true);
            } else {
                alert(data.error || "生成失败");
            }
        } catch (e) {
            console.error(e);
            alert("AI 生成失败，网络错误");
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
            transition={{ duration: 0.2, ease: "easeInOut" }}
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
                            <div className="grid grid-cols-4 gap-3 pt-2">
                                <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handlePhotoChange} />
                                {[
                                    { id: "voice", icon: Mic, label: "语音" },
                                    { id: "text", icon: MessageCircle, label: "文字" },
                                    { id: "photo", icon: Camera, label: "照片" },
                                    { id: "video", icon: Video, label: "视频" },
                                ].map(mode => (
                                    <button key={mode.id} onClick={() => handleInputModeChange(mode.id as any)} className="flex flex-col items-center gap-2 group">
                                        <div className={cn("size-12 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95", inputMode === mode.id ? "bg-[#eab308] text-black scale-105" : "bg-white text-slate-400")}>
                                            <mode.icon size={20} />
                                        </div>
                                        <span className={cn("text-xs font-black tracking-widest", inputMode === mode.id ? "text-[#eab308]" : "text-slate-300")}>{mode.label}</span>
                                    </button>
                                ))}
                            </div>

                            {(selectedImage || selectedVideo) && (
                                <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-lg">
                                    {selectedImage && <img src={selectedImage} alt="" className="w-full h-auto" />}
                                    {selectedVideo && <video src={selectedVideo} controls className="w-full h-auto" />}
                                    <button onClick={() => { setSelectedImage(null); setSelectedVideo(null); }} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full"><X size={16} /></button>
                                </div>
                            )}

                            <div className="bg-white rounded-[2.5rem] p-6 shadow-lg border border-slate-50 relative min-h-[220px] flex flex-col justify-center">
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
                                                className="size-24 rounded-full bg-[#eab308]/10 text-[#eab308] flex items-center justify-center hover:bg-[#eab308]/20 transition-all active:scale-95 group"
                                            >
                                                <Mic size={40} className="group-hover:scale-110 transition-transform" />
                                            </button>
                                            <p className="text-sm font-black text-slate-300 tracking-widest uppercase">点击按钮开始录音</p>
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
                                                className="size-24 rounded-full bg-purple-50 text-purple-400 flex items-center justify-center hover:bg-purple-100 transition-all active:scale-95 group"
                                            >
                                                <Camera size={40} className="group-hover:scale-110 transition-transform" />
                                            </button>
                                            <p className="text-sm font-black text-slate-300 tracking-widest uppercase">选择要分享的照片</p>
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
                                                    <motion.div
                                                        animate={{
                                                            scale: [1, 1.1, 1],
                                                            opacity: [0.5, 1, 0.5]
                                                        }}
                                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                                        className="size-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-200"
                                                    >
                                                        <div className="size-6 bg-white rounded-sm" />
                                                    </motion.div>
                                                    <div className="flex items-center gap-2 bg-red-50 px-4 py-1.5 rounded-full border border-red-100 shadow-sm">
                                                        <div className="size-2 bg-red-500 rounded-full animate-pulse" />
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
                                                className="w-full flex-1 min-h-[100px] text-lg text-slate-700 bg-amber-50/30 p-4 rounded-3xl border-2 border-dashed border-amber-200/50 focus:ring-0 resize-none font-serif leading-relaxed placeholder:text-slate-300"
                                                placeholder="语音转出的文字将实时显示在这里..."
                                                value={transcription}
                                                onChange={e => setTranscription(e.target.value)}
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
                                                className="w-full flex-1 min-h-[120px] text-lg text-slate-700 bg-transparent border-none focus:ring-0 resize-none font-serif leading-relaxed placeholder:text-slate-200"
                                                placeholder={inputMode === "video" ? "功能开发中..." : "写下您的祝福..."}
                                                value={transcription}
                                                onChange={e => setTranscription(e.target.value)}
                                                disabled={inputMode === "video"}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-50 mt-2">
                                    {/* 语音录制完成后或在文字模式下的语音转文字入口 */}
                                    {isRecording && (
                                        <div className="flex items-center gap-2 mr-auto bg-red-50 px-3 py-1.5 rounded-full border border-red-100 shadow-sm animate-pulse">
                                            <div className="size-1.5 bg-red-500 rounded-full" />
                                            <span className="text-[10px] font-black font-mono text-red-500">
                                                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                    )}

                                    {inputMode === "voice" && recordedAudioUrl && !isRecording && (
                                        <button
                                            onClick={() => { setRecordedAudioUrl(null); setTranscription(""); setRecordingTime(0); }}
                                            className="mr-auto text-xs font-black text-slate-400 hover:text-[#eab308] transition-colors"
                                        >
                                            重新录音
                                        </button>
                                    )}

                                    {/* NOTE: 在语音初始化/照片初始化状态下，不需要显示右下角的这个小录音按钮，因为中间已有大按钮 */}
                                    {/* 但在文本模式下，我们需要这个小按钮来触发语音转文字 */}
                                    <button
                                        onClick={toggleRecording}
                                        disabled={inputMode === "video" || inputMode === "photo"}
                                        className={cn(
                                            "size-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90",
                                            (() => {
                                                // 如果是其他初始化状态，按钮完全隐藏/不透明度为0
                                                const isInitVoice = inputMode === "voice" && !isRecording && !recordedAudioUrl;
                                                const isInitPhoto = inputMode === "photo" && !selectedImage;
                                                if (isInitVoice || isInitPhoto) return "opacity-0 pointer-events-none";

                                                if (isRecording) return "bg-red-500 text-white animate-pulse scale-110";
                                                return "bg-[#eab308]/10 text-[#eab308] hover:bg-[#eab308]/20";
                                            })()
                                        )}
                                    >
                                        {isRecording ? <div className="size-4 bg-white rounded-sm" /> : <Mic size={20} />}
                                    </button>
                                </div>
                            </div>

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
                        onClick={() => { setShowInput(true); setInputMode("voice"); resetCurrentInputData(); }}
                        className="w-full py-3 border-2 border-dashed border-[#eab308]/40 text-[#eab308] rounded-2xl text-sm font-black flex items-center justify-center gap-2 hover:bg-[#eab308]/5 transition-all mt-2"
                    >
                        <Plus size={16} strokeWidth={3} /> 再写一条留言
                    </motion.button>
                )}

                <div className="flex items-center justify-between py-2 px-1 border-t border-slate-100 mt-4">
                    <button
                        onClick={() => setShowWall(v => !v)}
                        className="flex items-center gap-1 text-slate-500"
                    >
                        <span className="text-sm font-black">留言墙 ({messages.length})</span>
                        {showWall ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <button
                        onClick={generateAISummary}
                        disabled={isGeneratingAI}
                        className="px-4 py-2 bg-[#eab308] text-black rounded-full text-xs font-black shadow-md flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-70"
                    >
                        <Sparkles size={13} className={isGeneratingAI ? "animate-spin" : ""} />
                        {isGeneratingAI ? "生成中..." : "✨ 用AI生成祝福"}
                    </button>
                </div>

                {messages.length === 0 && (
                    <div className="text-center py-6 px-4 bg-amber-50/50 rounded-2xl border border-dashed border-amber-200 mt-2">
                        <p className="text-sm font-black text-slate-500 mb-1">还没有人留言</p>
                        <p className="text-xs text-slate-400">送出祝福后，点击「用AI生成祝福」生成总结</p>
                    </div>
                )}

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
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between pt-2 pb-3">
                                            <span className="text-sm font-black text-slate-500">共 {messages.length} 条留言</span>
                                            <button
                                                onClick={() => setShowWall(false)}
                                                className="px-4 py-2 bg-slate-100 text-slate-500 rounded-full text-xs font-black flex items-center gap-1 hover:bg-slate-200 transition-colors"
                                            >
                                                <ChevronUp size={12} /> 收起留言墙
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
