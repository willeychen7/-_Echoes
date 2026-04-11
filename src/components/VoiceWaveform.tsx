import React from "react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface VoiceWaveformProps {
  isRecording: boolean;
  color?: string;
  className?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ 
  isRecording, 
  color = "text-white", 
  className 
}) => {
  const idlePath = "M0 20 Q 15 20, 30 20 T 60 20 T 90 20 T 120 20";
  const wavePaths = [
    "M0 20 Q 15 5, 30 20 T 60 20 T 90 35 T 120 20",
    "M0 20 Q 15 35, 30 20 T 60 5, 90 20 T 120 20",
    "M0 20 Q 15 20, 30 5 T 60 35, 90 20 T 120 20",
    "M0 20 Q 15 5, 30 20 T 60 20 T 90 35 T 120 20"
  ];

  return (
    <div className={cn("flex items-center justify-center overflow-hidden", className)}>
      <svg
        viewBox="0 0 120 40"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          d={idlePath}
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          animate={{
            d: isRecording ? wavePaths : idlePath
          }}
          transition={{
            repeat: Infinity,
            duration: 1.2,
            ease: "easeInOut"
          }}
        />
        <motion.path
          d={idlePath}
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
          animate={{
            d: isRecording 
              ? [
                  "M0 20 Q 15 30, 30 20 T 60 30, 90 20 T 120 20",
                  "M0 20 Q 15 10, 30 20 T 60 10, 90 20 T 120 20",
                ]
              : idlePath
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            ease: "easeInOut",
            delay: 0.2
          }}
        />
      </svg>
    </div>
  );
};

export const VoiceRipple: React.FC<{ isActive: boolean; className?: string }> = ({ isActive, className }) => {
  if (!isActive) return null;
  return (
    <div className={cn("absolute inset-0 z-[-1] pointer-events-none", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "easeOut",
          }}
          className="absolute inset-0 rounded-full border-2 border-amber-400/30"
        />
      ))}
    </div>
  );
};
