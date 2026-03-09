/**
 * 💡 mumuy/relationship.js 桥接层 - 62.0 宗法至尊升级版 (精准修复旁系晚辈与母系姑婆)
 * 核心修复：
 * 1. 晚辈称谓纠偏：明确区分 兄弟之子(侄) 与 姐妹之子(甥)。
 * 2. 母系祖辈旁系：外公姐妹称“姨姑婆”，外婆姐妹称“姨外婆”。
 * 3. 房分排行强化：支持“三姨姑婆”、“外二公”等特定称谓。
 */

import {
    normalizeGender,
    NUM_CHAR,
    ANCESTOR_PREFIX,
    DESCENDANT_PREFIX
} from './utils';

const HALL_RANK: Record<string, number> = {
    '根': 0, '根房': 0, '大房': 1, '一房': 1, '二房': 2, '三房': 3, '四房': 4, '五房': 5,
    '六房': 6, '七房': 7, '八房': 8, '九房': 9, '十房': 10, '小房': 99, '外家房': 1
};

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

    const tG = targetNode.generation_num ?? targetNode.generationNum;
    const vG = viewerNode.generation_num ?? viewerNode.generationNum;

    // Normalize data access for both DB and API patterns
    const getVal = (node: any, keys: string[]) => {
        for (const k of keys) if (node[k] !== undefined) return node[k];
        return undefined;
    };

    const targetHall = getVal(targetNode, ['ancestral_hall', 'ancestralHall']);
    const viewerHall = getVal(viewerNode, ['ancestral_hall', 'ancestralHall']);
    const targetBD = getVal(targetNode, ['birth_date', 'birthDate']);
    const viewerBD = getVal(viewerNode, ['birth_date', 'birthDate']);

    const tS = getExplicitOrder(targetNode);
    const vS = getExplicitOrder(viewerNode);
    const tIsFemale = normalizeGender(getVal(targetNode, ['gender'])) === 'female';
    const vIsFemale = normalizeGender(getVal(viewerNode, ['gender'])) === 'female';

    const tFatherId = getVal(targetNode, ['father_id', 'fatherId']);
    const vFatherId = getVal(viewerNode, ['father_id', 'fatherId']);
    const tMotherId = getVal(targetNode, ['mother_id', 'motherId']);
    const vMotherId = getVal(viewerNode, ['mother_id', 'motherId']);
    const vSpouseId = getVal(viewerNode, ['spouse_id', 'spouseId']);

    const genDiff = tG - vG;

    // --- 0. 直系优先 ---
    if (String(targetNode.id) === String(vFatherId)) return "父亲";
    if (String(targetNode.id) === String(vMotherId)) return "母亲";
    if (String(tFatherId) === String(viewerNode.id) || String(tMotherId) === String(viewerNode.id)) return tIsFemale ? "女儿" : "儿子";

    if (isSpouse(targetNode, viewerNode)) return tIsFemale ? '妻子' : '丈夫';

    const vSpouseNode = getFullNode(vSpouseId);

    // --- 姻亲：配偶的父母 → 公婆/岳父母 ---
    if (vSpouseNode && (String(targetNode.id) === String(getVal(vSpouseNode, ['father_id', 'fatherId'])) || String(targetNode.id) === String(getVal(vSpouseNode, ['mother_id', 'motherId'])))) {
        if (vIsFemale) return tIsFemale ? "婆婆" : "公公";
        return tIsFemale ? "岳母" : "岳父";
    }

    const areSiblings = (aNodeId: any, bNodeId: any) => {
        const a = getFullNode(aNodeId), b = getFullNode(bNodeId);
        if (!a || !b || String(a.id) === String(b.id)) return false;
        const af = getVal(a, ['father_id', 'fatherId']), bf = getVal(b, ['father_id', 'fatherId']);
        const am = getVal(a, ['mother_id', 'motherId']), bm = getVal(b, ['mother_id', 'motherId']);
        return (af && String(af) === String(bf)) || (am && String(am) === String(bm));
    };

    // --- 姻亲：配偶的兄弟姐妹（大伯/叔/大姑/小姑，或大舅子/小舅子/大姨子等）---
    if (vSpouseId && vSpouseNode && genDiff === 0) {
        if (areSiblings(targetNode.id, vSpouseNode.id)) {
            const spouseOrder = getExplicitOrder(vSpouseNode);
            const tOrder = getExplicitOrder(targetNode);
            const earlyRank = (tS >= 1 && tS <= 20) ? (tS === 1 ? '大' : NUM_CHAR[tS] || '') : '';
            if (vIsFemale) {
                // 妻子视角：丈夫的兄弟 → 大伯/叔；丈夫的姐妹 → 大姑/小姑
                if (tIsFemale) return (tOrder < spouseOrder ? earlyRank + '大姑' : earlyRank + '小姑');
                return (tOrder < spouseOrder ? earlyRank + '大伯' : earlyRank + '叔');
            } else {
                // 丈夫视角：妻子的兄弟 → 大舅子/小舅子；妻子的姐妹 → 大姨子/小姨子
                if (tIsFemale) return (tOrder < spouseOrder ? earlyRank + '大姨子' : earlyRank + '小姨子');
                return (tOrder < spouseOrder ? earlyRank + '大舅子' : earlyRank + '小舅子');
            }
        }
    }

    // --- 姻亲识别 ---
    // 检查 target 是否直接是 viewer 的配偶的儿媳/女婿
    const vChildren = members?.filter(m => (String(getVal(m, ['father_id', 'fatherId'])) === String(viewerNode.id) || String(getVal(m, ['mother_id', 'motherId'])) === String(viewerNode.id)));
    if (vChildren?.some(c => String(getVal(c, ['spouse_id', 'spouseId'])) === String(targetNode.id))) return tIsFemale ? "儿媳" : "女婿";
    // 检查 target 是否是某个孩子的父母的配偶 (儿媳/女婿 - 从目标角度)
    if (vChildren?.some(c => {
        const cSpouseId = getVal(c, ['spouse_id', 'spouseId']);
        return cSpouseId && String(cSpouseId) === String(targetNode.id);
    })) return tIsFemale ? "儿媳" : "女婿";
    // 检查 target 是否与 viewer 的某个孩子是配偶关系（反向）
    const targetSpouseId = getVal(targetNode, ['spouse_id', 'spouseId']);
    if (targetSpouseId && vChildren?.some(c => String(c.id) === String(targetSpouseId))) return tIsFemale ? "儿媳" : "女婿";

    // --- 姻亲：target 是 viewer 亲兄弟/姐妹的配偶 → 妹夫/姐夫/弟妹/嫂子 ---
    // 例：外婆大姐 → 外公（外婆的丈夫）= 妹夫
    const vSiblings = members?.filter(m => {
        if (String(m.id) === String(viewerNode.id)) return false;
        const mF = getVal(m, ['father_id', 'fatherId']);
        const mM = getVal(m, ['mother_id', 'motherId']);
        return (vFatherId && mF && String(mF) === String(vFatherId)) ||
            (vMotherId && mM && String(mM) === String(vMotherId));
    });
    const sibWithTargetAsSpouse = vSiblings?.find(sib => {
        const sibSpouseId = getVal(sib, ['spouse_id', 'spouseId']);
        return sibSpouseId && String(sibSpouseId) === String(targetNode.id);
    });
    if (sibWithTargetAsSpouse) {
        const sibIsFemale = normalizeGender(sibWithTargetAsSpouse.gender) === 'female';
        const sibOrder = getExplicitOrder(sibWithTargetAsSpouse);
        const vOrder = getExplicitOrder(viewerNode);
        const sibIsOlderThanViewer = sibOrder < vOrder;
        if (sibIsFemale) {
            // 妹妹/姐姐的丈夫 → 妹夫/姐夫
            return sibIsOlderThanViewer ? "姐夫" : "妹夫";
        } else {
            // 哥哥/弟弟的妻子 → 嫂子/弟妹
            return sibIsOlderThanViewer ? "嫂子" : "弟妹";
        }
    }

    // --- 检测 target 是否是 viewer 亲兄弟/姐妹的子女或其配偶 ---
    // 例1：外婆大姐 → 妈妈（外婆的女儿）= 外甥女
    // 例2：外婆大姐 → 爸爸（外婆的女婿）= 外甥女婿
    const sibWithTargetAsChildOrSpouse = vSiblings?.find(sib => {
        const sibId = String(sib.id);
        // 直接子女
        if (String(tFatherId) === sibId || String(tMotherId) === sibId) return true;
        // 子女的配偶
        const sibChildren = members?.filter(m => (String(getVal(m, ['father_id', 'fatherId'])) === sibId || String(getVal(m, ['mother_id', 'motherId'])) === sibId));
        if (sibChildren?.some(c => {
            const cSpouseId = getVal(c, ['spouse_id', 'spouseId']);
            return cSpouseId && String(cSpouseId) === String(targetNode.id);
        })) return true;
        return false;
    });

    if (sibWithTargetAsChildOrSpouse) {
        const sibIsFemale = normalizeGender(sibWithTargetAsChildOrSpouse.gender) === 'female';
        // 判定是直接子女还是子女配偶
        const isSpouseOfChild = !(String(tFatherId) === String(sibWithTargetAsChildOrSpouse.id) || String(tMotherId) === String(sibWithTargetAsChildOrSpouse.id));

        if (sibIsFemale) {
            if (isSpouseOfChild) return tIsFemale ? "外甥媳妇" : "外甥女婿";
            return tIsFemale ? "外甥女" : "外甥";
        } else {
            if (isSpouseOfChild) return tIsFemale ? "侄媳妇" : "侄女婿";
            return tIsFemale ? "侄女" : "侄子";
        }
    }

    // --- 检测 target 是否是 viewer 亲兄弟/姐妹的孙辈 (甥孙/侄孙) ---
    const sibWithTargetAsGrandchild = vSiblings?.find(sib => isDescendantRecursive(targetNode, sib, members) && Math.abs((targetNode.generation_num || targetNode.generationNum) - (sib.generation_num || sib.generationNum)) === 2);
    if (sibWithTargetAsGrandchild) {
        const sibIsFemale = normalizeGender(sibWithTargetAsGrandchild.gender) === 'female';
        const prefix = sibIsFemale ? "甥孙" : "侄孙";
        return prefix + (tIsFemale ? "女" : "");
    }

    // --- 姻亲原逻辑兜底：子女的配偶的父母 ---
    const vChildrenSpouseParents: number[] = [];
    vChildren?.forEach(child => {
        const childSpouseId = getVal(child, ['spouse_id', 'spouseId']);
        if (!childSpouseId) return;
        const childSpouseNode = getFullNode(childSpouseId);
        if (!childSpouseNode) return;
        const csF = getVal(childSpouseNode, ['father_id', 'fatherId']);
        const csM = getVal(childSpouseNode, ['mother_id', 'motherId']);
        if (csF) vChildrenSpouseParents.push(Number(csF));
        if (csM) vChildrenSpouseParents.push(Number(csM));
    });
    if (vChildrenSpouseParents.includes(Number(targetNode.id))) {
        return tIsFemale ? "亲家母" : "亲家公";
    }    // --- 姻亲扩展：递归 Qin-jia 检测 ---
    const isTargetQinJia = () => {
        // 如果 viewer 或其配偶与 target 有共同祖先，优先走血缘/近姻亲（公婆岳父母/内亲）逻辑
        if (findLCA(targetNode, viewerNode, members)) return false;
        if (vSpouseId && findLCA(targetNode, getFullNode(vSpouseId), members)) return false;

        const isCoreLineage = String(targetNode.id) === String(viewerNode.id) ||
            String(targetNode.id) === String(vSpouseId) ||
            String(targetNode.id) === String(vFatherId) ||
            String(targetNode.id) === String(vMotherId) ||
            vSiblings?.some(s => String(s.id) === String(targetNode.id));
        if (isCoreLineage) return false;

        const vLineageMembers = [viewerNode, ...(vSiblings || [])];
        const vAllDescendantsIds = new Set<string>();
        vLineageMembers.forEach(m => {
            vAllDescendantsIds.add(String(m.id));
            members?.forEach(potentialDesc => {
                if (isDescendantRecursive(potentialDesc, m, members)) {
                    vAllDescendantsIds.add(String(potentialDesc.id));
                }
            });
        });

        return members?.some(m => {
            const targetSpouseIdOfLineage = getVal(m, ['spouse_id', 'spouseId']);
            if (!targetSpouseIdOfLineage || !vAllDescendantsIds.has(String(targetSpouseIdOfLineage))) return false;

            const tF = getVal(targetNode, ['father_id', 'fatherId']);
            const tM = getVal(targetNode, ['mother_id', 'motherId']);
            const tSibs = members?.filter(sib => {
                const sibF = getVal(sib, ['father_id', 'fatherId']);
                const sibM = getVal(sib, ['mother_id', 'motherId']);
                return (tF && sibF && String(sibF) === String(tF)) ||
                    (tM && sibM && String(sibM) === String(tM)) ||
                    (String(sib.id) === String(targetNode.id));
            });

            return tSibs?.some(sib => isAncestorRecursive(sib, m, members) || String(sib.id) === String(m.id));
        });
    };

    if (isTargetQinJia()) {
        return tIsFemale ? "亲家母" : "亲家公";
    }
    const isBioAncestor = isAncestorRecursive(targetNode, viewerNode, members);
    const isBioDescendant = isDescendantRecursive(targetNode, viewerNode, members);

    let effectiveVH = viewerHall;
    let effectiveVFatherId = vFatherId;
    let effectiveVMotherId = vMotherId;

    if (vIsFemale && vSpouseId && !isBioAncestor && !isBioDescendant) {
        if (vSpouseNode) {
            effectiveVH = getVal(vSpouseNode, ['ancestral_hall', 'ancestralHall']);
            effectiveVFatherId = getVal(vSpouseNode, ['father_id', 'fatherId']);
            effectiveVMotherId = getVal(vSpouseNode, ['mother_id', 'motherId']);
        }
    }

    const hT = HALL_RANK[targetHall] ?? 99;
    const hV = HALL_RANK[effectiveVH] ?? 99;

    if (isSpouse(targetNode, viewerNode)) return tIsFemale ? '妻子' : '丈夫';

    // --- 1. 宗法路径辩别 ---
    const lca = findLCA(targetNode, viewerNode, members);
    const viewerMaternal = lca ? isDescendantThroughDaughter(viewerNode, lca, members) : false;
    const targetMaternal = lca ? isDescendantThroughDaughter(targetNode, lca, members) : false;

    const isSibOfMother = areSiblings(targetNode.id, effectiveVMotherId);
    const isSibOfFather = areSiblings(targetNode.id, effectiveVFatherId);

    let isMaternal = viewerMaternal || targetMaternal || isSibOfMother;
    // NOTE: 亲兄弟姐妹判断必须使用「原始」父母ID，而非经配偶代理的 effectiveVFatherId
    // 否则已婚女性的亲兄妹会被误判为堂亲
    const isRealSib = (tFatherId && String(tFatherId) === String(vFatherId)) ||
        (tMotherId && String(tMotherId) === String(vMotherId));

    // 补充：如果 viewer 已婚，且 target 是配偶的亲兄弟/姐妹 → 先行处理
    // 区分 viewer 性别：男性视角叫「大舅子/姨子」，女性视角叫「大伯/叔/大姑/小姑」
    if (vSpouseId && vSpouseNode && genDiff === 0) {
        if (areSiblings(targetNode.id, vSpouseNode.id)) {
            const spouseOrder = getExplicitOrder(vSpouseNode);
            const earlyRank = (tS >= 1 && tS <= 20) ? (tS === 1 ? '大' : NUM_CHAR[tS] || '') : '';
            if (vIsFemale) {
                // 妻子视角：丈夫的兄弟 → 大伯/叔；丈夫的姐妹 → 大姑/小姑
                if (tIsFemale) return (tS < spouseOrder ? earlyRank + '大姑' : earlyRank + '小姑');
                return (tS < spouseOrder ? earlyRank + '大伯' : earlyRank + '叔');
            } else {
                // 丈夫视角：妻子的兄弟 → 大舅子/小舅子；妻子的姐妹 → 大姨子/小姨子
                if (tIsFemale) return (tS < spouseOrder ? earlyRank + '大姨子' : earlyRank + '小姨子');
                return (tS < spouseOrder ? earlyRank + '大舅子' : earlyRank + '小舅子');
            }
        }
    }

    // 🚀 核心：亲手足生日排序诱导排行 (针对未明确设置排行的情况)
    let finalTS = tS;
    let finalVS = vS;
    if (members && isRealSib) {
        const getBirthRank = (node: any, fId: any, mId: any) => {
            const bd = getVal(node, ['birth_date', 'birthDate']);
            if (!bd) return 99;
            const sibs = members.filter(m =>
                (fId && String(getVal(m, ['father_id', 'fatherId'])) === String(fId)) ||
                (mId && String(getVal(m, ['mother_id', 'motherId'])) === String(mId)) ||
                (targetHall && getVal(m, ['ancestral_hall', 'ancestralHall']) === targetHall)
            );
            const sortedBDs = sibs.filter(s => getVal(s, ['birth_date', 'birthDate']))
                .sort((a, b) => new Date(getVal(a, ['birth_date', 'birthDate'])).getTime() - new Date(getVal(b, ['birth_date', 'birthDate'])).getTime());
            const idx = sortedBDs.findIndex(s => String(s.id) === String(node.id));
            return idx !== -1 ? idx + 1 : 99;
        };
        if (finalTS === 99) finalTS = getBirthRank(targetNode, tFatherId, tMotherId);
        if (finalVS === 99) finalVS = getBirthRank(viewerNode, effectiveVFatherId, effectiveVMotherId);
    }

    const rank = (finalTS >= 1 && finalTS <= 20) ? (finalTS === 1 ? '大' : NUM_CHAR[finalTS] || finalTS) : '';

    // --- 2. 代际生成 ---

    // 同辈
    if (genDiff === 0) {
        // 🚀 核心纠偏：长幼逻辑
        let isO = isRealSib ? (finalTS < finalVS) : ((hT < hV) || (hT === hV && tS < vS));

        // 如果通过排行/房分无法区分，且有生日数据，则由生日确认为准
        if (finalTS === finalVS) {
            const tB = targetNode.birth_date || targetNode.birthDate;
            const vB = viewerNode.birth_date || viewerNode.birthDate;
            if (tB && vB) {
                isO = new Date(tB).getTime() < new Date(vB).getTime();
            }
        }

        // 启发式：如果最终还是无法确定某个视角
        if (finalVS === 99 && finalTS !== 99) {
            const oldRel = targetNode.relationship || "";
            if (oldRel.includes("弟") || oldRel.includes("妹")) {
                isO = false;
            } else if (oldRel.includes("哥") || oldRel.includes("姐")) {
                isO = true;
            } else {
                // 如果没有明确倾向，回归排行索引比较：2 < 99 = true (哥/姐)
                isO = (finalTS < finalVS);
            }
        }

        if (!lca && !isRealSib && !isSpouse(targetNode, viewerNode)) return targetNode.relationship || "亲戚";

        // 计算堂/表兄弟姊妹的具体称谓（再从、三从等）
        const distV = lca ? getGenerationDistance(viewerNode, lca, members) : 0;
        let cousinPrefix = isRealSib ? '' : (isMaternal ? '表' : '堂');

        if (!isRealSib && !isMaternal && distV >= 3) {
            if (distV === 3) cousinPrefix = '再从';
            else if (distV === 4) cousinPrefix = '三从';
            else cousinPrefix = '族';
        }

        // 精准修正：如果 target 的父母是女性，且该女性是 viewer 父亲的姐妹（姑姑）→ 表亲
        if (!isRealSib) {
            const tMother = tMotherId ? getFullNode(tMotherId) : null;
            const tFather = tFatherId ? getFullNode(tFatherId) : null;
            const parentIsAunt = (tMother && areSiblings(tMother.id, vFatherId)) ||
                (tFather && areSiblings(tFather.id, vMotherId));
            if (parentIsAunt) cousinPrefix = '表';
        }

        if (isO) return cousinPrefix + rank + (tIsFemale ? '姐' : '哥');
        return cousinPrefix + rank + (tIsFemale ? '妹' : '弟');
    }

    // 长一辈 (-1)
    if (genDiff === -1) {
        if (isSibOfMother) return tIsFemale ? rank + '姨' : rank + '舅';
        if (isSibOfFather) {
            if (tIsFemale) return rank + '姑妈';
            const fNode = getFullNode(vFatherId);
            const fOrder = getExplicitOrder(fNode);
            return (tS < fOrder) ? (rank + '伯') : (rank + '叔');
        }

        if (!lca) return targetNode.relationship || "亲戚";

        const distV = getGenerationDistance(viewerNode, lca, members);

        // --- 核心修正：判断是否为母亲的堂/表兄弟姐妹 (堂舅/表舅/堂姨/表姨) ---
        // 1. 如果路径是从母亲向上的 (viewerMaternal)
        if (viewerMaternal) {
            const distToLCAFromTarget = getGenerationDistance(targetNode, lca, members);
            if (distToLCAFromTarget >= 2) {
                // 目标是通过其祖辈链接到 LCA 的，所以是母亲的堂/表亲
                const prefix = targetMaternal ? '表' : '堂';
                return tIsFemale ? rank + prefix + "姨" : rank + prefix + "舅";
            }
        }

        let prefix = (isRealSib || targetNode.ancestral_hall === effectiveVH) ? '' : (isMaternal ? '表' : '堂');
        if (!isMaternal && distV >= 4) {
            prefix = distV === 4 ? '再从' : '族';
        }

        if (tIsFemale) return prefix + rank + (isMaternal ? '姨' : '姑');
        return prefix + rank + ((hT < hV || tS === 1) ? '伯' : '叔');
    }

    // 晚一辈 (+1)
    if (genDiff === 1) {
        const pNode = getFullNode(tFatherId || tMotherId);
        if (areSiblings(viewerNode.id, pNode?.id)) {
            const pIsFemale = normalizeGender(pNode?.gender) === 'female';
            if (pIsFemale) return tIsFemale ? "外甥女" : "外甥";
            return tIsFemale ? "侄女" : "侄子";
        }
        if (!lca) return targetNode.relationship || "亲戚";
        if (isMaternal) return tIsFemale ? "外甥女" : "外甥";
        if (isRealSib) return tIsFemale ? "侄女" : "侄子";
        return '堂侄' + (tIsFemale ? '女' : '');
    }

    // 隔代
    const absGen = Math.abs(genDiff);
    if (absGen >= 2) {
        const isPast = genDiff < 0;
        const depthIdx = Math.min(absGen, 9);
        const prefixStr = isPast ? ANCESTOR_PREFIX[depthIdx] : DESCENDANT_PREFIX[depthIdx];

        if (isPast) {
            if (isBioAncestor) {
                const viewerFather = vFatherId ? getFullNode(vFatherId) : null;
                const throughFather = viewerFather ? isAncestorRecursive(targetNode, viewerFather, members) : false;
                const suffix = absGen === 2 ? (tIsFemale ? "奶奶" : "爷爷") : (tIsFemale ? "祖母" : "祖父");
                if (throughFather) return prefixStr + suffix;
                return "外" + prefixStr + suffix;
            }

            // 旁系祖辈及其配偶（如：婶婆、舅婆、姨公、姑爷）
            // 如果 target 是配偶，则解析到其丈夫/妻子
            const spouseId = getVal(targetNode, ['spouse_id', 'spouseId']);
            const effectiveTarget = spouseId ? getFullNode(spouseId) : targetNode;
            const isTargetSpouse = !!spouseId;

            const ancSib = members?.find(m => areSiblings(m.id, effectiveTarget.id) && isAncestorRecursive(m, viewerNode, members));
            const lineageNode = ancSib || effectiveTarget;
            const lcaOfLineage = findLCA(lineageNode, viewerNode, members);
            const throughMother = lcaOfLineage ? isDescendantThroughDaughter(viewerNode, lcaOfLineage, members) : false;

            if (ancSib) {
                const ancSibIsFemale = normalizeGender(ancSib.gender) === 'female';
                const bloodIsFemale = normalizeGender(effectiveTarget.gender) === 'female';

                if (absGen === 2) {
                    if (throughMother) {
                        // 母系 (外公/外婆一侧)
                        if (bloodIsFemale) {
                            // 姐妹
                            if (isTargetSpouse) return rank + "姨外公";
                            return rank + "姨外婆";
                        } else {
                            // 兄弟
                            if (isTargetSpouse) return rank + "舅外婆";
                            return rank + "舅外公";
                        }
                    } else {
                        // 父系 (爷爷/奶奶一侧)
                        if (bloodIsFemale) {
                            // 姐妹
                            if (isTargetSpouse) return rank + "姑爷爷";
                            return rank + "姑奶奶";
                        } else {
                            // 兄弟
                            if (isTargetSpouse) {
                                const bloodOrder = getExplicitOrder(effectiveTarget);
                                const ancOrder = getExplicitOrder(ancSib);
                                return bloodOrder < ancOrder ? rank + "伯婆" : rank + "婶婆";
                            }
                            return (getExplicitOrder(effectiveTarget) < getExplicitOrder(ancSib) ? rank + "伯公" : rank + "叔公");
                        }
                    }
                }
            }

            const suffix = absGen === 2 ? (tIsFemale ? "奶奶" : "爷爷") : (tIsFemale ? "祖母" : "祖父");
            return (throughMother ? "外" : "") + prefixStr + suffix;
        } else {
            // 晚辈 (孙子、曾孙、玄孙...)
            const suffix = tIsFemale ? "孙女" : "孙子";
            const sidePrefix = (isBioDescendant || targetNode.ancestral_hall === effectiveVH) ? "" : (isMaternal ? "外" : "堂");
            return sidePrefix + prefixStr + suffix;
        }
    }

    return targetNode.relationship || "亲戚";
}

