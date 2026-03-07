/**
 * 💡 家族逻辑大脑 V3.0 - 深度集成路人甲路径思想
 */

// 基于衔接点的快捷建议表
export const CONNECTOR_SUGGESTIONS: Record<string, string[]> = {
    'father': ['叔叔', '伯伯', '姑姑'],
    'grandfather': ['伯公', '叔公', '姑婆', '堂伯', '堂叔'],
    'grandmother': ['舅公', '姨婆', '堂舅', '堂姨'],
    'sibling': ['哥哥', '弟弟', '姐姐', '妹妹'], // 亲兄弟姐妹
    'self_p': ['堂哥', '堂弟', '堂姐', '堂妹'], // 父系堂亲
    'child_p': ['儿子', '女儿', '侄子', '侄女', '孙子', '孙女'],
    'mother': ['舅舅', '阿姨'],
    'm_grandfather': ['堂舅', '堂姨', '表舅', '外舅公'],
    'm_grandmother': ['姨姥', '表姨'],
    'self_m': ['表哥', '表弟', '表姐', '表妹'], // 母系表亲
    'child_m': ['外甥', '外甥女', '外孙', '外孙女'],
};

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
    const r = rank && rank !== '无' ? `-o${rank}` : '';
    return `${s}${suffix}-${path}${r}`;
}

/**
 * 礼法防火墙：实时检测称谓与支脉的逻辑冲突
 */
export function validateKinshipLogic(
    side: 'paternal' | 'maternal',
    connector: string,
    relText: string,
    targetSurname?: string,
    mySurname?: string
): { isValid: boolean, warning?: string, type: 'error' | 'warning' | 'success', tag?: string } {
    const isMaternal = side === 'maternal';
    const isSameSurname = !!(mySurname && targetSurname && targetSurname === mySurname);

    const tag = getLogicTag(side, connector, undefined, isSameSurname);
    const rel = relText || "";
    if (!rel) return { isValid: true, type: 'success', tag };

    // 增加：同姓堂舅/姨的特殊识别
    if (isMaternal && isSameSurname && (rel.includes('舅') || rel.includes('姨'))) {
        return {
            isValid: true,
            warning: `✅ 特殊路径识别：虽然该亲属与您同姓(${targetSurname})，但通过母亲血脉衔接，系统已锁定其为【同姓外戚】。`,
            type: 'success',
            tag
        };
    }

    // 1. 母系红线：严禁叔伯姑
    if (isMaternal && /叔|伯|姑/.test(rel)) {
        return {
            isValid: false,
            warning: '礼法冲突：母系(外家)支脉中不可能出现叔、伯、姑。请检查方位或改为“舅/姨”。',
            type: 'error',
            tag
        };
    }

    // 2. 父系-母族识别：奶奶分支
    if (side === 'paternal' && connector === 'grandmother') {
        if (/舅|姨/.test(rel)) {
            return { isValid: true, warning: '✅ 逻辑适配：成功识别父系中的“母族”分支坐标（如舅公）。', type: 'success', tag };
        }
        if (/叔|伯|姑/.test(rel)) {
            return { isValid: false, warning: '逻辑冲突：奶奶的分支属于外戚，不应出现叔/伯/姑。', type: 'error', tag };
        }
    }

    // 3. 堂舅逻辑纠偏
    if (rel.includes('堂') && !/舅|姨/.test(rel) && side === 'maternal') {
        return { isValid: false, warning: '逻辑矛盾：母系通常不称“堂”。若是母亲的堂兄弟，请称呼“堂舅”。', type: 'error', tag };
    }

    // 爷爷分支防错
    if (side === 'paternal' && connector === 'grandfather') {
        if (/舅|姨/.test(rel)) {
            return { isValid: false, warning: '爷爷的分支（父系宗亲核心）不应出现舅/姨称谓，请确认方位。', type: 'error', tag };
        }
        if (mySurname && targetSurname && targetSurname !== mySurname) {
            return { isValid: true, warning: '⚠️ 录入爷爷的分支但姓氏不同，请确认是否为“表亲”(如姑母或姑婆的后代)。', type: 'warning', tag };
        }
    }

    return { isValid: true, type: 'success', tag };
}

/**
 * 反向关系推演：TA 怎么叫你
 */
export function getReverseKinship(relText: string, side: 'paternal' | 'maternal', connector: string, myGender: any): string {
    const rel = relText || "";
    const isMale = String(myGender).toLowerCase() === 'male' || String(myGender) === '男';

    if (/叔|伯/.test(rel)) return isMale ? '侄子' : '侄女';
    if (/舅/.test(rel)) return isMale ? '外甥' : '外甥女';
    if (/姨/.test(rel)) return isMale ? '姨甥' : '姨甥女';
    if (/姑/.test(rel)) return isMale ? '内侄' : '内侄女';
    if (/公|爷|婆|奶|老祖|太/.test(rel)) return isMale ? (side === 'paternal' ? '孙子' : '外孙') : (side === 'paternal' ? '孙女' : '外孙女');
    if (/哥|弟/.test(rel)) return isMale ? '兄弟' : '兄妹/姐弟';
    if (/姐|妹/.test(rel)) return isMale ? '姐弟/兄妹' : '姐妹';
    if (/儿子|女儿/.test(rel)) return isMale ? '父亲' : '母亲';
    if (/侄|甥/.test(rel)) return isMale ? '叔辈/舅辈' : '姑妈/姨妈';
    if (rel === '父亲' || rel === '母亲' || /爸|妈/.test(rel)) return isMale ? '儿子' : '女儿';

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
export function generateSmartLayout(members: any[]) {
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

            const { _gen, _side, _rank, _rawTag, ...cleanMember } = m;
            finalMembers.push({
                ...cleanMember,
                mapX: x,
                mapY: y
            });
        });
    });

    return finalMembers;
}
