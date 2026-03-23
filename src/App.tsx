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

const AuthSync: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) return;

    // NOTE: 演示模式跳过同步，避免污染真实环境
    const user = JSON.parse(userStr);
    const isDemo = user?.demoMode || user?.id === 999;
    if (isDemo) return;

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

  const shouldShowNav = !hideNavPaths.includes(location.pathname);

  return (
    <div className="flex flex-col h-full bg-[#fdfbf7] relative overflow-hidden">
      <div className="scroll-container">
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
      </div>
      {shouldShowNav && <BottomNav />}
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
