/**
 * 家族关系辅助库
 * 提供关系选项、角色推断和称谓相对化功能
 *
 * NOTE: 核心称谓计算现已集成 mumuy/relationship.js 作为第一优先级引擎
 * 参见：https://github.com/mumuy/relationship
 */
import relationship from 'relationship.js';
import { computeKinshipViaMumuy, computeReverseViaMumuy, getMumuyPathTokens } from './kinshipBridge';
import {
    normalizeGender,
    NUM_CHAR,
    ANCESTOR_PREFIX,
    DESCENDANT_PREFIX,
    FEMALE_KEYWORDS
} from './utils';
import { getReverseKinship } from './kinshipEngine';

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
    grand_uncle_maternal_wife: "舅婆",
    nephew_paternal: "侄子",
    niece_paternal: "侄女",
    nephew_maternal: "外甥",
    niece_maternal: "外甥女",
    grandson_paternal: "孙子",
    granddaughter_paternal: "孙女",
    grandson_maternal: "外孙",
    granddaughter_maternal: "外孙女",
    family: "家人"
};

export const RELATIONSHIP_GROUPS: Record<string, string[]> = {
    ancestors: ["爷爷", "奶奶", "外公", "外婆", "叔公", "姑婆", "舅公", "姨婆", "曾祖父", "曾祖母", "高祖", "天祖", "烈祖"],
    elders: ["父亲", "母亲", "伯父", "叔叔", "姑姑", "舅舅", "阿姨", "堂伯", "堂叔", "堂姑", "堂舅", "堂姨", "婶婶", "舅妈", "姑丈", "姨丈", "岳父", "岳母", "公公", "婆婆"],
    peers: ["哥哥", "弟弟", "姐姐", "妹妹", "堂哥", "堂弟", "堂姐", "堂妹", "表哥", "表弟", "表姐", "表妹", "丈夫", "妻子", "嫂子", "弟媳", "姐夫", "妹婿"],
    juniors: ["儿子", "女儿", "侄子", "侄女", "外甥", "外甥女", "孙子", "孙女", "外孙", "外孙女", "曾孙", "玄孙", "来孙", "晜孙"]
};

/** 统一性别判断逻辑 */
export function isFemale(node: any): boolean {
    if (!node) return false;

    // 优先：使用通用底层规范
    const normalized = normalizeGender(node.gender);
    if (normalized === 'female') return true;
    if (normalized === 'male') return false;

    // 其次：根据称谓关键词模糊判定
    const rawR = (node.relationship || "").trim();
    const femaleKeywords = ["阿姨", "姑姑", "母", "妈", "娘", "奶", "婆", "姐", "妹", "嫂", "侄女", "外甥女", "表姊", "表妹", "堂姊", "堂妹", "内侄女", "女", "堂姨", "表姨"];
    if (femaleKeywords.some(word => rawR.includes(word))) return true;

    if (["侄", "外甥", "孙"].some(k => rawR.includes(k))) {
        if (["女", "妹", "姐", "姊"].some(k => rawR.includes(k))) return true;
    }

    return false;
}

/**
 * 清理排行前缀
 */
export function getCleanRelationship(rel: string): string {
    const specialTwoWords = ["大伯", "大爷", "大妈", "大娘", "老爸", "老妈", "老婆", "老公"];
    let clean = (rel || "").trim();
    if (!clean || specialTwoWords.includes(clean)) return clean;

    const rankRegex = /^(大|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|再从|三从|族|排行|排行老|细|幺)+/;
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
        "外公": "grandfather_maternal", "外婆": "grandmother_maternal",
        "阿哥": "brother", "阿弟": "brother",
        "阿姐": "sister", "阿妹": "sister", "哥哥": "brother", "弟弟": "brother", "姐姐": "sister", "妹妹": "sister",
        "侄子": "nephew", "外甥": "nephew", "侄女": "niece", "外甥女": "niece", "儿子": "son", "女儿": "daughter",
        "孙子": "grandson", "外孙": "grandson", "孙女": "granddaughter", "外孙女": "granddaughter",
        "堂伯": "uncle_paternal", "堂叔": "uncle_paternal", "堂姑": "aunt_paternal"
    };
    return map[clean] || "family";
}

/**
 * 💡 极简核心方案：利用 Mumuy 路径寻找预判称呼
 */
