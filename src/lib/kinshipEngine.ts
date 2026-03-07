// 轻量级 KinshipEngine (基于 mumuy/relationship 核心思想)
// 节点标识：
// f: father, m: mother, h: husband, w: wife, s: son, d: daughter, b: brother, p: sister
// o: 排行, 例如 o2 (老二)

export const REL_MAP: Record<string, string> = {
    // --- 父系宗亲 (Paternal) ---
    'f,b': '叔伯',         // 父亲的兄弟
    'f,p': '姑妈',         // 父亲的姐妹
    'f,f,b': '叔伯公',     // 爷爷的兄弟
    'f,f,p': '姑婆',       // 爷爷的姐妹

    // --- 父系里的母族 (Paternal-Maternal) ---
    'f,m,b': '舅公',       // 父亲的母亲(奶奶)的兄弟
    'f,m,p': '姨婆',       // 父亲的母亲(奶奶)的姐妹
    'f,m,b,s': '堂舅',     // 奶奶的亲侄子 (重点：归于父系侧的母族)

    // --- 母系外戚 (Maternal) ---
    'm,b': '舅舅',         // 母亲的兄弟
    'm,p': '姨妈',         // 母亲的姐妹
    'm,f,b,s': '堂舅',     // 母亲的堂兄弟 (重点：归于母系侧的堂亲)
    'm,m,b': '舅公',       // 母亲的母亲(外婆)的兄弟
};

/**
 * 获取逻辑坐标 (Logic Tag)
 * @param side 方位 (父系/母系)
 * @param connector 衔接点 (父亲、爷爷、奶奶...)
 * @param rank 排行
 */
export function getLogicTag(side: 'paternal' | 'maternal', connector: string, rank?: string): string {
    const s = side === 'paternal' ? '[F]' : '[M]';
    let path = 'unknown';
    if (connector === 'father') path = 'f';
    if (connector === 'grandfather') path = 'f,f';
    if (connector === 'grandmother') path = 'f,m';
    if (connector === 'mother') path = 'm';
    if (connector === 'm_grandfather') path = 'm,f';
    if (connector === 'm_grandmother') path = 'm,m';
    if (connector === 'sibling') path = 'b/p';

    return `${s}-${path}${rank && rank !== '无' ? `-o${rank}` : ''}`;
}

/**
 * 大白话逻辑守卫校验
 */
export function validateKinshipLogic(
    side: 'paternal' | 'maternal',
    connector: string,
    relText: string,
    targetSurname: string,
    mySurname: string
): { isValid: boolean, warning?: string, type: 'error' | 'warning' | 'success', tag?: string } {
    const tag = getLogicTag(side, connector);
    const rel = relText || "";

    // 母系不允许称“堂”，除非是“堂舅/堂姨”
    if (side === 'maternal' && rel.includes('堂')) {
        if (!rel.includes('舅') && !rel.includes('姨')) {
            return { isValid: false, warning: '母系支脉通常不称“堂”（堂兄弟姐妹属于父系宗亲），建议检查。', type: 'error', tag };
        }
    }

    // 父系里的母族矛盾解决 (奶奶分支)
    if (side === 'paternal' && connector === 'grandmother') {
        if (rel.includes('舅') || rel.includes('姨')) {
            return { isValid: true, warning: '✅ 奶奶的分支允许并鼓励使用舅/姨称谓 (如舅公、姨婆)', type: 'success', tag };
        }
        if (rel.includes('伯') || rel.includes('叔') || rel.includes('姑')) {
            return { isValid: false, warning: '奶奶的分支属于外戚，不应出现叔/伯/姑，这会造成家族树断裂！', type: 'error', tag };
        }
    }
    // 爷爷分支防错
    else if (side === 'paternal' && connector === 'grandfather') {
        if (rel.includes('舅') || rel.includes('姨')) {
            return { isValid: false, warning: '爷爷的分支（父系宗亲核心）不应出现舅/姨称谓，请确认方位。', type: 'error', tag };
        }
        if (mySurname && targetSurname && targetSurname !== mySurname) {
            return { isValid: true, warning: '⚠️ 录入爷爷的分支但姓氏不同，请确认是否为“表亲”(如姑母或姑婆的后代)。', type: 'warning', tag };
        }
    }

    // 基础母系防阻：绝不出现叔、伯、姑
    if (side === 'maternal' && (rel.includes('叔') || rel.includes('伯') || rel.includes('姑'))) {
        return { isValid: false, warning: '母系中不可能出现叔、伯、姑，这会造成家族树断裂！', type: 'error', tag };
    }

    return { isValid: true, type: 'success', tag };
}

/**
 * 反向称谓推导
 */
export function getReverseKinship(relText: string, side: 'paternal' | 'maternal', connector: string, myGender: any): string {
    const rel = relText || "";
    const isMale = String(myGender).toLowerCase() === 'male' || String(myGender) === '男';

    if (rel.includes('叔') || rel.includes('伯')) {
        return isMale ? '侄子' : '侄女';
    }
    if (rel.includes('舅')) {
        return isMale ? '外甥' : '外甥女';
    }
    if (rel.includes('姨')) {
        return isMale ? '姨甥' : '姨甥女';
    }
    if (rel.includes('姑')) {
        // 姑姑称兄弟的孩子为内侄
        return isMale ? '内侄' : '内侄女';
    }
    if (rel === '父亲' || rel === '母亲' || rel.includes('爸') || rel.includes('妈')) {
        return isMale ? '儿子' : '女儿';
    }
    if (rel.includes('公') || rel.includes('爷') || rel.includes('婆') || rel.includes('奶') || rel.includes('老祖') || rel.includes('太')) {
        return isMale ? (side === 'paternal' ? '孙子' : '外孙') : (side === 'paternal' ? '孙女' : '外孙女');
    }
    if (rel.includes('哥') || rel.includes('弟')) {
        return isMale ? '兄弟' : '兄妹/姐弟';
    }
    if (rel.includes('姐') || rel.includes('妹')) {
        return isMale ? '姐弟/兄妹' : '姐妹';
    }
    if (rel.includes('儿子') || rel.includes('女儿')) {
        return isMale ? '父亲' : '母亲';
    }
    if (rel.includes('侄') || rel.includes('甥')) {
        return isMale ? '叔辈/舅辈' : '姑妈/姨妈';
    }

    return '亲属';
}
