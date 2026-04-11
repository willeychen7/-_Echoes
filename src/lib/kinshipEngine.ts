/**
 * 💡 家族逻辑大脑 V4.0 - 集成 mumuy/relationship.js 权威称谓库
 * GitHub: https://github.com/mumuy/relationship
 */

import relationship from 'relationship.js';
import { normalizeGender, normalizeRank, getFormalRankTitle, NUM_CHAR, RANK_REGEX_STR } from "./utils";

// 基于衔接点的快捷建议表
export const CONNECTOR_SUGGESTIONS: Record<string, string[]> = {
    'father': ['叔叔', '伯伯', '姑姑'],
    'paternal_cousin_elder': ['堂伯', '堂叔', '堂姑', '表伯', '表叔', '表姑'],
    'grandfather': ['伯公', '叔公', '姑婆', '婶婆', '伯婆', '堂爷爷', '堂奶奶'],
    'g_grandfather': ['太爷爷', '老祖公', '太奶', '曾祖父', '曾祖母', '太伯公', '太叔公'],
    'grandmother': ['舅公', '姨婆', '堂舅公', '堂姨婆', '姨外婆'],
    // 直系至亲快捷项
    'grandparent_direct': ['爷爷', '奶奶'],
    'grandparent_m_direct': ['外公', '外婆'],
    'parent_direct': ['爸爸', '爸', '父亲'],
    'parent_m_direct': ['妈妈', '妈', '母亲'],
    'sibling': ['哥哥', '弟弟', '姐姐', '妹妹'], // 亲兄弟姐妹
    'self_p': ['堂哥', '堂弟', '堂姐', '堂妹', '表哥', '表弟'], // 父系宗亲
    'child_p': ['儿子', '女儿', '侄子', '侄女', '堂侄', '堂侄女'],
    'grandchild_p': ['孙子', '孙女', '外孙', '外孙女', '曾孙', '曾孙女'],
    'mother': ['舅舅', '阿姨'],
    'maternal_cousin_elder': ['堂舅', '堂姨', '表舅', '表叔', '表姑'],
    'm_grandfather': ['外公家族分支', '堂舅公', '堂姨婆'],
    'm_g_grandfather': ['外太公', '外太婆', '曾外祖'],
    'm_grandmother': ['姨姥', '表姨', '姨外婆', '外婆'],
    'self_m': ['表哥', '表弟', '表姐', '表妹'], // 母系外戚
    'child_m': ['外甥', '外甥女', '外孙', '外孙女'],
};
/**
 * 智能连接点测定：将自然语言称谓映射回系统逻辑节点
 */