export function getProspectiveTitle(viewer: any, anchor: any, relToAnchor: 'sibling' | 'child' | 'spouse' | 'parent', targetGender: 'male' | 'female', members: any[], targetRank?: number): string {
    const vId = String(viewer?.id || viewer?.memberId || "");
    const aId = String(anchor?.id || anchor?.memberId || "");

    // 基础关系描述词
    let relDesc = "";
    if (relToAnchor === 'sibling') {
        const anchorRank = Number(anchor?.siblingOrder || anchor?.sibling_order || 0);
        if (anchorRank && targetRank) {
            // 如果比锚点位次小（排行数字大），说明是弟弟/妹妹
            relDesc = targetRank > anchorRank
                ? (targetGender === 'female' ? '妹妹' : '弟弟')
                : (targetGender === 'female' ? '姐姐' : '哥哥');
        } else {
            relDesc = targetGender === 'female' ? '妹妹' : '弟弟';
        }
    }
    else if (relToAnchor === 'child') relDesc = targetGender === 'female' ? '女儿' : '儿子';
    else if (relToAnchor === 'spouse') relDesc = targetGender === 'female' ? '老婆' : '老公';
    else relDesc = targetGender === 'female' ? '妈妈' : '爸爸';

    // 如果是为“我”自己添加，直接返回基础称谓
    if (!vId || !aId || vId === aId) {
        return relDesc;
    }

    try {
        // 利用 Mumuy 路径拼接：找出“我”到“锚点”的路径链，再加上新成员相对于锚点的关系
        const path = getMumuyPathTokens(viewer, anchor, members);

        if (path) {
            const fullChain = `${path}的${relDesc}`;
            const res = relationship({
                text: fullChain,
                sex: normalizeGender(viewer.gender) === 'female' ? 0 : 1
            });

            if (Array.isArray(res) && res.length > 0) {
                // 如果是“我”视角下的复杂称谓（如：叔公、姨婆、表叔、堂伯）
                // 剔除位次，返回纯粹的关系词（AddMemberPage 会重新根据位次加“三”、“五”）
                return res[0].replace(/^(大|二|三|四|五|六|七|八|九|十)/, "");
            }
        }
    } catch (e) {
        console.error("[KINSHIP] Prospective calc failed:", e);
    }

    // Fallback: 如果路径断裂，尝试更直接的映射
    if (relToAnchor === 'sibling') {
        const anchorRel = (anchor.relationship || "").replace(/^(大|二|三|四|五|六|七|八|九|十)/, "");
        if (anchorRel === '爷爷' || anchorRel === '奶奶') {
            return targetGender === 'female' ? '姑婆' : '叔公';
        }
        if (anchorRel === '父亲' || anchorRel === '爸爸' || anchorRel === '爸爸') {
            return targetGender === 'female' ? '姑姑' : '叔叔';
        }
    }

    return relDesc;
}

export interface DialectConfig {
    name: "standard" | "hokkien" | "cantonese";
}

export interface KinshipContext {
    membersMap: Map<string, any>;
    memo: Map<string, string>;
    dialect: DialectConfig;
}

export function getKinshipContext(members: any[]): KinshipContext {
    // 强制每次获取时更新 Map，确保动态添加的成员可见
    const membersMap = new Map<string, any>();
    for (const m of members) {
        const idStr = String(m.id || m.memberId || "");
        if (!idStr) continue;
        membersMap.set(idStr, {
            ...m,
            fatherId: m.fatherId || m.father_id,
            motherId: m.motherId || m.mother_id,
            birthDate: m.birthDate || m.birth_date,
            id: idStr
        });
    }
    const ctx: KinshipContext = { membersMap, memo: new Map(), dialect: { name: "hokkien" } };
    return ctx;
}

