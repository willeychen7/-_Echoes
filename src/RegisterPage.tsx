import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "./components/Button";
import { ArrowLeft, Eye, EyeOff, ImagePlus, Plus, ChevronDown, Sparkles, Edit2, X, Camera, Check } from "lucide-react";
import { Card } from "./components/Card";
import { cn } from "./lib/utils";
import { DEFAULT_AVATAR, SYSTEM_AVATARS } from "./constants";
import { ImageCropper } from "./components/ImageCropper";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isAvatarUploaded, setIsAvatarUploaded] = useState(false);
  const [showDefaultAvatars, setShowDefaultAvatars] = useState(false);
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [showModalAvatarPicker, setShowModalAvatarPicker] = useState(false);

  const [invitationCode, setInvitationCode] = useState("");
  const [hasUrlCode, setHasUrlCode] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState("");
  const [customRelText, setCustomRelText] = useState(""); // 选"其他"时允许自由输入
  const [isEditingName, setIsEditingName] = useState(false); // 点笔才能编辑名字
  const [inviterName, setInviterName] = useState("");
  const [inviterId, setInviterId] = useState<number | null>(null);
  const [inviterRole, setInviterRole] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [isEditingInvite, setIsEditingInvite] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setInvitationCode(code);
      setHasUrlCode(true);
    }
  }, []);

  const canSubmit = name && phone && password && confirmPassword && verificationCode;

  const topRelationships = [
    { label: "儿子", value: "son" },
    { label: "女儿", value: "daughter" },
    { label: "父亲", value: "father" },
    { label: "母亲", value: "mother" },
    { label: "配偶", value: "spouse" }
  ];

  const otherRelationships = [
    { label: "弟弟", value: "brother" },
    { label: "妹妹", value: "sister" },
    { label: "哥哥", value: "brother" },
    { label: "姐姐", value: "sister" },
    { label: "爷爷/外公", value: "grandfather" },
    { label: "奶奶/外婆", value: "grandmother" },
    { label: "孙子", value: "grandson" },
    { label: "孙女", value: "granddaughter" },
    { label: "叔/伯/舅/姨父", value: "uncle" },
    { label: "姑/姨/婶/舅妈", value: "aunt" },
    { label: "侄子/外甥", value: "nephew" },
    { label: "侄女/外甥女", value: "niece" },
    { label: "其他", value: "other" }
  ];

  const allRelationships = [...topRelationships, ...otherRelationships];

  const handleSendCode = async () => {
    if (!phone) {
      alert("请先输入手机号或邮箱");
      return;
    }
    try {
      const res = await fetch("/api/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: phone })
      });
      if (res.ok) {
        setIsCodeSent(true);
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        const status = res.status;
        let errorMsg = "发送失败";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch (e) {
          errorMsg = `服务器错误 (HTTP ${status})`;
        }
        alert(errorMsg);
      }
    } catch (error) {
      console.error("Send code error:", error);
      alert("网络错误或服务器异常，请重试");
    }
  };

  const handleNext = async () => {
    if (password !== confirmPassword) {
      setPasswordError("两次输入的密码不一致");
      return;
    }

    setIsEditingInvite(false); // 关键修复：确保每次点击“下一步”时，弹窗都是先进入“确认”视图，而不是直接跳到“选择关系”
    setIsValidatingCode(true);
    setInviteError("");
    setVerificationError("");
    setPasswordError("");

    try {
      // 1. Verify OTP first
      const verifyRes = await fetch("/api/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: phone, code: verificationCode })
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        setVerificationError(err.error || "验证码错误");
        setIsValidatingCode(false);
        return;
      }

      // 2. Clear invitation code logic
      if (!invitationCode.trim()) {
        await handleCompleteRegistration();
        setIsValidatingCode(false);
        return;
      }

      const res = await fetch(`/api/validate-invite?code=${encodeURIComponent(invitationCode.trim())}`);
      if (!res.ok) {
        setInviteError("邀请码无效，请检查后重试");
        setIsValidatingCode(false);
        return;
      }
      const data = await res.json();
      console.log("[Debug] Invite Data Received:", data); // 调试日志：确认 Vercel 已更新
      setInviterName(data.inviterName);
      setInviterRole(data.inviterRole);
      setInviterId(data.inviterId);
      setInviteData(data);

      // 进入确认环节：展示 A 创建的信息供 B 确认或修改
      // 预填修改视图所需的状态
      if (data.targetName) setName(data.targetName);
      if (data.targetAvatar) setAvatar(data.targetAvatar);

      setSelectedRelationship(data.targetRole || "");
      setShowVerificationModal(true);
    } catch (err) {
      console.error("Validation error:", err);
      setInviteError("网络错误，请稍后重试");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleCompleteRegistration = async (overrideRole?: string, overrideStdRole?: string, overrideInviterId?: number, overrideName?: string, overrideAvatar?: string) => {
    let currentFamilyId = 1;
    let currentMemberId = null;
    let currentUserId = null;

    const finalInviterId = overrideInviterId || inviterId;
    const finalRole = overrideRole || selectedRelationship;
    const finalName = overrideName || name;
    const finalAvatar = overrideAvatar || avatar;

    try {
      if ((invitationCode.trim() && finalInviterId) || overrideRole) {
        // 加入已有家族
        const relInfo = allRelationships.find(r => r.label === finalRole);
        const response = await fetch("/api/register-claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviteCode: invitationCode.trim(),
            name: finalName,
            avatarUrl: finalAvatar,
            relationshipToInviter: finalRole,
            standardRole: overrideStdRole || relInfo?.value || "other",
            phone,
            password,
            gender: gender // Pass gender to claim
          })
        });

        if (!response.ok) {
          const resData = await response.json();
          alert(resData.error || "注册失败");
          return;
        }
        const resData = await response.json();
        currentFamilyId = resData.familyId || null;
        currentMemberId = resData.memberId;
        currentUserId = resData.userId;
      } else {
        // 创建新家族
        const response = await fetch("/api/register-new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: finalName, phone, password, avatar: finalAvatar, gender })
        });

        if (!response.ok) {
          const resData = await response.json();
          alert(resData.error || "注册失败");
          return;
        }
        const resData = await response.json();
        currentFamilyId = resData.familyId;
        currentMemberId = resData.memberId;
        currentUserId = resData.userId;
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      alert(`注册过程中出现错误: ${error.message || "未知错误"}`);
      return;
    }

    const userData = {
      id: currentUserId,
      name: finalName,
      phone,
      avatar: finalAvatar,
      relationship: overrideRole || selectedRelationship || (currentFamilyId ? "创建者" : ""),
      inviterName: (invitationCode || overrideRole) ? inviterName : null,
      inviterId: finalInviterId,
      inviterRole,
      familyId: currentFamilyId,
      memberId: currentMemberId,
      isRegistered: true
    };
    localStorage.setItem("currentUser", JSON.stringify(userData));

    // 导向到注册成功页面（小树页面），保持原有优雅的体验
    navigate("/register-success");
  };

  const defaultAvatars = SYSTEM_AVATARS;

  const handleAvatarClick = () => {
    setShowDefaultAvatars(!showDefaultAvatars);
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setTempImage(url);
      setShowCropper(true);
      setShowDefaultAvatars(false);
      setShowModalAvatarPicker(false);
    }
  };

  const selectDefaultAvatar = (url: string) => {
    setAvatar(url);
    setIsAvatarUploaded(true);
    setShowDefaultAvatars(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf0] text-[#1a1a1a] pb-12 font-sans">
      {/* Top Bar */}
      <div className="flex items-center p-4 justify-between bg-transparent">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
          <ArrowLeft size={28} />
        </button>
        <div className="flex-1"></div>
      </div>

      {/* Header Section */}
      <div className="flex flex-col items-center px-6 py-8">
        <div className="relative mb-6">
          <div
            onClick={handleAvatarClick}
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-36 w-36 border-4 border-white shadow-sm cursor-pointer overflow-hidden relative"
            style={{ backgroundImage: `url("${avatar}")` }}
          >
            {isAvatarUploaded && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <span className="text-white text-xs font-bold bg-black/40 px-2 py-1 rounded">已就绪</span>
              </div>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
          <button
            onClick={handleUploadClick}
            className="absolute bottom-1 right-1 p-2 rounded-full shadow-md border border-slate-100 transition-all bg-white text-[#eab308] hover:scale-110"
          >
            <Camera size={20} className="text-[#eab308]" />
          </button>

          {/* Default Avatars Popover */}
          {showDefaultAvatars && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full mt-4 left-1/2 -translate-x-1/2 bg-white p-4 rounded-3xl shadow-2xl border border-slate-100 z-50 min-w-[280px]"
            >
              <div className="grid grid-cols-4 gap-3">
                {defaultAvatars.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => selectDefaultAvatar(url)}
                    className="w-12 h-12 rounded-full border-2 border-slate-100 hover:border-[#eab308] overflow-hidden transition-all"
                  >
                    <img src={url} alt={`Default ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
                <button
                  onClick={handleUploadClick}
                  className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-[#eab308] hover:border-[#eab308] transition-all"
                >
                  <Plus size={24} />
                </button>
              </div>
            </motion.div>
          )}
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">创建账号</h1>
          <p className="text-[#475569] text-lg font-medium italic">加入家族，留住岁月的温情</p>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex flex-col gap-8 px-6 max-w-md mx-auto w-full">
        <div className="space-y-5">
          <label className="flex flex-col gap-3">
            <span className="text-[#1e293b] text-lg font-bold px-1">我的名字</span>
            <input
              className="w-full rounded-[2rem] border-none bg-white shadow-sm h-16 px-6 text-lg text-black placeholder:text-slate-400 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
              placeholder="请输入您的姓名"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-3">
            <span className="text-[#1e293b] text-lg font-bold px-1">手机号 / 邮箱</span>
            <input
              className="w-full rounded-[2rem] border-none bg-white shadow-sm h-16 px-6 text-lg text-black placeholder:text-slate-400 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
              placeholder="请输入您的手机号或邮箱"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-3">
            <span className="text-[#1e293b] text-lg font-bold px-1">验证码</span>
            <div className="relative flex items-center">
              <input
                className={cn(
                  "w-full rounded-[2rem] border-none bg-white shadow-sm h-16 px-6 text-lg text-black placeholder:text-slate-400 focus:ring-2 focus:ring-[#eab308]/20 transition-all",
                  verificationError && "ring-2 ring-red-400"
                )}
                placeholder="请输入验证码"
                type="text"
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value);
                  setVerificationError("");
                }}
              />
              <button
                onClick={handleSendCode}
                disabled={countdown > 0}
                className={`absolute right-3 px-4 py-2 rounded-full font-bold text-sm transition-all ${countdown > 0
                  ? "bg-slate-100 text-slate-400"
                  : "bg-[#eab308]/10 text-[#eab308] hover:bg-[#eab308]/20"
                  }`}
              >
                {countdown > 0 ? `${countdown}s` : "获取验证码"}
              </button>
            </div>
            {verificationError && (
              <p className="text-red-500 text-sm font-bold px-2">{verificationError}</p>
            )}
          </label>

          <label className="flex flex-col gap-3">
            <span className="text-[#1e293b] text-lg font-bold px-1">设置密码</span>
            <div className="relative flex items-center">
              <input
                className="w-full rounded-[2rem] border-none bg-white shadow-sm h-16 px-6 text-lg text-black placeholder:text-slate-400 focus:ring-2 focus:ring-[#eab308]/20 transition-all"
                placeholder="请输入登录密码"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-6 text-slate-400"
              >
                {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-3">
            <span className="text-[#1e293b] text-lg font-bold px-1">确认密码</span>
            <div className="relative flex items-center">
              <input
                className={cn(
                  "w-full rounded-[2rem] border-none bg-white shadow-sm h-16 px-6 text-lg text-black placeholder:text-slate-400 focus:ring-2 focus:ring-[#eab308]/20 transition-all",
                  passwordError && "ring-2 ring-red-400"
                )}
                placeholder="请再次输入密码"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError("");
                }}
              />
              <button
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-6 text-slate-400"
              >
                {showConfirmPassword ? <EyeOff size={24} /> : <Eye size={24} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-red-500 text-sm font-bold px-2">{passwordError}</p>
            )}
          </label>

          {!hasUrlCode ? (
            <label className="flex flex-col gap-3">
              <span className="text-[#1e293b] text-lg font-bold px-1">家族邀请码 (选填)</span>
              <input
                className={`w-full rounded-[2rem] border-none bg-white shadow-sm h-16 px-6 text-xl font-bold text-[#eab308] focus:ring-2 focus:ring-[#eab308]/20 transition-all ${inviteError ? 'ring-2 ring-red-400' : ''}`}
                type="text"
                placeholder="例如: FA-1003"
                value={invitationCode}
                onChange={(e) => { setInvitationCode(e.target.value); setInviteError(""); }}
              />
              {inviteError && (
                <p className="text-red-500 text-sm font-bold px-2">{inviteError}</p>
              )}
            </label>
          ) : (
            <div className="bg-[#eab308]/10 p-5 rounded-3xl border border-[#eab308]/20 flex items-center justify-between shadow-sm">
              <div className="flex flex-col">
                <span className="text-[#eab308] font-bold text-lg">已绑定专属邀请函</span>
                <span className="text-sm text-[#eab308]/70 mt-1 font-medium italic">完成注册后即可直接加入家族</span>
              </div>
              <div className="text-xs bg-white px-3 py-1.5 rounded-xl text-[#eab308] shadow-sm font-mono font-black">{invitationCode}</div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-4">
          <Button
            size="xl"
            disabled={!canSubmit || isValidatingCode}
            className={`w-full h-16 rounded-[2rem] text-xl font-bold shadow-lg transition-all ${canSubmit && !isValidatingCode
              ? "bg-[#eab308] hover:bg-[#d9a306] text-black shadow-[#eab308]/20"
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              }`}
            onClick={handleNext}
          >
            {isValidatingCode ? "验证中..." : "下一步"}
          </Button>
          <p className="text-center text-[10px] text-slate-300 mt-2 font-mono">v1.2.9-ConfirmFlow</p>
        </div>

        {/* 身份确认与修改弹窗 */}
        <AnimatePresence>
          {showVerificationModal && inviteData && (
            <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
              >
                <div className="space-y-6">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-[#eab308]/10 rounded-full flex items-center justify-center mx-auto text-[#eab308]">
                      <Sparkles size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">确认您的身份</h3>
                    <p className="text-slate-500 font-medium text-sm">
                      <span className="font-bold text-[#eab308]">{inviterName}</span> 邀请您加入家族。您可以直接点击下方修改档案：
                    </p>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100/50 flex flex-col items-center gap-4 relative">
                    <div
                      className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white relative group cursor-pointer shrink-0"
                      onClick={() => setShowModalAvatarPicker(!showModalAvatarPicker)}
                    >
                      <img
                        src={avatar || inviteData.targetAvatar}
                        alt="Avatar"
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={20} />
                      </div>
                    </div>

                    {/* Inline Modal Avatar Selection */}
                    <AnimatePresence>
                      {showModalAvatarPicker && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="w-full overflow-hidden"
                        >
                          <div className="grid grid-cols-4 gap-2 bg-slate-100/50 p-3 rounded-[1.5rem] mt-2 mb-4">
                            {defaultAvatars.map((url, i) => (
                              <button
                                key={i}
                                onClick={(e) => { e.stopPropagation(); setAvatar(url); setIsAvatarUploaded(true); setShowModalAvatarPicker(false); }}
                                className={cn(
                                  "aspect-square rounded-full border-2 overflow-hidden transition-all",
                                  avatar === url ? "border-[#eab308] scale-90" : "border-white"
                                )}
                              >
                                <img src={url} alt={`Default ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </button>
                            ))}
                            <button
                              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); setShowModalAvatarPicker(false); }}
                              className="aspect-square rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-[#eab308] hover:border-[#eab308] transition-all bg-white"
                            >
                              <Camera size={20} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="w-full flex flex-col gap-4 mt-2">
                      <div className="space-y-1.5 text-left w-full">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">真实姓名</label>
                        <div className="relative">
                          {isEditingName ? (
                            <input
                              autoFocus
                              type="text"
                              className="w-full h-14 rounded-2xl bg-white border-2 border-[#eab308] ring-4 ring-[#eab308]/10 px-5 font-bold text-slate-800 placeholder:text-slate-300 transition-all shadow-sm"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              onBlur={() => setIsEditingName(false)}
                              placeholder="请输入您的姓名"
                            />
                          ) : (
                            <div className="w-full h-14 rounded-2xl bg-white border-2 border-slate-100 px-5 font-bold text-slate-800 shadow-sm flex items-center justify-between">
                              <span className={name ? "text-slate-800" : "text-slate-300"}>{name || "请输入您的姓名"}</span>
                              <button
                                type="button"
                                onClick={() => setIsEditingName(true)}
                                className="p-1.5 rounded-full hover:bg-[#eab308]/10 text-slate-300 hover:text-[#eab308] transition-all"
                              >
                                <Edit2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left w-full">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">性别 (用于精准关系推导)</label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                          <button
                            type="button"
                            onClick={() => setGender("male")}
                            className={cn(
                              "h-12 rounded-2xl font-bold transition-all border-2",
                              gender === "male" ? "bg-blue-50 border-blue-200 text-blue-600 shadow-sm" : "bg-white border-slate-100 text-slate-400"
                            )}
                          >
                            男
                          </button>
                          <button
                            type="button"
                            onClick={() => setGender("female")}
                            className={cn(
                              "h-12 rounded-2xl font-bold transition-all border-2",
                              gender === "female" ? "bg-pink-50 border-pink-200 text-pink-600 shadow-sm" : "bg-white border-slate-100 text-slate-400"
                            )}
                          >
                            女
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left w-full">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">您的身份（邀请人对您的称呼）</label>
                        <div className="w-full h-14 rounded-2xl bg-slate-50 border-2 border-slate-100 px-5 font-bold text-slate-500 shadow-sm flex items-center">
                          <span>{selectedRelationship || (inviteData && inviteData.targetRole) || "未知身份"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 pt-2 px-2">
                    <Button
                      size="xl"
                      className="w-full h-16 rounded-2xl bg-[#eab308] text-black font-black shadow-lg shadow-[#eab308]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      onClick={() => {
                        // 当选择"其他"且有自定义文字时，使用自定义文字作为关系标签
                        const effectiveRel = (selectedRelationship === "其他" && customRelText.trim())
                          ? customRelText.trim()
                          : (selectedRelationship || inviteData.targetRole);
                        const stdRole = allRelationships.find(r => r.label === selectedRelationship)?.value || "other";
                        const finalName = name || inviteData.targetName;
                        const finalAvatar = avatar || inviteData.targetAvatar;

                        setName(finalName);
                        setAvatar(finalAvatar);

                        handleCompleteRegistration(effectiveRel, stdRole, undefined, finalName, finalAvatar);
                      }}
                    >
                      <Check size={20} /> 是的，确认加入
                    </Button>
                    <button
                      className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                      onClick={() => {
                        setInvitationCode("");
                        setInviteData(null);
                        setShowVerificationModal(false);
                      }}
                    >
                      <X size={16} /> 这不是我，返回重新输入
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="text-center">
          <p className="text-slate-500 text-lg">
            已有账号？ <button onClick={() => navigate("/login")} className="text-[#eab308] font-bold underline underline-offset-8 decoration-2">去登录</button>
          </p>
        </div>

        {/* Accessibility Note */}
        <div className="mt-8 px-6 text-center">
          <p className="text-slate-400 text-sm leading-relaxed italic">
            提示：如果您在操作中遇到困难，可以请您的子女或孙辈协助完成注册。
          </p>
        </div>
      </div>
      {showCropper && tempImage && (
        <ImageCropper
          image={tempImage}
          onCropComplete={(croppedImage) => {
            // 压缩图片：避免 base64 过大导致 Vercel 413 错误
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              const MAX_WIDTH = 500;
              const scale = Math.min(1, MAX_WIDTH / img.width);
              canvas.width = img.width * scale;
              canvas.height = img.height * scale;
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              const compressed = canvas.toDataURL("image/jpeg", 0.7); // 质量降到 0.7 显著减小体积
              setAvatar(compressed);
              setIsAvatarUploaded(true);
              setShowCropper(false);
              setTempImage(null);
            };
            img.src = croppedImage;
          }}
          onClose={() => {
            setShowCropper(false);
            setTempImage(null);
          }}
        />
      )}
    </div>
  );
};
