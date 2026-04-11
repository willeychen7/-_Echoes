import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, BookOpen, Calendar, User, Plus } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const leftNavItems = [
    { to: "/square", label: "广场", icon: Home },
    { to: "/square#archive", label: "记忆档案", icon: BookOpen },
  ];
  const rightNavItems = [
    { to: "/square#events", label: "日历", icon: Calendar },
    { to: "/profile", label: "我的", icon: User },
  ];

  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleNavClick = (to: string) => {
    // 基础逻辑：点击任何导航项，如果是当前页面，则滚动到顶部
    // 如果是切换页面，由于 React Router 的特性，通常需要我们手动处理一下滚动
    const targetPath = to.split('#')[0];
    const currentPath = location.pathname;

    if (targetPath === currentPath) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // 跨页面跳转时，强制在新页面渲染后回到顶部
      window.scrollTo({ top: 0 });
    }
  };

  return (
    <>
      {/* Add Menu Overlay */}
      <AnimatePresence>
        {showAddMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddMenu(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[70]"
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.8 }}
              className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[80] w-[85%] max-w-sm"
            >
              <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-2xl border border-white/50 flex flex-col gap-4">
                <h3 className="text-center text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">添加内容</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => { setShowAddMenu(false); navigate("/add-event"); }}
                    className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-amber-50 active:scale-95 transition-all group"
                  >
                    <div className="size-14 rounded-2xl bg-[#eab308] text-white flex items-center justify-center shadow-lg shadow-[#eab308]/30 group-hover:rotate-6 transition-transform">
                      <Calendar size={28} />
                    </div>
                    <span className="text-sm font-black text-slate-700">发布大事记</span>
                  </button>
                  <button
                    onClick={() => { setShowAddMenu(false); navigate("/add-member"); }}
                    className="flex flex-col items-center gap-3 p-5 rounded-3xl bg-blue-50 active:scale-95 transition-all group"
                  >
                    <div className="size-14 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:-rotate-6 transition-transform">
                      <BookOpen size={28} />
                    </div>
                    <span className="text-sm font-black text-slate-700">创建档案</span>
                  </button>
                </div>
                <button
                  onClick={() => setShowAddMenu(false)}
                  className="mt-2 py-4 text-slate-400 font-bold text-sm tracking-widest hover:text-slate-600 transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="w-full bg-white shadow-[0_-12px_30px_rgba(0,0,0,0.04)] flex justify-center overflow-hidden pt-1 pb-safe">
        <nav className="w-full flex items-center px-2 py-1 h-[72px] relative">
          {/* Left Items */}
          <div className="flex-1 flex items-center">
            {leftNavItems.map((item) => {
              const [path, hash] = item.to.split("#");
              const isItemActive = location.pathname === path && (hash ? location.hash.startsWith("#" + hash) : location.hash === "");

              return (
                <button
                  key={item.to}
                  onClick={() => {
                    handleNavClick(item.to);
                    navigate(item.to);
                  }}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 transition-all duration-300 relative py-1 rounded-xl outline-none",
                    isItemActive ? "text-[#eab308]" : "text-slate-400"
                  )}
                >
                  <item.icon size={22} strokeWidth={isItemActive ? 3 : 2} />
                  <span className="text-[10px] font-black tracking-tight">{item.label}</span>
                  {isItemActive && (
                    <motion.div
                      layoutId="activeTabBadge"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 size-1 rounded-full bg-[#eab308]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Center Plus Button */}
          <div className="mx-2 relative z-10 bottom-1">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className={cn(
                "size-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl shadow-slate-900/20 transition-all active:scale-90",
                showAddMenu && "rotate-45 bg-[#eab308] text-black"
              )}
            >
              <Plus size={32} strokeWidth={4} />
            </button>
          </div>

          {/* Right Items */}
          <div className="flex-1 flex items-center">
            {rightNavItems.map((item) => {
              const [path, hash] = item.to.split("#");
              const isItemActive = location.pathname === path && (hash ? location.hash.startsWith("#" + hash) : location.hash === "");

              return (
                <button
                  key={item.to}
                  onClick={() => {
                    handleNavClick(item.to);
                    navigate(item.to);
                  }}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 transition-all duration-300 relative py-1 rounded-xl outline-none",
                    isItemActive ? "text-[#eab308]" : "text-slate-400"
                  )}
                >
                  <item.icon size={22} strokeWidth={isItemActive ? 3 : 2} />
                  <span className="text-[10px] font-black tracking-tight">{item.label}</span>
                  {isItemActive && (
                    <motion.div
                      layoutId="activeTabBadge"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 size-1 rounded-full bg-[#eab308]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
};
