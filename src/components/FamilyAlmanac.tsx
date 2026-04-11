import React, { useEffect, useState } from 'react';
import { Heart, Sparkles, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { getLunarDay } from '../lib/calendarUtils';
import { motion } from "motion/react";

interface AlmanacData {
    solar_date: string;
    solar_year: number;
    solar_month: number;
    solar_day: number;
    lunar_month_name: string;
    lunar_day_name: string;
    gzYear: string;
    gzDay: string;
    nayin: string;
    clash: string;
    gods: { xi: string, cai: string, fu: string };
    is_lucky_day: boolean;
    yi: string[];
    ji: string[];
    week_day: string;
    family_insight: string;
    family_events: string[];
    us_holiday?: string;
    festivals?: string;
}

interface FamilyAlmanacProps {
    familyId?: number | string;
    date?: string; // ISO 8601 format: YYYY-MM-DD
    onPrev?: () => void;
    onNext?: () => void;
    onDateChange?: (newDate: string) => void;
}

/**
 * 辅助函数：将 AI 返回的 **加粗文本** 渲染为 <strong> 标签
 */
export const renderContentWithBold = (text: string | null) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            const content = part.slice(2, -2);
            let colorClass = "text-[#b45309]"; // 默认棕色

            if (content.includes("今日整体节奏")) colorClass = "text-rose-500";
            if (content.includes("适合的家庭活动")) colorClass = "text-rose-500";
            if (content.includes("温馨提示")) colorClass = "text-rose-500";

            return <strong key={i} className={`font-black ${colorClass} not-italic`}>{content}</strong>;
        }
        return part;
    });
};

const parseLocalDate = (dateStr?: string): { year: number; month: number; day: number } => {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-').map(Number);
        return { year, month, day };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
};

