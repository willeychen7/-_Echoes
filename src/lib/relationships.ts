/**
 * 家族关系辅助库
 * 提供关系选项、角色推断和称谓相对化功能
 *
 * NOTE: 核心称谓计算现已集成 mumuy/relationship.js 作为第一优先级引擎
 * 参见：https://github.com/mumuy/relationship
 */
import { computeKinshipViaMumuy, computeReverseViaMumuy } from './kinshipBridge';

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
    older_brother: "哥哥",
    younger_brother: "弟弟",
    older_sister: "姐姐",
    younger_sister: "妹妹",
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

    if (["侄", "外甥", "孙"].some(k => rawR.includes(k))) {
        if (["女", "妹", "姐"].some(k => rawR.includes(k))) return true;
    }

    return femaleKeywords.some(word => name.includes(word));
}

/**
 * 清理排行前缀
 */
export function getCleanRelationship(rel: string): string {
    const specialTwoWords = ["大伯", "大爷", "大妈", "大娘", "老爸", "老妈", "老婆", "老公"];
    let clean = (rel || "").trim();
    if (!clean || specialTwoWords.includes(clean)) return clean;

    const rankRegex = /^(大|小|老|一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|排行|排行老|细|幺)+/;
    const match = clean.match(rankRegex);

    if (match && clean.length > match[0].length) {
        return clean.substring(match[0].length);
    }

    const tags = ["(母家)", "(父家)", "(母系)", "(父系)", "(亲生)", "(堂)", "(表)", "(血亲)", "(姻亲)"];
    tags.forEach(t => {
        clean = clean.split(t).join("");
    });

    return clean;
}

/**
 * 推断标准角色标识
 */
export function deduceRole(relationship: string): string {
    const raw = (relationship || "").trim();
    const clean = getCleanRelationship(relationship);
    if (!clean) return "family";

    if (clean === "爸" && /^(大|二|三|四|五|六|七|八|九|十|小|一|第)/.test(raw)) {
        const exclusions = ["老爸", "阿爸", "亲爸", "爸爸", "父亲"];
        if (!exclusions.some(exc => raw.includes(exc))) return "uncle_paternal";
    }

    const map: Record<string, string> = {
        "老爸": "father", "亲爸": "father", "爸爸": "father", "父亲": "father", "阿爸": "father", "爸": "father",
        "老妈": "mother", "亲妈": "mother", "妈妈": "mother", "母亲": "mother", "阿妈": "mother", "妈": "mother",
        "高祖父": "great_great_grandfather", "高祖母": "great_great_grandmother",
        "曾祖父": "great_grandfather", "曾祖母": "great_grandmother",
        "爷爷": "grandfather_paternal", "奶奶": "grandmother_paternal",
        "外公": "grandfather_maternal", "外婆": "grandmother_maternal", "阿哥": "brother", "阿弟": "brother",
        "阿姐": "sister", "阿妹": "sister", "哥哥": "brother", "弟弟": "brother", "姐姐": "sister", "妹妹": "sister",
        "侄子": "nephew", "外甥": "nephew", "侄女": "niece", "外甥女": "niece", "儿子": "son", "女儿": "daughter",
        "孙子": "grandson", "孙女": "granddaughter"
    };
    return map[clean] || "family";
}

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
        membersMap.set(Number(m.id), {
            ...m,
            fatherId: m.fatherId || m.father_id,
            motherId: m.motherId || m.mother_id,
            birthDate: m.birthDate || m.birth_date,
            id: Number(m.id)
        });
    }
    const ctx: KinshipContext = { membersMap, memo: new Map(), dialect: { name: "hokkien" } };
    engineCache.set(members, ctx);
    return ctx;
}

export function isClan(vNode: any, tNode: any): boolean {
    if (!vNode || !tNode) return false;
    const tTag = (tNode.logicTag || tNode.logic_tag || "").toString().toUpperCase();
    if (tTag.startsWith('[F]')) return true;
    if (tTag.startsWith('[M]')) return false;
    if (vNode.surname && tNode.surname) return vNode.surname === tNode.surname;
    return false;
}

export function getRankPrefix(targetNode: any, members: any[]) {
    const tTag = (targetNode.logicTag || targetNode.logic_tag || "").toString().toUpperCase();
    const rankMatch = tTag.match(/-O(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|小|幺|老)$/);
    if (rankMatch) return rankMatch[1];

    const rawRemark = (targetNode.relationship || "").trim();
    const explicitRankMatch = rawRemark.match(/^(大|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|小|老|排行老|细|幺)/);
    if (explicitRankMatch) {
        let rank = explicitRankMatch[0];
        if (rank.startsWith("排行老")) rank = rank.substring(3);
        else if (rank.startsWith("排行")) rank = rank.substring(2);
        return rank;
    }
    return "";
}

