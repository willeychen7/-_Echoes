import React from 'react';
import { cn } from '../lib/utils';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  error?: string;
  suffix?: React.ReactNode;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  required,
  className,
  containerClassName,
  labelClassName,
  error,
  suffix,
  ...props
}) => {
  return (
    <label className={cn("flex flex-col gap-3", containerClassName)}>
      <span className={cn("text-[#1e293b] text-lg font-bold px-1 flex items-center gap-1", labelClassName)}>
        {label}
        {required && <span className="text-rose-500 text-base">*</span>}
      </span>
      <div className="relative flex items-center">
        <input
          className={cn(
            "w-full rounded-[2rem] border-none bg-white shadow-sm h-16 px-6 text-lg text-black placeholder:text-slate-400 focus:ring-2 focus:ring-[#eab308]/20 transition-all",
            error && "ring-2 ring-rose-500/20",
            className
          )}
          {...props}
        />
        {suffix && (
          <div className="absolute right-4">
            {suffix}
          </div>
        )}
      </div>
      {error && <p className="text-rose-500 text-xs px-2">{error}</p>}
    </label>
  );
};
