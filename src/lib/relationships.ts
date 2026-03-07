/**
 * 家族关系辅助库
 * 提供关系选项、角色推断和称谓相对化功能
 */

// NOTE: 标准角色对应的中文显示名
export const STANDARD_ROLE_LABELS: Record<string, string> = {
    self: "本人",
    father: "父亲",
    mother: "母亲",
    grandfather_paternal: "爷爷",
    grandmother_paternal: "奶奶",
    grandfather_maternal: "外公",
    grandmother_maternal: "外婆",
    great_great_grandfather: "高祖父",
    great_great_grandmother: "高祖母",
    great_grandfather: "曾祖父",
    great_grandmother: "曾祖母",
    son: "儿子",
    daughter: "女儿",
    brother: "哥哥/弟弟",
    sister: "姐姐/妹妹",
    uncle_paternal: "叔叔/伯伯",
    aunt_paternal: "姑姑",
    uncle_maternal: "舅舅",
    aunt_maternal: "阿姨",
    husband: "丈夫",
    wife: "妻子",
    grand_uncle_paternal: "叔公/伯公",
    grand_aunt_paternal: "姑婆/婶婆",
    grand_uncle_maternal: "舅公/外叔公",
    grand_aunt_maternal: "姨婆/妗婆",
    grandson: "孙子",
    granddaughter: "孙女",
    nephew: "侄子/外甥",
    niece: "侄女/外甥女",
    cousin: "表亲/亲系",
    family: "家人",
};

// NOTE: 用于 AddMemberPage 选择关系时的选项列表
export const RELATIONSHIP_OPTIONS = [
    { value: "grandfather_paternal", label: "爷爷" },
    { value: "grandmother_paternal", label: "奶奶" },
    { value: "grandfather_maternal", label: "外公" },
    { value: "grandmother_maternal", label: "外婆" },
    { value: "great_grandfather", label: "曾祖/外曾祖" },
    { value: "great_great_grandfather", label: "高祖" },
    { value: "grand_uncle_paternal", label: "叔公/伯公" },
    { value: "grand_aunt_paternal", label: "姑婆/婶婆" },
    { value: "grand_uncle_maternal", label: "舅公/姨公" },
    { value: "grand_aunt_maternal", label: "姨婆/妗婆" },
    { value: "father", label: "父亲" },
    { value: "mother", label: "母亲" },
    { value: "husband", label: "丈夫" },
    { value: "wife", label: "妻子" },
    { value: "older_brother", label: "哥哥" },
    { value: "younger_brother", label: "弟弟" },
    { value: "older_sister", label: "姐姐" },
    { value: "younger_sister", label: "妹妹" },
    { value: "uncle_paternal", label: "叔叔/伯伯" },
    { value: "婶婶", label: "婶婶/伯母" },
    { value: "aunt_paternal", label: "姑姑" },
    { value: "姑父", label: "姑父/姑丈" },
    { value: "uncle_maternal", label: "舅舅" },
    { value: "舅妈", label: "舅妈/妗子" },
    { value: "aunt_maternal", label: "阿姨" },
    { value: "姨父", label: "姨父/姨丈" },
    { value: "son", label: "儿子" },
    { value: "daughter", label: "女儿" },
    { value: "nephew", label: "侄子/外甥" },
    { value: "niece", label: "侄女/外甥女" },
    { value: "grandson", label: "孙子/外孙" },
    { value: "granddaughter", label: "孙女/外孙女" },
    { value: "cousin", label: "堂亲/表亲" },
    { value: "family", label: "其他家人" },
    { value: "pet", label: "宠物/毛孩子" },
];

/** 统一性别判断逻辑 */
export function isFemale(node: any): boolean {
    if (!node) return false;
    const g = (node.gender || "").toString().toLowerCase().trim();
    if (g === "female" || g === "女") return true;
    if (g === "male" || g === "男") return false;

    const rawR = (node.relationship || "").trim();
    const name = (node.name || "").trim();
    const femaleKeywords = ["阿姨", "姑姑", "母", "妈", "娘", "奶", "婆", "姐", "妹", "嫂", "侄女", "外甥女", "表姐", "表妹", "堂姐", "堂妹", "内侄女", "女"];
    if (femaleKeywords.some(word => rawR.includes(word))) return true;

    // 特殊处理：如果是“侄/外甥/孙”且备注中有女/姐/妹字
    if (["侄", "外甥", "孙"].some(k => rawR.includes(k))) {
        if (["女", "妹", "姐"].some(k => rawR.includes(k))) return true;
    }

    return femaleKeywords.some(word => name.includes(word));
}

/**
 * 清理排行前缀 (大, 二, 十一, 十二... 小, 老等)，还原为基础称谓
 * 支持无限排行 (1-99+)
 */
export function getCleanRelationship(rel: string): string {
    const specialTwoWords = ["大伯", "大爷", "大妈", "大娘", "老爸", "老妈", "老婆", "老公"];
    let clean = (rel || "").trim();
    if (!clean || specialTwoWords.includes(clean)) return clean;

    // 匹配中文数字排行前缀 (支持口语化：排行老三、细妹、幺儿等)
    const rankRegex = /^(大|小|老|一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|排行|排行老|细|幺)+/;
    const match = clean.match(rankRegex);

    if (match && clean.length > match[0].length) {
        return clean.substring(match[0].length);
    }

    // 移除手动分流打标
    const tags = ["(母家)", "(父家)", "(母系)", "(父系)", "(亲生)", "(堂)", "(表)", "(血亲)", "(姻亲)"];
    tags.forEach(t => {
        clean = clean.split(t).join("");
    });

    return clean;
}

/**
 * 根据关系字符串推断标准角色标识
 */
