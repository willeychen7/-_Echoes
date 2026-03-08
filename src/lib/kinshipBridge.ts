/**
 * 💡 mumuy/relationship.js 桥接层 - 62.0 宗法至尊升级版 (精准修复旁系晚辈与母系姑婆)
 * 核心修复：
 * 1. 晚辈称谓纠偏：明确区分 兄弟之子(侄) 与 姐妹之子(甥)。
 * 2. 母系祖辈旁系：外公姐妹称“姨姑婆”，外婆姐妹称“姨外婆”。
 * 3. 房分排行强化：支持“三姨姑婆”、“外二公”等特定称谓。
 */

import { normalizeGender } from './utils';

const HALL_RANK: Record<string, number> = {
    '根': 0, '根房': 0, '大房': 1, '一房': 1, '二房': 2, '三房': 3, '四房': 4, '五房': 5,
    '六房': 6, '七房': 7, '八房': 8, '九房': 9, '十房': 10, '小房': 99, '外家房': 1
};

const NUM_CHAR = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

const ANCESTOR_PREFIX = ['', '', '', '曾', '高', '太', '烈', '天', '远', '鼻'];
const DESCENDANT_PREFIX = ['', '', '', '曾', '玄', '来', '晜', '仍', '云', '耳'];

function getExplicitOrder(node: any): number {
    const raw = node.sibling_order ?? node.siblingOrder;
    if (raw !== undefined && raw !== null) return Number(raw);
    const tag = node.logic_tag || node.logicTag || "";
    const match = String(tag).match(/-o(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|小|幺|老)/i);
    if (match) {
        const val = match[1];
        const map: Record<string, number> = { '大': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20, '小': 11, '老': 11, '幺': 11 };
        return map[val] || 99;
    }
    return 99;
}

