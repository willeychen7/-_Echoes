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
import { BottomNav } from "./components/BottomNav";

const AppContent: React.FC = () => {
  useEffect(() => {
    // Demo Initialization: Force "陈建国" (ID 3) if no user exists
    const savedUser = localStorage.getItem("currentUser");
    if (!savedUser) {
      const demoUser = {
        name: "陈建国",
        phone: "13800138000",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMmK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y",
        relationship: "父亲",
        familyId: "FAM888888",
        memberId: 3,
        isRegistered: true,
        bio: "热爱生活，记录美好。",
        birthday: "1965-05-12",
        gender: "男",
        standardRole: "father"
      };
      localStorage.setItem("currentUser", JSON.stringify(demoUser));
    }
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
