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

    // 1. 逻辑标签优先 (LogicTag First) - 宗亲判定终极防线
    const tTag = (tNode.logicTag || tNode.logic_tag || "").toString().toUpperCase();
    if (tTag.startsWith('[F]')) return true;  // [F] 开头绝对是父系(宗亲/姑表)
    if (tTag.startsWith('[M]')) return false; // [M] 开头绝对是母系外戚

    // 2. 角色属性判定 (Role First) - 即使坐标丢失，角色也能指引方位
    const sRole = tNode.standardRole || tNode.standard_role || "";
    if (['brother', 'sister', 'father', 'grandfather_paternal', 'grandmother_paternal', 'uncle_paternal', 'aunt_paternal'].includes(sRole)) return true;
    if (['uncle_maternal', 'aunt_maternal', 'grandfather_maternal', 'grandmother_maternal'].includes(sRole)) return false;

    // 3. 档案打标方位判定
    const tSide = tNode.origin_side || tNode.originSide;
    if (tSide === 'maternal') return false;
    if (tSide === 'paternal') return true;

    // 4. 衔接点判定：如果是亲兄弟姐妹路径，必定属于宗亲范畴
    if (tTag.includes('SIB') || tTag.includes('LOGIC:SIB') || tTag.includes('-X')) return true;

    // 5. 姓氏兜底
    if (vNode.surname && tNode.surname && vNode.surname.trim() !== "" && tNode.surname.trim() !== "") {
        return vNode.surname === tNode.surname;
    }

    // 6. 最后的兜底：如果关系词本身包含“堂”，且没有明确的母系标记
    if (tNode.relationship && tNode.relationship.includes('堂') && !tTag.includes('[M]')) return true;

    return false;
}

/**
 * 根据生日及房头计算排行前缀 (大, 二, 三, 小)
 */
