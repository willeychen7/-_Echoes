import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, X, Sparkles, Send, Trash2, Home, CheckCircle } from "lucide-react";
import { cn } from "../lib/utils";
import confetti from "canvas-confetti";
import { VoiceWaveform } from "./VoiceWaveform";

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (data: any) => void;
  currentUser: any;
}

/**
 * 适老化语音助手 (Elderly Voice Assistant)
 * 核心功能：
 * 1. 巨大麦克风按钮，一键录音
 * 2. 实时语音转文字
 * 3. AI 解析用户意图 (例如：添加大事记、查询档案)
 */
export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ isOpen, onClose, onResult, currentUser }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "success">("idle");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
        setStatus("idle");
        setTranscription("");
        setIsRecording(false);
    }
  }, [isOpen]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("您的浏览器不支持语音识别功能，请使用 Chrome 或 Safari 浏览器。");
      return;
    }

    setTranscription("");
    setIsRecording(true);
    setStatus("recording");

    const r = new SR();
    r.lang = "zh-CN";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e: any) => {
      let sessionFinal = "";
      let sessionInterim = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) sessionFinal += e.results[i][0].transcript;
        else sessionInterim += e.results[i][0].transcript;
      }
      setTranscription(sessionFinal + sessionInterim);
    };

    r.onend = () => {
      setIsRecording(prev => {
        if (prev) {
          // 如果识别非手动终止（自动结束），延迟处理
          setTimeout(processVoice, 500); 
        }
        return false;
      });
    };

    recognitionRef.current = r;
    r.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    
    // 给 transcription 状态更新留出一点点 settlement 的时间
    setTimeout(() => {
      if (transcription.trim()) {
          processVoice();
      } else {
          setStatus("idle");
      }
    }, 400);
  };

  // AI 解析处理
  const processVoice = async () => {
    setStatus("processing");
    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "voice-assistant-command",
          text: transcription,
          currentUser
        })
      });
      const data = await res.json();
      
      // NOTE: server.ts 返回的是 { text: "AI 生成的字符串" }
      // 我们需要解析这个字符串为 JSON
      if (data.text) {
        try {
          // 清理可能存在的 Markdown 代码块
          const jsonStr = data.text.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(jsonStr);
          
          if (parsed.action && parsed.action !== "none") {
            setStatus("success");
            setTimeout(() => {
                onResult(parsed);
                onClose();
                confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
            }, 1500);
          } else {
            setStatus("idle");
            alert(parsed.feedback || "抱歉，我没有听清您的需求，请再说一遍。");
          }
        } catch (parseErr) {
          console.error("[VOICE] JSON Parse Error:", parseErr, data.text);
          setStatus("idle");
          alert("识别结果格式有误，请重试或通过文字输入。");
        }
      } else {
        setStatus("idle");
        alert(data.error || "未能获取识别结果，请稍后再试。");
      }
    } catch (e) {
      console.error(e);
      setStatus("idle");
      alert("语音助手服务繁忙，请稍后再试。");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-6 pb-12 backdrop-blur-md bg-black/40">
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            className="bg-white w-full max-w-lg rounded-[3.5rem] p-8 shadow-2xl relative border-t-8 border-[#eab308]/20"
          >
            {/* Close */}
            <button onClick={onClose} className="absolute top-6 right-6 size-12 flex items-center justify-center bg-slate-100 rounded-full text-slate-400">
              <X size={24} />
            </button>

            <div className="flex flex-col items-center gap-8 py-4">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-[#eab308]">
                  <Sparkles size={24} />
                  <h3 className="text-2xl font-black tracking-tight">家族语音秘书</h3>
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Family Voice Secretary</p>
              </div>

              {/* Status Display */}
              <div className="min-h-[120px] w-full bg-slate-50/50 rounded-[2.5rem] p-6 flex items-center justify-center border-2 border-dashed border-slate-100 italic font-serif">
                {status === "idle" && <p className="text-slate-300 text-xl">“您可以说：‘添加一张爷爷的生日礼’...”</p>}
                {status === "recording" && (
                    <div className="w-full flex flex-col items-center gap-4">
                        <VoiceWaveform isRecording={true} className="h-10 w-full" color="stroke-amber-500" />
                        <p className="text-2xl text-slate-700 font-bold leading-relaxed text-center">{transcription || "正在倾听..."}</p>
                    </div>
                )}
                {status === "processing" && (
                    <div className="flex flex-col items-center gap-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                            <Sparkles size={40} className="text-[#eab308]" />
                        </motion.div>
                        <p className="text-[#eab308] text-xl font-black">正在智能解析中...</p>
                    </div>
                )}
                {status === "success" && (
                    <div className="flex flex-col items-center gap-3 text-emerald-500">
                        <CheckCircle size={48} />
                        <p className="text-xl font-black">已为您准备好！</p>
                    </div>
                )}
              </div>

              {/* Huge Mic Button */}
              <div className="relative">
                <button
                  onClick={toggleRecording}
                  disabled={status === "processing" || status === "success"}
                  className={cn(
                    "relative size-32 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 group z-10",
                    isRecording ? "bg-amber-400 shadow-amber-200" : "bg-[#eab308] shadow-[#eab308]/30"
                  )}
                >
                  {isRecording ? (
                      <div className="size-10 bg-white rounded-lg shadow-sm" />
                  ) : (
                      <Mic size={48} fill="currentColor" strokeWidth={3} className="text-white group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>

              {/* Hint */}
              <div className="flex flex-col items-center gap-1">
                <p className="text-slate-400 font-black tracking-widest text-sm uppercase">
                    {isRecording ? "正在听您说..." : "点击金色大按钮说话"}
                </p>
                {!isRecording && status === "idle" && (
                    <p className="text-[10px] text-slate-300 font-bold">💡 系统将自动感知意图并为您跳转</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