export function deduceRole(relationship: string): string {
    const raw = (relationship || "").trim();
    const clean = getCleanRelationship(relationship);
    if (!clean) return "family";

    // 逻辑 A: 特殊处理带排行的“爸”（闽系中二爸、三爸均为叔伯）
    // 只有“数字/排行+爸”才判定为叔伯，防止“亲爸”误判。老爸、爸爸是亲爹。
    if (clean === "爸" && /^(大|二|三|四|五|六|七|八|九|十|小|一|第)/.test(raw)) {
        const exclusions = ["老爸", "阿爸", "亲爸", "爸爸", "父亲"];
        if (!exclusions.some(exc => raw.includes(exc))) return "uncle_paternal";
    }

    const map: Record<string, string> = {
        "老爸": "father",
        "亲爸": "father",
        "爸爸": "father",
        "父亲": "father",
        "阿爸": "father",
        "亚爸": "father",
        "爸": "father",
        "老妈": "mother",
        "亲妈": "mother",
        "妈妈": "mother",
        "母亲": "mother",
        "阿妈": "mother",
        "妈": "mother",
        "高祖父": "great_great_grandfather",
        "高祖母": "great_great_grandmother",
        "曾祖父": "great_grandfather",
        "曾祖母": "great_grandmother",
        "外曾祖父": "great_grandfather",
        "外曾祖母": "great_grandmother",
        "爷爷": "grandfather_paternal",
        "奶奶": "grandmother_paternal",
        "外公": "grandfather_maternal",
        "姥爷": "grandfather_maternal",
        "外婆": "grandmother_maternal",
        "姥姥": "grandmother_maternal",
        "外妈": "grandmother_maternal",
        "伯公": "grand_uncle_paternal",
        "伯婆": "grand_aunt_paternal", // 伯公妻
        "姆婆": "grand_aunt_paternal", // 伯公妻
        "叔公": "grand_uncle_paternal",
        "叔婆": "grand_aunt_paternal", // 叔公妻
        "伯爷": "grand_uncle_paternal",
        "叔爷": "grand_uncle_paternal",
        "婶婆": "grand_aunt_paternal", // 叔公妻
        "姑婆": "grand_aunt_paternal",
        "姑丈公": "grand_uncle_paternal", // 姑婆夫
        "姑公": "grand_uncle_paternal", // 姑婆夫
        "舅公": "grand_uncle_maternal",
        "妗婆": "grand_aunt_maternal", // 舅公妻
        "姨婆": "grand_aunt_maternal",
        "姨丈公": "grand_uncle_maternal", // 姨婆夫
        "姨公": "grand_uncle_maternal", // 姨婆夫
        "舅婆": "grand_aunt_maternal", // 舅公妻
        "阿公": "grandfather_paternal",
        "亚公": "grandfather_paternal",
        "阿嬷": "grandmother_paternal",
        "外嬷": "grandmother_maternal",
        "大家官": "grandfather_paternal",
        "大家": "grandmother_paternal",
        "家官": "grandfather_paternal", // 闽系儿媳对公公称呼
        "家婆": "grandmother_paternal", // 闽系儿媳对婆婆称呼
        "舅太": "great_grand_uncle_maternal",
        "姑太": "great_grand_aunt_paternal",
        "嗣子": "son",
        "祧子": "son",
        "大伯": "uncle_paternal",
        "小叔": "uncle_paternal",
        "叔叔": "uncle_paternal",
        "伯伯": "uncle_paternal",
        "叔": "uncle_paternal",
        "伯": "uncle_paternal",
        "亚叔": "uncle_paternal",
        "亚伯": "uncle_paternal",
        "大爷": "uncle_paternal",
        "儿媳": "daughter",
        "新妇": "daughter",
        "女婿": "son",
        "囝婿": "son",
        "公公": "grandfather_paternal",
        "婆婆": "grandmother_paternal",
        "岳父": "grandfather_maternal",
        "外丈": "grandfather_maternal",
        "外丈公": "grandfather_maternal",
        "岳母": "grandmother_maternal",
        "外姆": "grandmother_maternal",
        "大舅子": "uncle_maternal",
        "小舅子": "uncle_maternal",
        "舅子": "uncle_maternal",
        "內兄": "brother",
        "內弟": "brother",
        "大姑": "aunt_paternal",
        "小姑": "aunt_paternal",
        "大姨子": "aunt_maternal",
        "小姨子": "aunt_maternal",
        "姨子": "aunt_maternal",
        "丈夫": "husband",
        "妻子": "wife",
        "老婆": "wife",
        "老公": "husband",
        "兄弟": "brother",
        "大伯子": "brother",
        "小叔子": "brother",
        "阿兄": "brother",
        "大姑子": "sister",
        "小姑子": "sister",
        "姑奶": "sister",
        "姑妹": "sister",
        "妯娌": "sister",
        "连襟": "brother",
        "担儿挑": "brother",
        "襟兄弟": "brother",
        "哥哥": "brother",
        "哥": "brother",
        "弟弟": "brother",
        "弟": "brother",
        "姐": "sister",
        "姐姐": "sister",
        "妹妹": "sister",
        "妹": "sister",
        "姐妹": "sister",
        "姑姑": "aunt_paternal",
        "姑妈": "aunt_paternal",
        "姑姐": "aunt_paternal",
        "姑": "aunt_paternal",
        "亚姑": "aunt_paternal",
        "舅舅": "uncle_maternal",
        "舅": "uncle_maternal",
        "亚舅": "uncle_maternal",
        "阿姨": "aunt_maternal",
        "妗": "aunt_maternal",
        "舅姆": "aunt_maternal",
        "婶婶": "aunt_paternal",
        "伯母": "aunt_paternal",
        "姨妈": "aunt_maternal",
        "小姨": "aunt_maternal",
        "伯姆": "aunt_paternal",
        "婶": "aunt_paternal",
        "姑父": "uncle_paternal",
        "姑丈": "uncle_paternal",
        "姨父": "uncle_maternal",
        "姨丈": "uncle_maternal",
        "堂舅": "uncle_maternal",
        "堂姨": "aunt_maternal",
        "亲兄": "cousin",
        "亲弟": "cousin",
        "亲姐": "cousin",
        "亲妹": "cousin",
        "亲伯": "cousin",
        "亲叔": "cousin",
        "亲姑": "cousin",
        "头房": "cousin",
        "太爷": "great_grandfather",
        "太奶": "great_grandmother",
        "堂伯": "cousin",
        "堂叔": "cousin",
        "堂哥": "cousin",
        "堂弟": "cousin",
        "堂姐": "cousin",
        "堂妹": "cousin",
        "堂侄": "nephew",
        "堂侄女": "niece",
        "亲侄": "nephew",
        "亲外甥": "nephew",
        "表叔": "cousin",
        "表姑": "cousin",
        "表伯": "cousin",
        "表哥": "cousin",
        "表弟": "cousin",
        "表姐": "cousin",
        "表妹": "cousin",
        "表侄": "nephew",
        "表侄女": "niece",
        "表外甥": "nephew",
        "表外甥女": "niece",
        "儿": "son",
        "儿子": "son",
        "女儿": "daughter",
        "孙子": "grandson",
        "孙女": "granddaughter",
        "外孙": "grandson",
        "外孙子": "grandson",
        "外孙女": "granddaughter",
        "曾孙": "grandson",
        "曾孙女": "granddaughter",
        "外曾孙": "grandson",
        "侄子": "nephew",
        "外甥": "nephew",
        "姨甥": "nephew",
        "甥": "nephew",
        "侄女": "niece",
        "外甥女": "niece",
        "姨甥女": "niece",
        "甥女": "niece",
        "内侄": "nephew",
        "内侄女": "niece",
    };
    return map[clean] || "family";
}

// --- 性能与缓存优化 (文化策略模式 & 递归缓存) ---
export interface DialectConfig {
    name: "standard" | "hokkien" | "cantonese";
}

export interface KinshipContext {
    membersMap: Map<number, any>;
    memo: Map<string, string>;
    dialect: DialectConfig;
}

const engineCache = new WeakMap<any[], KinshipContext>();

export function getKinshipContext(members: any[]): KinshipContext {
    if (engineCache.has(members)) return engineCache.get(members)!;

    const membersMap = new Map<number, any>();
    for (const m of members) {
        // 数据规范化 (Schema Normalization)
        membersMap.set(Number(m.id), {
            ...m,
            fatherId: m.fatherId || m.father_id,
            motherId: m.motherId || m.mother_id,
            birthDate: m.birthDate || m.birth_date,
            id: Number(m.id)
        });
    }

    const ctx: KinshipContext = {
        membersMap,
        memo: new Map(),
        dialect: { name: "hokkien" }
    };
    engineCache.set(members, ctx);
    return ctx;
}

/**
 * 核心：获取一个人的父母 ID 集合
 */
function getParentIds(nodeId: any, members: any[]) {
    const ctx = getKinshipContext(members);
    const node = ctx.membersMap.get(Number(nodeId));
    if (!node) return { fId: null, mId: null };
    return { fId: node.fatherId, mId: node.motherId };
}

/**
 * 核心：判断是否为宗亲（同姓且同宗）
 */
