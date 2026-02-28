import { NavLink, useLocation } from "react-router-dom";
import { Home, BookOpen, Calendar, User } from "lucide-react";
import { cn } from "../lib/utils";
import { motion } from "motion/react";

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const navItems = [
    { to: "/square", label: "广场", icon: Home },
    { to: "/square#archive", label: "档案", icon: BookOpen },
    { to: "/calendar", label: "日历", icon: Calendar },
    { to: "/profile", label: "我的", icon: User },
  ];

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
    <div className="w-full shrink-0 z-50 glass-morphism border-t border-slate-100 bg-white/95 pb-1">
      <nav className="flex justify-around items-center px-2 py-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => handleNavClick(item.to)}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative px-4 py-1 rounded-xl",
                isActive ? "text-[#eab308]" : "text-slate-400"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "transition-all duration-300",
                  isActive ? "scale-110" : "scale-100"
                )}>
                  <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  "text-[10px] font-bold tracking-tight transition-opacity",
                  isActive ? "opacity-100" : "opacity-60"
                )}>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTabBadge"
                    className="absolute -top-1 right-3 size-1.5 rounded-full bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.6)]"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
