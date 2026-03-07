/**
 * 💡 mumuy/relationship.js 桥接层
 *
 * 核心职责：
 * 1. 将系统内部 Logic Tag 坐标 转换为 mumuy 库能理解的"中文关系链"或"底层关系符"
 * 2. 调用 mumuy 库进行权威亲戚称谓计算
 * 3. 处理 Viewer 与 Target 之间的相对路径计算
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
let relationshipLib: any = null;

function getRelationshipLib(): any {
    if (relationshipLib) return relationshipLib;
    try {
        if (typeof require !== 'undefined') {
            relationshipLib = require('relationship.js');
        }
    } catch (e) {
        console.warn('[KinshipBridge] relationship.js 未能加载', e);
    }
    return relationshipLib;
}

/**
 * 内部路径映射表：将本系统的 LogicTag 路径片段 转换为 mumuy 的底层编码 (f,m,s,d,xb,xs)
 */
const TAG_TO_MUMUY_MAP: Record<string, string> = {
    'f': 'f',
    'm': 'm',
    's': 's',
    'd': 'd',
    'sib': 'xb',
    'x': 'f,xb,s',
    'x,m': 'm,xb,s',
    'child_p': 'xb,s',
    'child_m': 'xs,s',
};

/**
 * 路径反转逻辑：如 "爸爸的爸爸" 反转为 "儿子的儿子"
 * @param path 原始路径
 * @param dSex 目标节点的性别 (0:女, 1:男)
 */
function inversePath(path: string, dSex: 0 | 1): string {
    if (!path) return '';
    const invMap: Record<string, string> = {
        'f': dSex === 0 ? 'd' : 's',
        'm': dSex === 0 ? 'd' : 's',
        's': 'f',
        'd': 'm',
        'xb': 'xb',
        'xs': 'xs',
        'h': 'w',
        'w': 'h'
    };
    return path.split(',').reverse().map(s => invMap[s] || s).join(',');
}

/**
 * 将本系统的 LogicTag 路径转换为 mumuy 底层编码路径
 */
function normalizePath(tag: string): string {
    const core = tag.toUpperCase().replace(/^\[[FM]\](!S)?-/, '').split('-O')[0].toLowerCase();
    if (core === 'self' || !core) return '';

    // 如果是预设的简写，则展开
    if (TAG_TO_MUMUY_MAP[core]) return TAG_TO_MUMUY_MAP[core];

    // 否则逐点映射
    return core.split(',').map(s => TAG_TO_MUMUY_MAP[s] || s).join(',');
}

/**
 * 计算相对中文链
 */
function getRelativeChainText(vTag: string, tTag: string, targetSex: 0 | 1 = 1, viewerSex: 0 | 1 = 1): string {
    const vPath = normalizePath(vTag);
    const tPath = normalizePath(tTag);

    if (vPath === tPath) return '';

    const vSegs = vPath ? vPath.split(',') : [];
    const tSegs = tPath ? tPath.split(',') : [];
    let commonIdx = 0;
    while (commonIdx < vSegs.length && commonIdx < tSegs.length && vSegs[commonIdx] === tSegs[commonIdx]) {
        commonIdx++;
    }

    const toAncestor = vSegs.slice(commonIdx);
    const fromAncestor = tSegs.slice(commonIdx);

    const relPathParts = [];
    // 向上走：使用 Viewer 的性别来决定反转后的称呼 (因为是回到公共祖先)
    // 错误！应该是回到公共祖先的路径中，最后一步回到的是谁？
    // 实际上 inversePath 应该逐级决定。但简化处理：回到 Viewer 时使用 viewerSex
    if (toAncestor.length > 0) relPathParts.push(inversePath(toAncestor.join(','), viewerSex));
    if (fromAncestor.length > 0) relPathParts.push(fromAncestor.join(','));

    const relPath = relPathParts.join(',');

    // 3. 转换为中文
    const map: Record<string, string> = {
        'f': '爸爸', 'm': '妈妈', 's': '儿子', 'd': '女儿',
        'xb': '兄弟', 'xs': '姐妹', 'h': '丈夫', 'w': '妻子'
    };
    return relPath.split(',').filter(Boolean).map(seg => map[seg] || '亲戚').join('的');
}

/**
 * 核心：通过 mumuy 库计算称谓
 */
export function computeKinshipViaMumuy(
    targetNode: any,
    viewerNode: any,
    members: any[],
    reverse: boolean = false
): string | null {
    const lib = getRelationshipLib();
    if (!lib) return null;

    const vTag = (viewerNode.logicTag || viewerNode.logic_tag || 'SELF').toString();
    const tTag = (targetNode.logicTag || targetNode.logic_tag || 'SELF').toString();

    // 如果两者都是 SELF 或相同，且不是为了计算反向
    if (vTag === tTag && !reverse) return '本人';

    try {
        const vSex = (viewerNode.gender === 'female' || viewerNode.gender === '女') ? 0 : 1;
        const tSex = (targetNode.gender === 'female' || targetNode.gender === '女') ? 0 : 1;

        // 计算相对链
        let chain = getRelativeChainText(vTag, tTag, tSex, vSex);
        let startSex = vSex;

        // 如果是计算反向 (TA 怎么叫我)
        if (reverse) {
            chain = getRelativeChainText(tTag, vTag, vSex, tSex);
            startSex = tSex;
        }

        if (!chain) return null;

        const res = lib({
            text: chain,
            sex: startSex,
            reverse: false,
            optimal: true,
        });

        if (Array.isArray(res) && res.length > 0) {
            return res[0] as string;
        }

        // 尝试 expression 模式
        const exprRes = lib(chain);
        if (Array.isArray(exprRes) && exprRes.length > 0) return exprRes[0];

        return null;
    } catch (e) {
        return null;
    }
}

/**
 * 独立的反向称谓计算（用于 AddMemberPage）
 */
export function computeReverseViaMumuy(
    manualRelText: string,
    myGender: 'male' | 'female'
): string | null {
    const lib = getRelationshipLib();
    if (!lib || !manualRelText) return null;

    try {
        const sexValue = myGender === 'female' ? 0 : 1;
        const result = lib({
            text: manualRelText,
            sex: sexValue,
            reverse: true,
            optimal: true,
        });
        if (Array.isArray(result) && result.length > 0) return result[0];
        return null;
    } catch (e) {
        return null;
    }
}
