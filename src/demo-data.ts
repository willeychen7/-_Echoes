/**
 * 演示模式的静态数据
 * NOTE: 这些数据完全独立于 Supabase，
 * 仅在用户未注册登录时使用，确保不污染真实数据库。
 */

import { FamilyMember, FamilyEvent } from "./types";

export const DEMO_FAMILY_ID = "demo";

export const DEMO_MEMBERS: FamilyMember[] = [
    {
        id: 1001,
        name: "林月娥",
        relationship: "奶奶",
        avatarUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuDvg6W6IFZ2JuDXanowe2po0Ndn_QmJPFENhHjprVqA22bvfwP64ioaH-ScdlzVoD4OmDEq4Owhiwy5JcXd5r_eQmBI6g7e8qSO3v3gjR7IbsNRaRePyLPJ6-oO0li96mEPtfaFA4JYAQquay2Gxj2UDAsTG6Be_k0WdXbKGyFieLqreF6K2rDFmxJe_hG6CM0TdKAPDlUh5ys0cfZjZKaXgY_Ceu9arfujNoJmvo9lhnmPK7BmGE1H-6dLGdB9a7wtp2FsoTpjA2w",
        bio: "喜欢种花和听京剧。",
        birthDate: "1948-10-12",
        standardRole: "mother",
        gender: "female",
        isRegistered: false,
    },
    {
        id: 1002,
        name: "陈兴华",
        relationship: "爷爷",
        avatarUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMmK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y",
        bio: "退休教师，喜欢写书法。",
        birthDate: "1945-03-20",
        standardRole: "father",
        gender: "male",
        isRegistered: false,
    },
    {
        id: 1003,
        name: "陈建国",
        relationship: "爸爸",
        avatarUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMmK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y",
        bio: "热爱生活，记录美好。",
        birthDate: "1965-05-12",
        standardRole: "father",
        gender: "male",
        fatherId: 1002,
        motherId: 1001,
        isRegistered: true,
    },
    {
        id: 1004,
        name: "李美芳",
        relationship: "妈妈",
        avatarUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuDIwxfzAvsOl_ZzsdHKppuFhs_5iM26_e_p9y0kU5_hiLIVc9JAY_Q8otsTMmOgX5pbn8EPDA2b_WN2KHmuEYiQ_xNJvM7vhbd7cZi38m3JnyKMW5xfg3al0T0-wRjr8BHYEW-69XFpOpqZ0CLKqXYOqBmT2ZzMxzoX_kgqVkuAi9Dx-uoZIO6209WL5x1iIvXLkAyJcupmiN4VgbJxG_YZoKIVS_i2I8CFGTfPC8qlUUhPO4BjYxqiYHbOdcLlV1QacYME0v_b-4Q",
        bio: "家里的主厨，喜欢广场舞。",
        birthDate: "1968-08-15",
        standardRole: "mother",
        gender: "female",
        isRegistered: false,
    },
    {
        id: 1005,
        name: "陈小明",
        relationship: "儿子",
        avatarUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBAdiBHDqEr2K33fyt5BaRHdl7JV-ITKpBOKDmyz87kyHbJXbxViiMpAoqF0v8hkObP0481dOZWZeNK5mf151CBcsTi2zydCD56k2lIlrJNwk9IImtHScfDETFF-h9tJxjbmxUOZY_g8jEIokPEDj37oagfY6VWKEMIw6Fyk_Uxew_PYRxZzLw_28b4pO4EMCBITCWArexcIpjk4HIlC4udrqA9MrjKSueMBgGE3UpXfLjRdUIZ9OgHLbrq0JWsvpsm1Xm135ZE81s",
        bio: "记录爷爷奶奶的故事。",
        birthDate: "2000-06-01",
        standardRole: "son",
        gender: "male",
        fatherId: 1003,
        motherId: 1004,
        isRegistered: true,
    },
];

/**
 * 演示大事记数据
 * NOTE: 基于当前日期动态生成，确保「本周」「本月」「本年」都有事件
 */
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth(); // 0-indexed

