/**
 * 💡 mumuy/relationship.js 桥接层 - 61.0 宗法极限巅峰版 (上下五代 + 左右五房)
 * 核心修复：母系祖辈旁系称谓定制 (外二公/三姑婆/姨外婆)、邻接手足判定鲁棒化
 */

const HALL_RANK: Record<string, number> = {
    '根': 0, '根房': 0, '大房': 1, '一房': 1, '二房': 2, '三房': 3, '四房': 4, '五房': 5,
    '六房': 6, '七房': 7, '八房': 8, '九房': 9, '十房': 10, '小房': 99, '外家房': 1
};

const NUM_CHAR = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

// 祖辈深度前缀
const ANCESTOR_PREFIX = ['', '', '', '曾', '高', '太', '烈', '天', '远', '鼻'];
// 孙辈深度前缀
const DESCENDANT_PREFIX = ['', '', '', '曾', '玄', '来', '晜', '仍', '云', '耳'];

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
    const tSex = (targetNode.gender === 'female' || targetNode.gender === '女') ? 'F' : 'M';
    const vSex = (viewerNode.gender === 'female' || viewerNode.gender === '女') ? 'F' : 'M';
    const tS = targetNode.sibling_order ?? targetNode.siblingOrder ?? 99;
    const vS = viewerNode.sibling_order ?? viewerNode.siblingOrder ?? 99;

    const tFatherId = targetNode.father_id || targetNode.fatherId;
    const vFatherId = viewerNode.father_id || viewerNode.fatherId;
    const tMotherId = targetNode.mother_id || targetNode.motherId;
    const vMotherId = viewerNode.mother_id || viewerNode.motherId;
    const vSpouseId = viewerNode.spouse_id || viewerNode.spouseId;

    const genDiff = tG - vG;

    // --- 0. 直系优先判定 ---
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

    // --- 1. 深度宗法路径辨析 ---
    const lca = findLCA(targetNode, viewerNode, members);
    const viewerMaternal = lca ? isDescendantThroughDaughter(viewerNode, lca, members) : false;
    const targetMaternal = lca ? isDescendantThroughDaughter(targetNode, lca, members) : false;

    const areSiblings = (aId, bId) => {
        const a = getFullNode(aId), b = getFullNode(bId);
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

    // --- 2. 代际生成 ---

    // 同辈
    if (genDiff === 0) {
        const isO = isRealSib ? (tS < vS) : ((hT < hV) || (hT === hV && tS < vS));
        const prefix = isRealSib ? '' : (isMaternal ? '表' : '堂');
        let rankText = (isRealSib || targetNode.ancestral_hall === effectiveVH) ?
            ((tS >= 1 && tS <= 10) ? (tS === 1 ? '大' : NUM_CHAR[tS]) : '') : '';
        if (isO) return prefix + rankText + (tSex === 'F' ? '姐' : '哥');
        return prefix + rankText + (tSex === 'F' ? '妹' : '弟');
    }

    // 长一辈 (-1)
    if (genDiff === -1) {
        const rank = (tS >= 1 && tS <= 10) ? (tS === 1 ? '大' : NUM_CHAR[tS]) : '';
        if (isSibOfMother) return tSex === 'F' ? rank + '姨' : rank + '舅';
        if (isSibOfFather) {
            if (tSex === 'F') return rank + '姑妈';
            const fNode = getFullNode(vFatherId);
            return (tS < (fNode?.sibling_order || 99)) ? (rank + '伯') : (rank + '叔');
        }

        const prefix = (isRealSib || targetNode.ancestral_hall === effectiveVH) ? '' : (isMaternal ? '表' : '堂');
        if (viewerMaternal && lca && (String(lca.id) === String(tFatherId) || String(lca.id) === String(tMotherId))) return prefix + rank + (tSex === 'F' ? '姨婆' : '舅公');
        if (tSex === 'F') return prefix + rank + (isMaternal ? '姨' : '姑');
        return prefix + rank + ((hT < hV || tS === 1) ? '伯' : '叔');
    }

    // 晚一辈 (+1)
    if (genDiff === 1) {
        const isChildOfRealSib = areSiblings(viewerNode.id, tFatherId) || areSiblings(viewerNode.id, tMotherId);
        if (isMaternal) return tSex === 'F' ? "外甥女" : "外甥";
        if (isRealSib || isChildOfRealSib) return tSex === 'F' ? "侄女" : "侄子";
        return '堂侄' + (tSex === 'F' ? '女' : '');
    }

    // 隔代
    const absGen = Math.abs(genDiff);
    if (absGen >= 2) {
        const isPast = genDiff < 0;
        const depthIdx = Math.min(absGen, 9);
        const prefixStr = isPast ? ANCESTOR_PREFIX[depthIdx] : DESCENDANT_PREFIX[depthIdx];

        if (isPast) {
            const sidePrefix = (isBioAncestor || hT === hV) ? '' : (isMaternal ? '外' : '堂');
            if (absGen === 2) {
                if (isBioAncestor) return (isMaternal ? "外" : "") + prefixStr + (tSex === 'F' ? "婆" : "公");

                // 旁系祖辈校准
                const r = rankPrefix(tS);
                if (viewerMaternal || isMaternal) {
                    const ancSib = members?.find(m => areSiblings(m.id, targetNode.id) && isAncestorRecursive(m, viewerNode, members));
                    if (ancSib) {
                        if (ancSib.gender === 'female' || ancSib.gender === '女') return r + "姨外婆"; // 外婆系统
                        if (tSex === 'F') return r + "姑婆"; // 外公的姐妹
                        return "外" + r + "公"; // 外公的兄弟
                    }
                    if (tSex === 'M') return "外" + r + "公";
                    return r + sidePrefix + (tSex === 'F' ? '婆' : '公');
                }
            }
            return sidePrefix + prefixStr + (tSex === 'F' ? '奶奶' : '爷爷');
        } else {
            const sidePrefix = (isBioDescendant || hT === hV) ? "" : (isMaternal ? "外" : "堂");
            return sidePrefix + prefixStr + (tSex === 'F' ? '孙女' : '孙子');
        }
    }

    return targetNode.relationship || "亲戚";
}

function rankPrefix(s) { return (s >= 1 && s <= 10) ? (s === 1 ? '大' : NUM_CHAR[s]) : ''; }

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