export function getConnectorNodeByRelation(rel: string): string {
    if (!rel) return 'self';
    const r = rel.trim();

    // 1. 远祖辈 (4-5代及以上)
    if (r.includes('烈') || r.includes('天') || r.includes('远') || r.includes('鼻')) {
        return r.includes('外') ? 'm_g_grandfather' : 'g_grandfather';
    }

    // 2. 曾/高祖辈 (3-4代)
    if (r.includes('曾') || r.includes('高') || r.includes('太爷') || r.includes('太奶')) {
        return r.includes('外') ? 'm_g_grandfather' : 'g_grandfather';
    }
    // 3. 祖辈 (按照宗法严格划分)
    if (r.includes('外婆') || r.includes('外祖母') || r.includes('姥姥')) return 'm_grandmother';
    if (r.includes('外公') || r.includes('外祖父')) return 'm_grandfather';
    if (r.includes('奶奶') || r.includes('祖母')) return 'grandparent_direct';
    if (r.includes('爷爷') || r.includes('祖父')) return 'grandparent_direct';
    
    // 旁系祖辈
    if (r.includes('姨外婆') || r.includes('舅外公') || r.includes('姨姥')) return 'm_grandmother';
    if (r.includes('太外公') || r.includes('外曾祖')) return 'm_g_grandfather';
    if (r.includes('叔公') || r.includes('伯公') || r.includes('姑婆') || r.includes('叔婆') || r.includes('伯婆')) return 'grandfather';
    if (r.includes('舅公') || r.includes('姨婆')) return 'grandmother';

    // 4. 父辈 (直接)
    if (r === '父亲' || r === '爸爸' || r === '爸') return 'parent_direct';
    if (r === '母亲' || r === '妈妈' || r === '妈') return 'parent_m_direct';

    // 5. 叔伯舅姨 (父辈旁系)
    if (r.includes('堂伯') || r.includes('堂叔') || r.includes('堂姑')) return 'paternal_cousin_elder';
    if (r.includes('叔') || r.includes('伯') || r.includes('姑')) return 'father';
    if (r.includes('堂舅') || r.includes('堂姨')) return 'maternal_cousin_elder';
    if (r.includes('舅') || r.includes('姨')) return 'mother';

    // 6. 平辈 (堂、表)
    if (r.includes('堂')) return 'self_p';
    if (r.includes('表')) return 'self_m';
    if (['哥', '弟', '姐', '妹'].some(s => r.includes(s))) return 'sibling';

    // 7. 晚辈
    if (r.includes('玄') || r.includes('来') || r.includes('晜') || r.includes('仍')) return 'grandchild_p'; // 统归为远孙辈
    if (r.includes('孙')) return 'grandchild_p'; // 简化处理，默认宗亲孙辈
    if (r.includes('侄')) return 'child_p';
    if (r.includes('甥')) return 'child_m';
    if (r.includes('子') || r.includes('女')) return 'child_p';

    return 'self';
}

// 房头配色方案：采用低饱和度、高明度的中国传统色，确保不干扰头像显示
const HALL_COLORS = [
    'rgba(240, 249, 255, 0.6)', // 远天蓝
    'rgba(240, 253, 244, 0.6)', // 若竹翠
    'rgba(255, 251, 235, 0.6)', // 琥珀黄
    'rgba(254, 242, 242, 0.6)', // 胭脂红
    'rgba(250, 245, 255, 0.6)', // 薰衣草紫
    'rgba(255, 247, 237, 0.6)', // 杏花橙
];

/**
 * 智能解析：从自然语言中提取“房分/排行”
 */
export function extractRankFromText(text: string): string | null {
    if (!text) return null;
    const match = text.match(new RegExp(RANK_REGEX_STR));
    return match ? match[0] : null;
}

/**
 * 生成逻辑坐标 (Logic Tag) - 用于全家福地图自动排版
 */
export function getLogicTag(side: 'paternal' | 'maternal', connector: string, rank?: string, isSameSurname?: boolean): string {
    const s = side === 'paternal' ? '[F]' : '[M]';
    // 如果同姓但在母系，增加标记位 '!S' (Same Surname)
    const suffix = (side === 'maternal' && isSameSurname) ? '!S' : '';
    const paths: Record<string, string> = {
        father: 'f', grandfather: 'f,f', grandmother: 'f,m', g_grandfather: 'f,f,f',
        paternal_cousin_elder: 'f,f,b', // 通过爷爷的手足衔接 (堂伯叔姑)
        mother: 'm', m_grandfather: 'm,f', m_grandmother: 'm,m', m_g_grandfather: 'm,f,f',
        maternal_cousin_elder: 'm,f,b', // 通过外公的手足衔接 (堂舅姨)
        sibling: 'sib', self_p: 'x', self_m: 'x,m',
        child_p: 's', child_m: 's,m', grandchild_p: 's,s'
    };
    const path = paths[connector] || 'unknown';
    
    // 🚀 核心改进：如果房分未知，通过特定的 hash 或标记位使该分支保持独立，防止多房头“合并成一房”
    let r = '';
    if (rank && rank !== '不知道') {
        r = `-o${rank}`;
    } else if (rank === '不知道') {
        // 使用一个特殊的占位符，由后端或同步流程决定是否真的合龙
        r = `-oUNKNOWN`;
    }
    
    return `${s}${suffix}-${path}${r}`;
}

/**
 * 礼法防火墙：实时检测称谓与支脉、性别的逻辑冲突
 */
