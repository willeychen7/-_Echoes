import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Play, Heart, Trash2, Calendar, Film, RefreshCw, Download, Sparkles, Camera } from "lucide-react";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { isDemoMode } from "../demo-data";

interface MagicCollection {
  id: any; // 🛡️ 兼容模拟数据的字符串 ID
  video_url: string | null;
  image_url: string;
  created_at: string;
  title?: string;
  category?: string;
}

export const MagicCollections: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [collections, setCollections] = useState<MagicCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const getCurrentUser = () => {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  };

  const fetchCollections = async () => {
    setLoading(true);
    const user = getCurrentUser();
    const isDemo = isDemoMode(user);

    try {
      let data: any[] = [];
      if (isDemo) {
        data = JSON.parse(localStorage.getItem("magic_demo_collections") || "[]");
      } else {
        const { data: dbData, error } = await supabase
          .from("demo_memories")
          .select("*")
          .eq("family_id", user.familyId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        data = dbData || [];
      }

      // 🎨 模拟效果注入：加入来自不同时期的大事记照片
      const mockPhotoItems = [
        {
          id: 'mock-birthday',
          video_url: null,
          image_url: 'https://images.unsplash.com/photo-1530103043960-ef38714abb15?auto=format&fit=crop&q=80&w=400',
          created_at: '2024-06-15T12:00:00Z', // 小明生日当天
          is_mock: true,
          category: 'archive',
          title: '小明的 26 岁生日'
        },
        {
          id: 'mock-1',
          video_url: null,
          image_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=400',
          created_at: '2023-11-20T08:30:00Z',
          is_mock: true,
          category: 'archive',
          title: '爷爷的老怀表'
        },
        {
          id: 'mock-2',
          video_url: null,
          image_url: 'https://images.unsplash.com/photo-1543039622-7a8601ad7614?auto=format&fit=crop&q=80&w=400',
          created_at: '2025-01-05T15:45:00Z',
          is_mock: true,
          category: 'archive',
          title: '1982年的老家门口'
        }
      ];

      setCollections([...mockPhotoItems, ...data]);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchCollections();
  }, [isOpen]);

  const deleteItem = async (id: any) => {
    const user = getCurrentUser();
    const isDemo = isDemoMode(user);

    try {
      if (isDemo) {
        const saved = JSON.parse(localStorage.getItem("magic_demo_collections") || "[]");
        const updated = saved.filter((c: any) => String(c.id) !== String(id));
        localStorage.setItem("magic_demo_collections", JSON.stringify(updated));
        setCollections(updated);
      } else {
        const { error } = await supabase.from("demo_memories").delete().eq("id", id);
        if (error) throw error;
        setCollections(prev => prev.filter(c => c.id !== id));
      }
      setDeleteConfirmId(null);
    } catch (e) {
      console.error("Delete failed:", e);
      alert("删除失败");
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = `magic-memory-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed:", e);
      alert("下载失败");
    }
  };

  return (
    <>
      {/* 触发按钮：我的珍藏馆 (黄金典藏版) */}
      <motion.button
        whileHover={{ scale: 1.08, rotate: [0, -1, 1, 0] }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(true)}
        className="relative group h-16 pl-5 pr-7 rounded-2xl bg-gradient-to-br from-amber-50 via-[#fffbeb] to-amber-100 shadow-[0_20px_50px_-12px_rgba(212,175,55,0.4)] flex items-center gap-4 border border-amber-200/60 overflow-hidden"
      >
        {/* 背景呼吸光晕 */}
        <motion.div
          animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-gradient-to-r from-amber-200/0 via-amber-200/40 to-amber-200/0 pointer-events-none"
        />

        <div className="relative size-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 group-hover:rotate-12 transition-transform duration-500">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Heart size={24} fill="currentColor" />
          </motion.div>
        </div>

        <div className="flex flex-col items-start leading-tight">
          <span className="text-[17px] font-black text-amber-950 tracking-tight">我的珍藏馆</span>
        </div>

        {/* 顶部金粉粒子感 (CSS 模拟) */}
        <div className="absolute top-0 right-0 p-1 opacity-40">
          <RefreshCw size={10} className="text-amber-500/20" />
        </div>
      </motion.button>

      {/* 珍藏馆弹窗 */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />

            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[900px] h-[80vh] bg-[#fdfaf5] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">

              <header className="px-10 py-8 flex items-center justify-between border-b border-amber-100 bg-white/50">
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Film size={28} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">我的珍藏</h2>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all">
                  <X size={24} />
                </button>
              </header>

              <main className="flex-1 overflow-y-auto p-10">
                {loading ? (
                  <div className="size-full flex flex-col items-center justify-center gap-4">
                    <RefreshCw className="animate-spin text-amber-500" size={40} />
                    <p className="text-slate-400 font-bold">正在打开放映室...</p>
                  </div>
                ) : collections.length === 0 ? (
                  <div className="size-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="size-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200">
                      <Film size={40} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-400">目前还没有珍藏</h3>
                      <p className="text-slate-300 text-sm mt-1">在照相馆复活照片后，点击收藏即可出现在这里</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {collections.map((item, idx) => (
                      <motion.div 
                        key={String(item.id || Math.random())} 
                        layout 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        whileHover={{ y: -5 }}
                        className="group relative flex flex-col bg-[#121212] rounded-md overflow-hidden shadow-2xl border border-white/5"
                      >
                        {/* 🎞️ 胶片边缘打孔 (左右) */}
                        <div className="absolute inset-x-0 top-0.5 h-3 flex justify-around px-2 z-50 pointer-events-none opacity-20">
                          {[1,2,3,4,5,6].map(i => <div key={i} className="w-2 h-2 bg-white rounded-[1px]" />)}
                        </div>
                        <div className="absolute inset-x-0 bottom-0.5 h-3 flex justify-around px-2 z-50 pointer-events-none opacity-20">
                          {[1,2,3,4,5,6].map(i => <div key={i} className="w-2 h-2 bg-white rounded-[1px]" />)}
                        </div>

                        <div className="relative p-3 py-4">
                           <div className="aspect-[4/3] relative bg-black cursor-pointer overflow-hidden rounded-sm" onClick={() => item.video_url && setSelectedVideo(item.video_url)}>
                              <img src={item.image_url} className="size-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Collection" />
                              
                              {/* 🎨 胶片刻度文字 (更微小) */}
                              <div className="absolute bottom-1 left-2 text-[6px] font-mono text-white/50 z-40">
                                 #0{(idx + 1).toString().padStart(2, '0')}
                              </div>

                              {item.video_url && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-40">
                                  <div className="size-10 rounded-full border border-white/20 flex items-center justify-center text-white/80">
                                    <Play size={16} fill="white" />
                                  </div>
                                </div>
                              )}
                           </div>
                        </div>

                        <div className="px-3 pb-3 flex flex-col gap-1 bg-black/60 pt-2 border-t border-white/5">
                           <div className="flex items-center gap-2">
                             <div className={cn(
                               "size-2 rounded-full",
                               item.video_url ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.6)]"
                             )} />
                             <span className={cn(
                               "text-[10px] font-black tracking-tight",
                               item.video_url ? "text-amber-200" : "text-teal-200"
                             )}>
                               {item.video_url ? "来自：复活照片往事" : `来自大事记：${item.title || "珍贵时刻"}`}
                             </span>
                           </div>
                           
                           <div className="flex justify-between items-center mt-0.5">
                              <div className="flex items-center gap-1.5 text-white/70">
                                <Calendar size={10} className="text-white/40" />
                                <span className="text-[11px] font-mono font-bold tracking-tighter italic">
                                  {new Date(item.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                 {item.video_url && (
                                   <button onClick={(e) => { e.stopPropagation(); handleDownload(item.video_url); }} className="text-white hover:text-teal-400 transition-all">
                                     <Download size={14} />
                                   </button>
                                 )}
                                 <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(item.id); }} className="text-white hover:text-rose-500 transition-all">
                                   <Trash2 size={14} />
                                 </button>
                              </div>
                           </div>
                        </div>

                        {/* 删除确认浮层 (适配黑金色调) */}
                        <AnimatePresence>
                          {deleteConfirmId === item.id && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              className="absolute inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-6 text-center gap-4">
                              <p className="text-white/60 text-xs font-bold">销毁这段胶片记忆？</p>
                              <div className="flex gap-4">
                                <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="px-6 py-2 bg-rose-600 text-white text-[10px] font-black rounded-full shadow-lg">确认销毁</button>
                                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }} className="px-6 py-2 bg-white/10 text-white/60 text-[10px] font-bold rounded-full">暂留</button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                )}
              </main>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 全屏播放器 */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/95">
            <button onClick={() => setSelectedVideo(null)} className="absolute top-10 right-10 text-white/60 hover:text-white z-50">
              <X size={40} />
            </button>
            <video src={selectedVideo} autoPlay controls className="max-w-[90vw] max-h-[90vh] shadow-[0_0_100px_rgba(212,175,55,0.2)]" />
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
