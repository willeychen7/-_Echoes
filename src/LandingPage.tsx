import React from "react";
import { motion } from "motion/react";
import { Button } from "./components/Button";
import { useNavigate } from "react-router-dom";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] overflow-hidden relative font-serif">
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-12 max-w-2xl mx-auto w-full">
        {/* Gramophone Animation */}
        <div className="relative w-64 h-56 mx-auto mb-12 flex justify-center scale-110">
          {/* Vinyl Record */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="absolute bottom-0 left-4 w-48 h-48 rounded-full bg-[#1a1a1a] shadow-[0_10px_30px_rgba(0,0,0,0.2)] border-4 border-[#2a2a2a] flex items-center justify-center"
          >
            {/* Grooves */}
            <div className="absolute inset-3 rounded-full border border-[#333]"></div>
            <div className="absolute inset-6 rounded-full border border-[#333]"></div>
            <div className="absolute inset-9 rounded-full border border-[#333]"></div>
            <div className="absolute inset-12 rounded-full border border-[#333]"></div>
            {/* Center Label */}
            <div className="relative w-16 h-16 rounded-full border-2 border-[#1a1a1a] overflow-hidden bg-[#eab308]">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-[#1a1a1a] rounded-full"></div>
              </div>
            </div>
          </motion.div>

          {/* Tonearm Assembly */}
          <div className="absolute top-2 right-8 z-10">
            {/* Base */}
            <div className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-br from-slate-200 to-slate-400 rounded-full shadow-lg border border-slate-300 z-20 flex items-center justify-center">
              <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
            </div>
            {/* Arm */}
            <motion.div
              initial={{ rotate: -25 }}
              animate={{ rotate: 18 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
              style={{ transformOrigin: "top center" }}
              className="relative w-2 h-28 bg-gradient-to-b from-slate-300 to-slate-400 rounded-full shadow-xl"
            >
              {/* Stylus Head */}
              <div className="absolute -bottom-4 -left-2 w-6 h-8 bg-gradient-to-br from-slate-300 to-slate-500 rounded-sm shadow-lg border border-slate-400">
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-slate-700 rounded-full"></div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Title Section */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-[160px] leading-[0.9] font-[900] tracking-tighter text-[#1a1a1a] font-serif">
            岁月留声
          </h1>

          <div className="space-y-4 text-[#4a4a4a] text-3xl italic leading-relaxed font-black">
            {[
              "家里的声音，从未走远。",
              "数字化作永恒的陪伴，",
              "听，那是岁月的重响。"
            ].map((text, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.3 + (i * 0.8),
                  duration: 1.0,
                  ease: "easeOut"
                }}
              >
                {text}
              </motion.p>
            ))}
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="w-full max-w-sm space-y-4">
          <div className="flex justify-center">
            <Button
              size="lg"
              className="px-14 py-4 rounded-full text-lg font-black bg-[#eab308] hover:bg-[#d9a306] text-black shadow-lg shadow-[#eab308]/20 border-none transition-all active:scale-95"
              onClick={() => {
                localStorage.removeItem("demoCustomMembers");
                localStorage.removeItem("demoCustomEvents");
                navigate("/login");
              }}
            >
              登录 / 注册
            </Button>
          </div>

          <div className="text-center">
            <button
              onClick={() => {
                localStorage.removeItem("currentUser");
                localStorage.removeItem("demoCustomMembers");
                localStorage.removeItem("demoCustomEvents");
                navigate("/square");
              }}
              className="text-[#a1a1a1] text-sm font-black hover:text-[#4a4a4a] transition-colors uppercase tracking-widest"
            >
              逛逛家族广场 (Demo)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
