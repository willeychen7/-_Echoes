import React, { useEffect } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "./components/Button";
import { ArrowLeft, TreeDeciduous } from "lucide-react";
import confetti from "canvas-confetti";

export const RegisterSuccessPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 45, spread: 360, ticks: 100, zIndex: 0 };
    const colors = ['#ff0000', '#ffa500', '#ffff00', '#008000', '#0000ff', '#4b0082', '#ee82ee'];

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 100 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, colors, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, colors, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-slate-900">
      {/* Header */}
      <div className="flex items-center p-4 justify-between">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={28} />
        </button>
        <div className="flex-1"></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, duration: 1.5 }}
          className="text-center mb-12 flex flex-col items-center"
        >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 15 }}
            className="mb-6 p-6 rounded-full bg-[#eab308]/10 text-[#eab308]"
          >
            <TreeDeciduous size={80} />
          </motion.div>
          
          <motion.h2 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-6xl font-bold text-[#eab308] tracking-widest font-serif mb-4"
          >
            注册成功
          </motion.h2>
          <div className="w-24 h-1 bg-[#eab308] mx-auto rounded-full opacity-50"></div>
        </motion.div>

        <div className="text-center max-w-lg space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-wide font-serif">
              欢迎回家
            </h1>
            <p className="text-slate-600 text-xl px-8 leading-relaxed italic">
              “家里的声音，从未走远。”
            </p>
          </div>
          
          <p className="text-slate-500 text-lg px-8 leading-relaxed">
            您的账号已经准备就绪。让我们一起留住每一份温暖的回响。
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-6 pb-24 w-full max-w-md mx-auto">
        <Button 
          size="xl" 
          className="w-full py-8 text-2xl font-bold rounded-full bg-[#eab308] hover:bg-[#d9a306] text-black shadow-lg shadow-[#eab308]/20 border-none transition-all"
          onClick={() => navigate("/square")}
        >
          开启旅程
        </Button>
      </div>
    </div>
  );
};