export function computeKinshipViaMumuy(
    targetNode: any,
    viewerNode: any,
    members?: any[]
): string | null {
    if (!targetNode || !viewerNode) return null;
    if (targetNode.id === viewerNode.id) return "本人";

    const getFullNode = (id: any) => id ? members?.find(m => String(m.id) === String(id)) : null;

    const tG = targetNode.generation_num || targetNode.generationNum;
    const vG = viewerNode.generation_num || viewerNode.generationNum;
    const tS = getExplicitOrder(targetNode);
    const vS = getExplicitOrder(viewerNode);
    const tSex = normalizeGender(targetNode.gender) === 'female' ? 'F' : 'M';
    const vSex = normalizeGender(viewerNode.gender) === 'female' ? 'F' : 'M';

    const tFatherId = targetNode.father_id || targetNode.fatherId;
    const vFatherId = viewerNode.father_id || viewerNode.fatherId;
    const tMotherId = targetNode.mother_id || targetNode.motherId;
    const vMotherId = viewerNode.mother_id || viewerNode.motherId;
    const vSpouseId = viewerNode.spouse_id || viewerNode.spouseId;

    const genDiff = tG - vG;

    // --- 0. 直系优先 ---
    if (String(targetNode.id) === String(vFatherId)) return "父亲";
    if (String(targetNode.id) === String(vMotherId)) return "母亲";
    if (String(tFatherId) === String(viewerNode.id) || String(tMotherId) === String(viewerNode.id)) return tSex === 'F' ? "女儿" : "儿子";

    // --- 姻亲识别 ---
    const vChildren = members?.filter(m => (String(m.father_id) === String(viewerNode.id) || String(m.mother_id) === String(viewerNode.id)));
    if (vChildren?.some(c => String(c.spouse_id) === String(targetNode.id))) return tSex === 'F' ? "儿媳" : "女婿";

    const vSpouseNode = getFullNode(vSpouseId);
    if (vSpouseNode && (String(targetNode.id) === String(vSpouseNode.father_id) || String(targetNode.id) === String(vSpouseNode.mother_id))) {
        if (vSex === 'F') return tSex === 'F' ? "婆婆" : "公公";
        return tSex === 'F' ? "岳母" : "岳父";
    }

    const isBioAncestor = isAncestorRecursive(targetNode, viewerNode, members);
    const isBioDescendant = isDescendantRecursive(targetNode, viewerNode, members);

    let effectiveVH = viewerNode.ancestral_hall;
    let effectiveVFatherId = vFatherId;
    let effectiveVMotherId = vMotherId;

    if (vSex === 'F' && vSpouseId && !isBioAncestor && !isBioDescendant) {
        if (vSpouseNode) {
            effectiveVH = vSpouseNode.ancestral_hall;
            effectiveVFatherId = vSpouseNode.father_id || vSpouseNode.fatherId;
            effectiveVMotherId = vSpouseNode.mother_id || vSpouseNode.motherId;
        }
    }

    const hT = HALL_RANK[targetNode.ancestral_hall] ?? 99;
    const hV = HALL_RANK[effectiveVH] ?? 99;

    if (isSpouse(targetNode, viewerNode)) return tSex === 'F' ? '妻子' : '丈夫';

    // --- 1. 宗法路径辩别 ---
    const lca = findLCA(targetNode, viewerNode, members);
    const viewerMaternal = lca ? isDescendantThroughDaughter(viewerNode, lca, members) : false;
    const targetMaternal = lca ? isDescendantThroughDaughter(targetNode, lca, members) : false;

    const areSiblings = (aNodeId, bNodeId) => {
        const a = getFullNode(aNodeId), b = getFullNode(bNodeId);
        if (!a || !b || String(a.id) === String(b.id)) return false;
        const af = a.father_id || a.fatherId, bf = b.father_id || b.fatherId;
        const am = a.mother_id || a.motherId, bm = b.mother_id || b.motherId;
        return (af && String(af) === String(bf)) || (am && String(am) === String(bm));
    };

    const isSibOfMother = areSiblings(targetNode.id, vMotherId);
    const isSibOfFather = areSiblings(targetNode.id, vFatherId);

    let isMaternal = viewerMaternal || targetMaternal || isSibOfMother;
    const isRealSib = (tFatherId && String(tFatherId) === String(effectiveVFatherId)) ||
        (tMotherId && String(tMotherId) === String(effectiveVMotherId));

    const rank = (tS >= 1 && tS <= 10) ? (tS === 1 ? '大' : NUM_CHAR[tS]) : '';

    // --- 2. 代际生成 ---

    // 同辈
    if (genDiff === 0) {
        // 🚀 核心纠偏：长幼逻辑
        // 如果 viewer 没有排行 (99)，而 target 有排行，且 target 关系曾经是“弟/妹”或“姐/哥”，我们应该尊重原倾向
        // 这里采用更稳健的逻辑：如果 viewer 是 99，不要轻易判定 target 为 "哥/姐"
        let isO = isRealSib ? (tS < vS) : ((hT < hV) || (hT === hV && tS < vS));

        if (vS === 99 && tS !== 99) {
            const oldRel = targetNode.relationship || "";
            if (oldRel.includes("弟") || oldRel.includes("妹")) {
                isO = false;
            } else if (oldRel.includes("哥") || oldRel.includes("姐")) {
                isO = true;
            } else {
                // 如果没有明确称谓背景，且主账号未设排行：1 为长；>1 为幼
                isO = (tS === 1);
                if (tS > 1) isO = false;
            }
        }

        const prefix = isRealSib ? '' : (isMaternal ? '表' : '堂');
        if (isO) return prefix + rank + (tSex === 'F' ? '姐' : '哥');
        return prefix + rank + (tSex === 'F' ? '妹' : '弟');
    }

    // 长一辈 (-1)
    if (genDiff === -1) {
        if (isSibOfMother) return tSex === 'F' ? rank + '姨' : rank + '舅';
        if (isSibOfFather) {
            if (tSex === 'F') return rank + '姑妈';
            const fNode = getFullNode(vFatherId);
            return (tS < (fNode?.sibling_order || 99)) ? (rank + '伯') : (rank + '叔');
        }

        const prefix = (isRealSib || targetNode.ancestral_hall === effectiveVH) ? '' : (isMaternal ? '表' : '堂');
        if (tSex === 'F') return prefix + rank + (isMaternal ? '姨' : '姑');
        return prefix + rank + ((hT < hV || tS === 1) ? '伯' : '叔');
    }

    // 晚一辈 (+1)
    if (genDiff === 1) {
        const pNode = getFullNode(tFatherId || tMotherId);
        if (areSiblings(viewerNode.id, pNode?.id)) {
            const pIsFemale = normalizeGender(pNode?.gender) === 'female';
            if (pIsFemale) return tSex === 'F' ? "外甥女" : "外甥";
            return tSex === 'F' ? "侄女" : "侄子";
        }
        if (isMaternal) return tSex === 'F' ? "外甥女" : "外甥";
        if (isRealSib) return tSex === 'F' ? "侄女" : "侄子";
        return '堂侄' + (tSex === 'F' ? '女' : '');
    }

    // 隔代
    const absGen = Math.abs(genDiff);
    if (absGen >= 2) {
        const isPast = genDiff < 0;
        const depthIdx = Math.min(absGen, 9);
        const prefixStr = isPast ? ANCESTOR_PREFIX[depthIdx] : DESCENDANT_PREFIX[depthIdx];

        if (isPast) {
            if (absGen === 2) {
                if (isBioAncestor) return (isMaternal ? "外" : "") + prefixStr + (tSex === 'F' ? "婆" : "公");

                // 旁系祖辈精准术语
                if (viewerMaternal || isMaternal) {
                    const ancSib = members?.find(m => areSiblings(m.id, targetNode.id) && isAncestorRecursive(m, viewerNode, members));
                    if (ancSib) {
                        const ancSibIsFemale = normalizeGender(ancSib.gender) === 'female';
                        if (ancSibIsFemale) return rank + "姨外婆"; // 外婆的姐妹
                        if (tSex === 'F') return rank + "姨姑婆"; // 外公的姐妹 (用户特定要求)
                        return "外" + rank + "公"; // 外公的兄弟
                    }
                    if (tSex === 'M') return "外" + rank + "公";
                    return rank + (isMaternal ? '姨' : '堂') + (tSex === 'F' ? '婆' : '公');
                }
                const hSide = hT === hV ? "" : "堂";
                return hSide + rank + (tSex === 'F' ? '奶奶' : '爷爷');
            }
            const sidePrefix = (isBioAncestor || hT === hV) ? '' : (isMaternal ? '外' : '堂');
            return sidePrefix + prefixStr + (tSex === 'F' ? '奶奶' : '爷爷');
        } else {
            const sidePrefix = (isBioDescendant || hT === hV) ? "" : (isMaternal ? "外" : "堂");
            return sidePrefix + prefixStr + (tSex === 'F' ? '孙女' : '孙子');
        }
    }

    return targetNode.relationship || "亲戚";
}

