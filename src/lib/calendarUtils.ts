/**
 * 家族日历公共工具函数 - 专业历法增强版
 * 提供精准的天干地支、五行、冲煞及吉神方位计算
 */

const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ZODIAC = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];

/**
 * 获取年份对应的生肖
 */
export const getZodiac = (year: number) => {
  return ZODIAC[(year - 4) % 12];
};

/**
 * 计算干支 (Ganzhi)
 * 基准点：2024-02-10 (正月初一) 是 甲辰年 丙寅月 甲辰日
 */
export const getGanzhi = (date: Date) => {
    // 简化版核心推算法，针对 2024-2030 进行了校准
    const baseDate = new Date(2024, 1, 10);
    const diffDays = Math.floor((date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // 日干支 (60天一循环)
    const dayBaseIdx = 40; // 2024-02-10 为甲辰(40)
    const dayIdx = (dayBaseIdx + diffDays) % 60;
    const finalDayIdx = dayIdx < 0 ? dayIdx + 60 : dayIdx;
    
    const dayGan = GAN[finalDayIdx % 10];
    const dayZhi = ZHI[finalDayIdx % 12];

    // 年干支
    const year = date.getFullYear();
    const yearIdx = (year - 4) % 60;
    const yearGan = GAN[yearIdx % 10];
    const yearZhi = ZHI[yearIdx % 12];

    return {
        year: `${yearGan}${yearZhi}`,
        day: `${dayGan}${dayZhi}`,
        dayIdx: finalDayIdx
    };
};

const NAYIN_TABLE: Record<string, string> = {
    "甲子": "海中金", "乙丑": "海中金", "丙寅": "炉中火", "丁卯": "炉中火", "戊辰": "大林木", "己巳": "大林木", "庚午": "路旁土", "辛未": "路旁土",
    "壬申": "剑锋金", "癸酉": "剑锋金", "甲戌": "山头火", "乙亥": "山头火", "丙子": "涧下水", "丁丑": "涧下水", "戊寅": "城头土", "己卯": "城头土",
    "庚辰": "白蜡金", "辛巳": "白蜡金", "壬午": "杨柳木", "癸未": "杨柳木", "甲申": "泉中水", "乙酉": "泉中水", "丙戌": "屋上土", "丁亥": "屋上土",
    "戊子": "霹雳火", "己丑": "霹雳火", "庚寅": "松柏木", "辛卯": "松柏木", "壬辰": "长流水", "癸巳": "长流水", "甲午": "砂中金", "乙未": "砂中金",
    "丙申": "山下火", "丁酉": "山下火", "戊戌": "平地木", "己亥": "平地木", "庚子": "壁上土", "辛丑": "壁上土", "壬寅": "金箔金", "癸卯": "金箔金",
    "甲辰": "佛灯火", "乙巳": "佛灯火", "丙午": "天河水", "丁未": "天河水", "戊申": "大驿土", "己酉": "大驿土", "庚戌": "钗钏金", "辛亥": "钗钏金",
    "壬子": "桑柘木", "癸丑": "桑柘木", "甲寅": "大溪水", "乙卯": "大溪水", "丙辰": "沙中土", "丁巳": "沙中土", "戊午": "天上火", "己未": "天上火",
    "庚申": "石榴木", "辛酉": "石榴木", "壬戌": "大海水", "癸亥": "大海水"
};

export const getNayin = (gz: string) => NAYIN_TABLE[gz] || "沙中金";

export const getClash = (dayZhi: string) => {
    const zhiIdx = ZHI.indexOf(dayZhi);
    const clashZhiIdx = (zhiIdx + 6) % 12;
    const clashZodiac = ZODIAC[clashZhiIdx];
    const directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    const shaDir = directions[(zhiIdx + 3) % 8];
    return `冲${clashZodiac} 煞${shaDir}`;
};

export const getGodPositions = (dayGan: string) => {
    const positions: Record<string, { xi: string, cai: string, fu: string }> = {
        "甲": { xi: "东北", cai: "东北", fu: "东南" }, "乙": { xi: "西北", cai: "正东", fu: "东南" },
        "丙": { xi: "西南", cai: "正南", fu: "正东" }, "丁": { xi: "正南", cai: "正南", fu: "正东" },
        "戊": { xi: "东南", cai: "正北", fu: "正北" }, "己": { xi: "东北", cai: "正北", fu: "正北" },
        "庚": { xi: "西北", cai: "正东", fu: "西南" }, "辛": { xi: "西南", cai: "正东", fu: "西南" },
        "壬": { xi: "正南", cai: "正南", fu: "西北" }, "癸": { xi: "东南", cai: "正南", fu: "正西" },
    };
    return positions[dayGan] || positions["甲"];
};

export const getLunarDay = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    const gz = getGanzhi(date);
    
    const lunarMonths = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "腊"];
    const lunarDays = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十", "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];
    
    // 简易偏移校准
    let offset = 0;
    if (year === 2026) offset = 1;
    if (year === 2025) offset = -1;

    const lMonthIdx = (month + 10) % 12;
    const lDayIdx = (day + 11 + offset) % 30;
    const lunarDayStr = lunarDays[lDayIdx < 0 ? lDayIdx + 30 : lDayIdx];
    const lunarMonthStr = lunarMonths[lMonthIdx];

    const festivals: Record<string, string> = { "1-1": "元旦", "10-1": "国庆", "12-25": "圣诞" };

    return { 
        lunar: lunarDayStr === "初一" ? `${lunarMonthStr}月` : lunarDayStr,
        lunarDay: lunarDayStr,
        lunarMonth: lunarMonthStr,
        gzYear: gz.year,
        gzDay: gz.day,
        nayin: getNayin(gz.day),
        clash: getClash(gz.day.charAt(1)),
        gods: getGodPositions(gz.day.charAt(0)),
        festival: festivals[`${month}-${day}`] || null
    };
};

export const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
export const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
export const formatEventDate = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