export function validateKinshipLogic(
    side: 'paternal' | 'maternal',
    connector: string,
    relText: string,
    gender: 'male' | 'female',
    targetSurname?: string,
    mySurname?: string
): { isValid: boolean, warning?: string, type: 'error' | 'warning' | 'success', tag?: string } {
    const isMaternal = side === 'maternal';
    const isSameSurname = !!(mySurname && targetSurname && targetSurname === mySurname);

    const tag = getLogicTag(side, connector, undefined, isSameSurname);
    const rel = relText || "";
    if (!rel) return { isValid: true, type: 'success', tag };

    // --- 🚀 新增：称号与性别一致性强校验 ---
    const femaleKeywords = ["姑", "姨", "妈", "娘", "奶", "婆", "姐", "妹", "嫂", "侄女", "外甥女", "媳", "婶", "妗", "姥", "女"];
    const maleKeywords = ["叔", "伯", "爸", "爹", "爷", "公", "哥", "弟", "婿", "夫", "男", "侄子", "外甥", "舅"];

    const isRelFemale = femaleKeywords.some(k => rel.includes(k));
    const isRelMale = maleKeywords.some(k => rel.includes(k));

    if (gender === 'male' && isRelFemale && !isRelMale) {
        return { isValid: false, warning: `礼法冲突：您选择的性别为“男”，但称谓“${rel}”带有明显的女性特征。请修正性别或称谓。`, type: 'error', tag };
    }
    if (gender === 'female' && isRelMale && !isRelFemale) {
        return { isValid: false, warning: `礼法冲突：您选择的性别为“女”，但称谓“${rel}”带有明显的男性特征。请修正性别或称谓。`, type: 'error', tag };
    }

    // 增加：同姓堂舅/姨的特殊识别
    if (isMaternal && isSameSurname && (rel.includes('舅') || rel.includes('姨'))) {
        return {
            isValid: true,
            warning: `✅ 特殊路径识别：虽然该亲属与您同姓(${targetSurname})，但通过母亲血脉衔接，系统已锁定其为【同姓外戚】。`,
            type: 'success',
            tag
        };
    }

    // 1. 母系校验：严禁纯“叔伯姑”，但允许“表叔/表姑/堂舅（如果是同姓外戚）”
    if (isMaternal && !rel.includes('表') && /叔|伯|姑/.test(rel)) {
        return {
            isValid: false,
            warning: '礼法冲突：母系(外家)支脉通常不直接称“叔/伯/姑”。若是母亲的表兄弟姐妹，请称呼“表舅/表姨”或“表叔/表姑”。',
            type: 'error',
            tag
        };
    }

    // 2. 父系-母族识别：奶奶分支
    if (side === 'paternal' && connector === 'grandmother') {
        if (/叔|伯|姑/.test(rel) && !rel.includes('表') && !rel.includes('堂')) {
            return { isValid: false, warning: '逻辑冲突：奶奶的分支属于外戚，通常称呼舅/姨系统。', type: 'error', tag };
        }
    }

    // 3. 堂舅逻辑纠偏
    if (rel.includes('堂') && !/舅|姨/.test(rel) && side === 'maternal') {
        const isBiao = rel.includes('表');
        if (!isBiao) {
            return { isValid: false, warning: '逻辑矛盾：母系通常不单独称“堂”。若是母亲的堂兄弟，请称呼“堂舅”。', type: 'error', tag };
        }
    }

    // 爷爷分支防错
    if (side === 'paternal' && connector === 'grandfather') {
        if ((rel.includes('舅') || rel.includes('姨')) && !rel.includes('表') && !rel.includes('堂')) {
            return { isValid: false, warning: '爷爷的分支（父系宗亲核心）不应直接出现舅/姨称谓，请确认方位。', type: 'error', tag };
        }
    }

    return { isValid: true, type: 'success', tag };
}

import { computeKinshipViaMumuy, getExplicitOrder, computeReverseViaMumuy } from './kinshipBridge';
import { STANDARD_ROLE_LABELS, getCleanRelationship, isFemale } from './relationships';

