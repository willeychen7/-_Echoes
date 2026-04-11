/**
 * 💡 mumuy/relationship.js 桥接层 - 65.0 宗统版本
 * 核心升级：
 * 1. 符合 Mumuy (relationship.js) 路径引擎逻辑，通过 BFS 寻找最短路径并翻译为 Mumuy Chain。
 * 2. 排行与堂表统一：支持 [堂表前缀] + [排行] + [称谓] 格式 (如: 堂二哥)。
 * 3. 稳健的性别与世代防线：即便数据缺失，依据路径也能推导出基本名分。
 */

import relationship from 'relationship.js';
import {
    normalizeGender,
    NUM_CHAR,
    ANCESTOR_PREFIX,
    DESCENDANT_PREFIX,
    RANK_MAP
} from './utils';

const HALL_RANK: Record<string, number> = {
    '根': 0, '根房': 0, '大房': 1, '一房': 1, '二房': 2, '三房': 3, '四房': 4, '五房': 5,
    '六房': 6, '七房': 7, '八房': 8, '九房': 9, '十房': 10, '小房': 99, '外家房': 1
};

/**
 * 💡 获取明确排行：优先 SiblingOrder，其次语义诱导
 */
export function getExplicitOrder(node: any): number {
    const raw = node.sibling_order ?? node.siblingOrder;
    if (raw !== undefined && raw !== null) return Number(raw);

    const tag = node.logic_tag || node.logicTag || "";
    if (tag) {
        const match = String(tag).match(/-o(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|小|幺|老)/i);
        if (match) return RANK_MAP[match[1]] || 99;
    }

    const rel = node.relationship || "";
    const rankKeys = Object.keys(RANK_MAP).sort((a, b) => b.length - a.length);
    for (const key of rankKeys) {
        if (rel.startsWith(key)) return RANK_MAP[key];
    }

    if (rel.includes('哥') || rel.includes('姐')) return 1;
    if (rel.includes('弟') || rel.includes('妹')) return 99;

    return 99;
}

/**
 * 💡 基于 BFS 路径寻找 Mumuy 描述链
 */
/**
 * 💡 基于 BFS 路径寻找 Mumuy 描述链 (公开版本)
 */
