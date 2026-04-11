import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Mic, X, Sparkles, Brain } from "lucide-react";

export const GlobalVoiceAssistant: React.FC = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "responding">("idle");
  const [transcription, setTranscription] = useState("");
  const [feedback, setFeedback] = useState("");
  const recognitionRef = useRef<any>(null);
  const transcriptionRef = useRef("");

  // 🚀 处理“召唤”事件：支持个性化欢迎语
  useEffect(() => {
    const handleToggle = async () => {
      const targetState = !isVisible;
      setIsVisible(targetState);
      
      if (targetState) {
        // 🚀 个性化唤起：Hi [姓名]，想和包包说点啥吗？
        const userStr = localStorage.getItem("currentUser");
        const user = userStr ? JSON.parse(userStr) : null;
        const userName = user?.name || "您";
        const greeting = `Hi ${userName}，想和包包说点啥吗？`;

        console.log("[Assistant] Activation greeting start...");
        setStatus("responding");
        setFeedback(greeting);
        
        // 🔊 等待播报完全结束再开启录音
        await playAgentAudio(greeting);
        
        console.log("[Assistant] Greeting ended, switching to listening mode.");
        // 稍微缓冲一下（0.2秒），给环境留一点静默时间
        setTimeout(() => {
          startListening();
        }, 200);
      } else {
        stopListening();
      }
    };
    window.addEventListener("toggle-assistant", handleToggle);
    return () => window.removeEventListener("toggle-assistant", handleToggle);
  }, [isVisible]);

  const onClose = () => {
    stopListening();
    setIsVisible(false);
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.error("SpeechRecognition not supported");
      return;
    }

    setFeedback("");
    setTranscription("");
    transcriptionRef.current = "";
    setStatus("listening");
    setIsRecording(true);
    isRecordingRef.current = true;

    const r = new SR();
    r.lang = "zh-CN";
    r.continuous = false;
    r.interimResults = true;

    r.onstart = () => console.log("[Assistant] Recognition started...");
    r.onerror = (e: any) => {
        console.error("[Assistant] Recognition error:", e.error);
        setStatus("idle");
        setIsRecording(false);
        isRecordingRef.current = false;
    };

    r.onresult = (e: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      const full = final + interim;
      setTranscription(full);
      transcriptionRef.current = full;
    };

    r.onend = () => {
      console.log("[Assistant] Recognition auto-ended.");
      setIsRecording(false);
      isRecordingRef.current = false;
      const finalVal = transcriptionRef.current.trim();
      if (finalVal) {
        processCommand();
      } else {
        setStatus("idle");
      }
    };

    recognitionRef.current = r;
    r.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
        isRecordingRef.current = false; 
        recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const processCommand = async () => {
    const text = transcriptionRef.current.trim();
    if (!text) {
      setStatus("idle");
      return;
    }

    const lowerText = text.toLowerCase();
    const localActionMap: { [key: string]: { action: string, path: string, feedback: string } } = {
      "广场": { action: "navigate", path: "/square", feedback: "[温柔、开心] 好哒，我们现在就回广场看看大家。" },
      "日历": { action: "navigate", path: "/calendar", feedback: "[温柔、知性] 没问题，这就带您去查看家族日历。" },
      "档案": { action: "navigate", path: "/archive/-1", feedback: "[温柔、体贴] 好的，正在为您打开家族档案。" },
      "消息": { action: "navigate", path: "/notifications", feedback: "[温柔、神秘] 收到，我们去看看有没有新的家庭消息吧。" },
      "我的": { action: "navigate", path: "/profile", feedback: "[温柔、从容] 好的，这就前往您的个人页面。" },
      "退出": { action: "navigate", path: "/login", feedback: "[温柔、依依不舍] 您要休息了吗？那包包先送您回登录页，一会儿见喔。" }
    };

    for (const key in localActionMap) {
      if (lowerText.includes(key)) {
        const item = localActionMap[key];
        setFeedback(item.feedback);
        setStatus("responding");
        await playAgentAudio(item.feedback);
        setTimeout(() => {
          navigate(item.path);
          onClose();
          setStatus("idle");
        }, 1500);
        return;
      }
    }

    setStatus("thinking");
    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "voice-assistant-command",
          text,
          currentUser: JSON.parse(localStorage.getItem("currentUser") || "{}")
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.text) {
        let parsed;
        try {
          const jsonMatch = data.text.match(/\{[\s\S]*\}/);
          const rawJson = jsonMatch ? jsonMatch[0] : data.text;
          parsed = JSON.parse(rawJson);
        } catch (parseErr) {
          console.error("[Assistant] JSON Parse failed:", parseErr);
          parsed = { action: "chat", feedback: data.text.slice(0, 100) };
        }

        setFeedback(parsed.feedback || "我在呢，您请说。");
        setStatus("responding");
        await playAgentAudio(parsed.feedback || "我在呢。");

        if (parsed.action === 'navigate' && parsed.params?.path) {
           setTimeout(() => {
             navigate(parsed.params.path);
             onClose();
           }, 2000);
        } else if (parsed.action === 'add-event') {
           setTimeout(() => {
             navigate("/add-event", { state: { prefill: parsed.params } });
             onClose();
           }, 2000);
        } else {
           setTimeout(() => {
             if (status === "responding") setStatus("idle");
           }, 8000);
        }
      }
    } catch (e: any) {
      const errorMsg = e.message || "抱歉，刚才包包没听清，能再说一遍吗？";
      setFeedback(errorMsg);
      setStatus("responding");
      await playAgentAudio(errorMsg);
    }
  };

  const playAgentAudio = async (text: string) => {
    try {
      const cleanText = text.replace(/\[.*?\]/g, "").trim();
      const res = await fetch("/api/tts/elevenlabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText })
      });
      
      if (!res.ok) throw new Error("API Failure");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audio.oncanplaythrough = () => {
          console.log("[AudioEngine] ElevenLabs playback started.");
          audio.play().catch(reject);
        };
        audio.onended = () => {
          console.log("[AudioEngine] ElevenLabs playback finished.");
          resolve(true);
        };
        audio.onerror = (e) => {
          console.error("[AudioEngine] Error:", e);
          reject(e);
        };
        setTimeout(() => {
          console.warn("[AudioEngine] Timeout safety triggered.");
          resolve(true);
        }, 12000); 
      });
    } catch (e) {
      return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text.replace(/\[.*?\]/g, ""));
        u.lang = "zh-CN";
        u.onend = () => resolve(true);
        window.speechSynthesis.speak(u);
        setTimeout(resolve, 3000);
      });
    }
  };

  // 🚀 清理逻辑
  useEffect(() => {
    if (!isVisible) {
      stopListening();
      setStatus("idle");
    }
  }, [isVisible]);

  const lastGreetedAt = useRef(0);
  
  // 🚀 处理核心交互：大头像点击
  useEffect(() => {
    const handleClick = async () => {
      const now = Date.now();
      if (now - lastGreetedAt.current < 5000) return;
      lastGreetedAt.current = now;
      console.log("[Assistant] Click greeting triggered...");
      
      const introduction = "包包来了，有什么吩咐吗";
      setStatus("responding");
      setFeedback(introduction);
      
      await playAgentAudio(introduction);
      console.log("[Assistant] Click introduction finished.");
      
      // 这里的交互仅为介绍，不自动开启麦克风，除非用户再次点击下方的大球或小图标
      setTimeout(() => setStatus("idle"), 5000);
    };
    window.addEventListener("click-assistant", handleClick);
    return () => window.removeEventListener("click-assistant", handleClick);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
           initial={{ opacity: 0, y: 100 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: 100 }}
           className="absolute inset-x-0 bottom-0 z-[100] p-6 pb-12"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          <div className="relative glass-morphism rounded-[32px] p-6 shadow-2xl border border-white/40 overflow-hidden">
            {status === "listening" && (
                <motion.div 
                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-amber-400/20 blur-3xl rounded-full" 
                />
            )}

            <div className="flex flex-col items-center gap-6">
                <button onClick={onClose} className="absolute top-4 right-4 size-8 rounded-full bg-black/5 flex items-center justify-center text-slate-400 hover:text-slate-600">
                   <X size={18} />
                </button>

                <div className="relative">
                    <div className="size-20 rounded-full overflow-hidden border-2 border-white shadow-lg">
                        <img src="/secretary.jpg" className="w-full h-full object-cover scale-125" />
                    </div>
                    {status === "thinking" && (
                        <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white p-1 rounded-lg">
                            <Brain size={14} className="animate-pulse" />
                        </div>
                    )}
                </div>

                <div className="text-center space-y-2 max-w-full">
                    {status === "idle" && <h3 className="text-lg font-bold text-slate-800">点击下方开始说说话...</h3>}
                    {status === "listening" && (
                        <div className="space-y-1">
                            <span className="text-xs font-black text-amber-500 uppercase tracking-widest animate-pulse">正在倾听 (说完请停顿)</span>
                            <p className="text-xl font-black text-slate-800 break-words">{transcription || "请说话..."}</p>
                        </div>
                    )}
                    {status === "thinking" && (
                        <div className="flex items-center justify-center gap-2">
                            <div className="size-2 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="size-2 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="size-2 bg-amber-400 rounded-full animate-bounce"></div>
                            <span className="text-sm font-bold text-slate-500 italic">正在思考中...</span>
                        </div>
                    )}
                    {status === "responding" && (
                        <p className="text-lg font-bold text-slate-800 leading-relaxed px-4 text-left break-words">
                            {feedback}
                        </p>
                    )}
                </div>

                <button
                    onClick={isRecording ? stopListening : startListening}
                    className={`relative size-20 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-red-500 scale-90 shadow-red-200" : "bg-amber-400 shadow-amber-200 shadow-xl"}`}
                >
                    <Mic size={32} className="text-white" />
                    {isRecording && (
                        <motion.div 
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="absolute inset-0 rounded-full bg-red-400"
                        />
                    )}
                </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
