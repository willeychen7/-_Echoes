import React, { useState, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Share2, LogOut, Heart, MessageSquare, Clock, X, Check, CheckCircle, Camera, Gift, Users, Bell, ChevronRight, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "./lib/utils";
import { ImageCropper } from "./components/ImageCropper";
import { DEMO_PERSONAS, isDemoMode } from "./demo-data";
import { DEFAULT_AVATAR, SYSTEM_AVATARS } from "./constants";

/** 相对时间转换 */
const getRelativeTime = (dateStr: string) => {
  if (!dateStr) return "刚刚";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
  return date.toLocaleDateString();
};

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
  const [isLoading, setIsLoading] = useState(false);

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("currentUser");
    const parsed = saved ? JSON.parse(saved) : null;
    const cachedStats = parsed?.stats || { memories: 0, likes: 0, days: 1 };

    return {
      id: parsed?.memberId || null,
      name: parsed?.name || "家人",
      role: parsed?.relationship || "本人",
      avatar: parsed?.avatar || parsed?.avatarUrl || DEFAULT_AVATAR,
      joinDate: parsed?.joinDate || new Date().toISOString(),
      familyId: parsed?.familyId || 1,
      bio: parsed?.bio || parsed?.signature || "热爱生活，记录美好。",
      birthday: parsed?.birthday || parsed?.birthDate || "",
      gender: parsed?.gender || "男",
      stats: cachedStats,
      isRegistered: !!parsed?.isRegistered
    };
  });

  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    birthday: ""
  });
  const [unreadCount, setUnreadCount] = useState(0);

  useLayoutEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  const fetchStatsAndNotifications = async (currentUserInfo: any) => {
    try {
      const memberId = currentUserInfo.memberId || currentUserInfo.id;
      if (!memberId) {
        setIsLoading(false);
        return;
      }

      // 核心增强：不仅获取统计，还获取最新的档案详情以确保同步
      const isDemo = isDemoMode(currentUserInfo);
      const [notifsRes, statsRes, profileRes] = await Promise.all([
        fetch(`/api/notifications/${memberId}`),
        fetch(`/api/stats/${memberId}`),
        !isDemo ? fetch(`/api/family-members/${memberId}`) : Promise.resolve(null)
      ]);

      const [notifs, stats, freshProfile] = await Promise.all([
        notifsRes.json(),
        statsRes.json(),
        profileRes ? profileRes.json() : Promise.resolve(null)
      ]);

      const days = Math.max(1, Math.floor((Date.now() - new Date(currentUserInfo.joinDate || Date.now()).getTime()) / 86400000));

      // 如果有最新的云端档案，同步到本地缓存
      let finalUserData = {
        ...currentUserInfo,
        bio: currentUserInfo.bio || currentUserInfo.signature || "热爱生活，记录美好。",
        birthday: currentUserInfo.birthday || currentUserInfo.birthDate || ""
      };
      const statsObj = {
        memories: stats.memories || 0,
        likes: stats.likes || 0,
        days
      };

      let hasChanges = false;
      if (freshProfile && freshProfile.id) {
        const remoteName = freshProfile.name;
        const remoteAvatar = freshProfile.avatar_url || freshProfile.avatarUrl;
        const remoteBio = freshProfile.bio || "热爱生活，记录美好。";
        const remoteBirthday = freshProfile.birth_date || freshProfile.birthDate;

        if (
          remoteName !== finalUserData.name ||
          (remoteAvatar && remoteAvatar !== finalUserData.avatar) ||
          remoteBio !== (finalUserData.bio || "热爱生活，记录美好。") ||
          remoteBirthday !== finalUserData.birthday
        ) {
          finalUserData = {
            ...finalUserData,
            name: remoteName,
            avatar: remoteAvatar || finalUserData.avatar,
            bio: remoteBio || finalUserData.bio || "热爱生活，记录美好。",
            birthday: remoteBirthday || finalUserData.birthday
          };
          hasChanges = true;
        }
      }

      // 无论 profile 是否变化，都要同步最新的 stats 到缓存
      localStorage.setItem("currentUser", JSON.stringify({
        ...finalUserData,
        stats: statsObj
      }));

      setUser(prevUser => {
        // 检查统计数据是否有变化
        const statsChanged =
          prevUser.stats.memories !== (stats.memories || 0) ||
          prevUser.stats.likes !== (stats.likes || 0) ||
          prevUser.stats.days !== days;

        if (!hasChanges && !statsChanged && prevUser.id === finalUserData.memberId) {
          return prevUser;
        }

        return {
          ...prevUser,
          ...finalUserData,
          avatar: (finalUserData.avatar && finalUserData.avatar.length > 20) ? finalUserData.avatar : prevUser.avatar,
          stats: {
            memories: stats.memories || 0,
            likes: stats.likes || 0,
            days
          }
        };
      });

      // Removed setEditForm to prevent the signature input from jumping during background API polling.

      setNotifications(Array.isArray(notifs) ? notifs : []);
      const unread = (Array.isArray(notifs) ? notifs : []).filter((n: any) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (e) {
      console.error("Fetch profile stats error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (!savedUser) {
      setIsLoading(false);
      return;
    }
    const parsed = JSON.parse(savedUser);
    if (!parsed.memberId) {
      setIsLoading(false);
      return;
    }

    // 初始加载
    fetchStatsAndNotifications(parsed);

    // NOTE: 30秒轮询兑底 —— 确保断网后重连也能同步
    const pollTimer = setInterval(() => fetchStatsAndNotifications(parsed), 30000);

    return () => clearInterval(pollTimer);
  }, []);

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

    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      localStorage.setItem("currentUser", JSON.stringify({ ...parsed, avatar: url }));
    }

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

    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      localStorage.setItem("currentUser", JSON.stringify({
        ...parsed,
        name: editForm.name,
        bio: editForm.bio,
        birthday: editForm.birthday,
        avatar: user.avatar
      }));
    }

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
      const phone = JSON.parse(localStorage.getItem("currentUser") || "{}").phone;
      const res = await fetch("/api/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone,
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
    { label: "孙子/孙女", value: "grandson" },
    { label: "配偶", value: "spouse" },
    { label: "其他", value: "other" }
  ];

  const handleSwitchPersona = (persona: any) => {
    localStorage.setItem("currentUser", JSON.stringify(persona));
    window.location.reload();
  };

  const defaultAvatars = SYSTEM_AVATARS;

  const menuGroups = [
    {
      title: "账号设置",
      items: [
        {
          icon: Edit2, label: "编辑个人资料", color: "text-blue-500 bg-blue-50", action: () => {
            setEditForm({ name: user.name, bio: user.bio, birthday: user.birthday });
            setShowEditModal(true);
          }
        },
        ...(user.isRegistered ? [{ icon: Gift, label: "接受家族邀请", color: "text-rose-500 bg-rose-50", action: () => setShowInviteModal(true) }] : []),
        ...(isDemoMode(user) ? [{ icon: Users, label: "切换测试用户", color: "text-indigo-500 bg-indigo-50", action: () => setShowPersonaModal(true) }] : []),
        {
          icon: Bell,
          label: "消息通知",
          color: "text-orange-500 bg-orange-50",
          badge: unreadCount > 0 ? unreadCount.toString() : "",
          action: () => navigate("/notifications")
        },
        { icon: CheckCircle, label: "隐私与安全", color: "text-emerald-500 bg-emerald-50" },
      ]
    }
  ];

  return (
    <div className="bg-[#fdfbf0] min-h-screen">
      <header className="sticky top-0 z-[60] glass-morphism px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 p-2 -ml-3 rounded-full hover:bg-black/5 text-slate-800 transition-colors group">
          <ArrowLeft size={28} className="group-active:-translate-x-1 transition-transform" />
          <span className="text-lg font-black pr-2">返回</span>
        </button>
        <h1 className="text-xl font-black font-display flex-1 text-center truncate px-2 text-slate-800">
          个人中心
        </h1>
        <div className="w-10"></div>
      </header>

      {/* isLoading 时不再显示一个空白 div，而是直接显示内容，只是在后台加载 */}
      <main className="px-6 py-8 space-y-10">
        <motion.div
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
          <div
            className="flex items-center justify-center gap-2 mb-4 cursor-pointer group px-4 py-1 -mt-1 rounded-full hover:bg-slate-50 transition-colors"
            onClick={() => {
              setEditForm({ name: user.name, bio: user.bio, birthday: user.birthday });
              setShowEditModal(true);
            }}
          >
            <p className="text-sm text-slate-500 italic">“{user.bio}”</p>
            <div className="bg-[#eab308]/20 p-1 rounded-full text-[#eab308] group-hover:scale-110 transition-transform shadow-sm">
              <Edit2 size={12} strokeWidth={3} />
            </div>
          </div>

          {user.birthday && (
            <div className="flex items-center justify-center gap-1.5 mb-6 text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full max-w-max mx-auto shadow-sm">
              <span>🎂 生日：{user.birthday}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 w-full border-t border-slate-100 pt-6">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-bold text-slate-800">{user.stats.memories}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">留声印记</span>
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
                    <div className={cn("size-10 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow", item.color)}>
                      <item.icon size={20} />
                    </div>
                    <span className="font-bold text-slate-700 flex-1 text-left">{item.label}</span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
                    {item.badge && (
                      <span className="absolute right-12 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm shadow-red-200 border-2 border-white animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-white rounded-[2rem] p-2 shadow-sm border border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full p-4 flex items-center justify-center gap-3 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all"
            >
              <LogOut size={20} /> 退出登录
            </button>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px] flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-8 text-left">
                <h3 className="text-2xl font-bold">消息通知</h3>
                <button onClick={() => {
                  setShowNotifications(false);
                  localStorage.setItem(`read_notifs_old_${user.id}`, localStorage.getItem(`read_notifs_${user.id}`) || "[]");
                }} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-4 text-left">
                {notifications.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-bold">暂无新通知</div>
                ) : (
                  notifications.map((n, i) => {
                    const isUnread = !JSON.parse(localStorage.getItem(`read_notifs_old_${user.id}`) || "[]").includes(n.id);
                    // NOTE: 根据通知类型决定跳转目标
                    const handleNotifClick = () => {
                      setShowNotifications(false);
                      if (n.event_id) {
                        navigate("/square", { state: { highlightEventId: n.event_id } });
                      } else if (n.target_member_id || n.member_id) {
                        navigate("/archive", { state: { highlightMemberId: n.target_member_id || n.member_id } });
                      } else {
                        navigate("/square");
                      }
                    };
                    return (
                      <button key={i} onClick={handleNotifClick} className={cn("w-full p-4 rounded-[2rem] flex gap-4 border border-slate-100/50 transition-all text-left active:scale-[0.98] group", isUnread ? "bg-orange-50 hover:bg-orange-100/70" : "bg-slate-50 hover:bg-slate-100")}>
                        <div className="relative shrink-0">
                          <img src={n.sender_avatar || n.authorAvatar || `https://picsum.photos/seed/${n.sender_name || n.authorName}/100/100`} className="size-12 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
                          {n.type === "like" && (
                            <div className="absolute -bottom-1 -right-1 size-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white">❤️</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">
                            <span className="text-[#eab308]">{n.sender_name || n.authorName}</span>
                            {n.type === "like" ? ` 赞了你的${n.event_id ? '大事记' : '记忆档案'}留言！` : " 在你的档案里留言了！"}
                          </p>
                          {n.content && n.type !== "like" && <p className="text-xs text-slate-400 mt-1 italic truncate">“{n.content}”</p>}
                          <p className="text-[10px] text-slate-300 mt-2 font-bold uppercase tracking-tighter">{getRelativeTime(n.created_at || n.createdAt)}</p>
                        </div>
                        <div className="self-center text-slate-200 group-hover:text-slate-400 transition-colors shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showAvatarModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px]"
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
                        user.avatar === url ? "border-[#eab308] scale-95 shadow-lg shadow-[#eab308]/20" : "border-slate-50"
                      )}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors">
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
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px] flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-8 text-left">
                <h3 className="text-2xl font-bold">编辑个人资料</h3>
                <button onClick={() => setShowEditModal(false)} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar pb-4 text-left">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 ml-4">我的姓名</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full h-16 px-6 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
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

              <div className="pt-6 space-y-3">
                <button onClick={handleEditSave} className="w-full py-5 bg-[#eab308] text-black rounded-3xl font-bold shadow-xl shadow-[#eab308]/20 active:scale-[0.98] transition-all">
                  保存修改
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showPersonaModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px]"
            >
              <h3 className="text-2xl font-bold mb-8 text-center">切换演示角色</h3>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pb-2">
                {DEMO_PERSONAS.map((persona, i) => (
                  <button
                    key={i}
                    onClick={() => handleSwitchPersona(persona)}
                    className={cn(
                      "w-full p-4 flex items-center gap-4 rounded-3xl border-2 transition-all active:scale-[0.98]",
                      user.id === persona.memberId ? "border-[#eab308] bg-[#eab308]/5" : "border-slate-50 hover:bg-slate-50"
                    )}
                  >
                    <img src={persona.avatar} alt={persona.name} className="size-12 rounded-full object-cover shadow-sm" />
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{persona.name}</div>
                      <div className="text-xs text-slate-400">关系：{persona.relationship}</div>
                    </div>
                    {user.id === persona.memberId && <div className="size-2 rounded-full bg-[#eab308]" />}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPersonaModal(false)}
                className="w-full py-5 bg-slate-100 rounded-3xl font-bold text-slate-500 mt-6 active:scale-95 transition-transform"
              >
                取消
              </button>
            </motion.div>
          </div>
        )}

        {showInviteModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px] flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8 text-left">
                <h3 className="text-2xl font-bold">加入家族</h3>
                <button onClick={() => { setShowInviteModal(false); setInviteData(null); }} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <X size={20} />
                </button>
              </div>

              {!inviteData ? (
                <div className="space-y-6 text-left">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 ml-4">邀请码</label>
                    <input
                      type="text"
                      value={inviteCodeInput}
                      onChange={(e) => { setInviteCodeInput(e.target.value); setInviteError(""); }}
                      className={cn(
                        "w-full h-16 px-6 rounded-2xl bg-slate-50 border-none font-black text-xl text-[#eab308] placeholder:text-slate-200 focus:ring-2 focus:ring-[#eab308]/20 transition-all",
                        inviteError && "ring-2 ring-red-400"
                      )}
                      placeholder="例如: INV-1002-1003"
                    />
                    {inviteError && <p className="text-red-500 text-xs font-bold px-4">{inviteError}</p>}
                  </div>
                  <button
                    onClick={handleValidateInvite}
                    disabled={isValidatingInvite || !inviteCodeInput}
                    className="w-full py-5 bg-[#eab308] text-black rounded-3xl font-bold shadow-xl shadow-[#eab308]/20 disabled:opacity-50 active:scale-[0.98] transition-all"
                  >
                    {isValidatingInvite ? "验证中..." : "验证邀请码"}
                  </button>
                </div>
              ) : (
                <div className="space-y-8 overflow-y-auto no-scrollbar pb-2 text-left">
                  <p className="text-slate-500 leading-relaxed px-4 text-center">
                    <span className="font-bold text-slate-800">{inviteData.inviterName}</span> 邀请您加入家族。请问您是他的？
                  </p>
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
                    className="w-full py-5 bg-[#eab308] text-black rounded-3xl font-bold shadow-xl shadow-[#eab308]/20 disabled:opacity-50 mt-4 active:scale-[0.98] transition-all"
                  >
                    确认加入
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

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
