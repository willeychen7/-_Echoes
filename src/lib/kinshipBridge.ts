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
 * 获取排行权重
 */
function getRankWeight(rank: string): number {
    const map: Record<string, number> = {
        '大': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
        '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
        '小': 98, '老': 99
    };
    return map[rank] || 0;
}

/**
 * 路径反转逻辑
 */
function inversePath(path: string, vSex: 0 | 1): string {
    if (!path) return '';
    const invMap: Record<string, string> = {
        'f': vSex === 0 ? 'd' : 's',
        'm': vSex === 0 ? 'd' : 's',
        's': 'f',
        'd': 'm',
        'xb': vSex === 0 ? 'xs' : 'xb',
        'xs': vSex === 0 ? 'xs' : 'xb',
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
 * 获取 logicTag 中的排行
 */
function getTagRank(tag: string): string | null {
    const match = tag.toUpperCase().match(/-O(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|小|幺|老)$/);
    return match ? match[1] : null;
}

/**
 * 计算相对中文链
 */
function getRelativeChainText(vTag: string, tTag: string, targetSex: 0 | 1 = 1, viewerSex: 0 | 1 = 1): string {
    const vPath = normalizePath(vTag);
    const tPath = normalizePath(tTag);
    const vRank = getTagRank(vTag);
    const tRank = getTagRank(tTag);

    // 🚀 核心纠偏：即使路径相同，如果排行不同，则不是同一人
    if (vPath === tPath && vRank === tRank) return '';

    const vSegs = vPath ? vPath.split(',') : [];
    const tSegs = tPath ? tPath.split(',') : [];
    let commonIdx = 0;
    while (commonIdx < vSegs.length && commonIdx < tSegs.length && vSegs[commonIdx] === tSegs[commonIdx]) {
        commonIdx++;
    }

    const toAncestor = vSegs.slice(commonIdx);
    const fromAncestor = tSegs.slice(commonIdx);

    const relPathParts = [];
    if (toAncestor.length > 0) relPathParts.push(inversePath(toAncestor.join(','), viewerSex));
    if (fromAncestor.length > 0) relPathParts.push(fromAncestor.join(','));

    const relPath = relPathParts.join(',');

    // 3. 转换为中文
    const map: Record<string, string> = {
        'f': '爸爸', 'm': '妈妈', 's': '儿子', 'd': '女儿',
        'xb': '兄弟', 'xs': '姐妹', 'h': '丈夫', 'w': '妻子'
    };

    const segments = relPath.split(',').filter(Boolean);

    // 💡 针对堂/表亲的排行注入逻辑 (Branch-Aware Injection)
    // 寻找链条中的“兄弟/姐妹”节点，将其替换为带排行的称呼（如：三叔）
    let chain = segments.map((seg, idx) => {
        let base = map[seg] || '亲戚';

        // 如果是去往 Target 的最后一段路径或者是父辈节点
        if (tRank && tRank !== '不知道') {
            const isLastSiblingInPath = (seg === 'xb' || seg === 'xs') && idx === segments.length - 2;
            const isFatherLevel = (seg === 'f' || seg === 'm') && idx === segments.length - 2;

            if (isLastSiblingInPath || isFatherLevel) {
                // 注入房分排行
                return tRank + base;
            }
        }
        return base;
    }).join('的');

    return chain;
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
