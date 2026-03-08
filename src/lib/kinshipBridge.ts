/**
 * 💡 mumuy/relationship.js 桥接层 - 2.0 升级版 (视角感知 + 绝对坐标系)
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

const HALL_RANK: Record<string, number> = {
    '大房': 1, '一房': 1, '二房': 2, '三房': 3, '四房': 4, '五房': 5,
    '六房': 6, '七房': 7, '八房': 8, '九房': 9, '十房': 10, '小房': 99
};

/**
 * 核心：动态称谓计算引擎
 * 逻辑：优先使用绝对坐标 (Generation & Hall) 进行视向感知计算
 */
export function computeKinshipViaMumuy(
    targetNode: any,
    viewerNode: any,
    members?: any[],
    reverse: boolean = false
): string | null {
    // 1. 本人判定
    if (targetNode.id === viewerNode.id) return "本人";

    // 2. 准备基础数据 (坐标系)
    const tG = targetNode.generation_num;
    const vG = viewerNode.generation_num;
    const tH = targetNode.ancestral_hall;
    const vH = viewerNode.ancestral_hall;
    const tSex = targetNode.gender === 'female' || targetNode.gender === '女' ? 'F' : 'M';
    const tS = targetNode.sibling_order || 99;
    const vS = targetNode.sibling_order || 99;

    // 🚀 核心逻辑 A: 基于“绝对坐标”的动态推导 (无需寻路，最准)
    if (tG != null && vG != null) {
        const genDiff = tG - vG; // 目标代数 - 观察者代数
        const hT = HALL_RANK[tH] || 99;
        const hV = HALL_RANK[vH] || 99;

        // 同辈 (代际差为 0)
        if (genDiff === 0) {
            let isOlder = false;
            if (hT < hV) isOlder = true; // 目标的房分更靠前
            else if (hT === hV && tS < vS) isOlder = true; // 同房，目标的排行更靠前

            if (tH === vH) {
                // 亲兄弟姐妹
                return isOlder ? (tSex === 'F' ? '姐姐' : '哥哥') : (tSex === 'F' ? '妹妹' : '弟弟');
            } else {
                // 堂兄弟姐妹 (跨房)
                return isOlder ? (tSex === 'F' ? '堂姐' : '堂哥') : (tSex === 'F' ? '堂妹' : '堂弟');
            }
        }

        // 长一辈 (代际差为 -1)
        if (genDiff === -1) {
            if (tH === vH) return tSex === 'F' ? '姑妈' : '叔伯'; // 同房的长辈
            return tSex === 'F' ? '堂姑' : (hT === 1 ? '大伯' : '叔叔');
        }

        // 晚一辈 (代际差为 1)
        if (genDiff === 1) {
            return tSex === 'F' ? '侄女' : '侄子';
        }

        // 长两辈 (代际差为 -2)
        if (genDiff === -2) return tSex === 'F' ? '奶奶/外婆' : '爷爷/外公';

        // 晚两辈 (代际差为 2)
        if (genDiff === 2) return tSex === 'F' ? '孙女' : '孙子';
    }

    // 🚀 核心逻辑 B: 兜底方案 (使用原有 relationship.js 库)
    // 如果没有坐标，回退到数据库存储的相对备注
    if (targetNode.relationship && !reverse) return targetNode.relationship;

    return null;
}

/**
 * 辅助：获取对邀请人的反向称谓
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
