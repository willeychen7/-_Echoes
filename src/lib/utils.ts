import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "刚刚";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
  if (diffInSeconds < 172800) return "昨天";
  return `${Math.floor(diffInSeconds / 86400)}天前`;
}
export function normalizeGender(g: any): 'male' | 'female' | null {
  if (!g) return null;
  const s = String(g).toLowerCase().trim();
  if (s === 'male' || s === '男' || s === 'm') return 'male';
  if (s === 'female' || s === '女' || s === 'f') return 'female';
  return null;
}

// --- 🌐 全局宗法术语标准库 ---
export const NUM_CHAR = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export const ANCESTOR_PREFIX = ['', '', '', '曾', '高', '太', '烈', '天', '远', '鼻'];
export const DESCENDANT_PREFIX = ['', '', '', '曾', '玄', '来', '晜', '仍', '云', '耳'];
export const KINSHIP_PREFIXES = ['再从', '三从', '堂', '表', '族'];
export const FEMALE_KEYWORDS = ["阿姨", "姑姑", "母", "妈", "娘", "奶", "婆", "姐", "妹", "嫂", "侄女", "外甥女", "表姊", "表妹", "堂姊", "堂妹", "内侄女", "女", "堂姨", "表姨", "大姨", "小姨", "大姑", "小姑"];
export const MALE_KEYWORDS = ["叔", "伯", "爸", "爹", "爷", "公", "哥", "弟", "婿", "夫", "男", "侄子", "外甥", "舅", "堂舅", "表舅", "大舅子", "小舅子"];
// --- 🌟 统一排行归位字典 (名分归正) ---
export const RANK_MAP: Record<string, number> = {
  "1": 1, "一": 1, "大": 1, "长": 1, "首": 1, "伯": 1, "元": 1, "老大": 1,
  "2": 2, "二": 2, "次": 2, "仲": 2, "老二": 2,
  "3": 3, "三": 3, "叔": 3, "老三": 3,
  "4": 4, "四": 4, "季": 4, "老四": 4,
  "5": 5, "五": 5, "老五": 5,
  "6": 6, "六": 6, "老六": 6,
  "7": 7, "七": 7, "老七": 7,
  "8": 8, "八": 8, "老八": 8,
  "9": 9, "九": 9, "老九": 9,
  "10": 10, "十": 10, "老十": 10,
  "11": 11, "十一": 11, "12": 12, "十二": 12, "13": 13, "十三": 13, "14": 14, "十四": 14, "15": 15, "十五": 15,
  "16": 16, "十六": 16, "17": 17, "十七": 17, "18": 18, "十八": 18, "19": 19, "十九": 19, "20": 20, "二十": 20,
  "末": 99, "小": 99, "幼": 99, "幺": 99, "老幺": 99, "老小": 99
};

// 后台逻辑正则匹配序列 (由长至短排列，防止部分匹配)
export const RANK_REGEX_STR = "(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|长|次|末|小|幼|幺|老)";

// UI 建议排行序列
export const RANK_UI_OPTIONS = [
  { label: '老大（大房）', value: '大' },
  { label: '老二（二房）', value: '二' },
  { label: '老三（三房）', value: '三' },
  { label: '老四（四房）', value: '四' },
  { label: '老五（五房）', value: '五' },
  { label: '老六（六房）', value: '六' },
  { label: '老七（七房）', value: '七' },
  { label: '老幺（最后）', value: '老幺' }
];

/**
 * 统一排行归并逻辑：确保“2”、2、“二”、“次”在系统眼中是同一个人
 * @param input 原始输入
 * @returns 统一的数字排行 (1-10, 99)
 */
export function normalizeRank(input: any): number | null {
  if (input === null || input === undefined || input === '不知道') return null;
  const s = String(input).trim();
  return RANK_MAP[s] || (isNaN(Number(s)) ? null : Number(s));
}

/**
 * 将数字排行翻译为正式礼法前缀
 * @param rank 规范化后的排行数字
 * @param isViewer 是否为本尊(长/次)还是房分(长/二/三房)
 */
export function getFormalRankTitle(rank: number | null, mode: 'prefix' | 'branch' = 'prefix'): string {
  if (!rank || rank === 99) {
    if (rank === 99) return mode === 'prefix' ? "小" : "小房";
    return "";
  }

  if (mode === 'branch') {
    if (rank === 1) return "大房";
    return NUM_CHAR[rank] + "房";
  }

  // Prefix mode
  if (rank === 1) return "长";
  if (rank === 2) return "次";
  return NUM_CHAR[rank];
}
