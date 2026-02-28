import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "./components/Button";
import { ArrowLeft, Mail, Lock, Phone as PhoneIcon, Key, Eye, EyeOff } from "lucide-react";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 忘记密码相关状态
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [countdown, setCountdown] = useState(0);

  /** 获取重置密码验证码 */
  const handleGetResetCode = async () => {
    if (!forgotEmail) { alert("请输入邮箱"); return; }
    try {
      const res = await fetch("/api/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail })
      });
      if (res.ok) {
        alert("验证码已发送至服务器日志，请查看");
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) { clearInterval(timer); return 0; }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e) {
      alert("发送失败");
    }
  };

  /** 重置密码提交 */
  const handleResetPassword = async () => {
    if (!forgotEmail || !otpCode || !newPassword) {
      alert("请填写完整信息");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, code: otpCode, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert("密码重置成功，请使用新密码登录");
        setIsForgotMode(false);
        setPhone(forgotEmail);
      } else {
        alert(data.error || "重置失败");
      }
    } catch (e) {
      alert("连接服务器失败");
    } finally {
      setLoading(false);
    }
  };

  /** 真实登录逻辑 */
  const handleLogin = async () => {
    if (!phone || !password) {
      setError("请输入账号和密码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        localStorage.setItem("currentUser", JSON.stringify({ ...data.user, isRegistered: true }));
        navigate("/square");
      } else {
        setError(data.error || "登录失败");
      }
    } catch (e) {
      setError("连接服务器失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] px-6 py-8">
      <button onClick={() => isForgotMode ? setIsForgotMode(false) : navigate("/")} className="mb-4 size-12 flex items-center justify-center rounded-full hover:bg-black/5">
        <ArrowLeft size={28} />
      </button>

      <div className="text-center mb-10 mt-6">
        <h1 className="text-4xl font-bold font-display mb-2">
          {isForgotMode ? "找回密码" : "欢迎回来"}
        </h1>
        <p className="text-slate-500 text-lg">
          {isForgotMode ? "通过验证验证码来重置您的密码" : "开启您的家族记忆之旅"}
        </p>
      </div>

      <div className="max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {!isForgotMode ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-slate-700 font-bold px-1 flex items-center gap-2">
                  <Mail size={16} /> 手机号 / 邮箱
                </label>
                <input
                  type="text"
                  className="w-full h-16 px-5 rounded-2xl border-2 border-slate-100 focus:border-[#eab308] focus:ring-0 text-lg shadow-sm transition-all"
                  placeholder="请输入账号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-slate-700 font-bold flex items-center gap-2">
                    <Lock size={16} /> 密码
                  </label>
                  <button onClick={() => setIsForgotMode(true)} className="text-sm font-bold text-[#eab308] hover:underline">
                    忘记密码？
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full h-16 px-5 rounded-2xl border-2 border-slate-100 focus:border-[#eab308] focus:ring-0 text-lg shadow-sm transition-all pr-14"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-center font-bold">{error}</p>
              )}

              <div className="pt-4 space-y-4">
                <Button size="xl" className="w-full h-16 rounded-2xl bg-[#eab308] text-black font-black text-xl" disabled={loading} onClick={handleLogin}>
                  {loading ? "登录中..." : "立即登录"}
                </Button>
                <div className="flex items-center gap-4 py-2">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-slate-300 text-sm font-bold">OR</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <Button size="xl" variant="outline" className="w-full h-16 rounded-2xl border-2 border-slate-100 text-slate-500 font-black text-xl" onClick={() => navigate("/register")}>
                  没有账号？立即注册
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-slate-700 font-bold px-1 flex items-center gap-2">
                  <Mail size={16} /> 您的邮箱
                </label>
                <input
                  type="email"
                  className="w-full h-16 px-5 rounded-2xl border-2 border-slate-100 focus:border-[#eab308] focus:ring-0 text-lg shadow-sm"
                  placeholder="请输入注册时的邮箱"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-slate-700 font-bold px-1 flex items-center gap-2">
                  <Key size={16} /> 验证码
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full h-16 px-5 rounded-2xl border-2 border-slate-100 focus:border-[#eab308] focus:ring-0 text-lg pr-32"
                    placeholder="请输入 6 位验证码"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                  <button
                    onClick={handleGetResetCode}
                    disabled={countdown > 0}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 font-bold rounded-xl transition-all ${countdown > 0 ? "bg-slate-50 text-slate-300" : "bg-[#eab308] text-black hover:scale-105"
                      }`}
                  >
                    {countdown > 0 ? `${countdown}s` : "获取"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-slate-700 font-bold px-1 flex items-center gap-2">
                  <Lock size={16} /> 设置新密码
                </label>
                <input
                  type="password"
                  className="w-full h-16 px-5 rounded-2xl border-2 border-slate-100 focus:border-[#eab308] focus:ring-0 text-lg shadow-sm"
                  placeholder="请输入 6 位以上新密码"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="pt-4 space-y-4">
                <Button size="xl" className="w-full h-16 rounded-2xl bg-[#eab308] text-black font-black text-xl" disabled={loading} onClick={handleResetPassword}>
                  {loading ? "提交中..." : "重置密码"}
                </Button>
                <button
                  onClick={() => setIsForgotMode(false)}
                  className="w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                >
                  返回登录
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
