/**
 * 演示模式的静态数据
 * NOTE: 这些数据完全独立于 Supabase，
 * 仅在用户未注册登录时使用，确保不污染真实数据库。
 */

import { FamilyMember, FamilyEvent } from "./types";

export const DEMO_FAMILY_ID = "demo";

export const DEMO_MEMBERS: FamilyMember[] = [
    { id: 1, name: "陈小明", relationship: "本人", avatarUrl: "/demo-avatars/son.png", gender: "male", generationNum: 30, generation_num: 30, isRegistered: true, fatherId: 4, father_id: 4, motherId: 5, mother_id: 5, siblingOrder: 2, sibling_order: 2, standardRole: "me", familyId: "demo" },
    { id: 2, name: "陈大平", relationship: "爷爷", avatarUrl: "/demo-avatars/grandpa.png", gender: "male", generationNum: 28, generation_num: 28, siblingOrder: 3, sibling_order: 3, spouseId: 3, spouse_id: 3, standardRole: "grandfather", familyId: "demo" },
    { id: 3, name: "李阿婆", relationship: "奶奶", avatarUrl: "/demo-avatars/grandma.png", gender: "female", generationNum: 28, generation_num: 28, spouseId: 2, spouse_id: 2, standardRole: "grandmother", familyId: "demo" },
    { id: 4, name: "陈建国", relationship: "爸爸", avatarUrl: "/demo-avatars/papa.png", gender: "male", generationNum: 29, generation_num: 29, fatherId: 2, father_id: 2, motherId: 3, mother_id: 3, spouseId: 5, spouse_id: 5, birth_date: "1970-05-15", standardRole: "father", familyId: "demo" },
    { id: 5, name: "张美丽", relationship: "妈妈", avatarUrl: "/demo-avatars/mama.png", gender: "female", generationNum: 29, generation_num: 29, spouseId: 4, spouse_id: 4, birth_date: "1972-08-20", standardRole: "mother", familyId: "demo" },
    { id: 6, name: "陈小红", relationship: "妹妹", avatarUrl: "/demo-avatars/sister.png", gender: "female", generationNum: 30, generation_num: 30, fatherId: 4, father_id: 4, motherId: 5, mother_id: 5, siblingOrder: 3, sibling_order: 3, standardRole: "sister", familyId: "demo" },
    { id: 8, name: "陈小刚", relationship: "哥哥", avatarUrl: "/demo-avatars/brother.png", gender: "male", generationNum: 30, generation_num: 30, fatherId: 4, father_id: 4, motherId: 5, mother_id: 5, siblingOrder: 1, sibling_order: 1, standardRole: "brother", familyId: "demo" },
    { id: 7, name: "咪咪", relationship: "宠物猫", avatarUrl: "/demo-avatars/cat.png", memberType: "pet", standardRole: "other", familyId: "demo" }
];

export const DEMO_EVENTS: FamilyEvent[] = [
    { id: 1, title: "爷爷 80 大寿", date: "2026-06-15", type: "birthday", memberId: 2, notes: "全家老少都要回老家给他老人家庆生！" },
    { id: 2, title: "家族春节跨年晚宴", date: "2026-02-17", type: "anniversary", notes: "在老宅院子里摆长龙宴，放烟花。" },
    { id: 3, title: "陈小明满月纪念日", date: "1998-05-12", type: "anniversary", memberId: 1 },
    { id: 4, title: "陈大平获得模范村长荣誉", date: "2010-08-20", type: "other", memberId: 2, notes: "那年爷爷特别高兴，全村人都来送锦旗。" },
    { id: 5, title: "陈家宗亲修缮门楼大祭", date: "2026-12-25", type: "other", notes: "跨越三省的陈氏宗亲都会回来，为百年门楼揭牌。" },
    { id: 6, title: "家族新年祈福团圆会", date: "2027-02-06", type: "anniversary", notes: "这是每年的保留项目，老少同乐。" },
    { id: 7, title: "陈小明 26 岁生日庆典", date: "2024-06-15", type: "birthday", memberId: 1, notes: "虽然在上海远洋视频，但大家还是隔空给他唱了生日歌。" }
];

/**
 * 演示模式下的静态记忆档案 (Archive Feed)
 */