/**
 * 核心优化：判定是否为宗亲（父系同宗）
 * 增加方位校验，防止同姓的母系外戚被误判为宗亲
 */
export function isClan(vNode: any, tNode: any, currentSide?: 'paternal' | 'maternal'): boolean {
    if (!vNode || !tNode) return false;

    // 名分锁优先：如果在创建档案时已经打上了母系的永久烙印，绝对不是宗亲
    if (tNode.originSide === 'maternal' || tNode.origin_side === 'maternal') return false;

    // 如果已经明确选择了母系方位，即便同姓，也不属于“宗亲”
    if (currentSide === 'maternal') return false;

    // 原有逻辑：同姓且同房头，或默认同姓同宗
    if (vNode.surname && tNode.surname && vNode.surname === tNode.surname) {
        if (vNode.ancestralHall && tNode.ancestralHall) {
            return vNode.ancestralHall === tNode.ancestralHall;
        }
        return true;
    }

    // 备选逻辑：如果明确打上了父系烙印且方位正确，优先信任
    if (tNode.originSide === 'paternal' || tNode.origin_side === 'paternal') {
        // 核心修正：即便姓氏不同，只要在档案建立时选择了“父系方位”，就应视为宗亲
        return true;
    }

    return false;
}

/**
 * 根据生日及房头计算排行前缀 (大, 二, 三, 小)
 */