const generateLocalAlmanac = (dateStr?: string): AlmanacData => {
    const { year, month, day } = parseLocalDate(dateStr);
    const lunarData = getLunarDay(year, month, day);
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const idx = (day + month) % 7;
    const yiPool = [['祭祀', '祈福', '嫁娶'], ['裁衣', '作灶', '修缮'], ['出行', '会友', '纳采']];
    const jiPool = [['安葬', '动土', '修辞'], ['出行', '词讼', '安葬'], ['安床', '入宅', '修造']];

    return {
        solar_date: dateStr || `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        solar_year: year,
        solar_month: month,
        solar_day: day,
        lunar_month_name: lunarData.lunarMonth + "月",
        lunar_day_name: lunarData.lunarDay,
        gzYear: lunarData.gzYear,
        gzDay: lunarData.gzDay,
        nayin: lunarData.nayin,
        clash: lunarData.clash,
        gods: lunarData.gods,
        is_lucky_day: true,
        yi: yiPool[idx % 3],
        ji: jiPool[idx % 3],
        week_day: weekDays[new Date(year, month - 1, day).getDay()],
        family_insight: '',
        family_events: [],
        festivals: lunarData.festival || "岁序安然",
    };
};

const FamilyAlmanac: React.FC<FamilyAlmanacProps> = ({ date, onPrev, onNext, onDateChange }) => {
    const [data, setData] = useState<AlmanacData>(() => generateLocalAlmanac(date));
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

    useEffect(() => {
        setData(generateLocalAlmanac(date));
        setAiAnalysis(null);
    }, [date]);

    const handleJump = (y: number, m: number) => {
        if (!onDateChange) return;
        const { day } = parseLocalDate(date);
        const lastDayOfMonth = new Date(y, m, 0).getDate();
        const targetDay = Math.min(day, lastDayOfMonth);
        onDateChange(`${y}-${String(m).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`);
    };

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const res = await fetch("/api/ai-generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "almanac-interpretation",
                    date: data.solar_date,
                    lunar: `${data.lunar_month_name}${data.lunar_day_name}`,
                    gzYear: data.gzYear,
                    gzDay: data.gzDay,
                    nayin: data.nayin,
                    clash: data.clash,
                    gods: data.gods,
                    yi: data.yi,
                    ji: data.ji,
                    prompt: `请务必保留以上 **...：** 的加粗标题格式，各部分直接换行，字数在 150 字以内。`
                })
            });
            const result = await res.json();
            if (result.text) setAiAnalysis(result.text);
        } catch (err) {
            console.error(err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const years = Array.from({ length: 41 }, (_, i) => 2010 + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="bg-[#fffdf9] rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(180,160,120,0.1)] border border-[rgba(212,163,115,0.2)] font-serif relative overflow-hidden">
            <div className="flex items-center justify-between px-2 mb-2 relative z-20">
                <button onClick={onPrev} className="size-8 rounded-full bg-transparent flex items-center justify-center text-[#eab308] hover:bg-amber-500/5 transition-colors active:scale-90">
                    <ChevronLeft size={24} strokeWidth={3} />
                </button>
                <div className="flex gap-1 items-center text-2xl text-[#eab308] font-black">
                    <select value={data.solar_year} onChange={(e) => handleJump(Number(e.target.value), data.solar_month)} className="bg-transparent border-none p-0 cursor-pointer focus:ring-0 text-[#eab308] font-black outline-none">
                        {years.map(y => <option key={y} value={y}>{y}年</option>)}
                    </select>
                    <select value={data.solar_month} onChange={(e) => handleJump(data.solar_year, Number(e.target.value))} className="bg-transparent border-none p-0 cursor-pointer focus:ring-0 text-[#eab308] font-black outline-none">
                        {months.map(m => <option key={m} value={m}>{m}月</option>)}
                    </select>
                </div>
                <button onClick={onNext} className="size-8 rounded-full bg-transparent flex items-center justify-center text-[#eab308] hover:bg-amber-500/5 transition-colors active:scale-90">
                    <ChevronRight size={24} strokeWidth={3} />
                </button>
            </div>

            <div className="text-[72px] font-black text-slate-700 text-center my-1 tracking-tighter shadow-sm">{data.solar_day}</div>
            <div className="flex justify-center gap-2 mb-4">
                <div className="bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-md text-[11px] font-black tracking-widest">{data.week_day}</div>
                {data.festivals !== "岁序安然" && <div className="bg-rose-500/10 text-rose-700 px-2 py-0.5 rounded-md text-[11px] font-black tracking-widest">{data.festivals}</div>}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                <div className="bg-stone-100/50 rounded-2xl p-3 border border-stone-200/50">
                    <div className="text-[10px] text-stone-400 font-bold mb-1 uppercase">岁次干支</div>
                    <div className="text-base font-black text-stone-700">{data.gzYear}年 {data.lunar_month_name}{data.lunar_day_name}</div>
                </div>
                <div className="bg-stone-100/50 rounded-2xl p-3 border border-stone-200/50">
                    <div className="text-[10px] text-stone-400 font-bold mb-1 uppercase">五行冲煞</div>
                    <div className="text-base font-black text-stone-700">{data.nayin}<br /><span className="text-[11px] text-rose-500">{data.clash}</span></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#fff1f2] rounded-2xl p-4 border border-rose-100 flex flex-col items-center">
                    <div className="size-8 rounded-lg bg-rose-500 text-white flex items-center justify-center font-black mb-2">宜</div>
                    <div className="flex flex-col gap-1 text-center font-black text-stone-700 text-sm">
                        {data.yi.map((v, i) => <div key={i}>{v}</div>)}
                    </div>
                </div>
                <div className="bg-[#f8fafc] rounded-2xl p-4 border border-slate-200 flex flex-col items-center">
                    <div className="size-8 rounded-lg bg-slate-400 text-white flex items-center justify-center font-black mb-2">忌</div>
                    <div className="flex flex-col gap-1 text-center font-black text-stone-600 text-sm">
                        {data.ji.map((v, i) => <div key={i}>{v}</div>)}
                    </div>
                </div>
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/50 mb-4 flex justify-around text-center items-center">
                <div><div className="text-[10px] text-amber-500 font-bold mb-1">喜神</div><div className="text-sm font-black text-stone-700">{data.gods.xi}</div></div>
                <div className="w-px h-6 bg-amber-200" />
                <div><div className="text-[10px] text-amber-500 font-bold mb-1">财神</div><div className="text-sm font-black text-stone-700">{data.gods.cai}</div></div>
                <div className="w-px h-6 bg-amber-200" />
                <div><div className="text-[10px] text-amber-500 font-bold mb-1">福神</div><div className="text-sm font-black text-stone-700">{data.gods.fu}</div></div>
            </div>

            <div className="mt-4 mb-4 min-h-[40px] flex flex-col items-center justify-center">
                {(isAnalyzing || aiAnalysis) && (
                    <div className="w-full text-center px-4">
                        {isAnalyzing && (
                            <div className="flex flex-col items-center gap-3">
                                <div className="size-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                <div className="text-xs font-black text-stone-400 tracking-widest animate-pulse">正在为您智慧解析...</div>
                            </div>
                        )}

                        {aiAnalysis && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center px-4">
                                <div className="text-[10px] font-black text-[#b45309]/40 tracking-[0.4em] uppercase mb-4">—— 家族智者 · 随笔 ——</div>
                                <div className="text-lg leading-relaxed text-stone-800 italic font-serif whitespace-pre-wrap">
                                    {renderContentWithBold(aiAnalysis)}
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FamilyAlmanac;
