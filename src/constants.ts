export const DEFAULT_AVATAR_HUMAN = "/default_avatar.png";
export const DEFAULT_AVATAR_PET = "/default_avatar.png";

export const DEFAULT_AVATAR = DEFAULT_AVATAR_HUMAN;

export const SYSTEM_AVATARS = [
    DEFAULT_AVATAR_HUMAN,
];

/**
 * 统一头像获取逻辑：
 * 1. 如果有有效的 URL，直接返回。
 * 2. 如果没有，返回标准默认头像。
 */
export const getSafeAvatar = (url?: string) => {
    if (!url || typeof url !== 'string' || url.trim().length === 0) return DEFAULT_AVATAR;
    let finalUrl = url.trim();
    // 强制增加前导斜杠，防止二级路由路径偏移导致的 404/连接错误
    if (!finalUrl.startsWith('http') && !finalUrl.startsWith('data:') && !finalUrl.startsWith('/')) {
        finalUrl = '/' + finalUrl;
    }
    return finalUrl;
};


