/**
 * 💡 家族逻辑大脑 V3.0 - 深度集成路人甲路径思想
 */

// 基于衔接点的快捷建议表
export const CONNECTOR_SUGGESTIONS: Record<string, string[]> = {
    'father': ['叔叔', '伯伯', '姑姑'],
    'grandfather': ['伯公', '叔公', '姑婆', '堂伯', '堂叔'],
    'grandmother': ['舅公', '姨婆', '堂舅', '堂姨'],
    'mother': ['舅舅', '阿姨'],
    'm_grandfather': ['堂舅', '堂姨', '表舅', '外舅公'],
    'm_grandmother': ['姨姥', '表姨'],
    'sibling': ['哥', '弟', '姐', '妹']
};

/**
 * 智能解析：从自然语言中提取“房分/排行”
 */
export function extractRankFromText(text: string): string | null {
    if (!text) return null;
    const match = text.match(/(大|一|二|三|四|五|六|七|八|九|十|小|幺|老)/);
    return match ? match[0] : null;
}

/**
 * 生成逻辑坐标 (Logic Tag) - 用于全家福地图自动排版
 */
export function getLogicTag(side: 'paternal' | 'maternal', connector: string, rank?: string): string {
    const s = side === 'paternal' ? '[F]' : '[M]';
    const paths: Record<string, string> = {
        father: 'f', grandfather: 'f,f', grandmother: 'f,m',
        mother: 'm', m_grandfather: 'm,f', m_grandmother: 'm,m', sibling: 'b/p',
        self_p: 'x', child_p: 's', self_m: 'x,m', child_m: 's,m'
    };
    const path = paths[connector] || 'unknown';
    const r = rank && rank !== '无' ? `-o${rank}` : '';
    return `${s}-${path}${r}`;
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
    const tag = getLogicTag(side, connector);
    const rel = relText || "";
    if (!rel) return { isValid: true, type: 'success', tag };

    // 1. 母系红线：严禁叔伯姑
    if (side === 'maternal' && /叔|伯|姑/.test(rel)) {
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
 * 为《全家福大地图》自动排版生成坐标
 * Generate SVG coordinates for members based on their Logic Tags.
 */
export function generateLayoutFromTags(members: any[]) {
    // Canvas settings
    const CENTER_X = 500;
    const START_Y = 100;
    const LEVEL_HEIGHT = 150;
    const SIBLING_GAP = 120;
    const SIDE_OFFSET = 300; // [F] goes left, [M] goes right

    return members.map((member) => {
        let x = CENTER_X;
        let y = START_Y;
        let generationLevel = 1; // Default generation level

        const tag = member.logicTag || member.logic_tag || "";

        if (!tag) {
            // 随机摆放在底部
            return { ...member, mapX: Math.random() * 1000, mapY: START_Y + LEVEL_HEIGHT * 4 };
        }

        // 解析方位 [F] or [M]
        const isPaternal = tag.startsWith('[F]');
        const isMaternal = tag.startsWith('[M]');

        // 中心线左侧或右侧
        if (isPaternal) {
            x -= SIDE_OFFSET;
        } else if (isMaternal) {
            x += SIDE_OFFSET;
        }

        // 解析代际和高度 y
        if (tag.includes('f,f') || tag.includes('m,m') || tag.includes('m,f') || tag.includes('f,m')) {
            generationLevel = -1; // 爷爷那辈
        } else if (tag.includes('-f') || tag.includes('-m')) {
            generationLevel = 0;  // 父母那辈
        } else if (tag.includes('-x') || tag.includes('b/p')) {
            generationLevel = 1;  // 同辈
        } else if (tag.includes('-s')) {
            generationLevel = 2;  // 晚辈
        }

        y = START_Y + (generationLevel + 1) * LEVEL_HEIGHT;

        // 解析房分（同辈横向位移）
        const rankMatch = tag.match(/-o(大|一|二|三|四|五|六|七|八|九|十|小|幺|老)$/);
        let rankOffset = 0;
        if (rankMatch) {
            const rankStr = rankMatch[1];
            const rankMap: Record<string, number> = {
                '大': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
                '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '小': 11, '幺': 11, '老': 11
            };
            const rIndex = rankMap[rankStr] || 1;
            rankOffset = (rIndex - 2) * SIBLING_GAP; // -2 to center around middle ranks
        }

        // 最终 X 轴加入房分偏移
        x += rankOffset;

        return {
            ...member,
            mapX: x,
            mapY: y
        };
    });
}