function getRankPrefix(targetNode: any, members: any[]) {
    // --- 逻辑 A：名分优先 (针对“二爸”、“老小姨”) ---
    const rawRemark = (targetNode.relationship || "").trim();
    const explicitRankMatch = rawRemark.match(/^(大|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|小|老|排行老|细|幺)/);
    if (explicitRankMatch) {
        let rank = explicitRankMatch[0];
        // 归一化处理：如果包含“排行老”，提取最后的数字/称呼
        if (rank.startsWith("排行老")) rank = rank.substring(3);
        else if (rank.startsWith("排行")) rank = rank.substring(2);
        return rank;
    }

    // --- 逻辑 B：生物学排序 (修正：防止缺失代数导致的全员大排行) ---
    const targetId = Number(targetNode.id);
    const targetGen = targetNode.generationNum;
    const targetHall = targetNode.ancestralHall;

    // 如果没有代数信息，严禁全局排行，只在亲兄弟姐妹间排行
    if (targetGen === undefined || targetGen === null) {
        const strictSibs = members.filter(m =>
            m.gender === targetNode.gender &&
            ((targetNode.fatherId && m.fatherId === targetNode.fatherId) || (targetNode.motherId && m.motherId === targetNode.motherId))
        );
        if (strictSibs.length <= 1) return "";
        const sorted = [...strictSibs].sort((a, b) => (a.birthDate || "9999").localeCompare(b.birthDate || "9999"));
        const index = sorted.findIndex(s => Number(s.id) === targetId);
        return index !== -1 ? ["", "大", "二", "三", "四", "五", "六"][index + 1] || "" : "";
    }

    const sibs = members.filter((m: any) => {
        if (m.memberType === 'pet' || m.type === 'pet') return false;
        return m.generationNum === targetGen &&
            m.ancestralHall === targetHall &&
            m.gender === targetNode.gender;
    });

    if (sibs.length <= 1) return "";

    const sorted = [...sibs].sort((a, b) => {
        const da = a.birthDate || a.birth_date || "9999-99-99";
        const db = b.birthDate || b.birth_date || "9999-99-99";
        return da.localeCompare(db);
    });

    const index = sorted.findIndex(s => Number(s.id) === targetId);
    if (index === -1) return "";

    // 针对末位的特殊处理
    if (index === sorted.length - 1 && sorted.length > 2) return "老";

    const chineseNumbers = ["", "大", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五"];
    return chineseNumbers[index + 1] || "";
}

/**
 * 严谨的家族关系推导函数 (核心缓存外壳)
 */
export function getRigorousRelationship(
    viewer: any,
    target: any,
    members: any[],
    depth: number = 0
): string {
    const ctx = getKinshipContext(members);
    let vId = viewer?.memberId ? Number(viewer.memberId) : (viewer?.id ? Number(viewer.id) : null);
    const tId = target?.id ? Number(target.id) : null;

    if (vId && !ctx.membersMap.has(vId)) {
        const boundMember = Array.from(ctx.membersMap.values()).find(m => Number(m.userId) === vId);
        if (boundMember) vId = Number(boundMember.id);
    }

    if (tId === null || vId === null) return target?.relationship || "家人";

    const cacheKey = `${vId}_${tId}_${depth}`;
    if (ctx.memo.has(cacheKey)) return ctx.memo.get(cacheKey)!;

    const result = computeRigorousRelationship(viewer, target, members, depth, ctx, vId as number, tId as number);
    ctx.memo.set(cacheKey, result);
    return result;
}

function computeRigorousRelationship(
    viewer: any,
    target: any,
    members: any[],
    depth: number,
    ctx: KinshipContext,
    vId: number,
    tId: number
): string {
    try {
        if (depth > 2) return target?.relationship || "家人";
        if (vId === tId) return "我";

        const vNode = ctx.membersMap.get(vId);
        const tNode = ctx.membersMap.get(tId);
        if (!vNode || !tNode) return target?.relationship || "家人";

        // --- 【关键修正点】物种隔离拦截器 ---
        const isPet = tNode.memberType === 'pet' ||
            tNode.type === 'pet' ||
            tNode.standardRole === 'pet' ||
            tNode.relationship === '宠物';

        if (isPet) {
            // 找到主人的逻辑：优先找 fatherId（挂载在谁名下），没有则找创建者
            const ownerId = tNode.fatherId || tNode.createdByMemberId;
            const owner = members.find(m => Number(m.id) === Number(ownerId));

            // 场景 A：我是主人
            if (vId && owner && Number(owner.id) === vId) {
                const petSuffix = tNode.gender === 'female' ? "毛女儿" : "毛儿子";
                // 显示：旺财 (毛儿子)
                return tNode.name ? `${tNode.name} (${petSuffix})` : petSuffix;
            }

            // 场景 B：别人是主人（二爸家的旺财）
            if (owner) {
                // 递归计算我叫主人什么
                const ownerTitle = getRigorousRelationship(vNode, owner, members, depth + 1);
                const cleanOwnerTitle = getCleanRelationship(ownerTitle);
                // 显示：二爸家的旺财 或 堂姐家的宝贝
                return `${cleanOwnerTitle}家的${tNode.name || '宝贝'}`;
            }

            return tNode.name || "家族萌宠";
        }

        // --- 严谨比对辅助函数 ---
        const eq = (a: any, b: any) => a && b && Number(a) === Number(b);

        // --- 闽系核心：昭穆（代数）判定逻辑 ---
        const vGen = vNode.generationNum ?? vNode.generation_num ?? 0;
        const tGen = tNode.generationNum ?? tNode.generation_num ?? 0;

        if (true) {
            const genDiff = vGen - tGen; // V相对于T的代差

            // 如果是同代 (0: 同辈)
            if (genDiff === 0 && !eq(vId, tId)) {
                const isRealSibling = (vNode.fatherId && eq(vNode.fatherId, tNode.fatherId)) ||
                    (vNode.motherId && eq(vNode.motherId, tNode.motherId));

                // 物理支脉判定：如果没有姓氏房头，但能溯源到共同爷爷，强行定性为“堂”
                const getFId = (id: any) => ctx.membersMap.get(Number(id))?.fatherId;
                const vGFId = getFId(vNode.fatherId);
                const tGFId = getFId(tNode.fatherId);
                const isPaternalCousin = vGFId && tGFId && eq(vGFId, tGFId);

                const tTag = tNode.logicTag || tNode.logic_tag || "";
                // 只要标记了 [M]，强制判定为非宗亲，从而触发“舅/姨/表”系的称谓生成
                const isClanResult = tTag.includes('[M]') ? false : isClan(vNode, tNode);
                const clan = isClanResult || isPaternalCousin;
                const prefix = getRankPrefix(tNode, members);

                if (isRealSibling) {
                    const vDate = vNode.birthDate || vNode.birth_date || "9999-99-99";
                    const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
                    let isOlder = tDate < vDate;

                    if (vDate === tDate) {
                        const rel = tNode.relationship || "";
                        if (rel.includes("哥") || rel.includes("姐") || rel.includes("兄")) isOlder = true;
                        if (rel.includes("弟") || rel.includes("妹")) isOlder = false;
                    }

                    if (tNode.gender === "female") {
                        return isOlder ? "姐姐" : "妹妹";
                    } else {
                        return isOlder ? "哥哥" : "弟弟";
                    }
                }
                if (clan) {
                    const vDate = vNode.birthDate || vNode.birth_date || "9999-99-99";
                    const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
                    let isOlder = tDate < vDate;

                    if (vDate === tDate) {
                        const rel = tNode.relationship || "";
                        if (rel.includes("哥") || rel.includes("姐") || rel.includes("兄")) isOlder = true;
                        if (rel.includes("弟") || rel.includes("妹")) isOlder = false;
                    }

                    if (tNode.gender === "female") {
                        return isOlder ? `${prefix}堂姐` : `${prefix}堂妹`;
                    } else {
                        return isOlder ? `${prefix}堂哥` : `${prefix}堂弟`;
                    }
                } else {
                    const vDate = vNode.birthDate || vNode.birth_date || "9999-99-99";
                    const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
                    let isOlder = tDate < vDate;

                    if (vDate === tDate) {
                        const rel = tNode.relationship || "";
                        if (rel.includes("哥") || rel.includes("姐") || rel.includes("兄")) isOlder = true;
                        if (rel.includes("弟") || rel.includes("妹")) isOlder = false;
                    }

                    if (tNode.gender === "female") {
                        return isOlder ? `${prefix}表姐` : `${prefix}表妹`;
                    } else {
                        return isOlder ? `${prefix}表哥` : `${prefix}表弟`;
                    }
                }
            }

            // 如果长一辈 (1: 对象是我的长辈)
            if (genDiff === 1) {
                const tTag = tNode.logicTag || tNode.logic_tag || "";
                const clan = tTag.includes('[M]') ? false : isClan(vNode, tNode);
                const prefix = getRankPrefix(tNode, members);
                const getFId = (id: any) => members.find(m => eq(m.id, id))?.fatherId;
                const vfId = vNode.fatherId;
                const isRealFatherSibling = vfId && tNode.fatherId && eq(getFId(vfId), tNode.fatherId);

                // DEBUG LOG
                if (vNode.name.includes("K") || tNode.name.includes("阿妹")) {
                    console.log(`[DEBUG:REL] ${vNode.name} -> ${tNode.name}: isFemale=${isFemale(tNode)}, genDiff=${genDiff}`);
                }

                if (clan) {
                    if (isRealFatherSibling) {
                        if (isFemale(tNode)) return `${prefix}姑姑`;
                        const fNode = members.find(m => eq(m.id, vfId));
                        const fDate = fNode?.birthDate || fNode?.birth_date || "9999-99-99";
                        const tDate = tNode?.birthDate || tNode?.birth_date || "9999-99-99";
                        return tDate < fDate ? `${prefix}伯伯` : `${prefix}叔叔`;
                    } else {
                        return isFemale(tNode) ? `${prefix}堂姑` : `${prefix}堂叔`;
                    }
                } else {
                    return isFemale(tNode) ? `${prefix}姨妈` : `${prefix}舅舅`;
                }
            }

            if (genDiff === 2) {
                const clan = isClan(vNode, tNode);
                const prefix = getRankPrefix(tNode, members);
                if (clan) return isFemale(tNode) ? `${prefix}姑婆` : `${prefix}叔公/伯公`;
                return isFemale(tNode) ? `${prefix}姨婆` : `${prefix}舅公`;
            }

            if (genDiff === -1) {
                const clan = isClan(vNode, tNode);
                const prefix = getRankPrefix(tNode, members);
                if (clan) return isFemale(tNode) ? `${prefix}堂侄女` : `${prefix}堂侄子`;
                return isFemale(tNode) ? `${prefix}表外甥女` : `${prefix}表外甥`;
            }

            if (genDiff === -2) {
                const clan = isClan(vNode, tNode);
                const prefix = getRankPrefix(tNode, members);
                if (clan) return isFemale(tNode) ? `${prefix}堂侄孙女` : `${prefix}堂侄孙`;
                return isFemale(tNode) ? `${prefix}表外甥孙女` : `${prefix}表外甥孙`;
            }
        }

        // 1. 直系父子
        if (eq(tId, vNode.fatherId)) return "爸爸";
        if (eq(tId, vNode.motherId)) return "妈妈";

        // 2. 直系子女
        if (eq(vId, tNode.fatherId) || eq(vId, tNode.motherId)) {
            return isFemale(tNode) ? "女儿" : "儿子";
        }

        // 3. 兄弟姐妹 (备用，如果代数缺失)
        if ((vNode.fatherId && eq(vNode.fatherId, tNode.fatherId)) ||
            (vNode.motherId && eq(vNode.motherId, tNode.motherId))) {
            return isFemale(tNode) ? "姐/妹" : "哥/弟";
        }

        // 4. 祖孙 (向上两代)
        const { fId: vf, mId: vm } = getParentIds(vId, members);
        if (vf) {
            const { fId: vff, mId: vfm } = getParentIds(vf, members);
            if (eq(tId, vff)) return "爷爷";
            if (eq(tId, vfm)) return "奶奶";
        }
        if (vm) {
            const { fId: vmf, mId: vmm } = getParentIds(vm, members);
            if (eq(tId, vmf)) return "外公";
            if (eq(tId, vmm)) return "外婆";
        }

        // 5. 孙辈 (向下两代)
        const { fId: tf, mId: tm } = getParentIds(tId, members);
        if (tf) {
            const { fId: tff, mId: tfm } = getParentIds(tf, members);
            if (eq(tff, vId) || eq(tfm, vId)) return isFemale(tNode) ? "孙女" : "孙子";
        }
        if (tm) {
            const { fId: tmf, mId: tmm } = getParentIds(tm, members);
            if (eq(tmf, vId) || eq(tmm, vId)) return isFemale(tNode) ? "外孙女" : "外孙子";
        }

        // 6. 配偶 (基于共同子女推断)
        const vIsSpouse = members.some(child =>
            (eq(child.fatherId, vId) && eq(child.motherId, tId)) ||
            (eq(child.motherId, vId) && eq(child.fatherId, tId))
        );
        if (vIsSpouse) return isFemale(tNode) ? "妻子" : "丈夫";

        // 7. 舅舅/阿姨/叔叔/姑姑 (父母的兄弟姐妹 - 带排行)
        if (vf) {
            const { fId: vff, mId: vfm } = getParentIds(vf, members);
            const fSiblings = members.filter(m => (vff && eq(m.fatherId, vff)) || (vfm && eq(m.motherId, vfm)));
            if (fSiblings.some(s => eq(s.id, tId))) {
                if (isFemale(tNode)) return "姑姑";
                const fNode = members.find(m => eq(m.id, vf));
                const fDate = fNode?.birthDate || fNode?.birth_date || "9999-99-99";
                const tDate = tNode?.birthDate || tNode?.birth_date || "9999-99-99";
                if (fDate && tDate) {
                    return tDate < fDate ? "伯伯" : "叔叔";
                }
                return "叔伯";
            }
        }
        if (vm) {
            const { fId: vmf, mId: vmm } = getParentIds(vm, members);
            const mSiblings = members.filter(m => (vmf && eq(m.fatherId, vmf)) || (vmm && eq(m.motherId, vmm)));
            if (mSiblings.some(s => eq(s.id, tId))) {
                return isFemale(tNode) ? "阿姨" : "舅舅";
            }
        }

        // 8. 侄子/外甥 (兄弟姐妹的孩子)
        const mySiblings = members.filter(m =>
            !eq(m.id, vId) &&
            ((vNode.fatherId && eq(m.fatherId, vNode.fatherId)) || (vNode.motherId && eq(m.motherId, vNode.motherId)))
        );
        if (mySiblings.some(s => eq(tNode.fatherId, s.id) || eq(tNode.motherId, s.id))) {
            const clan = isClan(vNode, tNode);
            return clan ? (isFemale(tNode) ? "亲侄女" : "亲侄子") : (isFemale(tNode) ? "外甥女" : "外甥");
        }

        // --- 映射常量 ---
        const inverseMap: Record<string, { male: string; female: string }> = {
            "儿子": { male: "爸爸", female: "妈妈" },
            "女儿": { male: "爸爸", female: "妈妈" },
            "爸爸": { male: "儿子", female: "女儿" },
            "妈妈": { male: "儿子", female: "女儿" },
            "亲侄": { male: "亲伯/叔", female: "亲姑/婶" },
            "亲外甥": { male: "舅舅", female: "阿姨" },
            "侄子": { male: "伯伯/叔叔", female: "姑姑" },
            "外甥": { male: "舅舅/姨丈", female: "阿姨/舅妈" },
            "侄女": { male: "伯伯/叔叔", female: "姑姑" },
            "外甥女": { male: "舅舅/姨丈", female: "阿姨/舅妈" },
            "内侄": { male: "姑丈", female: "姑姑" },
            "内侄女": { male: "姑丈", female: "姑姑" },
            "孙子": { male: "爷爷/外公", female: "奶奶/外婆" },
            "孙女": { male: "爷爷/外公", female: "奶奶/外婆" },
            "曾孙": { male: "曾祖/外曾祖", female: "曾祖/外曾祖" },
            "爷爷": { male: "孙子", female: "孙女" },
            "奶奶": { male: "孙子", female: "孙女" },
            "外公": { male: "外孙", female: "外孙女" },
            "外婆": { male: "外孙", female: "外孙女" },
            "公公": { male: "儿媳", female: "儿媳" },
            "婆婆": { male: "儿媳", female: "儿媳" },
            "岳父": { male: "女婿", female: "女婿" },
            "岳母": { male: "女婿", female: "女婿" },
            "丈夫": { male: "丈夫", female: "妻子" },
            "妻子": { male: "丈夫", female: "妻子" },
            "哥哥": { male: "弟弟", female: "妹妹" },
            "弟弟": { male: "哥哥", female: "姐姐" },
            "姐姐": { male: "弟弟", female: "妹妹" },
            "妹妹": { male: "哥哥", female: "姐姐" },
            "哥": { male: "弟弟", female: "妹妹" },
            "弟": { male: "哥哥", female: "姐姐" },
            "姐": { male: "弟弟", female: "妹妹" },
            "妹": { male: "哥哥", female: "姐姐" },
            "表哥": { male: "表弟", female: "表妹" },
            "表弟": { male: "表哥", female: "表姐" },
            "表姐": { male: "表弟", female: "表妹" },
            "表妹": { male: "表哥", female: "表姐" },
            "堂哥": { male: "堂弟", female: "堂妹" },
            "堂弟": { male: "堂哥", female: "堂姐" },
            "堂姐": { male: "堂弟", female: "堂妹" },
            "堂妹": { male: "堂哥", female: "堂姐" },
            "大伯": { male: "侄子", female: "侄女" },
            "叔叔": { male: "侄子", female: "侄女" },
            "伯伯": { male: "侄子", female: "侄女" },
            "姑姑": { male: "内侄", female: "内侄女" },
            "舅舅": { male: "外甥", female: "外甥女" },
            "阿姨": { male: "外甥", female: "外甥女" },
            "姨妈": { male: "外甥", female: "外甥女" },
            "表伯": { male: "表侄子", female: "表侄女" },
            "表叔": { male: "表侄子", female: "表侄女" },
            "表姑": { male: "表侄子", female: "表侄女" },
            "表阿姨": { male: "表外甥", female: "表外甥女" },
            "表姨": { male: "表外甥", female: "表外甥女" },
            "表舅": { male: "表外甥", female: "表外甥女" },
            "堂阿姨": { male: "堂外甥", female: "堂外甥女" },
            "堂舅": { male: "堂外甥", female: "堂外甥女" },
            "表外甥": { male: "表舅", female: "表姨" },
            "表外甥女": { male: "表舅", female: "表姨" },
            "堂外甥": { male: "堂舅", female: "堂姨" },
            "堂外甥女": { male: "堂舅", female: "堂姨" },
            "表侄": { male: "表伯/表叔", female: "表姑" },
            "表侄女": { male: "表伯/表叔", female: "表姑" },
            "堂侄": { male: "堂伯/堂叔", female: "堂姑" },
            "堂侄女": { male: "堂伯/堂叔", female: "堂姑" },
        };

        const spouseToViewerMap: Record<string, Record<string, string>> = {
            "female": {
                "爸爸": "公公", "妈妈": "婆婆", "哥哥": "大伯", "弟弟": "小叔", "姐姐": "大姑", "妹妹": "小姑",
                "兄弟": "大伯/小叔", "姐妹": "大姑/小姑", "亲兄弟": "大伯/小叔", "亲姐妹": "大姑/小姑"
            },
            "male": {
                "爸爸": "岳父", "妈妈": "岳母", "哥哥": "大舅子", "弟弟": "小舅子", "姐姐": "大姨子", "妹妹": "小姨子",
                "兄弟": "大舅子/小舅子", "姐妹": "大姨子/小姨子", "亲兄弟": "大舅子/小舅子", "亲姐妹": "大舅子/小舅子"
            }
        };

        const bridgeMap: Record<string, Record<string, string>> = {
            "妈妈": { "儿子": "哥/弟", "女儿": "姐/妹", "孙子": "外甥/外甥女", "孙女": "外甥/外甥女" },
            "爸爸": { "儿子": "哥/弟", "女儿": "姐/妹", "孙子": "侄子/侄女", "孙女": "侄子/侄女" },
            "爷爷": { "兄弟": "伯公/叔公", "姐妹": "姑婆" },
            "奶奶": { "兄弟": "舅公", "姐妹": "姨婆" },
            "外公": { "兄弟": "舅公", "姐妹": "姨婆" },
            "外婆": { "兄弟": "舅公", "姐妹": "姨婆" },
            "曾祖父": { "儿子": "爷爷/外公" },
            "伯公": { "儿子": "叔伯", "女儿": "姑姑" },
            "叔公": { "儿子": "叔伯", "女儿": "姑姑" },
            "舅公": { "儿子": "表叔/表伯", "女儿": "表姑" },
            "姑婆": { "儿子": "表叔", "女儿": "表姑", "孙子": "表哥/弟/姐/妹", "孙女": "表哥/弟/姐/妹" },
            "姨婆": { "儿子": "表叔", "女儿": "表姑" },
            "亲伯": { "儿子": "堂哥/弟", "女儿": "堂姐/妹" },
            "亲叔": { "儿子": "堂哥/弟", "女儿": "堂姐/妹" },
            "亲姑": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "姑父" },
            "大伯": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "妻子": "伯母" },
            "伯母": { "儿子": "堂哥/弟", "女儿": "堂姐/妹" },
            "伯伯": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "妻子": "伯母" },
            "叔叔": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "妻子": "婶婶" },
            "小叔": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "妻子": "婶婶" },
            "婶婶": { "儿子": "堂哥/弟", "女儿": "堂姐/妹" },
            "姑姑": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "姑父" },
            "堂哥": { "儿子": "堂侄", "女儿": "堂侄女", "妻子": "堂嫂" },
            "堂弟": { "儿子": "堂侄", "女儿": "堂侄女", "妻子": "堂弟媳" },
            "堂姐": { "儿子": "堂外甥", "女儿": "堂外甥女", "丈夫": "堂姐夫" },
            "堂妹": { "儿子": "堂外甥", "女儿": "堂外甥女", "丈夫": "堂妹夫" },
            "堂叔": { "儿子": "堂兄弟", "女儿": "堂姐妹", "妻子": "堂婶" },
            "堂伯": { "儿子": "堂兄弟", "女儿": "堂姐妹", "妻子": "堂伯母" },
            "亲兄弟": { "儿子": "亲侄", "女儿": "亲侄女", "孙子": "侄孙", "孙女": "侄孙女" },
            "亲姐妹": { "儿子": "亲外甥", "女儿": "亲外甥女", "孙子": "外甥孙", "孙女": "外甥孙女" },
            "亲兄弟姐妹": { "儿子": "亲侄/亲外甥", "女儿": "亲侄/亲外甥" },
            "表哥": { "儿子": "表侄", "女儿": "表侄女", "妻子": "表嫂" },
            "表弟": { "儿子": "表侄", "女儿": "表侄女", "妻子": "表弟媳" },
            "表姐": { "儿子": "表外甥", "女儿": "表外甥女", "丈夫": "表姐夫" },
            "表妹": { "儿子": "表外甥", "女儿": "表外甥女", "丈夫": "表妹夫" },
            "表兄弟": { "儿子": "表侄", "女儿": "表侄女" },
            "表姐妹": { "儿子": "表外甥", "女儿": "表外甥女" },
            "表兄弟姐妹": { "儿子": "表侄/表外甥", "女儿": "表侄/表外甥" },
            "表伯": { "儿子": "表哥/弟", "女儿": "表姐/妹", "妻子": "表伯母" },
            "表叔": { "儿子": "表哥/弟", "女儿": "表姐/妹", "妻子": "表婶" },
            "表姑": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "表姑父" },
            "舅舅": { "儿子": "表哥/弟", "女儿": "表姐/妹", "妻子": "舅妈" },
            "舅妈": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "舅舅" },
            "阿姨": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "姨父", "孙子": "表外甥", "孙女": "表外甥女" },
            "姨妈": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "姨父", "孙子": "表外甥", "孙女": "表外甥女" },
            "兄弟": { "儿子": "亲侄子", "女儿": "亲侄女" },
            "姐妹": { "儿子": "亲外甥", "女儿": "亲外甥女" },
            "哥哥": { "儿子": "亲侄子", "女儿": "亲侄女", "妻子": "嫂子" },
            "弟弟": { "儿子": "亲侄子", "女儿": "亲侄女", "妻子": "弟媳" },
            "姐姐": { "儿子": "亲外甥", "女儿": "亲外甥女", "丈夫": "姐夫" },
            "妹妹": { "儿子": "亲外甥", "女儿": "亲外甥女", "丈夫": "妹夫" },
            "哥": { "儿子": "亲侄子", "女儿": "亲侄女", "妻子": "嫂子" },
            "弟": { "儿子": "亲侄子", "女儿": "亲侄女", "妻子": "弟媳" },
            "姐": { "儿子": "亲外甥", "女儿": "亲外甥女", "丈夫": "姐夫" },
            "妹": { "儿子": "亲外甥", "女儿": "亲外甥女", "丈夫": "妹夫" },
            "姐/妹": { "儿子": "亲外甥", "女儿": "亲外甥女" },
            "哥/弟": { "儿子": "亲侄子", "女儿": "亲侄女" },
            "儿子": { "妻子": "儿媳", "儿子": "孙子", "女儿": "孙女", "孙辈": "曾孙" },
            "女儿": { "丈夫": "女婿", "儿子": "外孙", "女儿": "外孙女", "孙辈": "外曾孙" },
            "孙子": { "儿子": "曾孙", "女儿": "曾孙女" },
            "外孙": { "儿子": "外曾孙", "女儿": "外曾孙女" },
            "亲侄子": { "妻子": "侄媳妇" },
            "亲外甥": { "妻子": "外甥媳妇" },
            "二爸": { "妻子": "二妈/婶婶", "儿子": "堂哥/弟" },
            "大爸": { "妻子": "大妈/伯母", "儿子": "堂哥/弟" },
            "丈夫": { "爸爸": "公公", "妈妈": "婆婆", "兄弟": "夫家大伯/夫家小叔", "姐妹": "大姑/小姑" },
            "妻子": { "爸爸": "岳父", "妈妈": "岳母", "兄弟": "大舅子/小舅子", "姐妹": "大姨子/小姨子" },
            "夫家大伯": { "儿子": "内侄", "女儿": "内侄女" },
            "夫家小叔": { "儿子": "内侄", "女儿": "内侄女" },
            "大姑": { "儿子": "姑外甥", "女儿": "姑外甥女" },
            "小姑": { "儿子": "姑外甥", "女儿": "姑外甥女" },
            "大舅子": { "儿子": "内侄", "女儿": "内侄女" },
            "小舅子": { "儿子": "内侄", "女儿": "内侄女" },
            "大姨子": { "儿子": "姨外甥", "女儿": "姨外甥女" },
            "小姨子": { "儿子": "姨外甥", "女儿": "姨外甥女" },
            "内侄": { "儿子": "内侄孙", "女儿": "内侄孙女" }
        };

        // 情况 A: target 创建了 viewer
        if (eq(vNode.createdByMemberId, tId)) {
            const manualRel = tNode.relationship || "";
            if (manualRel && !["本人", "家人", "创建者", ""].includes(manualRel)) {
                return manualRel;
            }
            const myRoleToCreator = vNode.relationship || "";
            for (const [key, value] of Object.entries(inverseMap)) {
                if (myRoleToCreator.includes(key)) {
                    const titleRaw = isFemale(tNode) ? value.female : value.male;
                    const finalTitle = titleRaw.split("/")[0];
                    return injectRankingAndRemark(finalTitle, tNode, vNode, members);
                }
            }
        }

        // 情况 B: viewer 创建了 target
        if (eq(tNode.createdByMemberId, vId)) {
            const raw = tNode.relationship || "创建者";
            if (raw && !["本人", "家人", "创建者", "其他", "创建人"].includes(raw)) {
                const labels: Record<string, { male: string; female: string }> = {
                    "外甥": { male: "外甥", female: "外甥女" },
                    "外甥女": { male: "外甥", female: "外甥女" },
                    "侄子": { male: "侄子", female: "侄女" },
                    "侄女": { male: "侄子", female: "侄女" },
                    "儿子": { male: "儿子", female: "女儿" },
                    "女儿": { male: "儿子", female: "女儿" },
                    "哥哥": { male: "哥哥", female: "姐姐" },
                    "弟弟": { male: "弟弟", female: "妹妹" },
                    "姐姐": { male: "哥哥", female: "姐姐" },
                    "妹妹": { male: "弟弟", female: "妹妹" },
                    "老公": { male: "老公", female: "老婆" },
                    "老婆": { male: "老公", female: "老婆" },
                    "丈夫": { male: "丈夫", female: "妻子" },
                    "妻子": { male: "丈夫", female: "妻子" },
                    "爸爸": { male: "爸爸", female: "妈妈" },
                    "妈妈": { male: "爸爸", female: "妈妈" },
                    "爷爷": { male: "爷爷", female: "奶奶" },
                    "奶奶": { male: "爷爷", female: "奶奶" },
                    "外公": { male: "外公", female: "外婆" },
                    "外婆": { male: "外公", female: "外婆" },
                    "舅舅": { male: "舅舅", female: "舅妈" },
                    "舅妈": { male: "舅舅", female: "舅妈" },
                    "伯伯": { male: "伯伯", female: "伯母" },
                    "伯母": { male: "伯伯", female: "伯母" },
                    "叔叔": { male: "叔叔", female: "婶婶" },
                    "婶婶": { male: "叔叔", female: "婶婶" },
                    "堂哥": { male: "堂哥", female: "堂姐" },
                    "堂兄": { male: "堂哥", female: "堂姐" },
                    "堂弟": { male: "堂弟", female: "堂妹" },
                    "堂姐": { male: "堂哥", female: "堂姐" },
                    "堂妹": { male: "堂弟", female: "堂妹" },
                    "表哥": { male: "表哥", female: "表姐" },
                    "表兄": { male: "表哥", female: "表姐" },
                    "表弟": { male: "表弟", female: "表妹" },
                    "表姐": { male: "表哥", female: "表姐" },
                    "表妹": { male: "表弟", female: "表妹" },
                };
                const entry = labels[raw];
                if (entry) {
                    const corrected = isFemale(tNode) ? entry.female : entry.male;
                    return injectRankingAndRemark(corrected, tNode, vNode, members);
                }
                return injectRankingAndRemark(raw, tNode, vNode, members);
            }
        }

        // 情况 C: 级联桥接
        const vSpouseId = vNode.spouseId || members.find(m =>
            members.some(child => (eq(child.fatherId, vId) && eq(child.motherId, m.id)) || (eq(child.motherId, vId) && eq(child.fatherId, m.id)))
        )?.id;

        if (vSpouseId && !eq(tId, vSpouseId)) {
            const vSpouse = members.find(m => eq(m.id, vSpouseId));
            if (vSpouse) {
                const sRel = getRigorousRelationship(vSpouse, tNode, members, depth + 1);
                const cleanSRel = getCleanRelationship(sRel);
                const map = spouseToViewerMap[vNode.gender === 'female' ? 'female' : 'male'];
                if (map && map[cleanSRel]) {
                    const finalTitle = map[cleanSRel];
                    return injectRankingAndRemark(finalTitle, tNode, vNode, members);
                }
            }
        }

        if (tNode.createdByMemberId && !eq(tNode.createdByMemberId, vId)) {
            const creator = members.find(m => eq(m.id, tNode.createdByMemberId));
            if (creator) {
                const cRel = getRigorousRelationship(viewer, creator, members, depth + 1);
                const rawT = (tNode.relationship || "").replace(/\s+/g, "").toLowerCase();
                const sRole = (tNode.standardRole || tNode.standard_role || "").toLowerCase();
                let tRel = "";
                if (sRole === "daughter" || rawT === "女儿" || rawT === "女" || rawT.endsWith("女儿")) tRel = "女儿";
                else if (sRole === "son" || rawT === "儿子" || rawT === "子" || rawT.endsWith("儿子")) tRel = "儿子";
                else if (sRole === "granddaughter" || rawT.includes("孙女")) tRel = "孙女";
                else if (sRole === "grandson" || rawT.includes("孙子")) tRel = "孙子";
                else if (sRole === "brother" || rawT.includes("哥") || rawT.includes("弟")) tRel = "儿子";
                else if (sRole === "sister" || rawT.includes("姐") || rawT.includes("妹")) tRel = "女儿";
                else if (sRole === "wife" || ["老婆", "妻子", "爱人", "夫人", "内人", "太太"].some(w => rawT.includes(w))) tRel = "妻子";
                else if (sRole === "husband" || ["老公", "丈夫", "爱人", "先生"].some(w => rawT.includes(w))) tRel = "丈夫";
                else tRel = getCleanRelationship(tNode.relationship || "");

                const cRelOptions = cRel.split("/").map(s => getCleanRelationship(s));
                for (const cleanCRel of cRelOptions) {
                    if (bridgeMap[cleanCRel] && bridgeMap[cleanCRel][tRel]) {
                        const finalTitle = bridgeMap[cleanCRel][tRel].replace("夫家", "");
                        return injectRankingAndRemark(finalTitle, tNode, vNode, members, getRankPrefix(creator, members));
                    }
                }
            }
        }

        // 情况 D: 终极反转推演
        if (depth === 0) {
            const tToV = getRigorousRelationship(tNode, vNode, members, 1);
            const cleanTToV = getCleanRelationship(tToV);
            if (cleanTToV && cleanTToV !== "家人" && cleanTToV !== "我") {
                let inverseMatch = inverseMap[cleanTToV];
                if (!inverseMatch) {
                    for (const key of Object.keys(inverseMap)) {
                        if (cleanTToV.includes(key)) {
                            inverseMatch = inverseMap[key];
                            break;
                        }
                    }
                }
                if (inverseMatch) {
                    const rawT = (tNode.relationship || "").trim();
                    let finalTitleRaw = "";

                    // 1. 优先通过“打标”锁死名分 (名分锚定)
                    if (rawT.includes("母家") || rawT.includes("母系")) {
                        finalTitleRaw = isFemale(tNode) ? "姨妈" : "舅舅";
                    } else if (rawT.includes("父家") || rawT.includes("父系")) {
                        finalTitleRaw = isFemale(tNode) ? "姑姑" : "叔叔";
                    } else if (rawT.includes("血亲")) {
                        // 如果是长辈辈分反转
                        const isElder = ["叔", "伯", "姑", "舅", "姨"].some(k => inverseMatch.female.includes(k) || inverseMatch.male.includes(k));
                        if (isElder) {
                            if (isFemale(tNode)) finalTitleRaw = rawT.includes("妈") ? "姨妈" : "姑姑";
                            else finalTitleRaw = rawT.includes("爸") ? "叔叔" : "舅舅";
                        }
                    } else if (rawT.includes("姻亲")) {
                        if (isFemale(tNode)) finalTitleRaw = "舅妈";
                        else finalTitleRaw = "姑父";
                    } else if (rawT.includes("舅妈")) {
                        finalTitleRaw = "舅妈";
                    } else if (rawT.includes("舅舅")) {
                        finalTitleRaw = "舅舅";
                    } else if (rawT.includes("姨") || rawT.includes("阿姨")) {
                        finalTitleRaw = "阿姨";
                    } else {
                        // 2. 如果没标记，再按性别取默认值
                        const female = isFemale(tNode);
                        finalTitleRaw = female ? inverseMatch.female.split("/")[0] : inverseMatch.male.split("/")[0];
                    }
                    return injectRankingAndRemark(finalTitleRaw, tNode, vNode, members);
                }
            }
        }

        // 回退逻辑
        const baseRel = (tNode.relationship || "").trim();
        if (baseRel && !["本人", "家人", "创建者", "其他", "创建人"].includes(baseRel)) {
            return injectRankingAndRemark(baseRel, tNode, vNode, members);
        }
        return injectRankingAndRemark("家人", tNode, vNode, members);

    } catch (error) {
        console.error("家族逻辑推导异常:", error);
        return target?.relationship || target?.name || "家门亲戚";
    }

    // 内部注入函数
    function injectRankingAndRemark(baseRel: string, tNode: any, vNode: any, members: any[], inheritedPrefixStr: string = "") {
        let finalTitle = baseRel;
        const prefix = getRankPrefix(tNode, members) || inheritedPrefixStr;
        const rankable = ["爸爸", "叔叔", "叔伯", "姑姑", "阿姨", "舅舅", "姐/妹", "哥/弟", "兄弟", "姐妹", "堂姐/妹", "堂兄/弟", "表姐/妹", "表哥/弟", "嫂子", "嫂", "弟媳", "姐夫", "妹夫", "伯母", "婶婶", "舅妈", "姨父", "姑父"];
        if (prefix && rankable.some(r => baseRel.includes(r))) {
            if (!prefix.split("").some(char => baseRel.startsWith(char))) {
                finalTitle = prefix + baseRel;
                finalTitle = finalTitle.replace("嫂子", "嫂").replace("弟媳妇", "弟媳");
            }
        }
        const vDate = vNode.birthDate || vNode.birth_date;
        const tDate = tNode.birthDate || tNode.birth_date;
        if (vDate && tDate) {
            const isTargetOlder = tDate < vDate;
            finalTitle = finalTitle
                .replace("姐/妹", isTargetOlder ? "姐" : "妹")
                .replace("姊妹", isTargetOlder ? "姐" : "妹")
                .replace("哥/弟", isTargetOlder ? "哥" : "弟")
                .replace("兄弟", isTargetOlder ? "哥" : "弟")
                .replace("姐妹", isTargetOlder ? "姐" : "妹");
        }
        const rawRemark = (tNode.relationship || "").trim();
        const standardLabels = ["儿子", "女儿", "孩子", "后辈", "本人", "家人"];
        const isDuplicate = !rawRemark || ["本人", "家人", "创建者", "创建人", "其他"].includes(rawRemark) || standardLabels.includes(rawRemark) || finalTitle === rawRemark || finalTitle.includes(rawRemark) || getCleanRelationship(finalTitle) === getCleanRelationship(rawRemark);
        if (!isDuplicate && !finalTitle.includes(rawRemark)) {
            return `${finalTitle} (${rawRemark})`;
        }
        return finalTitle;
    }
}