function getRankPrefix(targetNode: any, members: any[]) {
    // --- 🚀 核心纠偏：逻辑坐标优先 (LogicTag Rank First) ---
    const tTag = (targetNode.logicTag || targetNode.logic_tag || "").toString().toUpperCase();
    const rankMatch = tTag.match(/-O(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|小|幺|老)$/);
    if (rankMatch) {
        return rankMatch[1];
    }

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

    // 🚀 核心优化：更鲁棒的观察者 ID 识别
    if (vId && !ctx.membersMap.has(vId)) {
        // 尝试通过 userId 匹配
        const boundMember = Array.from(ctx.membersMap.values()).find(m => (m.userId && Number(m.userId) === vId) || (m.user_id && Number(m.user_id) === vId));
        if (boundMember) vId = Number(boundMember.id);
    }

    // 如果还是没找到，且 viewer 是真实的成员节点但 ID 被误判
    if (viewer && viewer.userId && !vId) {
        vId = Number(viewer.id);
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
        if (vId === tId) return "本人";

        const vNode = ctx.membersMap.get(vId);
        const tNode = ctx.membersMap.get(tId);
        if (!vNode || !tNode) return target?.relationship || "家人";

        // --- 1. 物种隔离拦截器 ---
        const isPet = tNode.memberType === 'pet' || tNode.type === 'pet' || tNode.standardRole === 'pet' || tNode.relationship === '宠物';
        if (isPet) {
            const ownerId = tNode.fatherId || tNode.createdByMemberId;
            const owner = members.find(m => Number(m.id) === Number(ownerId));
            if (vId && owner && Number(owner.id) === vId) {
                const petSuffix = tNode.gender === 'female' ? "毛女儿" : "毛儿子";
                return tNode.name ? `${tNode.name} (${petSuffix})` : petSuffix;
            }
            if (owner) {
                const ownerTitle = getRigorousRelationship(vNode, owner, members, depth + 1);
                const cleanOwnerTitle = getCleanRelationship(ownerTitle);
                return `${cleanOwnerTitle}家的${tNode.name || '宝贝'}`;
            }
            return tNode.name || "家族萌宠";
        }

        const eq = (a: any, b: any) => a && b && Number(a) === Number(b);
        const isFem = isFemale(tNode);
        const prefix = getRankPrefix(tNode, members);

        // --- 2. 坐标解析 (Logic Tag First) ---
        const rawVTag = (vNode.logicTag || vNode.logic_tag || "").toString().toUpperCase();
        const rawTTag = (tNode.logicTag || tNode.logic_tag || "").toString().toUpperCase();
        const cleanTTag = rawTTag.replace(/^\[[FM]\](\!S)?-/, '');
        const cleanVTag = rawVTag.replace(/^\[[FM]\](\!S)?-/, '');

        const getTagLevel = (tag: string) => {
            const path = tag.replace(/^\[[FM]\](\!S)?-/, '').split('-O')[0].toLowerCase();
            if (path.includes('self')) return 0;
            if (path === 'sib' || path === 'x' || path === 'x,m') return 0;
            if (path.startsWith('s')) return -(path.split(',').length);
            if (!path) return 0;
            return path.split(',').length;
        };

        const vLevel = getTagLevel(rawVTag);
        const tLevel = getTagLevel(rawTTag);
        let tagGenDiff = vLevel - tLevel;

        // --- 3. 逻辑坐标绝对优先 (Tag-to-Tag Algebra) ---
        if (rawVTag && rawTTag) {
            if (rawVTag.includes('SELF') || !rawTTag.includes('SELF')) {
                const parts = cleanTTag.split('-O');
                const pathOnly = parts[0].toLowerCase();
                const rankStr = parts[1] || "";

                if (tagGenDiff === -1) {
                    if (pathOnly === 'f') {
                        if (!rankStr && !tNode.is_ghost) return "爸爸";
                        if (isFem) return `${prefix}姑姑`;
                        const fNode = vNode.fatherId ? ctx.membersMap.get(Number(vNode.fatherId)) : null;
                        const fDate = fNode?.birthDate || fNode?.birth_date || "9999-99-99";
                        const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
                        if (prefix === '大' || (tDate < fDate && fDate !== "9999-99-99")) return "大伯";
                        return `${prefix}叔叔`;
                    }
                    if (pathOnly === 'm') {
                        if (!rankStr && !tNode.is_ghost) return "妈妈";
                        return isFem ? `${prefix}姨妈` : `${prefix}舅舅`;
                    }
                }
                if (tagGenDiff === -2) {
                    if (pathOnly === 'f,f' || pathOnly === 'f,m') {
                        if (!rankStr && !tNode.is_ghost && pathOnly === 'f,f') return "爷爷";
                        if (!rankStr && !tNode.is_ghost && pathOnly === 'f,m') return "奶奶";
                        return isFem ? `${prefix}姑婆` : `${prefix}叔公`;
                    }
                    if (pathOnly === 'm,f' || pathOnly === 'm,m') {
                        if (!rankStr && !tNode.is_ghost && pathOnly === 'm,f') return "外公";
                        if (!rankStr && !tNode.is_ghost && pathOnly === 'm,m') return "外婆";
                        return isFem ? `${prefix}姨婆` : `${prefix}舅公`;
                    }
                }
                if (tagGenDiff === 0) {
                    const vDate = vNode.birthDate || vNode.birth_date || "9999-99-99";
                    const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
                    let isOlder = tDate < vDate;
                    if (vDate === tDate) {
                        const rel = (tNode.relationship || "").trim();
                        if (rel.includes("哥") || rel.includes("兄") || rel.includes("姐")) isOlder = true;
                    }
                    if (pathOnly === 'sib') {
                        if (isFem) return isOlder ? `${prefix}姐姐` : `${prefix}妹妹`;
                        return isOlder ? `${prefix}哥哥` : `${prefix}弟弟`;
                    }
                    if (pathOnly === 'x') {
                        if (isFem) return isOlder ? `${prefix}堂姐` : `${prefix}堂妹`;
                        return isOlder ? `${prefix}堂哥` : `${prefix}堂弟`;
                    }
                    if (pathOnly === 'x,m') {
                        if (isFem) return isOlder ? `${prefix}表姐` : `${prefix}表妹`;
                        return isOlder ? `${prefix}表哥` : `${prefix}表弟`;
                    }
                }
                if (tagGenDiff === 1) {
                    if (pathOnly === 's') return isFem ? `${prefix}侄女` : `${prefix}侄子`;
                    if (pathOnly === 's,m') return isFem ? `${prefix}外甥女` : `${prefix}外甥`;
                }
                // 深层代际支持
                if (tagGenDiff === -3) {
                    if (pathOnly.startsWith('f,f,f')) return isFem ? `${prefix}曾祖母` : `${prefix}曾祖父`;
                    return isFem ? `${prefix}外曾祖母` : `${prefix}外曾祖父`;
                }
                if (tagGenDiff === -4) return isFem ? `${prefix}高祖母` : `${prefix}高祖父`;
                if (tagGenDiff === 2) return isFem ? `${prefix}孙女` : `${prefix}孙子`;
            }

            // B. Target 是本人 (SELF)，查询反向称谓
            if (rawTTag.includes('SELF') && !rawVTag.includes('SELF')) {
                const vPath = cleanVTag.split('-O')[0].toLowerCase();
                if (vPath === 'f' || vPath === 'm') return isFem ? "女儿" : "儿子";
                if (vPath === 'f,f' || vPath === 'f,m') return isFem ? "孙女" : "孙子";
                if (vPath === 'm,f' || vPath === 'm,m') return isFem ? "外孙女" : "外孙";
                if (vPath === 'sib' || vPath === 'x' || vPath === 'x,m') return isFem ? "姐妹/妹妹" : "兄弟/弟弟";
            }
        }

        // --- 4. 传统 ID 链接逻辑 (ID-based Fallback) ---
        if (eq(tId, vNode.fatherId)) return "爸爸";
        if (eq(tId, vNode.motherId)) return "妈妈";
        if (eq(vId, tNode.fatherId) || eq(vId, tNode.motherId)) return isFem ? "女儿" : "儿子";

        const vGen = vNode.generationNum ?? vNode.generation_num ?? 30;
        const tGen = tNode.generationNum ?? tNode.generation_num ?? 30;
        let genDiff = rawVTag && rawTTag ? tagGenDiff : (vGen - tGen);

        if (genDiff === 0 && !eq(vId, tId)) {
            const isSib = (vNode.fatherId && eq(vNode.fatherId, tNode.fatherId)) || (vNode.motherId && eq(vNode.motherId, tNode.motherId));
            const vDate = vNode.birthDate || vNode.birth_date || "9999-99-99";
            const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
            const isOlder = tDate < vDate;
            if (isSib) {
                if (isFem) return isOlder ? `${prefix}姐姐` : `${prefix}妹妹`;
                return isOlder ? `${prefix}哥哥` : `${prefix}弟弟`;
            }
            if (isClan(vNode, tNode)) {
                if (isFem) return isOlder ? `${prefix}堂姐` : `${prefix}堂妹`;
                return isOlder ? `${prefix}堂哥` : `${prefix}堂弟`;
            }
            if (isFem) return isOlder ? `${prefix}表姐` : `${prefix}表妹`;
            return isOlder ? `${prefix}表哥` : `${prefix}表弟`;
        }

        if (genDiff === -1) {
            const vfId = vNode.fatherId;
            const isPaternal = vfId && tNode.fatherId && eq(ctx.membersMap.get(Number(vfId))?.fatherId, tNode.fatherId);
            if (isPaternal) {
                if (isFem) return `${prefix}姑姑`;
                const fNode = ctx.membersMap.get(Number(vfId));
                const fDate = fNode?.birthDate || fNode?.birth_date || "9999-99-99";
                const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
                return (tDate < fDate) ? `${prefix}伯伯` : `${prefix}叔叔`;
            }
            if (isClan(vNode, tNode)) {
                return isFem ? `${prefix}堂姑` : `${prefix}堂叔`;
            }
            return isFem ? `${prefix}姨妈` : `${prefix}舅舅`;
        }

        if (genDiff === -2) {
            if (isClan(vNode, tNode)) {
                if (cleanTTag === 'F,F' || rawTTag.includes('爷爷')) return isFem ? "奶奶" : "爷爷";
                return isFem ? `${prefix}姑婆` : `${prefix}叔公`;
            }
            if (cleanTTag === 'M,F' || cleanTTag === 'M,M') return isFem ? "外婆" : "外公";
            return isFem ? `${prefix}姨婆` : `${prefix}舅公`;
        }

        // --- 5. 终极回退：使用原始称谓或“家人” ---
        const baseRel = (tNode.relationship || "").trim();
        return injectRankingAndRemark(baseRel && !["本人", "家人", "创建者", "创建人", ""].includes(baseRel) ? baseRel : "家人", tNode, vNode, members);

    } catch (error) {
        console.error("家族逻辑推导异常:", error);
        return target?.relationship || target?.name || "家门亲戚";
    }

    function injectRankingAndRemark(baseRel: string, tNode: any, vNode: any, members: any[]) {
        let finalTitle = baseRel;
        const prefix = getRankPrefix(tNode, members);
        const rankable = ["爸爸", "叔叔", "姑姑", "阿姨", "舅舅", "姐", "哥", "弟", "妹", "堂", "表"];
        if (prefix && rankable.some(r => baseRel.includes(r)) && !baseRel.startsWith(prefix)) {
            finalTitle = prefix + baseRel;
        }
        const vDate = vNode.birthDate || vNode.birth_date;
        const tDate = tNode.birthDate || tNode.birth_date;
        if (vDate && tDate) {
            const isTargetOlder = tDate < vDate;
            finalTitle = finalTitle.replace("姐/妹", isTargetOlder ? "姐" : "妹").replace("哥/弟", isTargetOlder ? "哥" : "弟");
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
    const tTag = (tNode.logicTag || tNode.logic_tag || "").toString().toUpperCase();
    const sRole = (tNode.standardRole || tNode.standard_role || "").toLowerCase();

    // 🚀 核心纠偏：逻辑坐标或角色属性优先
    if (tTag.startsWith('[F]') || ['brother', 'sister', 'father', 'grandfather_paternal', 'grandmother_paternal', 'uncle_paternal', 'aunt_paternal'].includes(sRole)) {
        if (tTag.includes('SIB') || sRole === 'brother' || sRole === 'sister' || rel.includes('哥') || rel.includes('姐')) return "【家门】";
        if (sRole === 'grandfather_paternal' || tTag.includes('F,F')) return "【宗长】";
        return rel.includes('堂') ? "【同宗】" : "【宗亲】";
    }

    if (tTag.startsWith('[M]') || ['uncle_maternal', 'aunt_maternal', 'grandfather_maternal', 'grandmother_maternal'].includes(sRole)) {
        if (sRole === 'grandfather_maternal' || tTag.includes('M,F') || tTag.includes('M,M')) return "【外大父/母】";
        return "【母系外戚】";
    }

    if (type === 'social') return "【友】";
    if (type === 'affinal') return "【姻】";

    const vFatherId = vNode.fatherId;
    const tFatherId = tNode.fatherId;

    if (vNode.ancestralHall && tNode.ancestralHall && vNode.ancestralHall === tNode.ancestralHall) {
        if (!vFatherId || !tFatherId) return "【同宗】";
    }

    if (!vFatherId || !tFatherId) {
        // 如果逻辑坐标判定过了，这里作为兜底
        if (rel.includes("堂") || rel.includes("远")) return "【同宗】";
        if (rel.includes("表") && !tTag.startsWith('[F]')) return "【外戚】";
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
