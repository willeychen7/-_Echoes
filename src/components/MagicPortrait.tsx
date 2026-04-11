import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Camera, RefreshCw, Upload, Film, Wand2, Heart, Check } from "lucide-react";
import Cropper from "react-easy-crop";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { isDemoMode } from "../demo-data";

// --- 内部文案组件 ---
const LoadingLabel = ({ message }: { message?: string }) => {
  const [idx, setIdx] = useState(0);
  const labels = ["正在解析往昔容颜...", "正在穿越时光长廊...", "正在唤醒这段记忆...", "魔法最后冲洗中..."];
  useEffect(() => {
    const timer = setInterval(() => setIdx(v => (v + 1) % labels.length), 6000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.p key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
        className="text-[#d4af37] font-black italic tracking-widest text-xl min-h-[1.5em]">
        {message || labels[idx]}
      </motion.p>
    </div>
  );
};

// --- 类型定义 ---
type StudioStatus = "idle" | "cropping" | "processing" | "completed" | "error";

interface MagicPortraitProps {
  className?: string;
}

// --- 辅助工具函数 ---
const getImageDimensions = (url: string): Promise<{ width: number; height: number }> =>
  new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ width: img.width, height: img.height });
    img.src = url;
  });

const uploadToSupabase = async (file: File, folder: string, familyId: string, userId: string): Promise<string> => {
  const fileName = `${Date.now()}-${file.name}`;
  const path = `${folder}/${familyId}/${userId}/${fileName}`;
  const { data, error } = await supabase.storage.from("demo_memories").upload(path, file);
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("demo_memories").getPublicUrl(path);
  return publicUrl;
};

const getCurrentUser = () => {
  const saved = localStorage.getItem("currentUser");
  return saved ? JSON.parse(saved) : null;
};