/**
 * 反向关系推演：TA 怎么叫你
 */
export function getReverseKinship(
    relText: string,
    side: 'paternal' | 'maternal',
    connector: string,
    myGender: any,
    targetNode?: any,
    viewerNode?: any,
    members?: any[]
): string {
    // 🛡️ 极端过滤：避免返回“创建者”等管理术语，直接重定义关系基准
    const isMeFemale = isFemale(viewerNode);
    const isMeMale = !isMeFemale;

    // 如果 targetNode 或 viewerNode 带有管理性称谓，重置其计算优先级，强制走 mumuy 逻辑
    const getSafeNode = (node: any) => {
        if (!node) return node;
        const rel = (node.relationship || '').trim();
        if (['创建者', '本人', '我'].includes(rel)) return { ...node, relationship: undefined };
        return node;
    };

    const safeTarget = getSafeNode(targetNode);
    const safeViewer = getSafeNode(viewerNode);

    const pRank = normalizeRank(viewerNode?.parent_order);
    const sRank = normalizeRank(viewerNode?.sibling_order);
    const isPaternal = side === 'paternal';

    // --- 🚀 核心升级：如果具备 55.0 引擎环境，直接进行视角对调推演 ---
    // NOTE: 如果有排行信息且是祖辈关系，我们优先走下方的“排行归位”礼法逻辑，否则走标准引擎
    const isAncestorConnector = ['grandfather', 'grandmother', 'm_grandfather', 'm_grandmother', 'g_grandfather', 'm_g_grandfather', 'grandparent_direct', 'grandparent_m_direct'].includes(connector);
    const hasRankInfo = pRank !== null && pRank !== undefined || sRank !== null && sRank !== undefined;

    if (safeTarget && safeViewer && members && members.length > 0 && !(isAncestorConnector && hasRankInfo)) {
        try {
            const rev = computeKinshipViaMumuy(safeTarget, safeViewer, members);
            if (rev && !['亲属', '其他', '亲戚', '家人', '本人', '创建者', '我'].includes(rev)) return rev;
        } catch (e) { }
    }

    let rel = (relText || '').trim();
    if (rel.includes('_') || /^[a-z]+$/.test(rel)) {
        const standardLabel = STANDARD_ROLE_LABELS[rel];
        if (standardLabel) rel = standardLabel;
    }

    const coreRel = getCleanRelationship(rel);

    const targetSex = normalizeGender(targetNode?.gender) || (isFemale(targetNode) ? 'female' : 'male');

    // --- 🚀 权威升级：mumuy/relationship.js 核心算法引擎 ---
    if (!(isAncestorConnector && hasRankInfo)) {
        try {
            // 逻辑：如果 A 叫 B "三姨婆"，我们要知道 B 叫 A 什么。
            // 此时 A 是观察者/目标（isMeMale ? 'male' : 'female'），B 是被称呼者（targetSex）。
            // 在 computeReverseViaMumuy 中，第二个参数应传入“发起称谓者 A”的性别。
            const rev = computeReverseViaMumuy(coreRel, (isMeMale ? 'male' : 'female'), targetSex as 'male' | 'female');
            if (rev && !['亲属', '其他', '亲戚', '家人', '本人'].includes(rev)) return rev;
        } catch (e) {
            console.warn("Mumuy reverse calculation failed, falling back to heuristics:", e);
        }
    }

    // 🚀 [Logic Upgrade] 增加对标准 role key 的直接支持，防止翻译混淆
    const stdRoleKey = (relText || '').toLowerCase();
    if (stdRoleKey === 'son' || stdRoleKey === 'daughter' || stdRoleKey === 'child') return isMeMale ? '父亲' : '母亲';
    if (stdRoleKey === 'father' || stdRoleKey === 'mother' || stdRoleKey === 'parent') return isMeMale ? '儿子' : '女儿';
    if (stdRoleKey === 'brother' || stdRoleKey === 'sister' || stdRoleKey === 'sibling') {
        const tS = getExplicitOrder(targetNode);
        const vS = getExplicitOrder(viewerNode);
        if (tS !== 99 && vS !== 99 && tS !== vS) {
            if (tS < vS) return isMeMale ? '弟弟' : '妹妹'; // TA 比我大，TA 喊我弟/妹
            if (tS > vS) return isMeMale ? '哥哥' : '姐姐'; // TA 比我小，TA 喊我哥/姐
        }
        return isMeMale ? '哥哥/弟弟' : '姐姐/妹妹';
    }

    // 提取前缀 (堂、表、再从、三从、族)
    const prefixes = ['再从', '三从', '堂', '表', '族'];
    const prefix = prefixes.find(p => rel.includes(p)) || '';

    // =====================================================================
    // --- 🌟 Fallback: 启发式内置规则 (用于只有文本标签的场景) ---
    // =====================================================================
    if (['grandfather', 'grandmother', 'm_grandfather', 'm_grandmother', 'g_grandfather', 'm_g_grandfather', 'grandparent_direct', 'grandparent_m_direct'].includes(connector)) {
        if (/^(爷爷|奶奶|外公|外婆|曾祖|太爷|太奶|外太公|外太婆|公|爷|奶|姥)/.test(coreRel)) {

            const isPaternal = side === 'paternal';
            const isGreat = coreRel.includes('曾') || coreRel.includes('太');

            // 基础称谓定义
            const baseSuffix = isMeMale ? (isPaternal ? '孙' : '外孙') : (isPaternal ? '孙女' : '外孙女');
            const fullBase = isMeMale ? (isPaternal ? '孙子' : '外孙子') : (isPaternal ? '孙女' : '外孙女');

            // 礼法组合逻辑
            // 1. 特殊简写：长房长孙(女) -> 长孙(女)
            if (pRank === 1 && sRank === 1) return '长' + baseSuffix;

            // 2. 正常组合：如 大房的二孙子
            if (pRank && sRank) {
                const bTitle = getFormalRankTitle(pRank, 'branch');
                const sChar = sRank === 1 ? '长' : (sRank === 2 ? '次' : (sRank === 99 ? '小' : (NUM_CHAR[sRank] || sRank)));
                const finalBase = (sRank === 1 || sRank === 2 || sRank === 99) ? baseSuffix : fullBase;
                return `${bTitle}${sChar}${finalBase}`;
            }

            if (pRank) return getFormalRankTitle(pRank, 'branch') + fullBase;
            if (sRank) {
                const sChar = sRank === 1 ? '长' : (sRank === 2 ? '次' : (sRank === 99 ? '小' : (NUM_CHAR[sRank] || sRank)));
                return sChar + baseSuffix;
            }

            return isGreat ? (isMeMale ? (isPaternal ? '曾孙' : '外曾孙') : (isPaternal ? '曾孙女' : '外曾孙女')) : fullBase;
        }
    }

    if (connector === 'grandchild_p') {
        if (coreRel.includes('玄')) return isMeMale ? '高祖父' : '高祖母';
        if (coreRel.includes('曾')) return isMeMale ? '曾祖父' : '曾祖母';
        return isMeMale ? '爷爷' : '奶奶';
    }

    if (/叔|伯/.test(coreRel)) return prefix + (isMeMale ? '侄子' : '侄女');
    if (/姑/.test(coreRel)) return prefix + (isMeMale ? '侄子' : '侄女'); // 姑姑的侄子/女
    if (/舅|姨/.test(coreRel)) return prefix + (isMeMale ? '外甥' : '外甥女');
    if (/哥|姐|弟|妹/.test(coreRel)) {
        const isOlder = /哥|姐/.test(coreRel);
        if (isMeMale) return isOlder ? prefix + '弟' : prefix + '哥';
        return isOlder ? prefix + '妹' : prefix + '姐';
    }
    if (coreRel === '父亲' || coreRel === '母亲' || /爸|妈/.test(coreRel)) return isMeMale ? '儿子' : '女儿';
    if (coreRel === '儿子' || coreRel === '女儿' || /子|女/.test(coreRel)) return isMeMale ? '父亲' : '母亲';

    // 🚀 [Ranking Fix] 如果是平辈，且有排行数据，进行精准推导
    if (connector === 'sibling') {
        const tS = getExplicitOrder(targetNode);
        const vS = getExplicitOrder(viewerNode);
        if (tS !== 99 && vS !== 99 && tS !== vS) {
            if (tS < vS) return isMeMale ? '弟弟' : '妹妹'; // TA 比我大，TA 喊我弟/妹
            if (tS > vS) return isMeMale ? '哥哥' : '姐姐'; // TA 比我小，TA 喊我哥/姐
        }
    }

    if (/孙/.test(coreRel)) {
        if (coreRel.includes('玄') || coreRel.includes('耳')) return isMeMale ? '高祖父' : '高祖母';
        if (coreRel.includes('曾')) return isMeMale ? '曾祖父' : '曾祖母';
        if (coreRel.includes('外')) return isMeMale ? '外公' : '外婆';
        return isMeMale ? '爷爷' : '奶奶';
    }

    if (/侄|甥/.test(coreRel)) {
        if (prefix === '堂') return isMeMale ? '堂叔' : '堂姑';
        if (prefix === '表') return isMeMale ? '表舅' : '表姨';
        if (/外甥/.test(coreRel)) return isMeMale ? '舅舅/姨丈' : '姨妈/舅妈';
        return isMeMale ? '叔/舅' : '姑/姨';
    }

    return '亲属';
}