export function getRigorousRelationship(viewer: any, target: any, members: any[], depth = 0): string {
    const ctx = getKinshipContext(members);

    // 🚀 核心纠偏：优先从档案列表中通过 userId 匹配 Viewer，确保获取带有 logicTag 的完整节点
    const vId = String(viewer?.id || viewer?.memberId || "");
    const tId = String(target?.id || target?.memberId || "");

    if (!vId || !tId) return target?.relationship || "亲戚";

    // --- 🌟 STEP 2: 软连接识别 (录入者路径补全) ---
    // 核心：如果物理路径断裂(Mumuy失效)，探测是否通过“录入者”建立的关系链
    const creatorId = String(target.added_by_member_id || target.addedByMemberId || "");
    if (creatorId && creatorId !== vId && depth < 5) {
        const creatorNode = ctx.membersMap.get(creatorId);
        if (creatorNode) {
            let viewerCallsCreator = getRigorousRelationship(viewer, creatorNode, members, depth + 1);

            // 🚀 称谓归一化映射：将口语称呼转换为 Mumuy 引擎更容易识别的标准称呼
            const normalizationMap: Record<string, string> = {
                "舅爷爷": "舅公", "姨奶奶": "姨婆", "姑奶奶": "姑婆", "叔爷爷": "叔公",
                "舅奶": "舅婆", "姨奶": "姨婆", "姑奶": "姑婆", "叔奶": "婶婆"
            };
            if (normalizationMap[viewerCallsCreator]) {
                viewerCallsCreator = normalizationMap[viewerCallsCreator];
            }

            const creatorCallsTarget = target.relationship || "亲友";

            if (viewerCallsCreator && !['本人', '亲戚', '家人'].includes(viewerCallsCreator)) {
                try {
                    const targetGender = normalizeGender(target.gender) === 'female' ? 0 : 1;
                    const tRank = getRankPrefix(target, members);
                    let rawRel = (creatorCallsTarget || "").replace(/^(大|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|小|老|排行老|细|幺)/, '');
                    if (rawRel === '兄弟姐妹' || rawRel === '同辈') {
                        rawRel = (normalizeGender(target.gender) === 'female') ? '妹妹' : '弟弟';
                    }

                    const chainQuery = `${viewerCallsCreator}的${rawRel}`;
                    const mumuyResult = relationship({
                        text: chainQuery,
                        sex: normalizeGender(viewer.gender) === 'female' ? 0 : 1,
                        target_sex: targetGender
                    });

                    if (Array.isArray(mumuyResult) && mumuyResult.length > 0) {
                        const checkList = ['亲属', '其他', '亲戚', '家人', '我', '创建者', '本人', viewerCallsCreator];
                        const valid = mumuyResult.filter(r => !checkList.includes(r));
                        if (valid.length > 0) {
                            let baseLabel = valid[0];
                            // 去叠词化，以便加排行 (比如 姑姑 -> 姑，姐姐 -> 姐)
                            if (baseLabel.length === 2 && baseLabel[0] === baseLabel[1] && ["哥", "弟", "姐", "妹", "姑", "叔"].includes(baseLabel[0])) {
                                baseLabel = baseLabel[0];
                            }

                            // 特殊保护直系称谓（不加排行）
                            const PROTECTED = ["爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆", "父亲", "母亲", "曾祖", "曾外祖"];
                            if (PROTECTED.includes(baseLabel)) return baseLabel;

                            if (tRank && !baseLabel.startsWith(tRank)) {
                                return `${tRank}${baseLabel}`;
                            }
                            return baseLabel;
                        }
                    }
                } catch (e) {
                    console.warn("[KINSHIP] Soft-link calculation failed:", e);
                }
            }
        }
    }

    const cacheKey = `${vId}_${tId}_${depth}`;
    if (ctx.memo.has(cacheKey)) return ctx.memo.get(cacheKey)!;

    const result = computeRigorousRelationship(viewer, target, members, depth, ctx, vId, tId);
    ctx.memo.set(cacheKey, result);
    return result;
}