/**
 * 原有的简单推断逻辑
 */
export function getRelativeRelationship(
    viewerRole: string | undefined,
    targetRole: string | undefined,
    fallback: string
): string {
    if (!viewerRole || !targetRole) return fallback;
    if (viewerRole === targetRole) return "本人";

    const relMap: Record<string, Record<string, string>> = {
        father: {
            grandfather_paternal: "爷爷", grandmother_paternal: "奶奶",
            grandfather_maternal: "外公", grandmother_maternal: "外婆",
            mother: "妻子", wife: "妻子", son: "儿子", daughter: "女儿",
        },
        son: {
            father: "爸爸", mother: "妈妈",
            grandfather_paternal: "爷爷", grandmother_paternal: "奶奶",
        },
        daughter: {
            father: "爸爸", mother: "妈妈",
            grandfather_paternal: "爷爷", grandmother_paternal: "奶奶",
        }
    };
    return relMap[viewerRole]?.[targetRole] || STANDARD_ROLE_LABELS[targetRole] || fallback;
}

/**
 * 核心：获取关系的详细分类类型
 */
export function getRelationType(rel: string): 'blood' | 'affinal' | 'social' {
    const clean = getCleanRelationship(rel);
    if (!clean || clean === "本人" || clean === "自己") return 'blood';
    const socialKeywords = ["战友", "同学", "朋友", "恩师", "创建者", "归档人", "其他", "家人", "宠物", "毛儿子", "毛女儿", "宝贝"];
    if (socialKeywords.some(sw => clean.includes(sw))) return 'social';
    const affinalKeywords = ["婿", "媳", "岳", "丈", "妻", "夫", "嫂", "老公", "老婆", "舅子", "姨子", "内侄", "婶", "姆", "妗"];
    const bloodWhiteList = ["爸爸", "母亲", "妈妈", "阿姨", "姨妈", "舅舅", "姑姑", "叔叔", "伯伯", "爷爷", "奶奶", "外公", "外婆", "阿公", "阿嬷", "外嬷", "伯公", "叔公", "姑婆", "舅公", "姨婆", "曾祖", "高祖"];
    if (bloodWhiteList.some(w => clean.includes(w))) return 'blood';
    if (clean.includes("公公") || clean.includes("婆婆") || affinalKeywords.some(k => clean.includes(k))) return 'affinal';
    return 'blood';
}