function isSpouse(a: any, b: any) {
    if (!a || !b) return false;
    const aSpouseId = String(a.spouse_id || a.spouseId || "");
    const bSpouseId = String(b.spouse_id || b.spouseId || "");
    const aId = String(a.id);
    const bId = String(b.id);
    return (aSpouseId === bId || bSpouseId === aId);
}

function isAncestorRecursive(target, start, members) {
    if (!start || !target) return false;
    if (String(start.id) === String(target.id)) return true;
    const fId = getVal(start, ['father_id', 'fatherId']);
    const mId = getVal(start, ['mother_id', 'motherId']);
    return isAncestorRecursive(target, getFullNode(fId, members), members) ||
        isAncestorRecursive(target, getFullNode(mId, members), members);
}

function isDescendantRecursive(target, ancestor, members) {
    if (!target || !ancestor) return false;
    if (String(target.id) === String(ancestor.id)) return true;
    const fId = getVal(target, ['father_id', 'fatherId']);
    const mId = getVal(target, ['mother_id', 'motherId']);
    return isDescendantRecursive(getFullNode(fId, members), ancestor, members) ||
        isDescendantRecursive(getFullNode(mId, members), ancestor, members);
}

function findLCA(a, b, members) {
    const getAncestors = (node) => {
        const res = new Set();
        let curr = [node];
        while (curr.length) {
            const n = curr.pop();
            if (!n || res.has(String(n.id))) continue;
            res.add(String(n.id));
            curr.push(getFullNode(getVal(n, ['father_id', 'fatherId']), members));
            curr.push(getFullNode(getVal(n, ['mother_id', 'motherId']), members));
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
        queue.push(getFullNode(getVal(n, ['father_id', 'fatherId']), members));
        queue.push(getFullNode(getVal(n, ['mother_id', 'motherId']), members));
    }
    return null;
}

function isDescendantThroughDaughter(target, ancestor, members) {
    if (!target || !ancestor || String(target.id) === String(ancestor.id)) return false;

    let current = target;
    const visited = new Set();

    while (current && !visited.has(String(current.id)) && String(current.id) !== String(ancestor.id)) {
        visited.add(String(current.id));
        const fId = getVal(current, ['father_id', 'fatherId']);
        const mId = getVal(current, ['mother_id', 'motherId']);

        // 如果是通过母亲上溯的，说明这一步就是母系连接
        if (mId && isAncestorRecursive(ancestor, getFullNode(mId, members), members)) {
            return true;
        }

        const parentNode = fId ? getFullNode(fId, members) : null;
        if (!parentNode || !isAncestorRecursive(ancestor, parentNode, members)) break;
        current = parentNode;
    }

    return false;
}

function getVal(node: any, keys: string[]) {
    if (!node) return undefined;
    for (const k of keys) if (node[k] !== undefined) return node[k];
    return undefined;
}

function getFullNode(id: any, members?: any[]) {
    return id ? members?.find(m => String(m.id) === String(id)) : null;
}

function getGenerationDistance(target: any, ancestor: any, members?: any[]) {
    if (!target || !ancestor) return 0;
    let dist = 0;
    let curr = target;
    while (curr && String(curr.id) !== String(ancestor.id)) {
        const fId = getVal(curr, ['father_id', 'fatherId']);
        const mId = getVal(curr, ['mother_id', 'motherId']);
        curr = getFullNode(fId || mId, members);
        dist++;
        if (dist > 15) break;
    }
    return String(curr?.id) === String(ancestor.id) ? dist : 0;
}

export function computeReverseViaMumuy(m: string, s: 'male' | 'female'): string | null { return null; }