export function getMumuyPathTokens(viewer: any, target: any, members: any[]): string | null {
    if (!viewer || !target) return null;

    const vId = String(viewer.id || viewer.memberId || "");
    const tId = String(target.id || target.memberId || "");

    if (!vId || !tId || vId === tId) return null;

    const queue: { id: string; path: string[] }[] = [{ id: vId, path: [] }];
    const visited = new Set<string>([vId]);

    const TOKEN_MAP: Record<string, string> = {
        f: '爸爸', m: '妈妈', h: '老公', w: '老婆', s: '儿子', d: '女儿',
        xb: '哥哥', ob: '弟弟', xs: '姐姐', os: '妹妹'
    };

    while (queue.length > 0) {
        const { id, path } = queue.shift()!;
        const currentId = String(id);
        if (currentId === tId) return path.map(t => TOKEN_MAP[t] || t).join('的');

        const node = members.find(m => String(m.id || m.memberId) === currentId);
        if (!node) continue;

        const adj: { id: string; token: string }[] = [];

        // 1. 物理 ID 链接 (最可靠)
        const fId = node.father_id || node.fatherId;
        const mId = node.mother_id || node.motherId;
        if (fId) adj.push({ id: String(fId), token: 'f' });
        if (mId) adj.push({ id: String(mId), token: 'm' });

        const sId = node.spouse_id || node.spouseId;
        if (sId) {
            const isTargetFemale = normalizeGender(node.gender) === 'female';
            adj.push({ id: String(sId), token: isTargetFemale ? 'h' : 'w' });
        }

        const children = members.filter(m => String(m.father_id || m.fatherId) === currentId || String(m.mother_id || m.motherId) === currentId);
        for (const child of children) {
            adj.push({ id: String(child.id), token: normalizeGender(child.gender) === 'female' ? 'd' : 's' });
        }

        if (fId || mId) {
            const sibs = members.filter(m => (fId && String(m.father_id || m.fatherId) === String(fId)) || (mId && String(m.mother_id || m.mother_id) === String(mId)));
            for (const sib of sibs) {
                if (String(sib.id) === currentId) continue;
                const isF = normalizeGender(sib.gender) === 'female';
                const sRank = getExplicitOrder(sib);
                const nRank = getExplicitOrder(node);
                let token;
                if (sRank !== nRank) {
                    token = isF ? (sRank < nRank ? 'xs' : 'os') : (sRank < nRank ? 'xb' : 'ob');
                } else {
                    token = isF ? (String(sib.id) < currentId ? 'xs' : 'os') : (String(sib.id) < currentId ? 'xb' : 'ob');
                }
                adj.push({ id: String(sib.id), token });
            }
        }

        // 2. 软连接 (录入路径补全)：如果 A 录入了 B，那么 A 和 B 之间存在对应关系
        // 向上探测：我是谁录入的？
        const creatorId = String(node.addedByMemberId || node.added_by_member_id || "");
        if (creatorId && creatorId !== "null") {
            // 我是被谁录入的，他在我这里是什么角色
            const role = node.relationship || "";
            let token = "";
            if (role.includes('女')) token = 'm'; // 如果我是他的女儿，那他是我（妈）
            else if (role.includes('子')) token = 'f'; // 如果我是他的儿子，那他是我（爸）
            else if (role.includes('兄') || role.includes('弟') || role.includes('姐') || role.includes('妹')) {
                // 简化处理：兄弟姐妹的逆向默认仍为兄弟
                token = 'ob';
            }
            if (token) adj.push({ id: creatorId, token });
        }

        // 向下探测：我录入了谁？
        const createdNodes = members.filter(m => String(m.addedByMemberId || m.added_by_member_id) === currentId);
        for (const cn of createdNodes) {
            const role = cn.relationship || "";
            let token = "";
            if (role.includes('女')) token = 'd';
            else if (role.includes('子')) token = 's';
            else if (role.includes('兄')) token = 'xb';
            else if (role.includes('弟')) token = 'ob';
            else if (role.includes('姐')) token = 'xs';
            else if (role.includes('妹')) token = 'os';
            if (token) adj.push({ id: String(cn.id), token });
        }

        for (const next of adj) {
            const nextId = String(next.id);
            if (!visited.has(nextId)) {
                visited.add(nextId);
                queue.push({ id: nextId, path: [...path, next.token] });
            }
        }
        if (queue.length > 5000) break;
    }
    return null;
}

/**
 * 💡 核心称谓计算：Mumuy 路径优先
 */
