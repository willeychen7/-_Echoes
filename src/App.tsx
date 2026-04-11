import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LandingPage } from "./LandingPage";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { RegisterSuccessPage } from "./RegisterSuccessPage";
import { FamilySquare } from "./FamilySquare";
import { ArchivePage } from "./ArchivePage";
import { CalendarPage } from "./CalendarPage";
import { AddMemberPage } from "./AddMemberPage";
import { BlessingPage } from "./BlessingPage";
import { AddEventPage } from "./AddEventPage";
import { ProfilePage } from "./ProfilePage";
import { NotificationsPage } from "./NotificationsPage";
import { FamilyTreePage } from "./FamilyTree";
import { BottomNav } from "./components/BottomNav";
import { FloatingAgentTrigger } from "./components/FloatingAgentTrigger";
import { GlobalVoiceAssistant } from "./GlobalVoiceAssistant";
import { isDemoMode } from "./demo-data";

const AuthSync: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) return;

    // NOTE: 演示模式跳过同步，避免污染真实环境
    const user = JSON.parse(userStr);
    const isDemo = isDemoMode(user);
    if (isDemo) {
      console.log("[AuthSync] Persona:", user?.name, "Family:", user?.familyId, "isDemo:", isDemo);
      return;
    }

    // 🚀 核心锚定逻辑：启动时强制对齐
    const identity = user.id || user.phone;
    if (identity) {
      fetch(`/api/me?${user.id ? `userId=${user.id}` : `phone=${user.phone}`}`)
        .then(res => res.ok ? res.json() : null)
        .then(fresh => {
          if (fresh && (fresh.familyId !== user.familyId || fresh.memberId !== user.memberId)) {
            console.log("[AuthSync] Identity Drift Detected! Healing session...");
            const updated = { ...user, familyId: fresh.familyId, memberId: fresh.memberId };
            localStorage.setItem("currentUser", JSON.stringify(updated));

            // 🚀 核心修复：清理本地演示缓存，防止 demo 数据污染真实页面
            localStorage.removeItem("demoCustomMembers");
            localStorage.removeItem("demoCustomEvents");

            // 发送系统级同步事件
            window.dispatchEvent(new Event("sync-user"));
            // 如果是在关键业务页，刷新以重写数据源
            if (location.pathname === "/square") {
              setTimeout(() => window.location.reload(), 100);
            }
          }
        })
        .catch(error => console.error("AuthSync fetch error:", error)); // Added catch for fetch error
    }

    // 🚀 全局适老化功能：双击朗读任何文字
    const handleGlobalDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const textToRead = target.innerText || target.getAttribute("alt") || target.title;
      if (textToRead && window.speechSynthesis) {
        // 先停止正在朗读的
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = "zh-CN";
        utterance.rate = 0.9; // 稍微慢一点，更适合老人
        window.speechSynthesis.speak(utterance);
      }
    };
    window.addEventListener("dblclick", handleGlobalDblClick);

    return () => {
      window.removeEventListener("dblclick", handleGlobalDblClick);
    };
  }, [location.pathname]);

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const location = useLocation();

  const hideNavPaths = ["/", "/login", "/register", "/register-success"];
  const [homeMode, setHomeMode] = React.useState("normal");

  React.useEffect(() => {
    const checkMode = () => {
      const saved = localStorage.getItem("currentUser");
      const parsed = saved ? JSON.parse(saved) : null;
      setHomeMode(parsed?.homeMode || "normal");
    };
    checkMode();
    window.addEventListener("sync-user", checkMode);
    return () => window.removeEventListener("sync-user", checkMode);
  }, []);

  // Agent should not show on entry pages
  const shouldShowAgent = !hideNavPaths.includes(location.pathname);

  // Only hide bottom nav on the pure 'Square' home view. Sub-tabs like Archive/Calendar should show it.
  const shouldShowNav = !hideNavPaths.includes(location.pathname) &&
    !(location.pathname === "/square" && (location.hash === "" || location.hash === "#square"));

  return (
    <div className="h-[100dvh] w-full flex justify-center bg-slate-200 overflow-hidden">
      <div className="w-full max-w-[500px] h-full bg-[#fdfbf7] shadow-2xl flex flex-col relative">
        {shouldShowAgent && (
          <>
            <FloatingAgentTrigger />
            <GlobalVoiceAssistant />
          </>
        )}
        
        {/* 主要内容区域：flex-1 确保占据空间，overflow-y-auto 实现局部滚动 */}
        <main className="flex-1 overflow-y-auto scroll-container relative w-full bg-[#fdfbf7]">
          <AuthSync>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register-success" element={<RegisterSuccessPage />} />
              <Route path="/square" element={<FamilySquare />} />
              <Route path="/archive/:id" element={<ArchivePage />} />
              <Route path="/archive" element={<Navigate to="/square" />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/add-member" element={<AddMemberPage />} />
              <Route path="/add-event" element={<AddEventPage />} />
              <Route path="/blessing/:eventId" element={<BlessingPage />} />
              <Route path="/blessing" element={<Navigate to="/square" />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/family-tree" element={<FamilyTreePage />} />
              <Route path="*" element={<Navigate to="/square" />} />
            </Routes>
          </AuthSync>
        </main>

        {/* 底部导航：非定位元素，作为弹性盒子的子项紧贴底部 */}
        {shouldShowNav && (
          <div className="shrink-0 border-t border-slate-100 bg-white z-[60]">
            <BottomNav />
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
