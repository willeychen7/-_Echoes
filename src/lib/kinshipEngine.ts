/**
 * 💡 家族逻辑大脑 V4.0 - 集成 mumuy/relationship.js 权威称谓库
 * GitHub: https://github.com/mumuy/relationship
 */

import { normalizeGender } from "./utils";

// 基于衔接点的快捷建议表
export const CONNECTOR_SUGGESTIONS: Record<string, string[]> = {
    'father': ['叔叔', '伯伯', '姑姑'],
    'grandfather': ['伯公', '叔公', '姑婆', '婶婆', '伯婆', '外公', '外叔公'],
    'grandmother': ['舅公', '姨婆', '堂舅公', '堂姨婆', '姨外婆'],
    'sibling': ['哥哥', '弟弟', '姐姐', '妹妹'], // 亲兄弟姐妹
    'self_p': ['堂哥', '堂弟', '堂姐', '堂妹', '再从兄', '再从弟', '三从兄'], // 父系宗亲
    'child_p': ['儿子', '女儿', '侄子', '侄女', '孙子', '孙女'],
    'mother': ['舅舅', '阿姨'],
    'm_grandfather': ['堂舅', '堂姨', '表舅', '外舅公', '外公', '姑婆', '表叔', '表姑'],
    'm_grandmother': ['姨姥', '表姨', '姨外婆', '外婆'],
    'self_m': ['表哥', '表弟', '表姐', '表妹', '再从表哥', '再从表弟'], // 母系外戚
    'child_m': ['外甥', '外甥女', '外孙', '外孙女'],
};

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
    // 优先匹配多位数字，如 十一, 二十
    const match = text.match(/(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|小|幺|老)/);
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
        father: 'f', grandfather: 'f,f', grandmother: 'f,m',
        mother: 'm', m_grandfather: 'm,f', m_grandmother: 'm,m',
        sibling: 'sib', // 亲兄弟姐妹独享路径码 (mumuy风格)
        self_p: 'x', child_p: 's', self_m: 'x,m', child_m: 's,m'
    };
    const path = paths[connector] || 'unknown';
    const r = rank && rank !== '不知道' ? `-o${rank}` : '';
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

import { computeKinshipViaMumuy } from './kinshipBridge';
import { STANDARD_ROLE_LABELS, getCleanRelationship } from './relationships';

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
    // --- 🚀 核心升级：如果具备 55.0 引擎环境，直接进行视角对调推演 ---
    if (targetNode && viewerNode && members && members.length > 0) {
        try {
            const rev = computeKinshipViaMumuy(viewerNode, targetNode, members);
            if (rev && !['亲属', '其他', '亲戚', '家人'].includes(rev)) return rev;
        } catch (e) { }
    }

    let rel = (relText || '').trim();
    if (rel.includes('_') || /^[a-z]+$/.test(rel)) {
        const standardLabel = STANDARD_ROLE_LABELS[rel];
        if (standardLabel) rel = standardLabel;
    }

    const coreRel = getCleanRelationship(rel);
    const isMale = normalizeGender(myGender) === 'male';

    // 提取前缀 (堂、表、再从、三从、族)
    const prefixes = ['再从', '三从', '堂', '表', '族'];
    const prefix = prefixes.find(p => rel.includes(p)) || '';

    // =====================================================================
    // --- 🌟 Fallback: 启发式内置规则 (用于只有文本标签的场景) ---
    // =====================================================================
    if (connector === 'grandfather' || connector === 'grandmother' || connector === 'm_grandfather' || connector === 'm_grandmother') {
        if (/^(爷爷|奶奶|外公|外婆|阿公|阿嬷|姥姥|姥爷)$/.test(coreRel)) {
            if (side === 'paternal') return isMale ? '孙子' : '孙女';
            return isMale ? '外孙' : '外孙女';
        }
    }

    if (/叔|伯/.test(coreRel)) return prefix + (isMale ? '侄子' : '侄女');
    if (/姑/.test(coreRel)) return prefix + (isMale ? '外甥' : '外甥女');
    if (/舅|姨/.test(coreRel)) return prefix + (isMale ? '外甥' : '外甥女');
    if (/哥|姐|弟|妹/.test(coreRel)) {
        const isOlder = /哥|姐/.test(coreRel);
        if (isMale) return isOlder ? prefix + '弟' : prefix + '哥';
        return isOlder ? prefix + '妹' : prefix + '姐';
    }
    if (coreRel === '父亲' || coreRel === '母亲' || /爸|妈/.test(coreRel)) return isMale ? '儿子' : '女儿';

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
export function generateSmartLayout(rawMembers: any[]) {
    // 过滤掉宠物和社交关系，它们不参与家族谱的计算
    const members = (rawMembers || []).filter(m =>
        m.memberType !== 'pet' && m.member_type !== 'pet' &&
        m.kinshipType !== 'social' && m.kinship_type !== 'social'
    );

    // Canvas settings
    const CENTER_X = 500;
    const START_Y = 100;
    const LEVEL_HEIGHT = 160;
    const MIN_NODE_GAP = 140; // 弹性防碰撞节点安全距离
    const SIDE_OFFSET = 300;

    // 内部帮助函数：提取代际
    const getGenLevel = (tag: string) => {
        if (!tag) return 99; // 未指定，放最后
        if (tag.includes('f,f') || tag.includes('m,m') || tag.includes('m,f') || tag.includes('f,m')) return -1; // 爷爷辈
        if (tag.includes('-f') || tag.includes('-m')) return 0; // 父母辈
        if (tag.includes('-sib') || tag.includes('-x') || tag.includes('self')) return 1; // 同辈
        if (tag.includes('-s') || tag.includes('child')) return 2; // 晚辈
        return 99;
    };

    // 内部帮助函数：提取数字化的房分权重排序
    const getRankIndex = (tag: string) => {
        const match = tag.match(/-o(二十|十一|十二|十三|十四|十五|十六|十七|十八|十九|一|二|三|四|五|六|七|八|九|十|大|小|幺|老)$/);
        if (!match) return 0;
        const rankMap: Record<string, number> = {
            '大': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
            '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
            '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
            '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
            '小': 98, '幺': 98, '老': 99
        };
        return rankMap[match[1]] || 1;
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
            _gen: getGenLevel(tag),
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
            if (prev.fatherId && curr.fatherId && prev.fatherId === curr.fatherId) gap = 85;
            else if (prev.ancestralHall && curr.ancestralHall && prev.ancestralHall === curr.ancestralHall) gap = 140;
            else gap = 200;
            currentXOffset += gap;
            gaps.push(currentXOffset);
        }

        const totalWidth = currentXOffset;

        group.forEach((m, index) => {
            let x = CENTER_X;
            let y = START_Y + (gen + 1) * LEVEL_HEIGHT;
            const extraRepulsion = m._rawTag.includes('!S') ? 160 : 0;

            if (gen === 99) {
                x = CENTER_X + (Math.random() * 800 - 400);
                y = START_Y + 4 * LEVEL_HEIGHT + Math.random() * 100;
            } else {
                if (isPaternal) {
                    const centerX = CENTER_X - SIDE_OFFSET;
                    x = centerX - (totalWidth / 2) + gaps[index] - extraRepulsion;
                } else if (isMaternal) {
                    const centerX = CENTER_X + SIDE_OFFSET;
                    x = centerX - (totalWidth / 2) + gaps[index] + extraRepulsion;
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
