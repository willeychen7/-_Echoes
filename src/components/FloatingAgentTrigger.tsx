import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";

/**
 * Global Floating Agent Trigger
 * Provides a seamless way to return to the Voice Square from any other page.
 */
export const FloatingAgentTrigger: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Only show when NOT on the Square page
  const isVisible = location.pathname !== "/square";
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ scale: 0, opacity: 0, x: 20 }}
          animate={{ scale: 1, opacity: 1, x: 0 }}
          exit={{ scale: 0, opacity: 0, x: 20 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.dispatchEvent(new CustomEvent("toggle-assistant"))}
          className="absolute right-6 bottom-24 z-[60] group transition-all"
          title="召唤包包小管家"
        >
          {/* THE AVATAR (Frameless Circle with AI Status) */}
          <div className="relative size-14 rounded-full overflow-hidden shadow-[0_12px_45px_rgba(251,191,36,0.35)] active:scale-95 transition-all group">
            
            {/* Background for transparency prevention */}
            <div className="absolute inset-0 bg-amber-50" />
            
            <motion.img 
              animate={{ scale: [1.3, 1.4, 1.3] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              src="/secretary.jpg" 
              alt="Back to Secretary" 
              className="w-full h-full object-cover select-none pointer-events-none relative z-10"
            />

            {/* AI Online Status Dot - Refined minimalist look */}
            <div className="absolute top-1.5 right-1.5 size-3 bg-green-400 rounded-full border-2 border-white/80 shadow-[0_0_10px_rgba(74,222,128,0.5)] z-30" />

            {/* Subtle Inner Glow */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent z-20 pointer-events-none" />
          </div>

          {/* Label Tip */}
          <div className="absolute bottom-full mb-4 right-0 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-black rounded-[10px] opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl">
             召唤包包 ✨
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