export function computeKinshipViaMumuy(targetNode: any, viewerNode: any, members?: any[]): string | null {
    if (!targetNode || !viewerNode) return null;
    if (String(targetNode.id) === String(viewerNode.id)) return "本人";

    const tF = targetNode.father_id || targetNode.fatherId;
    const tM = targetNode.mother_id || targetNode.motherId;
    const isTargetFemale = normalizeGender(targetNode.gender) === 'female';
    if ((tF && String(tF) === String(viewerNode.id)) || (tM && String(tM) === String(viewerNode.id))) {
        return isTargetFemale ? "女儿" : "儿子";
    }

    const vF = viewerNode.father_id || viewerNode.fatherId;
    const vM = viewerNode.mother_id || viewerNode.motherId;
    if (vF && String(vF) === String(targetNode.id)) return "父亲";
    if (vM && String(vM) === String(targetNode.id)) return "母亲";

    if (isSpouse(targetNode, viewerNode, members || [])) {
        return normalizeGender(targetNode.gender) === 'female' ? '妻子' : '丈夫';
    }

    try {
        const chain = getMumuyPathTokens(viewerNode, targetNode, members || []);
        if (chain) {
            const results: string[] = relationship({
                text: chain,
                sex: normalizeGender(viewerNode.gender) === 'female' ? 0 : 1
            });

            if (results && results.length > 0) {
                const checkList = ['亲戚', '其他', '家人', '亲属'];
                const valid = results.filter(r => !checkList.includes(r));

                if (valid.length === 0) return null;

                const baseLabel = valid[0];

                if (baseLabel && baseLabel !== "本人") {
                    // 🚀 核心纠偏 1：如果是直系血亲（爸爸、爷爷等），绝对不加排行前缀
                    const isDirectAnc = isAncestorRecursive(targetNode, viewerNode, members || []);
                    if (isDirectAnc) return baseLabel;

                    const rankVal = getExplicitOrder(targetNode);
                    let rankChar = (rankVal >= 1 && rankVal <= 20) ? (rankVal === 1 ? '大' : NUM_CHAR[rankVal] || rankVal) : '';
                    rankChar = String(rankChar);

                    if (rankChar) {
                        let label = baseLabel;

                        // 1. 缩短叠词
                        if (label.length === 2 && label[0] === label[1] && ["哥", "弟", "姐", "妹"].includes(label[0])) {
                            label = label[0];
                        }

                        // 2. 保护直系称谓
                        const PROTECTED = ["爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆", "父亲", "母亲", "曾祖", "曾外祖"];
                        if (PROTECTED.includes(label)) return label;

                        // 3. 避免重复排行
                        if (label.startsWith(rankChar)) return label;

                        // 4. 处理堂表
                        const prefixMatch = label.match(/^(堂|表|外|曾|高|祖|族|再从|三从)+/);
                        if (prefixMatch) {
                            const prefix = prefixMatch[0];
                            const core = label.substring(prefix.length);
                            let finalCore = core;
                            if (core.length === 2 && core[0] === core[1]) finalCore = core[0];
                            if (finalCore.startsWith(rankChar)) return prefix + finalCore;
                            return prefix + rankChar + finalCore;
                        }

                        return rankChar + label;
                    }
                    return baseLabel;
                }
            }
        }
    } catch (err) { }

    const tG = targetNode.generation_num ?? targetNode.generationNum;
    const vG = viewerNode.generation_num ?? viewerNode.generationNum;
    if (tG != null && vG != null) {
        const diff = tG - vG;
        const abs = Math.abs(diff);
        if (abs >= 2) {
            const prefix = diff < 0 ? ANCESTOR_PREFIX[Math.min(abs, 9)] : DESCENDANT_PREFIX[Math.min(abs, 9)];
            const suffix = normalizeGender(targetNode.gender) === 'female' ? (diff < 0 ? "奶奶" : "孙女") : (diff < 0 ? "爷爷" : "孙子");
            return prefix + suffix;
        }
    }

    return targetNode.relationship || "亲戚";
}

// --- Helpers ---

function isSpouse(a: any, b: any, members: any[] = []) {
    if (!a || !b) return false;
    const aId = String(a.id || a.memberId || "");
    const bId = String(b.id || b.memberId || "");
    if (!aId || !bId) return false;
    const as = String(a.spouse_id || a.spouseId || "");
    const bs = String(b.spouse_id || b.spouseId || "");
    if (as === bId || bs === aId) return true;
    if (members.length > 0) {
        const hasMutualChild = members.some(m => {
            const f_id = String(m.father_id || m.fatherId || "");
            const m_id = String(m.mother_id || m.motherId || "");
            return (f_id === aId && m_id === bId) || (f_id === bId && m_id === aId);
        });
        if (hasMutualChild) return true;
    }
    return false;
}

export function isAncestorRecursive(target: any, start: any, members: any[]): boolean {
    if (!start || !target) return false;
    if (String(start.id) === String(target.id)) return true;
    const fId = start.father_id || start.fatherId;
    const mId = start.mother_id || start.motherId;
    const f = fId ? members.find(m => String(m.id) === String(fId)) : null;
    const m = mId ? members.find(m => String(m.id) === String(mId)) : null;
    return isAncestorRecursive(target, f, members) || isAncestorRecursive(target, m, members);
}