function isSpouse(a: any, b: any) { return a && b && (String(a.spouse_id) === String(b.id) || String(b.spouse_id) === String(a.id)); }

function isAncestorRecursive(target, start, members) {
    if (!start || !target) return false;
    if (String(start.id) === String(target.id)) return true;
    const fId = start.father_id || start.fatherId;
    const mId = start.mother_id || start.motherId;
    return isAncestorRecursive(target, members?.find(m => String(m.id) === String(fId)), members) ||
        isAncestorRecursive(target, members?.find(m => String(m.id) === String(mId)), members);
}

function isDescendantRecursive(target, ancestor, members) {
    if (!target || !ancestor) return false;
    if (String(target.id) === String(ancestor.id)) return true;
    const fId = target.father_id || target.fatherId;
    const mId = target.mother_id || target.motherId;
    return isDescendantRecursive(members?.find(m => String(m.id) === String(fId)), ancestor, members) ||
        isDescendantRecursive(members?.find(m => String(m.id) === String(mId)), ancestor, members);
}

function findLCA(a, b, members) {
    const getAncestors = (node) => {
        const res = new Set();
        let curr = [node];
        while (curr.length) {
            const n = curr.pop();
            if (!n || res.has(String(n.id))) continue;
            res.add(String(n.id));
            curr.push(members?.find(m => String(m.id) === String(n.father_id || n.fatherId)));
            curr.push(members?.find(m => String(m.id) === String(n.mother_id || n.motherId)));
        }
        return res;
    };
    const bAncs = getAncestors(b);
    let queue = [a];
    const visited = new Set();
    while (queue.length) {
        const n = queue.shift();
        if (!n || visited.has(String(n.id))) continue;
        visited.add(String(n.id));
        if (bAncs.has(String(n.id))) return n;
        queue.push(members?.find(m => String(m.id) === String(n.father_id || n.fatherId)));
        queue.push(members?.find(m => String(m.id) === String(n.mother_id || n.motherId)));
    }
    return null;
}

function isDescendantThroughDaughter(target, ancestor, members) {
    if (!target || !ancestor || String(target.id) === String(ancestor.id)) return false;
    let node = target;
    const visited = new Set();
    while (node && !visited.has(String(node.id)) && String(node.id) !== String(ancestor.id)) {
        visited.add(String(node.id));
        const mId = node.mother_id || node.motherId;
        const fId = node.father_id || node.fatherId;
        if (mId) {
            const m = members.find(m => String(m.id) === String(mId));
            if (String(mId) === String(ancestor.id)) return true;
            if (isAncestorRecursive(ancestor, m, members)) return true;
        }
        if (fId) {
            const f = members.find(m => String(m.id) === String(fId));
            if (String(fId) === String(ancestor.id)) return false;
            if (isAncestorRecursive(ancestor, f, members)) {
                node = f;
                continue;
            }
        }
        break;
    }
    return false;
}

export function computeReverseViaMumuy(m: string, s: 'male' | 'female'): string | null { return null; }