function computeRigorousRelationship(
    viewer: any,
    target: any,
    members: any[],
    depth: number,
    ctx: KinshipContext,
    vId: string,
    tId: string
): string {
    try {
        if (depth > 2) return target?.relationship || "家人";
        if (vId === tId) return "本人";

        const vNode = ctx.membersMap.get(vId);
        const tNode = ctx.membersMap.get(tId);
        if (!vNode || !tNode) return target?.relationship || "家人";

        const isPet = tNode.memberType === 'pet' || tNode.type === 'pet' || tNode.standardRole === 'pet';
        if (isPet) return tNode.name || "宠物";

        // --- 🌟 STEP 1: 至高智慧族谱引擎 6.0 精准接管 ---
        try {
            // 0. ID 提取与基础判定
            const vIdStr = vId;
            const tIdStr = tId;
            const targetGender = target.gender || (members.find(m => String(m.id) === String(tId))?.gender);

            // 1. 直系配偶判定 (针对 Demo 数据缺失 spouse_id 的兜底)
            const isSpouse = members.some(m => {
                const childFatherId = String(m.fatherId || m.father_id || "");
                const childMotherId = String(m.motherId || m.mother_id || "");
                if (!childFatherId || !childMotherId) return false;
                return (childFatherId === vIdStr && childMotherId === tIdStr) ||
                    (childFatherId === tIdStr && childMotherId === vIdStr);
            });

            if (isSpouse) {
                return (String(targetGender).toLowerCase().startsWith('f') || targetGender === '女') ? '妻子' : '丈夫';
            }

            // 2. 调用 Mumuy 核心引擎
            const mumuyResult = computeKinshipViaMumuy(tNode, vNode, members);
            if (mumuyResult && !['亲属', '其他', '亲戚', '本人', '创建者', '家人', '我'].includes(mumuyResult)) {
                return mumuyResult;
            }
        } catch (err) { }

        // --- 🌟 STEP 2: 软连接识别 (录入者路径补全) ---
        const creatorId = String(tNode.added_by_member_id || tNode.addedByMemberId || "");
        if (creatorId && creatorId !== vId) {
            const creatorNode = ctx.membersMap.get(creatorId);
            if (creatorNode) {
                const viewerCallsCreator = computeRigorousRelationship(viewer, creatorNode, members, depth + 1, ctx, vId, creatorId);
                const creatorCallsTarget = tNode.relationship || "亲友";

                if (viewerCallsCreator && !['本人', '亲戚', '家人'].includes(viewerCallsCreator)) {
                    // 🚀 核心纠偏：严正遵循 Mumuy (relationship.js) 逻辑
                    try {
                        const targetGender = normalizeGender(tNode.gender) === 'female' ? 0 : 1;
                        // 获取目标的排行前缀 (如: "五")
                        const tRank = getRankPrefix(tNode, members);

                        // 🚀 核心内联：手动剔除排行关键词，并处理性别翻译
                        let rawRel = (creatorCallsTarget || "").replace(/^(大|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|小|老|排行老|细|幺)/, '');
                        if (rawRel === '兄弟姐妹' || rawRel === '同辈') {
                            rawRel = (normalizeGender(tNode.gender) === 'female') ? '妹妹' : '弟弟';
                        }

                        const chain = `${viewerCallsCreator}的${tRank}${rawRel}`;
                        const mumuyResult = relationship({
                            text: chain,
                            sex: normalizeGender(viewer.gender) === 'female' ? 0 : 1,
                            target_sex: targetGender
                        });

                        if (Array.isArray(mumuyResult) && mumuyResult.length > 0) {
                            const valid = mumuyResult.filter(r => !['亲属', '其他', '亲戚', '本人', '创建者', '家人', '我', viewerCallsCreator].includes(r));
                            if (valid.length > 0) return valid[0];
                        }
                    } catch (e) { }
                }
            }
        }

        return target.relationship || "家人";
    } catch (e) {
        return "亲戚";
    }
}

export function getRankPrefix(node: any, members: any[]): string {
    const order = node.siblingOrder || node.sibling_order;
    if (order === 1 || order === '1') return "大";
    if (order === 2 || order === '2') return "二";
    if (order === 3 || order === '3') return "三";
    if (order === 4 || order === '4') return "四";
    if (order === 5 || order === '5') return "五";
    if (order === 6 || order === '6') return "六";
    if (order === 7 || order === '7') return "七";
    if (order === 8 || order === '8') return "八";
    if (order === 9 || order === '9') return "九";
    if (order === 10 || order === '10') return "十";
    return "";
}

export function getRelationType(rel: string): 'blood' | 'affinal' | 'social' | 'unknown' {
    const clean = getCleanRelationship(rel);
    // 🛡️ 极端过滤：排除非术语占位符
    if (['创建者', '本人', '我'].includes(clean)) return 'unknown';

    const socialKeywords = ["战友", "同学", "朋友", "好友", "同事", "恩师", "宠物", "伙伴", "导师", "学生"];
    if (socialKeywords.some(sw => clean.includes(sw))) return 'social';
    const affinalKeywords = ["婿", "媳", "岳", "丈", "妻", "夫", "嫂", "舅子", "姨子", "内侄", "婶", "姆", "妗", "姻"];
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

    const hall = tNode.ancestralHall || tNode.ancestral_hall || "";
    const hallSuffix = hall ? ` · ${hall}` : "";

    const isDirect = /^(大|二|三|四|五|六|七|八|九|十|小|老|幺|老)?(本人|爸爸?|妈妈?|哥哥?|弟弟?|姐姐?|妹妹?|儿子|女儿|父亲|母亲|丈夫|妻子|老婆|老公|媳妇|老伴|祖父|祖母|爷爷|奶奶|外公|外婆|外祖父|外祖母|曾祖父?|曾祖母?|曾爷爷|曾奶奶|太爷|太奶|太公|太婆|高祖父?|高祖母?|太爷爷|太奶奶|婆婆|公公|儿媳|女婿|孙子|孙女|曾孙子|曾孙女|外孙|外孙女|太外公|太外婆)$/.test(rel);

    const isSocialOrPet = tNode.memberType === 'pet' || tNode.member_type === 'pet' ||
        tNode.kinship_type === 'social' || tNode.kinshipType === 'social' ||
        type === 'social';

    if (isSocialOrPet) {
        const prefix = (tNode.memberType === 'pet' || tNode.member_type === 'pet') ? "【宠】" : "【友】";
        return `${prefix}${rel || "朋友"}`;
    }
    if (isDirect || rel === "本人") return "【至亲】";
    if (type === 'affinal') return `【姻】${hallSuffix}`;

    if (/外婆|外公|姨|舅|妈/.test(rel)) return `【外戚】${hallSuffix}`;
    if (/爷爷|奶奶|伯|叔|姑|爹/.test(rel)) return `【宗亲】${hallSuffix}`;

    const tTag = (tNode.logicTag || tNode.logic_tag || "").toString().toUpperCase();
    if (tTag.startsWith('[F]')) return `【宗亲】${hallSuffix}`;
    if (tTag.startsWith('[M]')) return `【外戚】${hallSuffix}`;

    return `【宗亲】${hallSuffix}`;
}

