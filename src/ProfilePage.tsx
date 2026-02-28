import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, ChevronRight, LogOut, Shield, HelpCircle, Bell, Edit, Info, Users, Camera, Gift, X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { ImageCropper } from "./components/ImageCropper";
import { DEMO_PERSONAS, isDemoMode } from "./demo-data";

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isValidatingInvite, setIsValidatingInvite] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [selectedRel, setSelectedRel] = useState("");
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [user, setUser] = useState({
    id: null as number | null,
    name: "陈建国",
    role: "本人",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMmK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y",
    joinDate: "2024-01-15",
    familyId: 1,
    bio: "热爱生活，记录美好。",
    birthday: "1965-05-12",
    gender: "男",
    stats: {
      memories: 12,
      likes: 48,
      days: 365
    },
    isRegistered: false
  });

  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    birthday: ""
  });

  useEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      const updatedUser = {
        ...user,
        id: parsed.memberId || null,
        name: parsed.name || user.name,
        avatar: parsed.avatar || user.avatar,
        role: parsed.relationship || user.role,
        bio: parsed.bio || user.bio,
        birthday: parsed.birthday || user.birthday,
        gender: parsed.gender || user.gender,
        familyId: parsed.familyId || user.familyId,
        isRegistered: !!parsed.isRegistered,
      };

      if (updatedUser.id) {
        fetchStatsAndNotifications(updatedUser);
      } else {
        setUser(updatedUser);
        setEditForm({
          name: updatedUser.name,
          bio: updatedUser.bio,
          birthday: updatedUser.birthday
        });
      }
    }
  }, []);

  const fetchStatsAndNotifications = async (currentUserInfo: any) => {
    try {
      const [msgsRes, eventsRes] = await Promise.all([
        fetch("/api/messages"),
        fetch(currentUserInfo.familyId ? `/api/events?familyId=${currentUserInfo.familyId}` : "/api/events")
      ]);
      const msgs = await msgsRes.json();
      const events = await eventsRes.json();

      const myEventsIds = events.filter((e: any) => e.memberId === currentUserInfo.id).map((e: any) => e.id);

      const memoriesCount = msgs.filter((m: any) => m.authorName === currentUserInfo.name).length;

      const myWallMsgs = msgs.filter((m: any) =>
        m.familyMemberId === currentUserInfo.id || myEventsIds.includes(m.eventId)
      );
      const likesCount = myWallMsgs.reduce((sum: number, m: any) => sum + (m.likes || 0), 0);

      const newNotifs = myWallMsgs
        .filter((m: any) => m.authorName !== currentUserInfo.name)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const days = Math.max(1, Math.floor((Date.now() - new Date(currentUserInfo.joinDate).getTime()) / 86400000));

      setUser({
        ...currentUserInfo,
        stats: { memories: memoriesCount, likes: likesCount, days }
      });
      setEditForm({
        name: currentUserInfo.name,
        bio: currentUserInfo.bio,
        birthday: currentUserInfo.birthday
      });
      setNotifications(newNotifs);
    } catch (e) {
      console.error(e);
      setUser(currentUserInfo);
      setEditForm({
        name: currentUserInfo.name,
        bio: currentUserInfo.bio,
        birthday: currentUserInfo.birthday
      });
    }
  };

  const handleLogout = () => {
    if (isDemoMode(user)) {
      localStorage.removeItem("demoCustomMembers");
      localStorage.removeItem("demoCustomEvents");
    }
    localStorage.removeItem("currentUser");
    navigate("/");
  };

  const handleAvatarChange = async (url: string) => {
    const updatedUser = { ...user, avatar: url };
    setUser(updatedUser);

    // Save to localStorage
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      localStorage.setItem("currentUser", JSON.stringify({ ...parsed, avatar: url }));
    }

    // Save to DB if linked
    if (user.id) {
      await fetch(`/api/family-members/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          relationship: user.role,
          avatarUrl: url,
          bio: user.bio,
          birthDate: user.birthday
        })
      });
    }

    // Dispatch sync events
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('sync-user'));
  };

  const handleEditSave = async () => {
    const updatedUser = {
      ...user,
      name: editForm.name,
      bio: editForm.bio,
      birthday: editForm.birthday
    };
    setUser(updatedUser);

    // Save to localStorage
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      localStorage.setItem("currentUser", JSON.stringify({
        ...parsed,
        name: editForm.name,
        bio: editForm.bio,
        birthday: editForm.birthday,
        avatar: user.avatar // Ensure avatar is kept
      }));
    }

    // Save to DB
    if (user.id) {
      await fetch(`/api/family-members/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          avatarUrl: user.avatar,
          bio: editForm.bio,
          birthDate: editForm.birthday
        })
      });
    }

    setShowEditModal(false);
    // Dispatch events for same-tab sync and cross-tab sync
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('sync-user'));
  };

  const handleValidateInvite = async () => {
    if (!inviteCodeInput.trim()) return;
    setIsValidatingInvite(true);
    setInviteError("");
    try {
      const res = await fetch(`/api/validate-invite?code=${encodeURIComponent(inviteCodeInput.trim())}`);
      if (!res.ok) {
        setInviteError("邀请码无效");
        setIsValidatingInvite(false);
        return;
      }
      const data = await res.json();
      setInviteData(data);
    } catch (e) {
      setInviteError("网络错误");
    }
    setIsValidatingInvite(false);
  };

  const handleAcceptInvite = async () => {
    if (!selectedRel || !inviteData) return;
    try {
      const res = await fetch("/api/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: user.role === "本人" ? JSON.parse(localStorage.getItem("currentUser") || "{}").phone : null, // Handle fallback
          inviteCode: inviteCodeInput.trim(),
          relationshipToInviter: selectedRel,
          standardRole: relationships.find(r => r.label === selectedRel)?.value || "other"
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "加入失败");
        return;
      }

      const data = await res.json();
      // Update local user data
      const savedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      localStorage.setItem("currentUser", JSON.stringify({
        ...savedUser,
        memberId: data.memberId,
        familyId: data.familyId,
        relationship: selectedRel
      }));

      alert("成功加入家族！");
      window.location.reload();
    } catch (e) {
      alert("操作失败");
    }
  };

  const relationships = [
    { label: "儿子", value: "son" },
    { label: "女儿", value: "daughter" },
    { label: "父亲", value: "father" },
    { label: "母亲", value: "mother" },
    { label: "哥哥/姐姐", value: "sibling" },
    { label: "弟弟/妹妹", value: "sibling" },
    { label: "孙子/孙女", value: "grandson" },
    { label: "配偶", value: "spouse" },
    { label: "其他", value: "other" }
  ];

  const handleSwitchPersona = (persona: any) => {
    localStorage.setItem("currentUser", JSON.stringify(persona));
    window.location.reload(); // Reload to apply new persona identity everywhere
  };

  const testPersonas = DEMO_PERSONAS;

  const defaultAvatars = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMmK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDvg6W6IFZ2JuDXanowe2po0Ndn_QmJPFENhHjprVqA22bvfwP64ioaH-ScdlzVoD4OmDEq4Owhiwy5JcXd5r_eQmBI6g7e8qSO3v3gjR7IbsNRaRePyLPJ6-oO0li96mEPtfaFA4JYAQquay2Gxj2UDAsTG6Be_k0WdXbKGyFieLqreF6K2rDFmxJe_hG6CM0TdKAPDlUh5ys0cfZjZKaXgY_Ceu9arfujNoJmvo9lhnmPK7BmGE1H-6dLGdB9a7wtp2FsoTpjA2w",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDIwxfzAvsOl_ZzsdHKppuFhs_5iM26_e_p9y0kU5_hiLIVc9JAY_Q8otsTMmOgX5pbn8EPDA2b_WN2KHmuEYiQ_xNJvM7vhbd7cZi38m3JnyKMW5xfg3al0T0-wRjr8BHYEW-69XFpOpqZ0CLKqXYOqBmT2ZzMxzoX_kgqVkuAi9Dx-uoZIO6209WL5x1iIvXLkAyJcupmiN4VgbJxG_YZoKIVS_i2I8CFGTfPC8qlUUhPO4BjYxqiYHbOdcLlV1QacYME0v_b-4Q",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBAdiBHDqEr2K33fyt5BaRHdl7JV-ITKpBOKDmyz87kyHbJXbxViiMpAoqF0v8hkObP0481dOZWZeNK5mf151CBcsTi2zydCD56k2lIlrJNwk9IImtHScfDETFF-h9tJxjbmxUOZY_g8jEIokPEDj37oagfY6VWKEMIw6Fyk_Uxew_PYRxZzLw_28b4pO4EMCBITCWArexcIpjk4HIlC4udrqA9MrjKSueMBgGE3UpXfLjRdUIZ9OgHLbrq0JWsvpsm1Xm135ZE81s"
  ];

  const menuGroups = [
    {
      title: "账号设置",
      items: [
        { icon: Edit, label: "编辑个人资料", color: "text-blue-500 bg-blue-50", action: () => setShowEditModal(true) },
        ...(user.isRegistered ? [{ icon: Gift, label: "接受家族邀请", color: "text-rose-500 bg-rose-50", action: () => setShowInviteModal(true) }] : []),
        ...(isDemoMode(user) ? [{ icon: Users, label: "切换测试用户", color: "text-indigo-500 bg-indigo-50", action: () => setShowPersonaModal(true) }] : []),
        { icon: Bell, label: "消息通知", color: "text-orange-500 bg-orange-50", badge: notifications.length > 0 ? notifications.length.toString() : "", action: () => setShowNotifications(true) },
        { icon: Shield, label: "隐私与安全", color: "text-emerald-500 bg-emerald-50" },
      ]
    },
    {
      title: "关于",
      items: [
        { icon: HelpCircle, label: "帮助与反馈", color: "text-purple-500 bg-purple-50" },
        { icon: Info, label: "关于我们", color: "text-slate-500 bg-slate-100", extra: "v1.0.0" },
      ]
    }
  ];

  return (
    <div className="bg-[#fdfbf0] min-h-full">
      <header className="sticky top-0 z-[60] bg-white/80 backdrop-blur-md px-6 py-5 flex items-center justify-between shadow-sm shrink-0 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 p-2 -ml-3 rounded-full hover:bg-black/5 text-slate-800 transition-colors group">
          <ArrowLeft size={28} className="group-active:-translate-x-1 transition-transform" />
          <span className="text-lg font-black pr-2">返回</span>
        </button>
        <h1 className="text-xl font-black font-display flex-1 text-center truncate px-2 text-slate-800">
          个人中心
        </h1>
        <div className="w-10"></div>
      </header>

      <main className="px-6 py-8 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#eab308]/10 to-transparent pointer-events-none" />

          <div className="relative z-10 mb-4 flex flex-col items-center">
            <div className="group cursor-pointer relative" onClick={() => setShowAvatarModal(true)}>
              <div className="size-28 rounded-full border-4 border-white shadow-lg overflow-hidden relative">
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="text-white" size={24} />
                </div>
              </div>
              <div className="absolute bottom-0 right-0 bg-[#eab308] text-black text-[10px] font-bold px-3 py-1 rounded-full border-2 border-white shadow-sm flex items-center gap-1">
                我
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">{user.name}</h2>
          <p className="text-sm text-slate-500 mb-6 italic">“{user.bio}”</p>

          <div className="grid grid-cols-3 gap-4 w-full border-t border-slate-100 pt-6">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold text-slate-800">{user.stats.memories}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">记忆瞬间</span>
            </div>
            <div className="flex flex-col items-center gap-1 border-x border-slate-100">
              <span className="text-xl font-bold text-slate-800">{user.stats.likes}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">获赞</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold text-slate-800">{user.stats.days}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">相伴天数</span>
            </div>
          </div>
        </motion.div>

        <div className="space-y-8 pb-4">
          {menuGroups.map((group, groupIndex) => (
            <div key={group.title} className="space-y-4">
              <h3 className="px-2 text-xs font-bold text-slate-400 uppercase tracking-widest">{group.title}</h3>
              <div className="bg-white rounded-[2rem] p-2 shadow-sm border border-slate-100 overflow-hidden">
                {group.items.map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 rounded-2xl transition-all active:scale-[0.98] group relative"
                  >
                    <div className={`size-10 rounded-xl ${item.color} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
                      <item.icon size={20} />
                    </div>
                    <span className="font-bold text-slate-700 flex-1 text-left">{item.label}</span>
                    {item.extra && <span className="text-xs font-bold text-slate-400 mr-2 bg-slate-100 px-2 py-1 rounded-full">{item.extra}</span>}
                    {item.badge && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 shadow-sm shadow-red-200">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-white rounded-[2rem] p-2 shadow-sm border border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full p-4 flex items-center gap-4 hover:bg-red-50 rounded-2xl transition-all active:scale-[0.98] group"
            >
              <div className="size-10 rounded-xl text-red-500 bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-all shadow-sm">
                <LogOut size={20} />
              </div>
              <span className="font-bold text-red-500 flex-1 text-left">退出登录</span>
            </button>
          </div>
        </div>
      </main>

      {/* Modals */}
      <motion.div
        className={cn(
          "fixed inset-0 bg-black/60 z-[100] flex items-end justify-center pointer-events-none transition-opacity",
          (showAvatarModal || showEditModal || showPersonaModal || showNotifications) ? "opacity-100 pointer-events-auto" : "opacity-0"
        )}
      >
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px] flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">消息通知</h3>
                <button onClick={() => setShowNotifications(false)} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-4 text-left">
                {notifications.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-bold">暂无新通知</div>
                ) : (
                  notifications.map((n, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl flex gap-3 shadow-sm border border-slate-100">
                      <img src={n.authorAvatar || `https://picsum.photos/seed/${n.authorName}/100/100`} className="size-10 border-2 border-white rounded-full shadow-sm shrink-0" alt="" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          <span className="text-[#eab308]">{n.authorName}</span> 在 <span className="underline decoration-slate-200">{n.eventId ? "你的大事记" : "你的记忆档案"}</span> 里给你留言了！
                        </p>
                        <p className="text-xs text-slate-500 mt-1 italic truncate">"{n.content}"</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-black">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {showAvatarModal && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px]"
            >
              <h3 className="text-2xl font-bold mb-8 text-center">更换我的头像</h3>
              <div className="space-y-8">
                <div className="grid grid-cols-4 gap-4">
                  {defaultAvatars.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => { handleAvatarChange(url); setShowAvatarModal(false); }}
                      className={cn(
                        "aspect-square rounded-2xl border-2 overflow-hidden hover:border-[#eab308] transition-all",
                        user.avatar === url ? "border-[#eab308] scale-95" : "border-slate-50"
                      )}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400 cursor-pointer hover:bg-slate-50">
                    <Camera size={20} />
                    <span className="text-[10px] font-bold">上传</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setTempImage(url);
                        setShowCropper(true);
                      }
                    }} />
                  </label>
                </div>
                <button onClick={() => setShowAvatarModal(false)} className="w-full py-5 bg-slate-100 rounded-3xl font-bold text-slate-500 active:scale-95 transition-transform">取消</button>
              </div>
            </motion.div>
          )}

          {showEditModal && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px] flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">编辑个人资料</h3>
                <button onClick={() => setShowEditModal(false)} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar pb-4 text-left">
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-400 ml-4">我的姓名</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full h-16 px-6 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                    placeholder="请输入姓名"
                  />
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-400 ml-4">我的生日</label>
                  <input
                    type="date"
                    value={editForm.birthday}
                    onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                    className="w-full h-16 px-6 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                  />
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-400 ml-4">我的个性签名</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    className="w-full h-32 p-6 rounded-2xl bg-slate-50 border-none font-medium text-slate-700 focus:ring-2 focus:ring-[#eab308]/20 transition-all resize-none"
                    placeholder="写点什么吧..."
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 space-y-3">
                <button onClick={handleEditSave} className="w-full py-5 bg-[#eab308] text-black rounded-3xl font-bold shadow-xl shadow-[#eab308]/20 active:scale-[0.98] transition-all">
                  保存所有修改
                </button>
                <button onClick={() => setShowEditModal(false)} className="w-full py-5 bg-slate-50 text-slate-400 rounded-3xl font-bold">
                  取消
                </button>
              </div>
            </motion.div>
          )}
          {showPersonaModal && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px]"
            >
              <h3 className="text-2xl font-bold mb-8 text-center">切换演示角色</h3>
              <div className="space-y-4">
                {testPersonas.map((persona, i) => (
                  <button
                    key={i}
                    onClick={() => handleSwitchPersona(persona)}
                    className={cn(
                      "w-full p-4 flex items-center gap-4 rounded-2xl border-2 transition-all active:scale-[0.98]",
                      user.id === persona.memberId ? "border-[#eab308] bg-[#eab308]/5" : "border-slate-50 hover:bg-slate-50"
                    )}
                  >
                    <img src={persona.avatar} alt={persona.name} className="size-12 rounded-full object-cover" />
                    <div className="text-left flex-1">
                      <div className="font-bold text-slate-800">{persona.name}</div>
                      <div className="text-xs text-slate-400">当前角色：{persona.relationship}</div>
                    </div>
                    {user.id === persona.memberId && <div className="size-2 rounded-full bg-[#eab308]" />}
                  </button>
                ))}
                <button
                  onClick={() => setShowPersonaModal(false)}
                  className="w-full py-5 bg-slate-100 rounded-3xl font-bold text-slate-500 mt-4"
                >
                  取消
                </button>
              </div>
            </motion.div>
          )}
          {showInviteModal && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px] flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold">加入家族</h3>
                <button onClick={() => { setShowInviteModal(false); setInviteData(null); }} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <X size={20} />
                </button>
              </div>

              {!inviteData ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 ml-4">请输入邀请码</label>
                    <input
                      type="text"
                      value={inviteCodeInput}
                      onChange={(e) => { setInviteCodeInput(e.target.value); setInviteError(""); }}
                      className={cn(
                        "w-full h-16 px-6 rounded-2xl bg-slate-50 border-none font-black text-xl text-[#eab308] focus:ring-2 focus:ring-[#eab308]/20 transition-all",
                        inviteError && "ring-2 ring-red-400"
                      )}
                      placeholder="例如: INV-1002-1003"
                    />
                    {inviteError && <p className="text-red-500 text-xs font-bold px-4">{inviteError}</p>}
                  </div>
                  <button
                    onClick={handleValidateInvite}
                    disabled={isValidatingInvite || !inviteCodeInput}
                    className="w-full py-5 bg-[#eab308] text-black rounded-3xl font-bold shadow-xl shadow-[#eab308]/20 disabled:opacity-50"
                  >
                    {isValidatingInvite ? "验证中..." : "验证邀请码"}
                  </button>
                </div>
              ) : (
                <div className="space-y-8 overflow-y-auto no-scrollbar pb-2">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-[#eab308]/10 rounded-full flex items-center justify-center mx-auto text-[#eab308]">
                      <Plus size={32} />
                    </div>
                    <p className="text-slate-500 leading-relaxed">
                      <span className="font-bold text-slate-800">{inviteData.inviterName}</span> 邀请您加入家族。<br />
                      请问您是 <span className="font-bold text-slate-800">{inviteData.inviterName}</span> 的谁？
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {relationships.map((rel) => (
                      <button
                        key={rel.label}
                        onClick={() => setSelectedRel(rel.label)}
                        className={cn(
                          "py-4 px-2 rounded-2xl border-2 font-bold transition-all text-sm",
                          selectedRel === rel.label
                            ? "bg-[#eab308] border-[#eab308] text-black shadow-lg shadow-[#eab308]/20"
                            : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {rel.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleAcceptInvite}
                    disabled={!selectedRel}
                    className="w-full py-5 bg-[#eab308] text-black rounded-3xl font-bold shadow-xl shadow-[#eab308]/20 disabled:opacity-50 mt-4"
                  >
                    确认加入并同步关系
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showCropper && tempImage && (
          <ImageCropper
            image={tempImage}
            onCropComplete={(croppedImage) => {
              handleAvatarChange(croppedImage);
              setShowCropper(false);
              setTempImage(null);
              setShowAvatarModal(false);
            }}
            onClose={() => {
              setShowCropper(false);
              setTempImage(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