function injectRankingAndRemark(baseRel: string, tNode: any, vNode: any, members: any[]) {
    let finalTitle = baseRel;
    const prefix = getRankPrefix(tNode, members);
    const rankable = ["爸爸", "妈妈", "叔叔", "叔", "伯", "伯伯", "姑姑", "姑", "姨", "阿姨", "舅", "舅舅", "舅妈", "姨丈", "婶", "嫂", "姐", "哥", "弟", "妹", "堂", "表", "侄", "外甥", "孙"];
    if (prefix && rankable.some(r => baseRel.includes(r)) && !baseRel.startsWith(prefix)) {
        finalTitle = prefix + baseRel;
    }
    return finalTitle;
}

export function getRigorousRelationship(viewer: any, target: any, members: any[], depth = 0): string {
    const ctx = getKinshipContext(members);
    let vId = viewer?.memberId ? Number(viewer.memberId) : (viewer?.id ? Number(viewer.id) : null);
    const tId = target?.id ? Number(target.id) : null;

    if (vId && !ctx.membersMap.has(vId)) {
        const boundMember = Array.from(ctx.membersMap.values()).find(m => (m.userId && Number(m.userId) === vId) || (m.user_id && Number(m.user_id) === vId));
        if (boundMember) vId = Number(boundMember.id);
    }
    if (tId === null || vId === null) return target?.relationship || "家人";

    const cacheKey = `${vId}_${tId}_${depth}`;
    if (ctx.memo.has(cacheKey)) return ctx.memo.get(cacheKey)!;

    const result = computeRigorousRelationship(viewer, target, members, depth, ctx, vId as number, tId as number);
    ctx.memo.set(cacheKey, result);
    return result;
}

function computeRigorousRelationship(viewer: any, target: any, members: any[], depth: number, ctx: KinshipContext, vId: number, tId: number): string {
    try {
        if (depth > 2) return target?.relationship || "家人";
        if (vId === tId) return "本人";

        const vNode = ctx.membersMap.get(vId);
        const tNode = ctx.membersMap.get(tId);
        if (!vNode || !tNode) return target?.relationship || "家人";

        const isPet = tNode.memberType === 'pet' || tNode.type === 'pet' || tNode.standardRole === 'pet';
        if (isPet) return tNode.name || "宠物";

        const isFem = isFemale(tNode);
        const prefix = getRankPrefix(tNode, members);

        // --- 🌟 STEP M: mumuy 引擎全量接管 ---
        try {
            const mumuyResult = computeKinshipViaMumuy(tNode, vNode, members, false);
            if (mumuyResult && !['本人', '亲属', '其他', '亲戚'].includes(mumuyResult)) {
                const cleanMumuy = mumuyResult.replace(/^(大|二|三|四|五|六|七|八|九|十|小|老)/, '');
                return prefix ? `${prefix}${cleanMumuy}` : mumuyResult;
            }
        } catch (err) { }

        // --- 4. 传统 ID 链接逻辑 (Fallback) ---
        const eq = (a: any, b: any) => a && b && Number(a) === Number(b);
        if (eq(tId, vNode.fatherId)) return "爸爸";
        if (eq(tId, vNode.motherId)) return "妈妈";
        if (eq(vId, tNode.fatherId) || eq(vId, tNode.motherId)) return isFem ? "女儿" : "儿子";

        return tNode.relationship || "亲戚";
    } catch (e) {
        return "亲戚";
    }
}

export function getRelationType(rel: string): 'blood' | 'affinal' | 'social' {
    const clean = getCleanRelationship(rel);
    const socialKeywords = ["战友", "同学", "朋友", "恩师", "宠物", "家人"];
    if (socialKeywords.some(sw => clean.includes(sw))) return 'social';
    const affinalKeywords = ["婿", "媳", "岳", "丈", "妻", "夫", "嫂", "舅子", "姨子", "内侄", "婶", "姆", "妗"];
    if (affinalKeywords.some(k => clean.includes(k))) return 'affinal';
    return 'blood';
}

export function isBloodRelation(rel: string): boolean {
    return getRelationType(rel) === 'blood';
}

export function getKinshipLabel(vNode: any, tNode: any, members: any[]): string | null {
    if (!vNode || !tNode) return null;
    const rel = getRigorousRelationship(vNode, tNode, members);
    const type = getRelationType(rel);
    if (type === 'social') return "【友】";
    if (type === 'affinal') return "【姻】";
    const tTag = (tNode.logicTag || tNode.logic_tag || "").toString().toUpperCase();
    if (tTag.startsWith('[F]')) return "【宗亲】";
    if (tTag.startsWith('[M]')) return "【外戚】";
    return "【血亲】";
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
