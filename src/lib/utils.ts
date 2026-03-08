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
