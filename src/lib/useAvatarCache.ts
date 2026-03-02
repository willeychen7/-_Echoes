import { useState, useEffect } from "react";

const AVATAR_CACHE_KEY = "familyAvatarCache";
const AVATAR_EVENT = "avatar-updated";

/**
 * 全局头像缓存 Hook
 * 存储格式：{ [memberId: string]: avatarUrl }
 * 当任何地方改变头像时，所有订阅的组件都会自动重渲染。
 */
export function useAvatarCache(): Record<string, string> {
    const [cache, setCache] = useState<Record<string, string>>(() => {
        try {
            return JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY) || "{}");
        } catch {
            return {};
        }
    });

    useEffect(() => {
        const refresh = () => {
            try {
                setCache(JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY) || "{}"));
            } catch { }
        };
        window.addEventListener(AVATAR_EVENT, refresh);
        window.addEventListener("storage", refresh);
        return () => {
            window.removeEventListener(AVATAR_EVENT, refresh);
            window.removeEventListener("storage", refresh);
        };
    }, []);

    return cache;
}

/**
 * 更新某个成员的头像缓存，并触发全局刷新事件。
 * 在 ProfilePage handleAvatarChange 里调用。
 */
export function updateAvatarCache(memberId: number | string, avatarUrl: string) {
    try {
        const current = JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY) || "{}");
        current[String(memberId)] = avatarUrl;
        localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(current));
        // NOTE: 触发所有订阅的组件刷新头像
        window.dispatchEvent(new CustomEvent(AVATAR_EVENT));
    } catch { }
}

/**
 * 批量写入所有家庭成员头像（仅触发一次刷新事件）。
 * 在 BlessingPage / ArchivePage 拉取成员列表时调用，
 * 确保任何成员改头像后，所有历史留言都显示最新头像。
 */
export function seedAvatarCache(entries: Record<string, string>) {
    try {
        const current = JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY) || "{}");
        const merged = { ...current, ...entries };
        localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(merged));
        // NOTE: 只触发一次事件，避免多次重渲染
        window.dispatchEvent(new CustomEvent(AVATAR_EVENT));
    } catch { }
}

/**
 * 工具函数：从消息中解析出最新头像
 * 优先级：缓存(memberId) > 消息里存的 avatar > picsum 占位
 */
export function resolveAvatar(
    cache: Record<string, string>,
    memberId: number | string | undefined | null,
    fallbackAvatar: string | undefined,
    seed: string
): string {
    if (memberId && cache[String(memberId)]) return cache[String(memberId)];
    return fallbackAvatar || `https://picsum.photos/seed/${seed}/100/100`;
}