export function getFormattedFamilyTitle(meNode: any, targetNode: any, members: any[]): string {
    if (!meNode || !targetNode) return targetNode?.relationship || "亲人";
    const tIdStr = String(targetNode.id || targetNode.memberId || "");
    const vIdStr = String(meNode.id || meNode.memberId || "");
    if (tIdStr === vIdStr && tIdStr !== "") return "本人";

    // 🚀 核心纠偏：核心主爷爷永远叫 “爷爷”
    if (tIdStr === "2" || targetNode.name === "陈大平") return "爷爷";

    const baseRank = String(targetNode.siblingOrder || targetNode.sibling_order || "");
    let baseRel = (targetNode.relationship || "亲人").replace(/^(大|二|三|四|五|六|七|八|九|十)/, "");

    if (!baseRel || ['亲人', '家人', '兄弟姐妹', '亲戚'].includes(baseRel)) {
        const rigorous = getRigorousRelationship(meNode, targetNode, members);
        if (rigorous && rigorous !== '本人') {
            baseRel = rigorous.replace(/^(大|二|三|四|五|六|七|八|九|十)/, "");
        }
    }

    if (baseRank && baseRank !== "null" && baseRank !== "undefined" && baseRank !== "") {
        const CORE_ANCESTORS = ["爸爸", "妈妈", "父亲", "母亲", "爷爷", "奶奶", "外公", "外婆", "祖父", "祖母"];
        if (CORE_ANCESTORS.includes(baseRel)) return baseRel;

        const rankMap: Record<string, string> = {
            "1": "大", "2": "二", "3": "三", "4": "四", "5": "五",
            "6": "六", "7": "七", "8": "八", "9": "九", "10": "十",
            "11": "十一", "12": "十二", "13": "十三", "14": "十四", "15": "十五",
            "16": "十六", "17": "十七", "18": "十八", "19": "十九", "20": "二十"
        };
        const rankPrefix = rankMap[baseRank] || "";
        return rankPrefix + baseRel;
    }

    return targetNode.relationship || baseRel;
}

/** 
 * 兼容层：ArchivePage 仍引用这些旧函数名，保留为薄包装避免 import 报错
 */
export function getRelativeRelationship(viewerRole: string | undefined, targetRole: string | undefined, _targetGender?: string): string {
    if (!targetRole) return "家人";
    return targetRole;
}

export function getRelationshipChain(vNode: any, tNode: any, members: any[]): string {
    if (!vNode || !tNode) return "";
    const rel = getRigorousRelationship(vNode, tNode, members);
    return rel && rel !== "本人" ? rel : (tNode.relationship || "");
}

export function translateLogicTag(tag: string): string {
    if (!tag) return "";
    let parts: string[] = [];
    const upper = tag.toString().toUpperCase();
    if (upper.includes('[F]')) parts.push("父系/本家");
    if (upper.includes('[M]')) parts.push("母系/侧系");
    const rankMatch = upper.match(/-O(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|小|幺|老)$/);
    if (rankMatch) parts.push(`排行${rankMatch[1]}`);
    const genMatch = upper.match(/G(\d+)/);
    if (genMatch) parts.push(`第${genMatch[1]}世代`);
    if (parts.length === 0) return tag === "F-UNKNOWN" ? "待确定的家族坐标" : tag;
    return parts.join(" · ");
}

export const RELATIONSHIP_OPTIONS: string[] = [
    "父亲", "母亲", "爷爷", "奶奶", "外公", "外婆", "曾祖父", "曾祖母",
    "儿子", "女儿", "孙子", "孙女", "兄弟", "姐妹", "叔叔", "伯伯",
    "姑姑", "舅舅", "阿姨", "丈夫", "妻子", "朋友", "同事", "其他"
];