/**
 * 名分搜索查询器
 * 解析用户的输入，返回可以用来过滤成员的布尔函数
 */
export function createKinshipSearchFilter(query: string) {
    if (!query || !query.trim()) return () => true;

    // 提取可能存在的排行
    const rank = extractRankFromText(query);
    const q = query.toLowerCase();

    // 构建过滤函数
    return (member: any) => {
        // 全匹配：姓名、称谓、标签
        if (member.name?.toLowerCase().includes(q)) return true;
        if (member.relationship?.toLowerCase().includes(q)) return true;

        // 逻辑标记匹配 (Logic Tag)
        // 比如输入 "舅公" -> [M] 侧 或者 f,m (奶奶分支)
        const tag = member.logicTag || member.logic_tag || "";
        if (!tag) return false;

        // 如果输入包含“排行”，检查 tag 是否包含该排行 (例如: -o三)
        if (rank && tag.includes(`-o${rank}`)) {
            // 进一步确认称谓性质。例如 "三叔" 应该过滤父系
            if (q.includes("叔") || q.includes("伯") || q.includes("姑")) {
                return tag.includes("[F]") && !tag.includes("f,m"); // 不能是奶奶的分支
            }
            if (q.includes("舅") || q.includes("姨")) {
                return tag.includes("[M]") || tag.includes("f,m");
            }
            return true;
        }

        // 基础名讳映射
        if (q.includes("堂") && tag.includes("[F]") && !tag.includes("f,m")) return true;
        if (q.includes("表") && (tag.includes("[M]") || tag.includes("f,m") || tag.includes("f,p"))) return true;

        if ((q.includes("舅") || q.includes("姨")) && (tag.includes("[M]") || tag.includes("f,m"))) return true;
        if ((q.includes("叔") || q.includes("伯") || q.includes("姑")) && tag.includes("[F]") && !tag.includes("f,m")) return true;

        return false;
    };
}

