import React from "react";
import { cn } from "../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl border border-primary/5 shadow-sm overflow-hidden",
        onClick && "cursor-pointer active:scale-[0.99] transition-transform",
        className
      )}
    >
      {children}
    </div>
  );
};
