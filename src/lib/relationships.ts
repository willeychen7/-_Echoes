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
    grand_aunt_paternal: "姑婆",
    grand_aunt_paternal_wife: "婶婆/伯婆",
    grand_uncle_maternal: "舅公",
    grand_aunt_maternal: "姨婆",
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
    { value: "grand_aunt_paternal", label: "姑婆" },
    { value: "grand_aunt_paternal_affinal", label: "婶婆/伯婆" },
    { value: "grand_uncle_maternal", label: "舅公" },
    { value: "grand_aunt_maternal", label: "姨婆" },
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

    // 🚀 核心纠偏：优先从档案列表中通过 userId 匹配 Viewer，确保获取带有 logicTag 的完整节点
    let vNodeFromList = members.find(m =>
        (m.userId && viewer?.id && String(m.userId) === String(viewer.id)) ||
        (m.id && viewer?.memberId && String(m.id) === String(viewer.memberId))
    );

    let vId = vNodeFromList?.id ? Number(vNodeFromList.id) : (viewer?.memberId ? Number(viewer.memberId) : (viewer?.id ? Number(viewer.id) : null));
    const tId = target?.id ? Number(target.id) : null;

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

    // 🚀 核心：完全基于“视角关系”进行推演
    const rel = getRigorousRelationship(vNode, tNode, members) || "";
    const type = getRelationType(rel);

    // 获取房头信息 (如：大房)
    const hall = tNode.ancestralHall || tNode.ancestral_hall || "";
    const hallSuffix = hall ? ` · ${hall}` : "";

    // 1. 公共非血缘分类
    if (type === 'social') return "【友】";
    if (type === 'affinal') return `【姻】${hallSuffix}`;

    // 2. 核心判定：判定是否为“至亲” (相对视角下的核心直系)
    // 无论从谁的视角看，只要对方是自己的 父母/子女/手足/祖辈，即为【至亲】
    const isDirect = /^(本人|爷爷|奶奶|外公|外婆|爸爸|妈妈|哥哥|弟弟|姐姐|妹妹|儿子|女儿|父亲|母亲|祖父|祖母|外祖父|外祖母)$/.test(rel);
    if (isDirect) return "【至亲】";

    // 3. 相对支脉判定：根据相对称谓中的关键字决定“宗”还是“外”
    // 这种方式完美解决了用户提到的“随迁”场景：A看B是外戚，B看A也是外戚（因为跨了母系）
    if (/堂|叔|伯|姑/.test(rel)) return `【宗亲】${hallSuffix}`;
    if (/表|舅|姨/.test(rel)) return `【外戚】${hallSuffix}`;

    // 4. 极端兜底：如果无法推算相对路径，尝试参考物理坐标（仅作参考）
    const tTag = (tNode.logicTag || tNode.logic_tag || "").toString().toUpperCase();
    if (tTag.startsWith('[F]')) return `【宗亲】${hallSuffix}`;
    if (tTag.startsWith('[M]')) return `【外戚】${hallSuffix}`;

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

/**
 * 生成关系路径说明文字
 * 
 * 用于解释间接关系，例如：「（堂弟 陈小明 的阿姨）」
 * 
 * 核心思路：
 * 1. 找出 viewer 和 target 之间所有可能的"中间人"节点
 * 2. 找到最近的一位中间人，他/她同时与 viewer 和 target 有直接关系
 * 3. 生成 "（[viewer称呼中间人的称谓] [中间人名字] 的 [目标对中间人的关系]）" 这样的文本
 * 
 * @param viewer 当前用户节点
 * @param target 目标成员节点
 * @param members 全部家族成员列表
 * @returns 说明文字，如果是直接关系则返回 null
 */
export function getRelationshipChain(viewer: any, target: any, members: any[]): string | null {
    if (!viewer || !target || !members || members.length === 0) return null;

    const ctx = getKinshipContext(members);
    const vId = viewer?.memberId ? Number(viewer.memberId) : (viewer?.id ? Number(viewer.id) : null);
    const tId = target?.id ? Number(target.id) : null;

    if (!vId || !tId || vId === tId) return null;

    const vNode = ctx.membersMap.get(vId);
    const tNode = ctx.membersMap.get(tId);
    if (!vNode || !tNode) return null;

    // NOTE: 直接关系不需要说明（父母、子女、配偶、手足）
    const directRel = getRigorousRelationship(viewer, target, members);
    const isDirect = /^(本人|爸爸|妈妈|父亲|母亲|哥哥|弟弟|姐姐|妹妹|儿子|女儿|爷爷|奶奶|外公|外婆|孙子|孙女|曾祖父|曾祖母|老公|老婆|丈夫|妻子)$/.test(directRel);
    if (isDirect) return null;

    // 找出 target 的"直接关联者"（目标的父母 + 其配偶等）
    const targetRelatives: number[] = [];
    if (tNode.fatherId) targetRelatives.push(Number(tNode.fatherId));
    if (tNode.motherId) targetRelatives.push(Number(tNode.motherId));
    if (tNode.spouseId || tNode.spouse_id) targetRelatives.push(Number(tNode.spouseId || tNode.spouse_id));

    // 检查 viewer 是否与这些直接关联者有2跳以内的关系
    for (const relativeId of targetRelatives) {
        const relativeNode = ctx.membersMap.get(relativeId);
        if (!relativeNode) continue;
        if (relativeId === vId) continue; // viewer 就是这个亲属，不需要说明

        // 看 viewer 如何称呼这个中间人
        const viewerCallsRelative = getRigorousRelationship(viewer, relativeNode, members);
        if (!viewerCallsRelative || viewerCallsRelative === '家人' || viewerCallsRelative === '亲戚') continue;

        // 看这个中间人与 target 的关系
        const relativeCallsTarget = getRigorousRelationship(relativeNode, target, members);
        if (!relativeCallsTarget || relativeCallsTarget === '家人' || relativeCallsTarget === '亲戚') continue;

        // NOTE: 避免同义反复，例如 target 本身就是直接关系时跳过
        const isViewerDirect = /^(本人|爸爸|妈妈|父亲|母亲|哥哥|弟弟|姐姐|妹妹|儿子|女儿|爷爷|奶奶|外公|外婆)$/.test(viewerCallsRelative);
        if (isViewerDirect) continue;

        const mName = relativeNode.name || '家人';
        return `${mName}（我${viewerCallsRelative}）的${relativeCallsTarget}`;
    }

    // 第二层：找 target 的"两跳"关联者（祖父母级别）
    for (const relativeId of targetRelatives) {
        const relativeNode = ctx.membersMap.get(relativeId);
        if (!relativeNode) continue;

        const secondLevelIds: number[] = [];
        if (relativeNode.fatherId) secondLevelIds.push(Number(relativeNode.fatherId));
        if (relativeNode.motherId) secondLevelIds.push(Number(relativeNode.motherId));

        for (const sl of secondLevelIds) {
            const slNode = ctx.membersMap.get(sl);
            if (!slNode || sl === vId) continue;

            const viewerCallsSl = getRigorousRelationship(viewer, slNode, members);
            if (!viewerCallsSl || viewerCallsSl === '家人' || viewerCallsSl === '亲戚') continue;

            // target 与这个二级节点的孩子的关系
            const slCallsTarget = getRigorousRelationship(slNode, target, members);
            if (!slCallsTarget || slCallsTarget === '家人' || slCallsTarget === '亲戚') continue;

            const mName = relativeNode.name || slNode.name || '家人';
            return `${mName}（我${viewerCallsSl}的孩子）的${slCallsTarget}`;
        }
    }

    return null;
}
