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
    const tSex = normalizeGender(getVal(targetNode, ['gender'])) === 'female' ? 'F' : 'M';
    const vSex = normalizeGender(getVal(viewerNode, ['gender'])) === 'female' ? 'F' : 'M';

    const tFatherId = getVal(targetNode, ['father_id', 'fatherId']);
    const vFatherId = getVal(viewerNode, ['father_id', 'fatherId']);
    const tMotherId = getVal(targetNode, ['mother_id', 'motherId']);
    const vMotherId = getVal(viewerNode, ['mother_id', 'motherId']);
    const vSpouseId = getVal(viewerNode, ['spouse_id', 'spouseId']);

    const genDiff = tG - vG;

    // --- 0. 直系优先 ---
    if (String(targetNode.id) === String(vFatherId)) return "父亲";
    if (String(targetNode.id) === String(vMotherId)) return "母亲";
    if (String(tFatherId) === String(viewerNode.id) || String(tMotherId) === String(viewerNode.id)) return tSex === 'F' ? "女儿" : "儿子";

    // --- 姻亲识别 ---
    // 检查 target 是否直接是 viewer 的配偶的儿媳/女婿
    const vChildren = members?.filter(m => (String(getVal(m, ['father_id', 'fatherId'])) === String(viewerNode.id) || String(getVal(m, ['mother_id', 'motherId'])) === String(viewerNode.id)));
    if (vChildren?.some(c => String(getVal(c, ['spouse_id', 'spouseId'])) === String(targetNode.id))) return tSex === 'F' ? "儿媳" : "女婿";
    // 检查 target 是否是某个孩子的父母的配偶 (儿媳/女婿 - 从目标角度)
    if (vChildren?.some(c => {
        const cSpouseId = getVal(c, ['spouse_id', 'spouseId']);
        return cSpouseId && String(cSpouseId) === String(targetNode.id);
    })) return tSex === 'F' ? "儿媳" : "女婿";
    // 检查 target 是否与 viewer 的某个孩子是配偶关系（反向）
    const targetSpouseId = getVal(targetNode, ['spouse_id', 'spouseId']);
    if (targetSpouseId && vChildren?.some(c => String(c.id) === String(targetSpouseId))) return tSex === 'F' ? "儿媳" : "女婿";

    const vSpouseNode = getFullNode(vSpouseId);

    // --- 姻亲：配偶的父母 → 公婆/岳父母 ---
    if (vSpouseNode && (String(targetNode.id) === String(getVal(vSpouseNode, ['father_id', 'fatherId'])) || String(targetNode.id) === String(getVal(vSpouseNode, ['mother_id', 'motherId'])))) {
        if (vSex === 'F') return tSex === 'F' ? "婆婆" : "公公";
        return tSex === 'F' ? "岳母" : "岳父";
    }

    // --- 姻亲：子女的配偶的父母 → 亲家公/亲家母 ---
    // 例：奶奶 → 外公/外婆（儿媳妈妈的父母）
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
        return tSex === 'F' ? "亲家母" : "亲家公";
    }

    // --- 姻亲：配偶的兄弟姐妹（大伯/叔/大姑/小姑，或大舅子/小舅子/大姨子等）---
    // 这在同辈章节中用 areSiblings 处理（已有逻辑）

    // --- 姻亲扩展：配偶父母的兄弟姐妹 ---
    // 例：爸爸 → 外公的姐妹（不是「姑」，而是「大舅妈/大岳姑」）
    // 这里简化：如果 target 是配偶父母的兄弟/姐妹，且非直接亲属，则标记为姻亲亲属
    if (vSpouseNode) {
        const spouseFId = getVal(vSpouseNode, ['father_id', 'fatherId']);
        const spouseMId = getVal(vSpouseNode, ['mother_id', 'motherId']);
        const spouseFNode = getFullNode(spouseFId);
        const spouseMNode = getFullNode(spouseMId);
        // target 是配偶的父亲的兄弟/姐妹
        if (spouseFId && spouseFNode) {
            const spFf = getVal(spouseFNode, ['father_id', 'fatherId']);
            const spFm = getVal(spouseFNode, ['mother_id', 'motherId']);
            const tSharesFParent = (tFatherId && spFf && String(tFatherId) === String(spFf)) || (tMotherId && spFm && String(tMotherId) === String(spFm));
            if (tSharesFParent) {
                // target 是配偶父亲的兄弟/姐妹
                return tSex === 'F' ? "内姑" : "内舅";
            }
        }
        // target 是配偶的母亲的兄弟/姐妹
        if (spouseMId && spouseMNode) {
            const spMf = getVal(spouseMNode, ['father_id', 'fatherId']);
            const spMm = getVal(spouseMNode, ['mother_id', 'motherId']);
            const tSharesMParent = (tFatherId && spMf && String(tFatherId) === String(spMf)) || (tMotherId && spMm && String(tMotherId) === String(spMm));
            if (tSharesMParent) {
                // target 是配偶母亲的兄弟/姐妹
                return tSex === 'F' ? "内姨" : "内舅";
            }
        }
    }

    const isBioAncestor = isAncestorRecursive(targetNode, viewerNode, members);
    const isBioDescendant = isDescendantRecursive(targetNode, viewerNode, members);

    let effectiveVH = viewerHall;
    let effectiveVFatherId = vFatherId;
    let effectiveVMotherId = vMotherId;

    if (vSex === 'F' && vSpouseId && !isBioAncestor && !isBioDescendant) {
        if (vSpouseNode) {
            effectiveVH = getVal(vSpouseNode, ['ancestral_hall', 'ancestralHall']);
            effectiveVFatherId = getVal(vSpouseNode, ['father_id', 'fatherId']);
            effectiveVMotherId = getVal(vSpouseNode, ['mother_id', 'motherId']);
        }
    }

    const hT = HALL_RANK[targetHall] ?? 99;
    const hV = HALL_RANK[effectiveVH] ?? 99;

    if (isSpouse(targetNode, viewerNode)) return tSex === 'F' ? '妻子' : '丈夫';

    // --- 1. 宗法路径辩别 ---
    const lca = findLCA(targetNode, viewerNode, members);
    const viewerMaternal = lca ? isDescendantThroughDaughter(viewerNode, lca, members) : false;
    const targetMaternal = lca ? isDescendantThroughDaughter(targetNode, lca, members) : false;

    const areSiblings = (aNodeId, bNodeId) => {
        const a = getFullNode(aNodeId), b = getFullNode(bNodeId);
        if (!a || !b || String(a.id) === String(b.id)) return false;
        const af = getVal(a, ['father_id', 'fatherId']), bf = getVal(b, ['father_id', 'fatherId']);
        const am = getVal(a, ['mother_id', 'motherId']), bm = getVal(b, ['mother_id', 'motherId']);
        return (af && String(af) === String(bf)) || (am && String(am) === String(bm));
    };

    const isSibOfMother = areSiblings(targetNode.id, vMotherId);
    const isSibOfFather = areSiblings(targetNode.id, vFatherId);

    let isMaternal = viewerMaternal || targetMaternal || isSibOfMother;
    // NOTE: 亲兄弟姐妹判断必须使用「原始」父母ID，而非经配偶代理的 effectiveVFatherId
    // 否则已婚女性的亲兄妹会被误判为堂亲
    const isRealSib = (tFatherId && String(tFatherId) === String(vFatherId)) ||
        (tMotherId && String(tMotherId) === String(vMotherId)) ||
        (targetHall && effectiveVH && targetHall === effectiveVH && !vSpouseId);

    // 补充：如果 viewer 已婚，且 target 是配偶的亲兄弟/姐妹 → 先行处理
    // 区分 viewer 性别：男性视角叫「大舅子/姨子」，女性视角叫「大伯/叔/大姑/小姑」
    if (vSpouseId && vSpouseNode && genDiff === 0) {
        if (areSiblings(targetNode.id, vSpouseNode.id)) {
            const spouseOrder = getExplicitOrder(vSpouseNode);
            const earlyRank = (tS >= 1 && tS <= 20) ? (tS === 1 ? '大' : NUM_CHAR[tS] || '') : '';
            if (vSex === 'M') {
                // 丈夫视角：妻子的兄弟 → 大舅子/小舅子；妻子的姐妹 → 大姨子/小姨子
                if (tSex === 'F') return (tS < spouseOrder ? earlyRank + '大姨子' : earlyRank + '小姨子');
                return (tS < spouseOrder ? earlyRank + '大舅子' : earlyRank + '小舅子');
            } else {
                // 妻子视角：丈夫的兄弟 → 大伯/叔；丈夫的姐妹 → 大姑/小姑
                if (tSex === 'F') return (tS < spouseOrder ? earlyRank + '大姑' : earlyRank + '小姑');
                return (tS < spouseOrder ? earlyRank + '大伯' : earlyRank + '叔');
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

        // 表堂辨析：
        // - 亲兄妹 → 无前缀
        // - 通过姑姑（父之姐妹）的孩子 → 表亲（母系走向）
        // - 通过叔伯（父之兄弟）的孩子 → 堂亲（父系走向）
        // - 通过舅/阿姨（母亲兄妹）的孩子 → 表亲
        let cousinPrefix = isRealSib ? '' : (isMaternal ? '表' : '堂');
        // 精准修正：如果 target 的父母是女性，且该女性是 viewer 父亲的姐妹（姑姑）→ 表亲
        if (!isRealSib) {
            const tParentFId = tFatherId ? getFullNode(tFatherId) : null;
            const tParentMId = tMotherId ? getFullNode(tMotherId) : null;
            const tParentFromFather = tParentFId && !tParentMId ? tParentFId : null; // 只有父亲
            const hasMotherAsParent = !!tParentMId; // target 有母亲记录
            // 如果 target 的直系父母中有女性，且该女性是 viewer 的亲属（姑姑方向），则是表亲
            const tMother = tMotherId ? getFullNode(tMotherId) : null;
            const tFather = tFatherId ? getFullNode(tFatherId) : null;
            const parentIsAunt = (tMother && isSibOfFather && areSiblings(tMother.id, vFatherId)) ||
                (tMother && areSiblings(tMother.id, vFatherId)) ||
                (tFather && areSiblings(tFather.id, vMotherId));
            if (parentIsAunt) cousinPrefix = '表';
            // 如果 target 的直接母亲是 viewer 父亲的姐妹（姑姑）→ 表亲
            if (tMother && vFatherId && areSiblings(tMother.id, vFatherId)) cousinPrefix = '表';
        }
        if (isO) return cousinPrefix + rank + (tSex === 'F' ? '姐' : '哥');
        return cousinPrefix + rank + (tSex === 'F' ? '妹' : '弟');
    }

    // 长一辈 (-1)
    if (genDiff === -1) {
        if (isSibOfMother) return tSex === 'F' ? rank + '姨' : rank + '舅';
        if (isSibOfFather) {
            if (tSex === 'F') return rank + '姑妈';
            const fNode = getFullNode(vFatherId);
            const fOrder = getExplicitOrder(fNode);
            return (tS < fOrder) ? (rank + '伯') : (rank + '叔');
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
                if (isBioAncestor) {
                    // 精准判断祖父母方向：通过父亲一侧 → 爷爷/奶奶，通过母亲一侧 → 外公/外婆
                    // 直接检查：viewer 的父亲是否是 target 的后代（即 target 是父系祖辈）
                    const viewerFather = vFatherId ? members?.find(m => String(m.id) === String(vFatherId)) : null;
                    const throughFather = viewerFather ? isDescendantRecursive(viewerFather, targetNode, members) || isAncestorRecursive(targetNode, viewerFather, members) : false;
                    if (throughFather) return (tSex === 'F' ? "奶奶" : "爷爷");
                    return (tSex === 'F' ? "外婆" : "外公");
                }

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

    // 溯源：从 target 向上找 ancestor，看第一步离开 ancestor 的链路是否为女性
    let current = target;
    const visited = new Set();
    const path: any[] = [];

    while (current && !visited.has(String(current.id)) && String(current.id) !== String(ancestor.id)) {
        visited.add(String(current.id));
        path.unshift(current);
        const fId = getVal(current, ['father_id', 'fatherId']);
        const mId = getVal(current, ['mother_id', 'motherId']);

        let parentNode = null;
        if (fId && isAncestorRecursive(ancestor, getFullNode(fId, members), members)) {
            parentNode = getFullNode(fId, members);
        } else if (mId && isAncestorRecursive(ancestor, getFullNode(mId, members), members)) {
            parentNode = getFullNode(mId, members);
        }

        if (!parentNode) break;
        current = parentNode;
    }

    if (String(current.id) === String(ancestor.id) && path.length > 0) {
        // 第一跳节点的母亲是否为 ancestor
        const firstNode = path[0];
        const mId = getVal(firstNode, ['mother_id', 'motherId']);
        return String(mId) === String(ancestor.id);
    }

    return false;
}

function getVal(node: any, keys: string[]) {
    if (!node) return undefined;
    for (const k of keys) if (node[k] !== undefined) return node[k];
    return undefined;
}

function getFullNode(id: any, members: any[]) {
    return id ? members?.find(m => String(m.id) === String(id)) : null;
}

export function computeReverseViaMumuy(m: string, s: 'male' | 'female'): string | null { return null; }