export const MagicPortrait: React.FC<MagicPortraitProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<StudioStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState<string>("");
  const [pollMessage, setPollMessage] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    const dims = await getImageDimensions(url);
    setSourceImage(url);
    setPreview(url);
    setAspect(dims.width / dims.height);
    setZoom(1);
    setStatus("cropping");
  };

  const toggleCamera = async (active: boolean) => {
    if (active) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setIsCameraActive(true);
        }
      } catch (err) { alert("无法访问摄像头"); }
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setIsCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.95);
    const blob = await (await fetch(url)).blob();
    const photoFile = new File([blob], "capture.jpg", { type: "image/jpeg" });
    setFile(photoFile);
    setSourceImage(url);
    setPreview(url);
    setAspect(canvas.width / canvas.height);
    setZoom(1);
    setStatus("cropping");
    toggleCamera(false);
  };

  const onCropComplete = useCallback((_: any, pixels: any) => setCroppedAreaPixels(pixels), []);

  const confirmCrop = async () => {
    if (!sourceImage) return;
    setLoading(true);
    const isOriginal = zoom === 1 && Math.abs(crop.x) < 0.1 && Math.abs(crop.y) < 0.1;
    if (isOriginal && file) {
      setPreview(URL.createObjectURL(file));
    } else if (isOriginal && sourceImage.startsWith("data:")) {
      const blob = await (await fetch(sourceImage)).blob();
      setFile(new File([blob], "capture.jpg", { type: "image/jpeg" }));
    } else if (croppedAreaPixels) {
      const img = await getImage(sourceImage);
      const blob = await createCroppedBlob(img, croppedAreaPixels);
      const newFile = new File([blob], "crop.jpg", { type: "image/jpeg" });
      setFile(newFile);
      setPreview(URL.createObjectURL(blob));
    }
    setStatus("idle");
    setLoading(false);
  };

  const handleDownload = async () => {
    if (!videoUrl) return;
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = 'none';
      a.href = url;
      a.download = `magic-memory-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed:", e);
      alert("下载失败，请尝试长按视频保存");
    }
  };

  const startMagic = async () => {
    if (!file) {
      alert("请重试载入照片"); 
      return;
    }
    
    const user = getCurrentUser();
    setStatus("processing");
    setPollMessage("正在启动魔法引擎...");

    try {
      // 1. 上传
      const publicUrl = await uploadToSupabase(file, "magic", user?.familyId || "demo", user?.memberId?.toString() || "guest");
      
      // 2. 启动异步任务
      const createResp = await fetch("http://localhost:8000/api/ai/animate/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: publicUrl, prompt: prompt })
      });
      const createData = await createResp.json();
      if (!createResp.ok || !createData.taskId) throw new Error(createData.detail || "任务启动失败");

      const taskId = createData.taskId;
      
      // 3. 轮旬
      let attempts = 0;
      const poll = async () => {
        if (attempts >= 40) {
            setStatus("error");
            return;
        }
        try {
            const statusResp = await fetch(`http://localhost:8000/api/ai/animate/status/${taskId}`);
            const statusData = await statusResp.json();
            
            if (statusData.status === "COMPLETE") {
                setVideoUrl(statusData.videoUrl);
                setStatus("completed");
            } else if (statusData.status === "FAILED") {
                throw new Error(statusData.error || "生成失败");
            } else {
                attempts++;
                setPollMessage(`魔法正在编织中... (${attempts * 3}s)`);
                setTimeout(poll, 3000);
            }
        } catch (e: any) {
            setStatus("error");
            alert(e.message);
        }
      };
      poll();

    } catch (e: any) {
      console.error("Magic failed:", e);
      setStatus("error");
    }
  };

  const saveToCollection = async () => {
    if (!videoUrl || !file) return;
    const user = getCurrentUser();
    const isDemo = isDemoMode(user);
    setLoading(true);

    try {
      const newItem = {
        family_id: user.familyId,
        user_id: user.id,
        title: 'AI 魔法映像',
        url: videoUrl,
        type: 'video',
        category: 'magic',
        date: new Date().toISOString().split('T')[0],
        thumbnail_url: preview
      };

      if (isDemo) {
        const saved = JSON.parse(localStorage.getItem("magic_demo_collections") || "[]");
        localStorage.setItem("magic_demo_collections", JSON.stringify([newItem, ...saved]));
        alert("已存入您的本地收藏馆！");
        resetAndClose();
      } else {
        const { error } = await supabase.from("demo_memories").insert([newItem]);
        if (error) throw error;
        alert("已存入您的珍藏馆！");
        resetAndClose();
      }
    } catch (e) {
      console.error(e);
      alert("收藏失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setIsOpen(false);
    toggleCamera(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => {
      setFile(null); setSourceImage(null); setPreview(null); setVideoUrl(null); setStatus("idle");
    }, 500);
  };

  const renderContent = () => {
    if (isCameraActive) return (
      <div className="relative w-full h-full bg-black">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-8">
          <button onClick={() => toggleCamera(false)} className="size-12 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-md"> <X size={24} /> </button>
          <button onClick={capturePhoto} className="size-20 rounded-full border-4 border-white p-1 shadow-2xl"> <div className="size-full rounded-full bg-white active:scale-90 transition-transform" /> </button>
        </div>
      </div>
    );

    if (status === "cropping" && sourceImage) return (
      <div className="relative w-full h-full flex flex-col">
        <div className="flex-1 relative">
          <Cropper image={sourceImage} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} minZoom={0.5} showGrid={false} classes={{ containerClassName: "bg-[#0f1115]", cropAreaClassName: "border-none" }} />
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80%] z-50 flex items-center gap-4 px-6 py-4 bg-black/60 backdrop-blur-2xl rounded-full border border-white/5 shadow-2xl">
          <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#d4af37]" />
          <span className="text-[10px] text-[#a88a6d] font-bold uppercase tracking-widest whitespace-nowrap">推近焦距</span>
        </div>
      </div>
    );

    if (status === "error") return (
      <div className="absolute inset-0 bg-[#0a0505] flex flex-col items-center justify-center p-8 text-center gap-6">
        <div className="size-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
          <X size={40} />
        </div>
        <div className="space-y-2">
          <h4 className="text-[#f7e4a1] text-xl font-black italic">魔法施展受阻</h4>
          <p className="text-[#d4af37]/60 text-sm leading-relaxed max-w-[200px] mx-auto">
            可能是由于篮子(Bucket)未就绪或后端魔法书(API)掉线了。
          </p>
        </div>
        <button onClick={() => setStatus("idle")} className="mt-4 px-8 py-3 bg-white/5 border border-white/10 rounded-full text-[#d4af37] font-bold hover:bg-white/10 transition-all">重新尝试</button>
      </div>
    );

    if (status === "processing" || status === "completed" || preview) return (
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {videoUrl ? (
          <video src={videoUrl} autoPlay loop controls className="w-full h-full object-contain shadow-2xl" />
        ) : (
          <img src={preview!} className="w-full h-full object-contain opacity-90" alt="Preview" />
        )}

        {status === "processing" && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
            <RefreshCw size={56} className="text-[#d4af37] animate-spin-slow" />
            <LoadingLabel message={pollMessage} />
          </div>
        )}

        {status === "completed" && (
          <div className="absolute top-6 right-6 bg-green-500 text-white px-4 py-1.5 rounded-full text-[11px] font-black shadow-lg flex items-center gap-2 animate-bounce">
            <Check size={14} /> 魔法唤醒成功
          </div>
        )}
      </div>
    );

    return (
      <div className="absolute inset-0 flex items-center justify-center p-12">
        <div className="grid grid-cols-2 gap-8 w-full max-w-[360px]">
          <StudioOption icon={<Upload size={32} />} label="载入相册" onClick={() => fileInputRef.current?.click()} />
          <StudioOption icon={<Camera size={32} />} label="即时拍照" onClick={() => toggleCamera(true)} />
        </div>
      </div>
    );
  };

  return (
    <div className="relative inline-block">
      <TriggerButton onClick={() => setIsOpen(true)} className={className} />

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden pointer-events-auto">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetAndClose} className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

              <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="relative w-full max-w-[480px] h-[750px] bg-[#1a0505] rounded-[3.5rem] shadow-[0_60px_120px_rgba(0,0,0,0.9)] border-[1px] border-[#d4af37]/30 flex flex-col overflow-hidden">

                <div className="absolute inset-0 bg-[#0a0a0a]" />
                <div className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(circle at 50% 30%, #5a0000 0%, #1a0000 70%, #050505 100%)' }} />

                <div className="relative flex-1 flex flex-col p-8 space-y-6">
                  <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-gradient-to-br from-[#d4af37]/20 to-black/40 flex items-center justify-center text-[#f7e4a1] border border-[#d4af37]/20 shadow-lg">
                        <Film size={26} />
                      </div>
                      <h3 className="text-2xl font-black text-[#f7e4a1] italic tracking-tighter uppercase font-serif drop-shadow-2xl">幸福回忆照相馆</h3>
                    </div>
                    <button onClick={resetAndClose} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-[#d4af37]/60 hover:bg-white/10 hover:text-white transition-all"> <X size={22} /> </button>
                  </header>

                  <main className="flex-1 relative bg-black/40 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-[inset_0_5px_30px_rgba(0,0,0,0.7)]">
                    {renderContent()}
                  </main>

                  <footer className="pt-2 space-y-6">
                    {(status === "idle" || status === "processing") && preview && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        {/* 🌟 魔法灵感问答 */}
                        <div className="space-y-3">
                          <label className="text-[10px] text-[#d4af37] font-black uppercase tracking-[0.2em] ml-2 opacity-50">你想让这段记忆如何流转？</label>
                          <div className="flex flex-wrap gap-2">
                             {[
                               { label: "慈祥微笑", value: "A gentle, warm smile" },
                               { label: "深情点头", value: "Emotional subtle nodding" },
                               { label: "亲切招手", value: "Warmly waving hand" },
                               { label: "春风拂面", value: "Breeze blowing hair and clothes" },
                               { label: "电影质感", value: "Cinematic nostalgic lighting" },
                               { label: "缓缓推近", value: "Slow cinematic zoom in" }
                             ].map((opt) => (
                               <button
                                 key={opt.label}
                                 onClick={() => setPrompt(prev => prev.includes(opt.value) ? prev.replace(opt.value, "").trim() : (prev + " " + opt.value).trim())}
                                 className={cn(
                                   "px-4 py-2 rounded-full text-[12px] font-bold transition-all border",
                                   prompt.includes(opt.value) 
                                     ? "bg-[#d4af37] border-[#d4af37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
                                     : "bg-white/5 border-white/10 text-[#d4af37]/60 hover:bg-white/10 hover:text-[#f7e4a1]"
                                 )}
                               >
                                 {opt.label}
                               </button>
                             ))}
                          </div>
                        </div>

                        {/* ✍️ 手动微调框 */}
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-[#d4af37]/40">
                            <Wand2 size={16} />
                          </div>
                          <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="魔法密语拼凑中..."
                            disabled={status === "processing"}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-[#f7e4a1] placeholder:text-[#d4af37]/20 text-sm focus:outline-none focus:border-[#d4af37]/40 transition-all shadow-inner"
                          />
                        </div>
                      </div>
                    )}

                    {status === "cropping" ? (
                      <PrimaryButton onClick={confirmCrop} loading={loading} label="确认并保留细节" />
                    ) : (status === "idle" || status === "processing") && preview ? (
                      <PrimaryButton onClick={startMagic} loading={status === "processing"} label="开启魔法唤醒" icon={<Sparkles size={20} />} active />
                    ) : status === "completed" ? (
                      <div className="flex gap-4">
                        <PrimaryButton onClick={handleDownload} label="下载并保存" icon={<Upload size={20} className="rotate-180" />} active />
                        <PrimaryButton onClick={saveToCollection} loading={loading} label="收藏这份记忆" variant="glass" />
                      </div>
                    ) : null}
                  </footer>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleFileSelect} />
    </div>
  );
};

const TriggerButton = ({ onClick, className }: any) => (
  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClick} className={cn("h-14 px-5 rounded-full bg-gradient-to-br from-amber-50 to-orange-100 shadow-xl flex items-center gap-3 border border-white/80 shrink-0", className)}>
    <div className="size-10 rounded-xl bg-white shadow-inner flex items-center justify-center text-orange-500"> <Camera size={20} strokeWidth={2.5} /> </div>
    <div className="flex flex-col items-start leading-none">
      <span className="text-[16px] font-black text-amber-950">复活照片往事</span>
    </div>
  </motion.button>
);

const StudioOption = ({ icon, label, onClick }: any) => (
  <div onClick={onClick} className="aspect-square bg-white/[0.02] border border-white/10 rounded-[2rem] flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-[#d4af37]/10 hover:border-[#d4af37]/30 group transition-all duration-500">
    <div className="text-[#a88a6d] group-hover:text-[#d4af37] group-hover:scale-110 transition-all duration-500"> {icon} </div>
    <span className="text-white/60 group-hover:text-white font-bold text-sm tracking-widest">{label}</span>
  </div>
);

const PrimaryButton = ({ onClick, loading, label, icon, active, variant }: any) => (
  <button 
    onClick={onClick} 
    disabled={loading} 
    className={cn(
      "relative z-[100] w-full py-5 rounded-[1.8rem] font-black text-lg shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 pointer-events-auto",
      active ? "bg-gradient-to-r from-[#d4af37] via-[#f7e4a1] to-[#d4af37] text-black" : "bg-white/5 border border-white/10 text-[#d4af37]",
      variant === "glass" && "bg-white/5 text-[#d4af37] hover:bg-white/10"
    )}
  >
    {loading ? <RefreshCw className="animate-spin" size={20} /> : (icon || null)}
    {loading ? (active ? "正在唤醒..." : "处理中...") : label}
  </button>
);

async function getImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}

async function createCroppedBlob(img: HTMLImageElement, area: any): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = area.width; canvas.height = area.height;
  canvas.getContext("2d")?.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise((res) => canvas.toBlob(b => res(b!), "image/jpeg", 0.95));
}