/**
 * 为《全家福大地图》自动排版生成坐标：采用弹性智能布局 (Smart Layout)
 * Generate SVG coordinates for members using an elastic collision-free layout.
 */
export function generateSmartLayout(rawMembers: any[], currentUser?: any) {
    if (!rawMembers || rawMembers.length === 0) return { members: [], pods: [] };

    // 过滤掉宠物和社交关系，它们不参与家族谱的计算
    const members = (rawMembers || []).filter(m =>
        m.memberType !== 'pet' && m.member_type !== 'pet' &&
        m.kinshipType !== 'social' && m.kinship_type !== 'social'
    );

    // 🚀 核心纠偏：确定“本人”基准
    // 如果传入了 currentUser，优先通过 userId 或 memberId 在 members 中找到它
    const selfNode = members.find(m => 
      (currentUser?.id && m.userId && String(m.userId) === String(currentUser.id)) ||
      (currentUser?.memberId && m.id && String(m.id) === String(currentUser.memberId)) ||
      (m.relationship === '本人' || m.relationship === '创建者' || (m.logicTag || "").includes('self'))
    ) || members[0];

    // Canvas settings
    const CENTER_X = 500;
    const START_Y = 100;
    const LEVEL_HEIGHT = 160;
    const MIN_NODE_GAP = 140; // 弹性防碰撞节点安全距离
    const SIDE_OFFSET = 300;

    // 内部帮助函数：动态提取代际 (支持无限层级)
    const getGenLevel = (tag: string, member: any) => {
        if (member.generation_num !== undefined && member.generation_num !== null) {
            // 修正：后端 generation_num 越大代表辈分越低（子孙），越小代表辈分越高（祖先）
            // 我们希望 Y 轴方向一致：祖先 (小) -> 后代 (大)
            return Number(member.generation_num); 
        }
        if (!tag || tag === 'unknown') return 30; // 放到中间默认层级

        const parts = tag.split('-');
        if (parts.length < 2) return 0;
        const path = parts[1];
        
        if (path === 'self' || path.startsWith('sib') || path.startsWith('x')) return 0; // 同辈
        
        const segments = path.split(',').filter(Boolean);
        const depth = segments.length;
        
        if (path.startsWith('f') || path.startsWith('m')) {
            return -depth; // 祖辈，越老越往上 (负数)
        }
        if (path.startsWith('s') || path.startsWith('child')) {
            return depth; // 晚辈，越年轻越往下 (正数)
        }
        return 0;
    };

    // 内部帮助函数：提取数字化的房分权重排序
    const getRankIndex = (tag: string) => {
        const match = tag.match(/-o([\d\w一二三四五六七八九十]+)$/);
        if (!match) return 5; // 默认中间位置
        return normalizeRank(match[1]) || 5;
    };

    /**
     * 核心提升：虚拟节点补全 (Ghost Nodes)
     */
    function injectGhostNodes(rawMembers: any[]) {
        const existingTags = new Set(rawMembers.map(m => m.logicTag || m.logic_tag || ""));
        const ghosts: any[] = [];

        rawMembers.forEach(m => {
            const tag = m.logicTag || m.logic_tag || "";
            if (!tag) return;

            const parts = tag.split('-');
            if (parts.length > 1) {
                const side = parts[0];
                const pathSegments = parts[1].split(',');
                if (pathSegments.length > 1) {
                    const parentPath = pathSegments.slice(0, -1).join(',');
                    const ghostTag = `${side}-${parentPath}`;

                    if (!existingTags.has(ghostTag)) {
                        const ghostName = parentPath.endsWith('f') ? "（父辈占位）" : "（母辈占位）";
                        ghosts.push({
                            id: `ghost-${ghostTag}`,
                            name: ghostName,
                            logicTag: ghostTag,
                            memberType: 'virtual',
                            isGhost: true,
                            gender: parentPath.endsWith('f') ? 'male' : 'female'
                        });
                        existingTags.add(ghostTag);
                    }
                }
            }
        });
        return [...rawMembers, ...ghosts];
    }

    // 1. 注入虚位
    const enrichedMembers = injectGhostNodes(members);

    // 2. 注入排序预处理辅助字段
    const parsedMembers = enrichedMembers.map(m => {
        const tag = m.logicTag || m.logic_tag || "";
        const fallbackSide = m.originSide === 'maternal' || m.origin_side === 'maternal' ? 'maternal' :
            (m.originSide === 'paternal' || m.origin_side === 'paternal' ? 'paternal' : 'unknown');

        return {
            ...m,
            _gen: getGenLevel(tag, m),
            _side: tag.startsWith('[F]') ? 'paternal' : (tag.startsWith('[M]') ? 'maternal' : fallbackSide),
            _rank: getRankIndex(tag),
            _rawTag: tag
        };
    });

    // 按代际和方位分组
    const grouped: Record<string, any[]> = {};
    parsedMembers.forEach(m => {
        const key = `${m._side}_${m._gen}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
    });

    const finalMembers: any[] = [];
    const pods: any[] = []; // 新增：房头背景块容器

    // 记录每个房头在每一代、每一侧的坐标范围
    const hallBounds: Record<string, { minX: number, maxX: number, minY: number, maxY: number, side: string, label: string }> = {};

    // 为每个分组分别计算居中对齐的防碰撞X轴坐标
    Object.keys(grouped).forEach(key => {
        const group = grouped[key];
        group.sort((a, b) => {
            if (a._rank !== b._rank) return a._rank - b._rank;
            return a._rawTag.localeCompare(b._rawTag);
        });

        const isPaternal = key.startsWith('paternal');
        const isMaternal = key.startsWith('maternal');
        const gen = parseInt(key.split('_')[1]);

        let currentXOffset = 0;
        const gaps: number[] = [0];

        for (let i = 1; i < group.length; i++) {
            const prev = group[i - 1];
            const curr = group[i];
            let gap = MIN_NODE_GAP;
            if (prev.father_id && curr.father_id && prev.father_id === curr.father_id) gap = MIN_NODE_GAP * 0.8;
            else if (prev.ancestralHall && curr.ancestralHall && prev.ancestralHall === curr.ancestralHall) gap = MIN_NODE_GAP;
            else gap = MIN_NODE_GAP * 1.5;
            currentXOffset += gap;
            gaps.push(currentXOffset);
        }

        const totalWidth = currentXOffset;

        group.forEach((m, index) => {
            let x = CENTER_X;
            let y = START_Y + (gen + 3) * LEVEL_HEIGHT; // Offset to start lower so top generations don't hit the top
            
            if (gen === 99) {
                x = CENTER_X + (Math.random() * 800 - 400);
                y = START_Y + 10 * LEVEL_HEIGHT; 
            } else {
                if (isPaternal) {
                    const centerX = CENTER_X - (SIDE_OFFSET + totalWidth / 2);
                    x = centerX + gaps[index];
                } else if (isMaternal) {
                    const centerX = CENTER_X + SIDE_OFFSET;
                    x = centerX + gaps[index];
                } else {
                    x = CENTER_X - (totalWidth / 2) + gaps[index];
                }
            }

            // 记录房头边界
            if (m.ancestralHall && m.ancestralHall !== '无' && !m.isGhost) {
                const hallKey = `${key}_${m.ancestralHall}`;
                if (!hallBounds[hallKey]) {
                    hallBounds[hallKey] = {
                        minX: x, maxX: x, minY: y, maxY: y,
                        side: m._side, label: m.ancestralHall
                    };
                } else {
                    hallBounds[hallKey].minX = Math.min(hallBounds[hallKey].minX, x);
                    hallBounds[hallKey].maxX = Math.max(hallBounds[hallKey].maxX, x);
                    hallBounds[hallKey].minY = Math.min(hallBounds[hallKey].minY, y);
                    hallBounds[hallKey].maxY = Math.max(hallBounds[hallKey].maxY, y);
                }
            }

            const { _gen, _side, _rank, _rawTag, ...cleanMember } = m;
            finalMembers.push({
                ...cleanMember,
                mapX: x,
                mapY: y
            });
        });
    });

    // 生成房头背景 Pods
    Object.keys(hallBounds).forEach((hallKey, i) => {
        const b = hallBounds[hallKey];
        const padding = 60; // 留出头像外圈空间
        pods.push({
            id: hallKey,
            x: b.minX - padding,
            y: b.minY - padding - 20,
            width: (b.maxX - b.minX) + padding * 2,
            height: (b.maxY - b.minY) + padding * 2 + 30,
            color: HALL_COLORS[i % HALL_COLORS.length],
            label: b.label,
            side: b.side
        });
    });

    return { members: finalMembers, pods };
}
