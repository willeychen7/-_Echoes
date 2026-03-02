import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
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
import { BottomNav } from "./components/BottomNav";

const AppContent: React.FC = () => {
  useEffect(() => {
    // 核心修复：移除自动注入演示用户的逻辑，防止其覆盖真实用户的登录状态。
    // 演示用户应仅在首次点击“立即开启”或未登录时，通过 LandingPage 明确触发。
  }, []);

  const location = useLocation();

  // 定义不需要显示底部导航栏的页面路径
  const hideNavPaths = ["/", "/login", "/register", "/register-success"];
  const shouldShowNav = !hideNavPaths.includes(location.pathname);

  return (
    <div className="flex flex-col h-full bg-[#fdfbf7] relative overflow-hidden">
      <div className="scroll-container">
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
        </Routes>
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
