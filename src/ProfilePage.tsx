// Force deployment sync - Vercel build trigger
import React, { useState, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Filter, ArrowLeft, MoreHorizontal, Edit2, Trash2, Camera,
  Settings, History, Heart, MessageSquare, Mic, Play, Pause, ChevronRight,
  Share2, QrCode, Copy, CheckCircle, Bell, UserPlus, Info, Shield, Check, X,
  AlertTriangle, Gift, Users, Clock, LogOut, Sparkles, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "./lib/utils";
import { updateAvatarCache } from "./lib/useAvatarCache";
import { ImageCropper } from "./components/ImageCropper";
import { DEMO_PERSONAS, isDemoMode } from "./demo-data";
import { DEFAULT_AVATAR, SYSTEM_AVATARS, getSafeAvatar } from "./constants";

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

/** 核心功能：基于双方 DNA (房分/排行/代数) 自动计算称谓推荐 */
const getIdentityRecommendation = (data: any) => {
  if (!data || !data.inviterId) return null;

  const iH = data.inviterAncestralHall;
  const tH = data.targetAncestralHall;
  const iG = data.inviterGenerationNum;
  const tG = data.targetGenerationNum;
  const iS = data.inviterSiblingOrder;
  const tS = data.targetSiblingOrder;
  const iSex = data.inviterGender === 'female' || data.inviterGender === '女' ? 'F' : 'M';

  // 🚀 核心新增：亲手足判定 (通过父辈 ID 判定)
  const isRealSibling = data.inviterFatherId && data.targetFatherId && data.inviterFatherId === data.targetFatherId;

  const hallMap: any = { '大房': 1, '二房': 2, '三房': 3, '四房': 4, '五房': 5, '六房': 6, '七房': 7, '八房': 8, '九房': 9, '十房': 10 };
  const hI = hallMap[iH] || 99;
  const hT = hallMap[tH] || 99;

  // 1. 代际差判定
  const genDiff = Number(tG) - Number(iG);

  if (genDiff === 0) {
    // 同辈：比房分或排行
    let isOlder = false;
    if (hI < hT) isOlder = true;
    else if (hI === hT && Number(iS) < Number(tS)) isOlder = true;

    // 如果是亲手足或是同房，去掉“堂”字称谓
    const isSameHouse = hI === hT;
    const prefix = isRealSibling || isSameHouse ? "" : "堂";
    const rel = isOlder ? (iSex === 'F' ? `${prefix}姐` : `${prefix}哥`) : (iSex === 'F' ? `${prefix}妹` : `${prefix}弟`);

    let reason = "";
    if (isRealSibling) {
      reason = `系统检测到您与邀请人同父同母，属于最亲近的胞亲，故称${rel}。`;
    } else if (isSameHouse) {
      reason = `同属${iH}且代际相同，因对方排行更${isOlder ? '长' : '幼'}，故称${rel}。`;
    } else {
      reason = hI < hT ? `邀请人在${iH}，您在${tH}，对方所属支脉更长，故称${rel}。` :
        `邀请人在${iH}，您在${tH}，您所属支脉更长，故称${rel}。`;
    }

    return { title: rel, reason };
  } else if (genDiff === 1) {
    const rel = iSex === 'F' ? '姑妈' : (hI === 1 ? '大伯' : '叔叔');
    return { title: rel, reason: "系统检测到对方高您一辈，由于是父系同宗关系，锁定为长辈。" };
  } else if (genDiff === -1) {
    return { title: "长辈", reason: "系统检测到您高对方一辈，对方应称呼您为长辈。" };
  }

  return null;
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
  const [isEditingInvite, setIsEditingInvite] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempAvatar, setTempAvatar] = useState("");
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveDoubleConfirm, setShowLeaveDoubleConfirm] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [showInviteAvatarPicker, setShowInviteAvatarPicker] = useState(false);
  const [isCroppingForInvite, setIsCroppingForInvite] = useState(false);
  const [isEditingTempName, setIsEditingTempName] = useState(false);
  const [customRelText, setCustomRelText] = useState("");
  const [elderRel, setElderRel] = useState<string | null>(null); // 新增：记录对邀请人父辈的称呼
  const [isRelConflict, setIsRelConflict] = useState(false);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  // 迁移对话框
  const [migrationInfo, setMigrationInfo] = useState<any>(null); // null = 不需要迁移，{} = 需要确认
  const [pendingAcceptParams, setPendingAcceptParams] = useState<any>(null);

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("currentUser");
    const parsed = saved ? JSON.parse(saved) : null;
    const cachedStats = parsed?.stats || { memories: 0, likes: 0, days: 1 };

    return {
      id: parsed?.id || parsed?.userId || null, // Global UUID
      memberId: parsed?.memberId || null,        // Family INT ID
      name: parsed?.name || "家人",
      role: parsed?.relationship || "我",
      avatar: getSafeAvatar(parsed?.avatar || parsed?.avatarUrl),
      joinDate: parsed?.joinDate || new Date().toISOString(),
      familyId: parsed?.familyId || null,
      bio: parsed?.bio || parsed?.signature || "热爱生活，记录美好。",
      birthday: parsed?.birthday || parsed?.birthDate || "",
      gender: parsed?.gender || "男",
      phone: parsed?.phone || "", // 核心修复：防止 phone 字段在后续同步中丢失
      stats: cachedStats,
      isRegistered: !!parsed?.isRegistered
    };
  });

  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    birthday: "",
    gender: "男"
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

  const fetchStatsAndNotifications = async (isInitial = false) => {
    try {
      // 核心修复：每次请求都读取最实时的本地存储，避免闭包过时
      const savedUser = localStorage.getItem("currentUser");
      const currentUserInfo = savedUser ? JSON.parse(savedUser) : null;

      if (!currentUserInfo) {
        if (!isInitial) return;
        setIsLoading(false);
        return;
      }

      const memberId = currentUserInfo.memberId;
      const userId = currentUserInfo.id || currentUserInfo.userId;

      if (!memberId && !userId) {
        setIsLoading(false);
        return;
      }

      // 1. 并发获取统计、通知和用户/档案详情
      const isDemo = isDemoMode(currentUserInfo);
      const cb = `?cb=${Date.now()}`;
      const [notifsRes, statsRes, profileRes, userRes] = await Promise.all([
        memberId ? fetch(`/api/notifications/${memberId}${cb}`) : Promise.resolve(null),
        memberId ? fetch(`/api/stats/${memberId}${cb}`) : Promise.resolve(null),
        (memberId && !isDemo) ? fetch(`/api/family-members/${memberId}${cb}`) : Promise.resolve(null),
        (userId && !isDemo) ? fetch(`/api/users/${userId}${cb}`) : Promise.resolve(null)
      ]);

      const [notifs, stats, freshProfile, freshUser] = await Promise.all([
        notifsRes ? notifsRes.json() : Promise.resolve([]),
        statsRes ? statsRes.json() : Promise.resolve({ memories: 0, likes: 0 }),
        profileRes ? profileRes.json() : Promise.resolve(null),
        userRes ? userRes.json() : Promise.resolve(null)
      ]);

      const days = Math.max(1, Math.floor((Date.now() - new Date(currentUserInfo.joinDate || Date.now()).getTime()) / 86400000));

      // 2. 判定逻辑：只有当远程数据确实“新”且“有效”时才进行覆盖
      let finalUserData = {
        ...currentUserInfo,
        bio: currentUserInfo.bio || currentUserInfo.signature || "热爱生活，记录美好。",
        birthday: currentUserInfo.birthday || currentUserInfo.birthDate || ""
      };

      const remoteName = freshUser?.name || freshProfile?.name || finalUserData.name;
      // 关键：如果远程返回的是占位图，或者本地已经有自定的长字符串头像，优先保住本地
      let remoteAvatar = freshUser?.avatar_url || freshProfile?.avatar_url || freshProfile?.avatarUrl;
      const currentAvatar = currentUserInfo.avatar || "";

      // 如果远程没头像，或者远程头像是默认图而本地已经是修改过的图，则忽略远程
      if (!remoteAvatar || (remoteAvatar.length < 20 && currentAvatar.length > 20)) {
        remoteAvatar = currentAvatar;
      }

      const remoteBio = freshUser?.bio || freshProfile?.bio || finalUserData.bio || "热爱生活，记录美好。";
      const remoteBirthday = freshUser?.birth_date || freshProfile?.birth_date || freshProfile?.birthDate || finalUserData.birthday;
      const remoteMemberId = freshUser?.member_id || freshProfile?.id || currentUserInfo.memberId;
      const remoteFamilyId = freshUser?.family_id || freshProfile?.family_id || currentUserInfo.familyId;

      let hasChanges = false;

      // AUTO-CORRECT: If remote IDs are different (e.g. after a leave family), sync them immediately
      if (remoteMemberId && remoteMemberId !== currentUserInfo.memberId) {
        finalUserData.memberId = remoteMemberId;
        hasChanges = true;
      }
      if (remoteFamilyId && remoteFamilyId !== currentUserInfo.familyId) {
        finalUserData.familyId = remoteFamilyId;
        hasChanges = true;
      }

      // 核心安全策略：后台轮询(isInitial=false) 绝对不更新个人资料字段，只更新统计数据
      // 同时，如果本地刚刚修改过资料（2分钟内），即使是初始加载也忽略远程旧数据覆盖
      const lastMod = parseInt(localStorage.getItem("_profileLastMod") || "0");
      const cooldownActive = (Date.now() - lastMod) < 120000; // 2分钟冷却期

      if (isInitial && !cooldownActive) {
        if (
          remoteName !== finalUserData.name ||
          remoteAvatar !== finalUserData.avatar ||
          remoteBio !== (finalUserData.bio || "热爱生活，记录美好。") ||
          remoteBirthday !== finalUserData.birthday
        ) {
          finalUserData = {
            ...finalUserData,
            name: remoteName,
            avatar: getSafeAvatar(remoteAvatar),
            bio: remoteBio,
            birthday: remoteBirthday
          };
          hasChanges = true;
        }
      }

      const statsObj = {
        memories: stats?.memories || 0,
        likes: stats?.likes || 0,
        days
      };

      // 3. 最终状态合并
      setUser(prevUser => {
        const statsChanged =
          prevUser.stats.memories !== statsObj.memories ||
          prevUser.stats.likes !== statsObj.likes ||
          prevUser.stats.days !== statsObj.days;

        // 构建合并后的最新数据
        // 关键防护：如果处于冷却期或非初始探测周期，强制信任本地头像
        const mergedAvatar = (isInitial && !cooldownActive && finalUserData.avatar && finalUserData.avatar.length > 20)
          ? finalUserData.avatar
          : prevUser.avatar;

        const mergedUser = {
          ...prevUser,
          ...finalUserData,
          avatar: mergedAvatar,
          stats: statsObj
        };

        // 持久化到 localStorage
        localStorage.setItem("currentUser", JSON.stringify(mergedUser));

        if (!hasChanges && !statsChanged && prevUser.avatar === mergedAvatar) {
          return prevUser;
        }
        return mergedUser;
      });

      setNotifications(Array.isArray(notifs) ? notifs : []);
      const unread = (Array.isArray(notifs) ? notifs : []).filter((n: any) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (e) {
      console.error("Fetch profile stats error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Removed setEditForm to prevent the signature input from jumping during background API polling.

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (!savedUser) {
      setIsLoading(false);
      return;
    }
    const parsed = JSON.parse(savedUser);
    if (!parsed.memberId && !parsed.id) {
      setIsLoading(false);
      return;
    }

    // 初始加载
    fetchStatsAndNotifications(true);

    // Identity Healing
    if (!parsed.memberId && parsed.id && parsed.name) {
      fetch("/api/users/claim-orphan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: parsed.id, name: parsed.name })
      })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.memberId) {
            const latest = JSON.parse(localStorage.getItem("currentUser") || "{}");
            const updated = { ...latest, memberId: data.memberId };
            localStorage.setItem("currentUser", JSON.stringify(updated));
            setUser(updated);

            // Trigger global sync so other pages (like Archive) know about the new link
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('sync-user'));

            fetchStatsAndNotifications();

            // NEW: Push current local profile to the newly claimed member immediately
            fetch("/api/users/sync-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: parsed.id,
                name: parsed.name,
                bio: parsed.bio || "",
                birthDate: parsed.birthday || "",
                avatarUrl: parsed.avatar || "",
                gender: parsed.gender || "男"
              })
            });
          }
        });
    }

    // Sync User ID
    if (!parsed.id && parsed.phone) {
      fetch(`/api/users/sync?phone=${parsed.phone}`)
        .then(r => r.json())
        .then(data => {
          if (data.id) {
            const latest = JSON.parse(localStorage.getItem("currentUser") || "{}");
            localStorage.setItem("currentUser", JSON.stringify({ ...latest, id: data.id }));
            setUser(prev => ({ ...prev, id: data.id }));
          }
        });
    }

    // NOTE: 定时轮询不再传递闭包内的 parsed，而是动态读取
    const pollTimer = setInterval(() => fetchStatsAndNotifications(), 30000);

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
    localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    localStorage.setItem("_profileLastMod", Date.now().toString());

    // 同步更新邀请确认界面的预览头像
    setTempAvatar(url);

    const targetMemberId = updatedUser.memberId;
    const targetUserId = updatedUser.id;

    if (targetMemberId) {
      updateAvatarCache(targetMemberId, url);
      await fetch(`/api/family-members/${targetMemberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updatedUser.name,
          relationship: updatedUser.role,
          avatarUrl: url,
          bio: updatedUser.bio,
          birthDate: updatedUser.birthday
        })
      });
    }

    if (targetUserId) {
      await fetch(`/api/users/sync-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          memberId: targetMemberId, // CRITICAL: Pass memberId for forced deep sync
          avatarUrl: url,
          name: updatedUser.name,
          bio: updatedUser.bio || "",
          birthDate: updatedUser.birthday || "",
          gender: updatedUser.gender || "男"
        })
      }).catch(console.error);
    }

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('sync-user'));
  };

  const handleEditSave = async () => {
    const updatedUser = {
      ...user,
      name: editForm.name,
      bio: editForm.bio,
      birthday: editForm.birthday,
      gender: editForm.gender
    };
    setUser(updatedUser);

    localStorage.setItem("currentUser", JSON.stringify(updatedUser)); // Use updatedUser object directly
    localStorage.setItem("_profileLastMod", Date.now().toString());

    const targetMemberId = updatedUser.memberId;
    const targetUserId = updatedUser.id;

    if (targetMemberId) {
      await fetch(`/api/family-members/${targetMemberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updatedUser.name,
          avatarUrl: updatedUser.avatar,
          bio: updatedUser.bio,
          birthDate: updatedUser.birthday,
          gender: updatedUser.gender
        })
      });
    }

    if (targetUserId) {
      await fetch(`/api/users/sync-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          memberId: targetMemberId, // CRITICAL: Pass memberId for forced deep sync
          name: updatedUser.name,
          bio: updatedUser.bio,
          birthDate: updatedUser.birthday,
          avatarUrl: updatedUser.avatar,
          gender: updatedUser.gender || "男"
        })
      }).catch(console.error);
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

      // 预设确认为 A 填写的资料
      setTempName(data.targetName || user.name);
      setTempAvatar(data.targetAvatar || user.avatar);

      // === 核心逻辑修复：推导 B 对 A 的反向称呼 ===
      const recommendation = getIdentityRecommendation(data);
      if (recommendation) {
        setSelectedRel(recommendation.title);
      } else {
        // 降级逻辑：如果无法智能推导，尝试通过 standard_role 进行简单的性别反转
        const inviterGender = data.inviterGender === 'female' || data.inviterGender === '女' ? 'female' : 'male';
        const targetRole = data.targetRole || "";
        // 这里可以调用现有的反转逻辑，或者简单设置
        setSelectedRel(targetRole.includes("弟") ? (inviterGender === 'female' ? "姐姐" : "哥哥") : "");
      }

      setIsEditingInvite(false);
    } catch (e) {
      setInviteError("网络错误");
    }
    setIsValidatingInvite(false);
  };

  // 校验逻辑：称谓与房分是否冲突
  useEffect(() => {
    if (elderRel && elderRel !== "不知道" && inviteData?.inviterAncestralHall) {
      const hall = inviteData.inviterAncestralHall;
      let hasConflict = false;
      if (elderRel === "大伯" && hall !== "大房") hasConflict = true;
      else if (elderRel === "二伯" && hall !== "二房") hasConflict = true;
      else if (elderRel === "三伯" && hall !== "三房") hasConflict = true;
      else if (elderRel === "爸爸" && hall !== inviteData.targetAncestralHall) hasConflict = true;
      else if (elderRel === "叔叔" && !["三房", "四房", "五房", "六房", "七房", "八房", "九房", "十房", "小房"].includes(hall)) hasConflict = true;

      setIsRelConflict(hasConflict);
      if (hasConflict) setShowConflictWarning(true);
      else setShowConflictWarning(false);
    } else {
      setIsRelConflict(false);
      setShowConflictWarning(false);
    }
  }, [elderRel, inviteData]);

  const handleAcceptInvite = async (overrideRole?: string, overrideStdRole?: string, overrideInviteData?: any, overrideName?: string, overrideAvatar?: string, mode?: string) => {
    if (isRelConflict) {
      alert("人物关系与对方登记的信息冲突，请核实后重试。");
      return;
    }
    const finalInviteData = overrideInviteData || inviteData;
    const finalRole = overrideRole || selectedRel;
    let finalStdRole = overrideStdRole || relationships.find(r => r.label === finalRole)?.value || "other";

    // 🚀 核心优化：动态识别“堂/表”称谓并映射为标准 cousin 角色
    if (finalStdRole === "other") {
      if (finalRole.includes("堂") || finalRole.includes("表")) finalStdRole = "cousin";
      else if (finalRole.includes("侄") || finalRole.includes("外甥")) finalStdRole = "nephew";
      else if (finalRole.includes("叔") || finalRole.includes("伯") || finalRole.includes("舅") || finalRole.includes("姨")) finalStdRole = "uncle";
    }

    const finalName = overrideName || tempName;
    const finalAvatar = overrideAvatar || tempAvatar;

    if (!finalRole || !finalInviteData) return;
    try {
      const savedUserBefore = JSON.parse(localStorage.getItem("currentUser") || "{}");
      // NOTE: 优先使用 UUID (id) 进行身份识别，这是最稳定的标识符
      const userId = savedUserBefore.id || savedUserBefore.userId;
      const phone = savedUserBefore.phone; // 备用降级

      // 如果没有指定 mode，先检查是否需要迁移
      if (!mode && finalInviteData.inviterFamilyId) {
        const migParams = new URLSearchParams({
          targetFamilyId: String(finalInviteData.inviterFamilyId),
          ...(userId ? { userId } : { phone: phone || '' })
        });
        const migRes = await fetch(`/api/check-migration?${migParams.toString()}`);
        if (migRes.ok) {
          const migData = await migRes.json();
          if (migData.needsMigration) {
            // 需要用户确认，展示迁移对话框
            setMigrationInfo(migData);
            setPendingAcceptParams({ overrideRole, overrideStdRole, overrideInviteData, overrideName, overrideAvatar });
            return;
          }
        }
      }

      // 计算推导出的邀请人房分与辈分
      let suggestedInviterHall = inviteData.inviterAncestralHall;
      let suggestedInviterGen = inviteData.inviterGenerationNum;

      if (elderRel && elderRel !== "不知道") {
        // 如果 A 没填房分，补全它
        if (!suggestedInviterHall) {
          if (elderRel === "大伯") suggestedInviterHall = "大房";
          else if (elderRel === "二伯") suggestedInviterHall = "二房";
          else if (elderRel === "三伯") suggestedInviterHall = "三房";
          else if (elderRel === "爸爸") suggestedInviterHall = inviteData.targetAncestralHall;
        }
        // 如果 A 没填代数，且 B 是 A 的同辈（堂/表/手足），同步 B 的代数给 A
        if (!suggestedInviterGen && (finalStdRole === "cousin" || finalStdRole === "sibling" || finalStdRole === "other")) {
          suggestedInviterGen = inviteData.targetGenerationNum;
        }
      }

      const res = await fetch("/api/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId, // 优先 UUID
          phone: phone,   // 向下兼容降级
          inviteCode: inviteCodeInput.trim(),
          relationshipToInviter: finalRole,
          standardRole: finalStdRole,
          name: finalName,
          avatarUrl: finalAvatar,
          mode: mode || "direct",
          targetSiblingOrder: inviteData.targetSiblingOrder,
          inviterAncestralHall: suggestedInviterHall,
          inviterGenerationNum: suggestedInviterGen,
          birthDate: user.birthday,
          gender: user.gender // 补齐性别字段，确保后端礼法校验闭环
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "加入失败");
        return;
      }

      const data = await res.json();
      const latestUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      localStorage.setItem("currentUser", JSON.stringify({
        ...latestUser,
        id: data.userId,
        familyId: data.familyId,
        memberId: data.memberId,
        name: finalName,
        avatar: finalAvatar,
        relationship: finalRole,
        inviterName: finalInviteData.inviterName
      }));

      setMigrationInfo(null);
      setPendingAcceptParams(null);
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

  const handleLeaveFamily = async (overrideTakeArchives: boolean = false) => {
    if (isDemoMode(user)) {
      alert("演示用户不可退出家族。");
      return;
    }

    setIsLeaving(true);
    try {
      const savedUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const res = await fetch("/api/leave-family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: savedUser.id,
          memberId: savedUser.memberId,
          takeArchives: overrideTakeArchives // Use passed boolean
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "退出操作失败");
      }

      // 清理本地存储中关于家族身份的信息
      localStorage.setItem("currentUser", JSON.stringify({
        ...savedUser,
        familyId: 1, // 回到默认公共家族
        memberId: null,
        relationship: "我",
        role: "我",
        isRegistered: true // Still registered as a user
      }));

      alert("已成功退出家族。");
      window.location.reload();
    } catch (e: any) {
      alert(e.message || "退出失败，请稍后重试。");
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
      setShowLeaveDoubleConfirm(false);
    }
  };

  // NOTE: hasJoinedFamily only true if user joined via invite (exclude creator/default roles)
  const hasJoinedFamily = user.isRegistered &&
    user.familyId &&
    user.familyId !== 0 &&
    user.id &&
    user.role !== "创建者" &&
    user.role !== "我";

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
            setEditForm({ name: user.name, bio: user.bio, birthday: user.birthday, gender: user.gender || "男" });
            setShowEditModal(true);
          }
        },
        {
          icon: hasJoinedFamily ? CheckCircle : Gift,
          label: hasJoinedFamily ? "家族管理" : "接受家族邀请",
          color: hasJoinedFamily ? "text-emerald-500 bg-emerald-50" : "text-rose-500 bg-rose-50",
          action: () => setShowInviteModal(true)
        },
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
    },
    {
      title: "系统信息",
      items: [
        { icon: Clock, label: "当前版本: v3.1.0 (全知智能版)", color: "text-slate-400 bg-slate-50" },
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
            <div className="group cursor-pointer relative" onClick={() => { setPendingAvatar(user.avatar); setShowAvatarModal(true); }}>
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

          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-slate-800">{user.name}</h2>
            {user.gender && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black shadow-sm",
                user.gender === "女" ? "bg-rose-100 text-rose-500" : "bg-blue-100 text-blue-500"
              )}>
                {user.gender === "女" ? "♀" : "♂"}
              </span>
            )}
          </div>
          <div
            className="flex items-center justify-center gap-2 mb-4 cursor-pointer group px-4 py-1 -mt-1 rounded-full hover:bg-slate-50 transition-colors"
            onClick={() => {
              setEditForm({ name: user.name, bio: user.bio, birthday: user.birthday, gender: user.gender || "男" });
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
                  localStorage.setItem(`read_notifs_old_${user.memberId}`, localStorage.getItem(`read_notifs_${user.memberId}`) || "[]");
                }} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-4 text-left">
                {notifications.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-bold">暂无新通知</div>
                ) : (
                  notifications.map((n, i) => {
                    const isUnread = !JSON.parse(localStorage.getItem(`read_notifs_old_${user.memberId}`) || "[]").includes(n.id);
                    // NOTE: 优先使用后端存储的 link_url 精准跳转，降级到广场
                    const handleNotifClick = () => {
                      setShowNotifications(false);
                      if (n.link_url && n.link_url !== "/profile") {
                        navigate(n.link_url);
                      } else if (n.event_id) {
                        navigate("/square");
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
              <h3 className="text-2xl font-bold mb-6 text-center">更换我的头像</h3>

              <div className="flex justify-center mb-8">
                <div className="size-32 rounded-full border-4 border-[#eab308]/20 shadow-inner overflow-hidden relative bg-slate-50">
                  <img
                    src={pendingAvatar || user.avatar}
                    className="w-full h-full object-cover"
                    key={pendingAvatar}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 border-[6px] border-white/50 rounded-full pointer-events-none" />
                </div>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-4 gap-4">
                  {defaultAvatars.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setPendingAvatar(url)}
                      className={cn(
                        "aspect-square rounded-2xl border-2 overflow-hidden hover:border-[#eab308] transition-all",
                        (pendingAvatar || user.avatar) === url ? "border-[#eab308] scale-95 shadow-lg shadow-[#eab308]/20" : "border-slate-50"
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

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (pendingAvatar) {
                        handleAvatarChange(pendingAvatar);
                        setShowAvatarModal(false);
                      }
                    }}
                    className="w-full py-5 bg-[#eab308] text-black rounded-3xl font-bold shadow-xl shadow-[#eab308]/20 active:scale-[0.98] transition-all"
                  >
                    确认更换
                  </button>
                  <button onClick={() => setShowAvatarModal(false)} className="w-full py-5 bg-slate-100 rounded-3xl font-bold text-slate-500 active:scale-95 transition-transform">取消</button>
                </div>
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
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 ml-4">我的性别</label>
                  <div className="flex gap-4 px-2">
                    {["男", "女"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, gender: g })}
                        className={cn(
                          "flex-1 h-14 rounded-2xl font-bold transition-all",
                          editForm.gender === g
                            ? (g === "男" ? "bg-blue-500 text-white" : "bg-rose-500 text-white")
                            : "bg-slate-50 text-slate-400"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
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
                      user.memberId === persona.memberId ? "border-[#eab308] bg-[#eab308]/5" : "border-slate-50 hover:bg-slate-50"
                    )}
                  >
                    <img src={persona.avatar} alt={persona.name} className="size-12 rounded-full object-cover shadow-sm" />
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate">{persona.name}</div>
                      <div className="text-xs text-slate-400">关系：{persona.relationship}</div>
                    </div>
                    {user.memberId === persona.memberId && <div className="size-2 rounded-full bg-[#eab308]" />}
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

        {/* 退出家族二次确认 */}
        <AnimatePresence>
          {(showLeaveConfirm || showLeaveDoubleConfirm) && (
            <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center space-y-6"
              >
                {!showLeaveDoubleConfirm ? (
                  <>
                    <div className="size-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <LogOut size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800">确认退出家族？</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">退出后，您将无法直接查看该家族的档案和动态。所有留言仍会保留但您的身份将解除绑定。</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => setShowLeaveDoubleConfirm(true)}
                        className="w-full py-4 bg-red-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-transform"
                      >
                        真的要退出
                      </button>
                      <button
                        onClick={() => setShowLeaveConfirm(false)}
                        className="w-full py-4 bg-slate-100 text-slate-500 font-black rounded-2xl active:scale-95 transition-transform"
                      >
                        我再想想
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="size-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Bell size={32} className="animate-bounce" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800">最后一次确认</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">此操作不可撤销，您确定要在此时退出家族吗？</p>
                    </div>
                    <div className="space-y-3">
                      <button
                        onClick={() => handleLeaveFamily(true)}
                        disabled={isLeaving}
                        className="w-full py-4 bg-[#eab308] text-black font-black rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex flex-col items-center"
                      >
                        <span className="text-lg">带走我的随行档案</span>
                        <span className="text-[10px] opacity-60 font-medium">迁出我创建的未注册成员</span>
                      </button>
                      <button
                        onClick={() => handleLeaveFamily(false)}
                        disabled={isLeaving}
                        className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex flex-col items-center"
                      >
                        <span className="text-lg">仅自己退出</span>
                        <span className="text-[10px] opacity-60 font-medium">将档案留在原家族中</span>
                      </button>
                      <button
                        onClick={() => { setShowLeaveConfirm(false); setShowLeaveDoubleConfirm(false); }}
                        className="w-full py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95 transition-transform"
                      >
                        取消
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {showInviteModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center backdrop-blur-sm p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full rounded-t-[3rem] sm:rounded-[3rem] p-8 pb-12 shadow-2xl overflow-hidden max-w-[414px] flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8 text-left">
                <h3 className="text-2xl font-bold">{hasJoinedFamily ? "家族管理" : "加入家族"}</h3>
                <button onClick={() => { setShowInviteModal(false); setInviteData(null); }} className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <X size={20} />
                </button>
              </div>

              {hasJoinedFamily ? (
                <div className="space-y-8 text-center pb-4">
                  <div className="size-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle size={48} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black text-slate-800">已加入家族</p>
                    <p className="text-sm text-slate-400 font-bold px-6">您当前已关联家族身份，如需加入其他家族，请先退出当前账号的家谱绑定。</p>
                  </div>
                  <button
                    onClick={() => { setShowInviteModal(false); setShowLeaveConfirm(true); }}
                    className="w-full py-5 bg-red-50 text-red-500 rounded-3xl font-black shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <LogOut size={20} /> 退出当前家族
                  </button>
                </div>
              ) : !inviteData ? (
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
              ) : migrationInfo ? (
                <div className="space-y-6 overflow-y-auto no-scrollbar pb-2 text-left h-full flex flex-col justify-center">
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-[#eab308]/10 text-[#eab308] rounded-full flex items-center justify-center mx-auto mb-2">
                        <Check size={32} />
                      </div>
                      <h3 className="text-xl font-black text-slate-800">切换家族确认</h3>

                      <div className="text-left bg-slate-50 p-6 rounded-[2rem] text-sm text-slate-600 space-y-3 shadow-inner">
                        <p className="font-medium text-slate-800 text-base">您目前拥有一个独立的家族。</p>
                        {migrationInfo.contentCount > 0 ? (
                          <p>您在这个家族中创建了 <b>{migrationInfo.contentCount}</b> 条记忆/留言。</p>
                        ) : (
                          <p>当前家族中暂无内容记录。</p>
                        )}
                        {migrationInfo.willFamilyBeDeleted && (
                          <p className="text-red-500 font-bold bg-red-100/50 p-3 rounded-xl mt-2">由于您是该家族唯一的注册用户，一旦离开，原家族将会被系统解散清理。</p>
                        )}
                      </div>

                      <div className="space-y-3 pt-6">
                        <button
                          onClick={() => {
                            const { overrideRole, overrideStdRole, overrideInviteData, overrideName, overrideAvatar } = pendingAcceptParams;
                            handleAcceptInvite(overrideRole, overrideStdRole, overrideInviteData, overrideName, overrideAvatar, "migrate");
                          }}
                          className="w-full py-5 bg-[#eab308] text-black rounded-3xl font-black shadow-xl shadow-[#eab308]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <Check size={20} /> 迁移记录并加入新家族
                        </button>
                        <button
                          onClick={() => {
                            const { overrideRole, overrideStdRole, overrideInviteData, overrideName, overrideAvatar } = pendingAcceptParams;
                            handleAcceptInvite(overrideRole, overrideStdRole, overrideInviteData, overrideName, overrideAvatar, "clear");
                          }}
                          className="w-full py-5 bg-red-50 text-red-600 rounded-3xl font-bold active:scale-95 transition-transform"
                        >
                          清空记录，以新人加入
                        </button>
                        <button
                          onClick={() => {
                            setMigrationInfo(null);
                            setPendingAcceptParams(null);
                          }}
                          className="w-full py-4 text-slate-400 font-medium active:scale-95 transition-transform"
                        >
                          取消并留在当前家族
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 overflow-y-auto no-scrollbar pb-2 text-left">
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 bg-[#eab308]/10 rounded-full flex items-center justify-center mx-auto text-[#eab308]">
                        <Sparkles size={32} />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">确认身份档案</h3>
                      <p className="text-sm text-slate-500 font-medium px-4">
                        <span className="font-bold text-[#eab308]">{inviteData.inviterName}</span> 为您预设了以下档案。您可以直接点击下方进行确认：
                      </p>
                    </div>

                    {/* === 🚀 核心新增：智能识别卡片 === */}
                    {getIdentityRecommendation(inviteData) && (
                      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] p-5 text-white shadow-xl shadow-indigo-200/50 space-y-3 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                          <Sparkles size={64} />
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                            <Users size={20} className="text-white" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black opacity-80 uppercase tracking-widest">系统智能血脉定位</h4>
                            <div className="text-lg font-black flex items-center gap-2">
                              {inviteData.inviterAncestralHall === inviteData.targetAncestralHall ? (
                                <span>同属 {inviteData.inviterAncestralHall || "家族支脉"}</span>
                              ) : (
                                <>
                                  {inviteData.inviterAncestralHall} <ChevronRight size={14} className="opacity-50" /> {inviteData.targetAncestralHall || "未定"}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
                          <p className="text-[10px] font-black opacity-70 mb-1">您应称呼邀请人为：</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black">{getIdentityRecommendation(inviteData)?.title}</span>
                            <span className="text-[10px] font-bold opacity-60">自动锁定成功</span>
                          </div>
                          <p className="text-[10px] mt-2 leading-relaxed opacity-80">{getIdentityRecommendation(inviteData)?.reason}</p>
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100/50 flex flex-col items-center gap-4 relative">
                      <div
                        className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white relative group cursor-pointer shrink-0"
                        onClick={() => setShowInviteAvatarPicker(!showInviteAvatarPicker)}
                      >
                        <img
                          src={tempAvatar || inviteData.targetAvatar || DEFAULT_AVATAR}
                          alt="Avatar"
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="text-white" size={20} />
                        </div>
                      </div>

                      {/* Inline Avatar Picker */}
                      <AnimatePresence>
                        {showInviteAvatarPicker && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="w-full overflow-hidden px-2 pt-2"
                          >
                            <div className="grid grid-cols-4 gap-2 bg-white/50 p-3 rounded-[1.5rem] border border-[#eab308]/10">
                              {SYSTEM_AVATARS.slice(0, 7).map((url, i) => (
                                <button
                                  key={i}
                                  onClick={(e) => { e.stopPropagation(); setTempAvatar(url); setShowInviteAvatarPicker(false); }}
                                  className={cn(
                                    "aspect-square rounded-full border-2 overflow-hidden transition-all",
                                    tempAvatar === url ? "border-[#eab308] scale-90" : "border-slate-100"
                                  )}
                                >
                                  <img src={url} className="w-full h-full object-cover" />
                                </button>
                              ))}
                              <label className="aspect-square rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-white transition-colors">
                                <Camera size={16} />
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const url = URL.createObjectURL(file);
                                    setTempImage(url);
                                    setIsCroppingForInvite(true);
                                    setShowCropper(true);
                                    setShowInviteAvatarPicker(false);
                                  }
                                }} />
                              </label>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* === 🚀 核心新增：长辈称谓交叉验证 === */}
                      <div className="space-y-4 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm w-full">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none text-left">血脉核对：长辈称议</label>
                          <span className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-bold">反向验证</span>
                        </div>

                        <div className="space-y-3">
                          <p className="text-xs text-slate-500 font-medium text-left leading-relaxed">
                            {inviteData.inviterAncestralHall
                              ? `您称呼 ${inviteData.inviterName} 的父亲（您的伯叔）为？`
                              : `对方尚未登记房分，请通过您的称呼协助补全：您称呼 ${inviteData.inviterName} 的父亲为？`
                            }
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {["大伯", "二伯", "三伯", "叔叔", "爸爸", "不知道"].map(btn => (
                              <button
                                key={btn}
                                onClick={() => setElderRel(btn)}
                                className={cn(
                                  "px-4 py-2.5 rounded-2xl text-xs font-black transition-all border-2",
                                  elderRel === btn
                                    ? "bg-slate-800 text-white border-slate-800 shadow-lg scale-95"
                                    : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                                )}
                              >
                                {btn}
                              </button>
                            ))}
                          </div>

                          {/* 校验与定义反馈逻辑 */}
                          {elderRel && elderRel !== "不知道" && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={cn(
                                "p-4 rounded-2xl flex items-start gap-3 border-2 transition-all shadow-sm",
                                !isRelConflict
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                                  : "bg-rose-50 border-rose-100 text-rose-600 ring-4 ring-rose-200/20"
                              )}
                            >
                              <div className="mt-0.5">
                                {!isRelConflict
                                  ? <CheckCircle size={14} />
                                  : <AlertTriangle size={14} className="animate-bounce" />
                                }
                              </div>
                              <div className="text-xs font-bold text-left leading-snug">
                                {isRelConflict ? (
                                  <>
                                    <div>人物归位冲突！</div>
                                    <div className="text-[10px] opacity-80 mt-1">
                                      您称呼对方父亲为“{elderRel}”，但对方已登记为“{inviteData.inviterAncestralHall}”。系统已拦截此次加入，请核实身份。
                                    </div>
                                  </>
                                ) : !inviteData.inviterAncestralHall ? (
                                  <>
                                    <div>身份协助定向</div>
                                    <div className="text-[10px] opacity-80 mt-1">
                                      基于您的称呼，系统已推断邀请人属于“{elderRel.replace("伯", "房").replace("叔叔", "三房以后的房分").replace("爸爸", "同房")}”，其代数将同步为第 {inviteData.targetGenerationNum} 代。
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div>验证吻合</div>
                                    <div className="text-[10px] opacity-80 mt-1">
                                      称谓与对方登记的“{inviteData.inviterAncestralHall} / 第{inviteData.inviterGenerationNum || inviteData.targetGenerationNum}代”信息完全匹配。
                                    </div>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* 第一部分：我是谁（确认或修正自己的排行） */}
                      <div className="space-y-3 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm w-full">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">您的家族定位</label>
                          <span className="text-[10px] bg-[#eab308]/10 text-[#eab308] px-2 py-0.5 rounded-full font-bold">需核对</span>
                        </div>
                        <div className="space-y-4">
                          <div className="relative">
                            {isEditingTempName ? (
                              <input
                                autoFocus
                                type="text"
                                className="w-full h-12 rounded-xl bg-slate-50 border-2 border-[#eab308] px-4 font-bold text-slate-800"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={() => setIsEditingTempName(false)}
                              />
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-black text-slate-800">{tempName}</span>
                                <button onClick={() => setIsEditingTempName(true)} className="p-2 text-slate-300 hover:text-[#eab308]">
                                  <Edit2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
                            <div className="size-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-sm font-black text-[#eab308]">
                              {inviteData.targetAncestralHall?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-400 font-bold">您所属的房分</p>
                              <p className="text-sm font-black text-slate-700">{inviteData.targetAncestralHall || "未录入"}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-200" />
                            <div className="flex-1 pl-2">
                              <p className="text-[10px] text-slate-400 font-bold">排行</p>
                              <select
                                className="bg-transparent text-sm font-black text-slate-700 outline-none w-full"
                                value={inviteData.targetSiblingOrder || ""}
                                onChange={(e) => {
                                  const newOrder = e.target.value ? parseInt(e.target.value) : null;
                                  setInviteData({ ...inviteData, targetSiblingOrder: newOrder });
                                }}
                              >
                                <option value="">未知</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                                  <option key={v} value={v}>老{['大', '二', '三', '四', '五', '六', '七', '八', '九', '十'][v - 1]}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 第二部分：TA是谁 */}
                      <div className="space-y-3 p-5 bg-indigo-50/50 rounded-3xl border border-indigo-100 shadow-sm w-full">
                        <label className="text-[11px] font-black text-indigo-400 uppercase tracking-widest ml-1">您如何称呼邀请人</label>
                        <div className="relative">
                          <select
                            value={selectedRel}
                            onChange={(e) => setSelectedRel(e.target.value)}
                            className="w-full h-12 rounded-xl bg-white border-2 border-indigo-200 px-4 font-black text-indigo-600 appearance-none shadow-sm"
                          >
                            <option value="">请选择称呼</option>
                            {["堂哥", "堂姐", "堂弟", "堂妹", "哥哥", "姐姐", "弟弟", "妹妹", "伯伯", "叔叔", "姑妈", "大伯", "其他"].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-300">
                            <ChevronDown size={16} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 pt-2 px-2">
                      <button
                        className={cn(
                          "w-full py-5 rounded-3xl font-black shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95",
                          (!selectedRel || (!elderRel && !inviteData?.inviterAncestralHall) || isRelConflict)
                            ? "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
                            : "bg-[#eab308] text-black shadow-[#eab308]/20"
                        )}
                        disabled={!selectedRel || (!elderRel && !inviteData?.inviterAncestralHall) || isRelConflict}
                        onClick={() => {
                          const effectiveRel = (selectedRel === "其他" && customRelText.trim())
                            ? customRelText.trim()
                            : (selectedRel || inviteData.targetRole);
                          handleAcceptInvite(
                            effectiveRel,
                            inviteData.targetStandardRole,
                            inviteData,
                            tempName,
                            tempAvatar
                          );
                        }}
                      >
                        {isRelConflict ? <X size={20} /> : <Check size={20} />}
                        {isRelConflict ? "身份冲突 无法加入" : "是的，确认加入"}
                      </button>
                      <button
                        className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        onClick={() => {
                          setInviteCodeInput("");
                          setInviteData(null);
                        }}
                      >
                        <X size={16} /> 这不是我，返回重新输入
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}


        {showCropper && tempImage && (
          <ImageCropper
            image={tempImage}
            onCropComplete={(croppedImage) => {
              // 关键修复：增加图片压缩，防止 Base64 过大导致 Vercel 接口 413 错误
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const MAX_WIDTH = 500;
                const scale = Math.min(1, MAX_WIDTH / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                const compressed = canvas.toDataURL("image/jpeg", 0.7);

                if (isCroppingForInvite) {
                  setTempAvatar(compressed);
                  setIsCroppingForInvite(false);
                } else {
                  setPendingAvatar(compressed);
                }
                setShowCropper(false);
                setTempImage(null);
              };
              img.src = croppedImage;
            }}
            onClose={() => {
              setShowCropper(false);
              setTempImage(null);
              setIsCroppingForInvite(false);
            }}
          />
        )}
      </AnimatePresence>
    </div >
  );
};