export function isBloodRelation(rel: string): boolean {
    return getRelationType(rel) === 'blood';
}

/**
 * 核心：获取血缘亲疏标签
 */
export function getKinshipLabel(vNode: any, tNode: any, members: any[]): string | null {
    if (!vNode || !tNode) return null;
    const vId = Number(vNode.memberId || vNode.id);
    const tId = Number(tNode.id);
    if (vId === tId) return null;

    const rel = getRigorousRelationship(vNode, tNode, members);
    const type = getRelationType(rel);

    if (type === 'social') return "【友】";
    if (type === 'affinal') return "【姻】";

    const vFatherId = vNode.fatherId;
    const tFatherId = tNode.fatherId;

    if (vNode.ancestralHall && tNode.ancestralHall && vNode.ancestralHall === tNode.ancestralHall) {
        if (!vFatherId || !tFatherId) return "【同宗】";
    }

    if (!vFatherId || !tFatherId) {
        if (rel.includes("堂") || rel.includes("远")) return "【同宗】";
        if (rel.includes("表")) return "【外戚】";
        return "【家门】";
    }

    if (Number(vFatherId) === Number(tFatherId)) return "【家门】";

    const getFId = (id: any) => {
        if (!id) return null;
        const m = members.find(m => Number(m.id) === Number(id));
        return m ? m.fatherId : null;
    };

    const vGFId = getFId(vFatherId);
    const tGFId = getFId(tFatherId);
    if (vGFId && Number(vGFId) === Number(tGFId)) return "【家门】";

    const vGGFId = getFId(vGFId);
    const tGGFId = getFId(tGFId);
    if (vGGFId && Number(vGGFId) === Number(tGGFId)) return "【同宗】";

    return "【远亲】";
}
