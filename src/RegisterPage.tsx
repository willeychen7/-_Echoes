import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "./components/Button";
import { ArrowLeft, Eye, EyeOff, ImagePlus, Plus } from "lucide-react";
import { Card } from "./components/Card";
import { cn } from "./lib/utils";

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
  const [avatar, setAvatar] = useState("https://lh3.googleusercontent.com/aida-public/AB6AXuBAdiBHDqEr2K33fyt5BaRHdl7JV-ITKpBOKDmyz87kyHbJXbxViiMpAoqF0v8hkObP0481dOZWZeNK5mf151CBcsTi2zydCD56k2lIlrJNwk9IImtHScfDETFF-h9tJxjbmxUOZY_g8jEIokPEDj37oagfY6VWKEMIw6Fyk_Uxew_PYRxZzLw_28b4pO4EMCBITCWArexcIpjk4HIlC4udrqA9MrjKSueMBgGE3UpXfLjRdUIZ9OgHLbrq0JWsvpsm1Xm135ZE81s");

  const [invitationCode, setInvitationCode] = useState("");
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState("");
  const [inviterName, setInviterName] = useState("");
  const [inviterId, setInviterId] = useState<number | null>(null);
  const [inviterRole, setInviterRole] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [verificationError, setVerificationError] = useState("");

  const canSubmit = name && phone && password && confirmPassword && verificationCode;

  const relationships = [
    { label: "儿子", value: "son" },
    { label: "女儿", value: "daughter" },
    { label: "父亲", value: "father" },
    { label: "母亲", value: "mother" },
    { label: "配偶", value: "spouse" },
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
        const data = await res.json();
        alert(data.error || "发送失败");
      }
    } catch (error) {
      console.error("Send code error:", error);
    }
  };

  const handleNext = async () => {
    if (password !== confirmPassword) {
      setPasswordError("两次输入的密码不一致");
      return;
    }

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
        return;
      }

      const res = await fetch(`/api/validate-invite?code=${encodeURIComponent(invitationCode.trim())}`);
      if (!res.ok) {
        setInviteError("邀请码无效，请检查后重试");
        setIsValidatingCode(false);
        return;
      }
      const data = await res.json();
      setInviterName(data.inviterName);
      setInviterRole(data.inviterRole);
      setInviterId(data.inviterId);
      setShowRelationshipModal(true);
    } catch {
      setInviteError("网络错误，请稍后重试");
    }
    setIsValidatingCode(false);
  };

  const handleCompleteRegistration = async () => {
    let currentFamilyId = 1;
    let currentMemberId = null;

    try {
      if (invitationCode.trim() && inviterId) {
        // 加入已有家族：告知后端新用户与邀请人的关系
        const relInfo = relationships.find(r => r.label === selectedRelationship);
        const response = await fetch("/api/register-claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviteCode: invitationCode.trim(),
            name,
            avatarUrl: avatar,
            relationshipToInviter: selectedRelationship,
            standardRole: relInfo?.value || "other",
            phone,
            password
          })
        });

        if (!response.ok) {
          const data = await response.json();
          alert(data.error || "注册失败");
          return;
        }
        const data = await response.json();
        currentFamilyId = data.familyId || 1;
        currentMemberId = data.memberId;
      } else {
        // 创建新家族 (Using unified backend endpoint)
        const response = await fetch("/api/register-new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, password, avatar })
        });

        if (!response.ok) {
          const data = await response.json();
          alert(data.error || "注册失败");
          return;
        }
        const data = await response.json();
        currentFamilyId = data.familyId;
        currentMemberId = data.memberId;
      }
    } catch (error) {
      console.error("Registration error:", error);
      alert("注册过程中出现错误，请稍后重试。");
      return;
    }

    const userData = {
      name,
      phone,
      avatar,
      relationship: selectedRelationship || "创建者",
      inviterName: invitationCode ? inviterName : null,
      inviterId,
      inviterRole,
      familyId: currentFamilyId,
      memberId: currentMemberId,
      isRegistered: true
    };
    localStorage.setItem("currentUser", JSON.stringify(userData));
    navigate("/register-success");
  };

  const defaultAvatars = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDIwxfzAvsOl_ZzsdHKppuFhs_5iM26_e_p9y0kU5_hiLIVc9JAY_Q8otsTMmOgX5pbn8EPDA2b_WN2KHmuEYiQ_xNJvM7vhbd7cZi38m3JnyKMW5xfg3al0T0-wRjr8BHYEW-69XFpOpqZ0CLKqXYOqBmT2ZzMxzoX_kgqVkuAi9Dx-uoZIO6209WL5x1iIvXLkAyJcupmiN4VgbJxG_YZoKIVS_i2I8CFGTfPC8qlUUhPO4BjYxqiYHbOdcLlV1QacYME0v_b-4Q",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBii1EKeh6-0PsDsGlI18r8HM0WItcEYyUf_owucYBCLJQQ90qBfnWGakCC9kNsiFehHUNrtMvMawxlIVe9_EBwvr3SZWkkn38vpLnRKed42OFHwPl_tsqJNOI-53LuvWMRYSFbBqKmYINxfzP0wI63O3ZFxJtBneMO0RBlqsrinM6maOXTTr-TG9lOIHtjgfvT9BiLXyTyPgcpRzIsWVdOdD38DuWNXJUqsytM9RVEsHDVRxFD4dgZEo7HIPkSihEdzor5lWaOxdk",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDcpi-D7iS967UY2-GOl9L7943tC0wgzQqK2e9_k9TsPcZ63d6faoor9DhdZ0b_yinSnxo3BOwEQhdj9zWl23tjYfGdxNnb7zyvA8A8-ygv6XRfvjSlobPzPULz0eSpd6ySbAURLCsWu1FdBZEW31OO43ZqpsxkblpBT0ev4jNjkA97Qg9MeNTEgep2uXj5M0a6ygnX1_HeUILUKheMgd-7Zjlug0UxQPn3uly09ea_NSKK4IMC0N2Q7Ndn-V-bEjOGkaGByNGdufQ",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBAdiBHDqEr2K33fyt5BaRHdl7JV-ITKpBOKDmyz87kyHbJXbxViiMpAoqF0v8hkObP0481dOZWZeNK5mf151CBcsTi2zydCD56k2lIlrJNwk9IImtHScfDETFF-h9tJxjbmxUOZY_g8jEIokPEDj37oagfY6VWKEMIw6Fyk_Uxew_PYRxZzLw_28b4pO4EMCBITCWArexcIpjk4HIlC4udrqA9MrjKSueMBgGE3UpXfLjRdUIZ9OgHLbrq0JWsvpsm1Xm135ZE81s",
    "https://picsum.photos/seed/avatar5/200/200",
    "https://picsum.photos/seed/avatar6/200/200"
  ];

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
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
        setIsAvatarUploaded(true);
        setShowDefaultAvatars(false);
      };
      reader.readAsDataURL(file);
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
            disabled={isAvatarUploaded}
            className={`absolute bottom-1 right-1 p-2 rounded-full shadow-md border border-slate-100 transition-all ${isAvatarUploaded ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white text-[#eab308] hover:scale-110"
              }`}
          >
            <ImagePlus size={20} className={isAvatarUploaded ? "text-slate-300" : "text-[#eab308]"} />
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
        </div>

        {/* Relationship Modal */}
        <AnimatePresence>
          {showRelationshipModal && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="text-center space-y-4 mb-8">
                  <div className="w-16 h-16 bg-[#eab308]/10 rounded-full flex items-center justify-center mx-auto text-[#eab308]">
                    <Plus size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">确认您的身份</h3>
                  <p className="text-slate-500">
                    您是通过 <span className="font-bold text-[#eab308]">{inviterName}</span> 的邀请码加入的。<br />
                    请问您是 <span className="font-bold text-slate-800">{inviterName}</span> 的谁？
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {relationships.map((rel) => (
                    <button
                      key={rel.label}
                      onClick={() => setSelectedRelationship(rel.label)}
                      className={cn(
                        "py-4 px-2 rounded-2xl border-2 font-bold transition-all text-sm",
                        selectedRelationship === rel.label
                          ? "bg-[#eab308] border-[#eab308] text-black shadow-lg shadow-[#eab308]/20"
                          : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {rel.label}
                    </button>
                  ))}
                </div>

                {selectedRelationship && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mb-8 p-4 bg-amber-50 rounded-2xl border border-amber-100"
                  >
                    <p className="text-sm text-amber-700 text-center font-medium">
                      您选择的身份是 <span className="font-bold">{inviterName}</span> 的
                      <span className="font-bold underline mx-1">{selectedRelationship}</span>，
                      系统将根据此关系自动建立您与家族各成员的关系网。
                    </p>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl py-4 font-bold"
                    onClick={() => setShowRelationshipModal(false)}
                  >
                    返回
                  </Button>
                  <Button
                    className="flex-1 rounded-2xl py-4 font-bold bg-[#eab308] text-black"
                    disabled={!selectedRelationship}
                    onClick={handleCompleteRegistration}
                  >
                    确认加入
                  </Button>
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
    </div>
  );
};