/** 工具函数：生成 YYYY-MM-DD 格式 */
function toDateStr(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 本周内：2天后
const in2Days = new Date(today);
in2Days.setDate(today.getDate() + 2);

// 本周内：5天后
const in5Days = new Date(today);
in5Days.setDate(today.getDate() + 5);

// 本月内：15天后
const in15Days = new Date(today);
in15Days.setDate(today.getDate() + 15);

export const DEMO_EVENTS: FamilyEvent[] = [
    {
        id: 2001,
        title: "陈兴华的生日",
        date: toDateStr(in2Days),
        type: "birthday",
        description: "爷爷的九十大寿！",
        isRecurring: true,
        memberId: 1002,
        notes: "准备寿桃和全家福合影",
    },
    {
        id: 2002,
        title: "李美芳的生日",
        date: toDateStr(in5Days),
        type: "birthday",
        description: "妈妈的生日",
        isRecurring: true,
        memberId: 1004,
        notes: "她最喜欢的蛋糕是芒果千层",
    },
    {
        id: 2003,
        title: "全家聚餐",
        date: toDateStr(in15Days),
        type: "event",
        description: "月度家庭聚会",
        isRecurring: false,
        memberId: 1003,
        notes: "订好了老字号火锅店",
    },
    {
        id: 2004,
        title: "结婚40周年纪念日",
        date: `${currentYear}-05-20`,
        type: "anniversary",
        description: "红宝石婚",
        isRecurring: true,
        memberId: 1002,
        notes: "计划全家旅行庆祝",
    },
    {
        id: 2005,
        title: "陈小明毕业典礼",
        date: `${currentYear}-06-15`,
        type: "graduation",
        description: "博士毕业典礼",
        isRecurring: false,
        memberId: 1005,
        notes: "全家一起去参加毕业典礼",
    },
    {
        id: 2006,
        title: "林月娥的生日",
        date: `${currentYear}-10-12`,
        type: "birthday",
        description: "奶奶的生日",
        isRecurring: true,
        memberId: 1001,
        notes: "奶奶喜欢吃红烧肉",
    },
    {
        id: 2007,
        title: "陈建国的生日",
        date: `${currentYear}-12-08`,
        type: "birthday",
        description: "爸爸的生日",
        isRecurring: true,
        memberId: 1003,
        notes: "一起去唱KTV",
    },
];


/**
 * 演示模式下的默认用户信息（陈建国）
 */
export const DEMO_DEFAULT_USER = {
    name: "陈建国",
    relationship: "本人",
    avatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMmK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y",
    memberId: 1003,
    standardRole: "father",
    bio: "热爱生活，记录美好。",
    birthday: "1965-05-12",
    familyId: "demo",
    isRegistered: true,
};

/**
 * 可切换的演示角色列表
 */
export const DEMO_PERSONAS = [
    {
        name: "陈建国",
        relationship: "父亲",
        avatar:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMmK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y",
        memberId: 1003,
        standardRole: "father",
        bio: "热爱生活，记录美好。",
        birthday: "1965-05-12",
        familyId: "demo",
        isRegistered: true,
    },
    {
        name: "陈小明",
        relationship: "长孙",
        avatar:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBAdiBHDqEr2K33fyt5BaRHdl7JV-ITKpBOKDmyz87kyHbJXbxViiMpAoqF0v8hkObP0481dOZWZeNK5mf151CBcsTi2zydCD56k2lIlrJNwk9IImtHScfDETFF-h9tJxjbmxUOZY_g8jEIokPEDj37oagfY6VWKEMIw6Fyk_Uxew_PYRxZzLw_28b4pO4EMCBITCWArexcIpjk4HIlC4udrqA9MrjKSueMBgGE3UpXfLjRdUIZ9OgHLbrq0JWsvpsm1Xm135ZE81s",
        memberId: 1005,
        standardRole: "son",
        bio: "记录爷爷奶奶的故事。",
        birthday: "2000-06-01",
        familyId: "demo",
        isRegistered: true,
    },
];

/**
 * 判断当前用户是否为演示模式
 */
export function isDemoMode(currentUser: any): boolean {
    if (!currentUser) return true;
    if (currentUser.familyId === "demo") return true;
    if (!currentUser.isRegistered) return true;
    // NOTE: familyId 必须是可解析为正整数的值，否则视为 Demo
    const fid = parseInt(String(currentUser.familyId));
    if (isNaN(fid) || fid <= 0) return true;
    return false;
}