export const DEMO_MEMORIES = [
    {
        id: 101,
        familyMemberId: 1,
        authorId: 4,
        authorName: "陈建国",
        authorRole: "爸爸",
        authorAvatar: "/demo-avatars/papa.png",
        content: "记得小明刚学会走路的那天，就在咱们老院子里，他跌跌撞撞地追着那只大公鸡跑，把我逗得不行。一晃这么多年，儿子都工作了。",
        type: "text",
        createdAt: "2025-10-15T08:00:00Z",
        likes: 5
    },
    {
        id: 102,
        familyMemberId: 2,
        authorId: 1,
        authorName: "陈小明",
        authorRole: "孙子",
        authorAvatar: "/demo-avatars/son.png",
        content: "爷爷最爱喝的龙井，每次放假回去都要陪他在葡萄架下喝上半天。这是爷爷当年的军功章，一直珍藏在大木盒子里。",
        type: "text",
        createdAt: "2025-08-20T14:30:00Z",
        mediaUrl: "https://images.unsplash.com/photo-1544943971-d832a74c7ce3?q=80&w=600&auto=format&fit=crop",
        likes: 12
    },
    {
        id: 103,
        familyMemberId: 4,
        authorId: 3,
        authorName: "李阿婆",
        authorRole: "奶奶",
        authorAvatar: "/demo-avatars/grandma.png",
        content: "建国小时候最调皮，有次还把家里的瓦罐打碎了。不过他人实诚，书读得好，后来当了老师也让我们脸上有光。",
        type: "text",
        createdAt: "2025-05-12T10:00:00Z",
        likes: 8
    },
    {
        id: 104,
        familyMemberId: 8,
        authorId: 4,
        authorName: "陈建国",
        authorRole: "父亲",
        authorAvatar: "/demo-avatars/papa.png",
        content: "小刚这几年带着大伙儿搞特色农业，吃了不少苦，但也真干出了名堂。作为父亲，我为你骄傲。希望你保重身体。",
        type: "text",
        createdAt: "2026-01-10T09:00:00Z",
        likes: 15
    },
    {
        id: 105,
        familyMemberId: 3,
        authorId: 8,
        authorName: "陈小刚",
        authorRole: "长孙",
        authorAvatar: "/demo-avatars/brother.png",
        content: "奶奶亲手给我绣的这副挂屏，我一直挂在办公室。每次觉得累了，看一眼这些针脚，就觉得心里踏实，这可是咱们陈家的手艺。",
        type: "text",
        createdAt: "2026-02-15T16:20:00Z",
        likes: 20
    },
    {
        id: 106,
        familyMemberId: 5,
        authorId: 1,
        authorName: "陈小明",
        authorRole: "儿子",
        authorAvatar: "/demo-avatars/son.png",
        content: "妈妈做的油焖笋永远是我的最爱！之前去上海带了好几罐。家里的味，在外面怎么都吃不够。",
        type: "text",
        createdAt: "2026-03-01T18:45:00Z",
        likes: 10
    }
];


/**
 * 演示模式下的默认用户信息（陈建国）
 */
export const DEMO_DEFAULT_USER = {
    name: "游客",
    relationship: "本人",
    avatar: "",
    memberId: 0,
    standardRole: "visitor",
    bio: "登录以开启您的家族记忆。",
    birthday: "",
    familyId: "demo",
    isRegistered: false,
};

/**
 * 可切换的演示角色列表
 */
export const DEMO_PERSONAS: any[] = [
    { 
        id: 1, 
        name: "陈小明", 
        relationship: "本人", 
        avatar: "/demo-avatars/son.png", 
        memberId: 1, 
        familyId: "demo",
        standardRole: "me",
        bio: "陈家长孙，目前在上海工作，喜欢摄影和记录家族故事。"
    },
    { 
        id: 4, 
        name: "陈建国", 
        relationship: "爸爸", 
        avatar: "/demo-avatars/papa.png", 
        memberId: 4, 
        familyId: "demo",
        standardRole: "father",
        bio: "陈家长子，退休教师，对家乡的历史非常有研究。"
    },
    { 
        id: 2, 
        name: "陈大平", 
        relationship: "爷爷", 
        avatar: "/demo-avatars/grandpa.png", 
        memberId: 2, 
        familyId: "demo",
        standardRole: "grandfather",
        bio: "陈家大家长，抗美援朝老兵，最喜欢在院子里讲当年的故事。"
    },
    { 
        id: 3, 
        name: "李阿婆", 
        relationship: "奶奶", 
        avatar: "/demo-avatars/grandma.png", 
        memberId: 3, 
        familyId: "demo",
        standardRole: "grandmother",
        bio: "慈祥的奶奶，年轻时曾是当地有名的绣娘，现在依然眼明手快。"
    },
    { 
        id: 8, 
        name: "陈小刚", 
        relationship: "哥哥", 
        avatar: "/demo-avatars/brother.png", 
        memberId: 8, 
        familyId: "demo",
        standardRole: "brother",
        bio: "小明的大哥，性格稳重，目前在老家经营一家特色农业合作社。"
    }
];

/**
 * 判断当前用户是否为演示模式
 */
export function isDemoMode(currentUser: any): boolean {
    if (!currentUser) return true;
    if (currentUser.familyId === "demo") return true;
    if (!currentUser.isRegistered) return true;
    // 核心修复：只要有有效的 familyId 且不为 'demo'，就绝对不进入 Demo 模式
    // 不再使用 parseInt，以兼容 UUID 和其他字符串格式的 ID
    if (currentUser.familyId && currentUser.familyId !== "demo") return false;
    return true;
}