export function isDescendantRecursive(target: any, ancestor: any, members: any[]): boolean {
    return isAncestorRecursive(ancestor, target, members);
}

export function findLCA(a: any, b: any, members: any[]): any {
    const getAncs = (n: any) => {
        const res = new Set<string>();
        let q = [n];
        while (q.length) {
            const curr = q.pop();
            if (!curr || res.has(String(curr.id))) continue;
            res.add(String(curr.id));
            const fId = curr.father_id || curr.fatherId;
            const mId = curr.mother_id || curr.motherId;
            if (fId) q.push(members.find(m => String(m.id) === String(fId)));
            if (mId) q.push(members.find(m => String(m.id) === String(mId)));
        }
        return res;
    };
    const bAncs = getAncs(b);
    let q = [a];
    const visited = new Set<string>();
    while (q.length) {
        const curr = q.shift();
        if (!curr || visited.has(String(curr.id))) continue;
        visited.add(String(curr.id));
        if (bAncs.has(String(curr.id))) return curr;
        const fId = curr.father_id || curr.fatherId;
        const mId = curr.mother_id || curr.motherId;
        if (fId) q.push(members.find(m => String(m.id) === String(fId)));
        if (mId) q.push(members.find(m => String(m.id) === String(mId)));
    }
    return null;
}

export function isDescendantThroughDaughter(target: any, ancestor: any, members: any[]): boolean {
    if (!target || !ancestor || String(target.id) === String(ancestor.id)) return false;
    let curr = target;
    while (curr && String(curr.id) !== String(ancestor.id)) {
        const mId = curr.mother_id || curr.motherId;
        if (mId && isAncestorRecursive(ancestor, members.find(m => String(m.id) === String(mId)), members)) return true;
        const fId = curr.father_id || curr.fatherId;
        const fNode = fId ? members.find(m => String(m.id) === String(fId)) : null;
        if (!fNode || !isAncestorRecursive(ancestor, fNode, members)) break;
        curr = fNode;
    }
    return false;
}

export function getGenerationDistance(target: any, ancestor: any, members: any[]): number {
    let d = 0; let c = target;
    while (c && String(c.id) !== String(ancestor.id)) {
        const pId = c.father_id || c.fatherId || c.mother_id || c.motherId;
        c = pId ? members.find(m => String(m.id) === String(pId)) : null;
        d++; if (d > 15) break;
    }
    return String(c?.id) === String(ancestor.id) ? d : 0;
}

import { getCleanRelationship } from './relationships';

export function computeReverseViaMumuy(rel: string, sex: 'male' | 'female', targetSex?: 'male' | 'female'): string | null {
    if (!rel) return null;
    try {
        let core = getCleanRelationship(rel);
        let prefix = "";
        const m = rel.match(/^(.+房)的/);
        if (m) { prefix = m[0]; core = core.replace(prefix, ""); }
        const result = relationship({ text: core, reverse: true, sex: sex === 'male' ? 1 : 0 });
        if (Array.isArray(result) && result.length > 0) {
            let valid = result.filter(r => !['自己', '本人', '亲戚', '其他', '家人'].includes(r));
            if (targetSex) {
                const femaleKeywords = ["姨", "姑", "妈", "娘", "奶", "婆", "姐", "妹", "婶", "侄女", "外甥女", "女"];
                const maleKeywords = ["叔", "伯", "爸", "爹", "爷", "公", "哥", "弟", "侄子", "外甥", "男", "子"];
                const filtered = valid.filter(r => (targetSex === 'female' ? femaleKeywords : maleKeywords).some(k => r.includes(k)));
                if (filtered.length > 0) valid = filtered;
            }
            if (valid.length > 0) return prefix + valid[0];
        }
    } catch (e) { }
    return null;
}
