/**
 * 家族关系辅助库
 * 提供关系选项、角色推断和称谓相对化功能
 */

// NOTE: 标准角色对应的中文显示名
export const STANDARD_ROLE_LABELS: Record<string, string> = {
    self: "本人",
    father: "父亲",
    mother: "母亲",
    grandfather_paternal: "爷爷",
    grandmother_paternal: "奶奶",
    grandfather_maternal: "外公",
    grandmother_maternal: "外婆",
    great_great_grandfather: "高祖父",
    great_great_grandmother: "高祖母",
    great_grandfather: "曾祖父",
    great_grandmother: "曾祖母",
    son: "儿子",
    daughter: "女儿",
    brother: "哥哥/弟弟",
    sister: "姐姐/妹妹",
    uncle_paternal: "叔叔/伯伯",
    aunt_paternal: "姑姑",
    uncle_maternal: "舅舅",
    aunt_maternal: "阿姨",
    husband: "丈夫",
    wife: "妻子",
    grandson: "孙子",
    granddaughter: "孙女",
    nephew: "侄子/外甥",
    niece: "侄女/外甥女",
    cousin: "表亲/亲系",
    family: "家人",
};

// NOTE: 用于 AddMemberPage 选择关系时的选项列表
export const RELATIONSHIP_OPTIONS = [
    { value: "grandfather_paternal", label: "爷爷" },
    { value: "grandmother_paternal", label: "奶奶" },
    { value: "grandfather_maternal", label: "外公" },
    { value: "grandmother_maternal", label: "外婆" },
    { value: "great_grandfather", label: "曾祖/外曾祖" },
    { value: "great_great_grandfather", label: "高祖" },
    { value: "father", label: "父亲" },
    { value: "mother", label: "母亲" },
    { value: "husband", label: "丈夫" },
    { value: "wife", label: "妻子" },
    { value: "brother", label: "兄弟" },
    { value: "sister", label: "姐妹" },
    { value: "uncle_paternal", label: "叔叔/伯伯" },
    { value: "aunt_paternal", label: "姑姑" },
    { value: "uncle_maternal", label: "舅舅" },
    { value: "aunt_maternal", label: "阿姨" },
    { value: "son", label: "儿子" },
    { value: "daughter", label: "女儿" },
    { value: "grandson", label: "孙子/外孙" },
    { value: "nephew", label: "侄子/外甥" },
    { value: "cousin", label: "表亲/亲访" },
    { value: "family", label: "其他家人" },
    { value: "pet", label: "宠物/毛孩子" },
];

/**
 * 清理排行前缀 (大, 二, 十一, 十二... 小, 老等)，还原为基础称谓
 * 支持无限排行 (1-99+)
 */
export function getCleanRelationship(rel: string): string {
    const specialTwoWords = ["大伯", "大爷", "大妈", "大娘", "老爸", "老妈", "老婆", "老公"];
    let clean = (rel || "").trim();
    if (!clean || specialTwoWords.includes(clean)) return clean;

    // 匹配中文数字排行前缀 (如 十一, 二十, 三, 大, 小)
    const rankRegex = /^(大|小|老|一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十)+/;
    const match = clean.match(rankRegex);

    if (match && clean.length > match[0].length) {
        return clean.substring(match[0].length);
    }

    return clean;
}

/**
 * 根据关系字符串推断标准角色标识
 */
export function deduceRole(relationship: string): string {
    const raw = (relationship || "").trim();
    const clean = getCleanRelationship(relationship);
    if (!clean) return "family";

    // 逻辑 A: 特殊处理带排行的“爸”（闽系中二爸、三爸均为叔伯）
    // 只有“数字/排行+爸”才判定为叔伯，防止“亲爸”误判。老爸、爸爸是亲爹。
    if (clean === "爸" && /^(大|二|三|四|五|六|七|八|九|十|小|一|第)/.test(raw)) {
        const exclusions = ["老爸", "阿爸", "亲爸", "爸爸", "父亲"];
        if (!exclusions.some(exc => raw.includes(exc))) return "uncle_paternal";
    }

    const map: Record<string, string> = {
        "老爸": "father",
        "亲爸": "father",
        "爸爸": "father",
        "父亲": "father",
        "阿爸": "father",
        "爸": "father",
        "老妈": "mother",
        "亲妈": "mother",
        "妈妈": "mother",
        "母亲": "mother",
        "阿妈": "mother",
        "妈": "mother",
        "高祖父": "great_great_grandfather",
        "高祖母": "great_great_grandmother",
        "曾祖父": "great_grandfather",
        "曾祖母": "great_grandmother",
        "外曾祖父": "great_grandfather",
        "外曾祖母": "great_grandmother",
        "爷爷": "grandfather_paternal",
        "奶奶": "grandmother_paternal",
        "外公": "grandfather_maternal",
        "外婆": "grandmother_maternal",
        "伯公": "grand_uncle_paternal",
        "姆婆": "grand_aunt_paternal", // 伯公妻
        "叔公": "grand_uncle_paternal",
        "婶婆": "grand_aunt_paternal", // 叔公妻
        "姑婆": "grand_aunt_paternal",
        "姑公": "grand_uncle_paternal", // 姑婆夫
        "舅公": "grand_uncle_maternal",
        "妗婆": "grand_aunt_maternal", // 舅公妻
        "姨婆": "grand_aunt_maternal",
        "姨公": "grand_uncle_maternal", // 姨婆夫
        "阿公": "grandfather_paternal",
        "阿嬷": "grandmother_paternal",
        "外嬷": "grandmother_maternal",
        "家官": "grandfather_paternal", // 闽系儿媳对公公称呼
        "家婆": "grandmother_paternal", // 闽系儿媳对婆婆称呼
        "舅太": "great_grand_uncle_maternal",
        "姑太": "great_grand_aunt_paternal",
        "嗣子": "son",
        "祧子": "son",
        "大伯": "uncle_paternal",
        "小叔": "uncle_paternal",
        "叔叔": "uncle_paternal",
        "伯伯": "uncle_paternal",
        "叔": "uncle_paternal",
        "大爷": "uncle_paternal",
        "儿媳": "daughter",
        "女婿": "son",
        "公公": "grandfather_paternal",
        "婆婆": "grandmother_paternal",
        "岳父": "grandfather_maternal",
        "岳母": "grandmother_maternal",
        "大舅子": "uncle_maternal",
        "小舅子": "uncle_maternal",
        "大姑": "aunt_paternal",
        "小姑": "aunt_paternal",
        "大姨子": "aunt_maternal",
        "小姨子": "aunt_maternal",
        "丈夫": "husband",
        "妻子": "wife",
        "老婆": "wife",
        "老公": "husband",
        "兄弟": "brother",
        "哥哥": "brother",
        "哥": "brother",
        "弟弟": "brother",
        "弟": "brother",
        "姐": "sister",
        "姐姐": "sister",
        "妹妹": "sister",
        "妹": "sister",
        "姐妹": "sister",
        "姑姑": "aunt_paternal",
        "姑": "aunt_paternal",
        "舅舅": "uncle_maternal",
        "舅": "uncle_maternal",
        "阿姨": "aunt_maternal",
        "姨": "aunt_maternal",
        "舅妈": "aunt_maternal",
        "婶婶": "aunt_paternal",
        "伯母": "aunt_paternal",
        "姨妈": "aunt_maternal",
        "小姨": "aunt_maternal",
        "姑父": "uncle_paternal",
        "姨父": "uncle_maternal",
        "亲兄": "cousin",
        "亲弟": "cousin",
        "亲姐": "cousin",
        "亲妹": "cousin",
        "亲伯": "cousin",
        "亲叔": "cousin",
        "亲姑": "cousin",
        "亲侄": "nephew",
        "亲外甥": "nephew",
        "表叔": "cousin",
        "表姑": "cousin",
        "表伯": "cousin",
        "表哥": "cousin",
        "表弟": "cousin",
        "表姐": "cousin",
        "表妹": "cousin",
        "表侄": "nephew",
        "表外甥": "nephew",
        "儿": "son",
        "儿子": "son",
        "女儿": "daughter",
        "孙子": "grandson",
        "孙女": "granddaughter",
        "外孙": "grandson",
        "外孙子": "grandson",
        "外孙女": "granddaughter",
        "曾孙": "grandson",
        "曾孙女": "granddaughter",
        "外曾孙": "grandson",
        "侄子": "nephew",
        "外甥": "nephew",
        "侄女": "niece",
        "外甥女": "niece",
        "内侄": "nephew",
        "内侄女": "niece",
    };
    return map[clean] || "family";
}

/**
 * 核心：获取一个人的父母 ID 集合
 */
function getParentIds(nodeId: any, members: any[]) {
    // 强制转为数字比较，防止 string vs number
    const node = members.find(m => Number(m.id) === Number(nodeId));
    if (!node) return { fId: null, mId: null };
    return { fId: node.fatherId, mId: node.motherId };
}

/**
 * 核心：判断是否为宗亲（同姓且同宗）
 */
export function isClan(vNode: any, tNode: any): boolean {
    if (!vNode || !tNode) return false;
    // 如果有房头定义，房头相同且姓氏相同则为宗亲
    if (vNode.surname && tNode.surname && vNode.surname === tNode.surname) {
        if (vNode.ancestralHall && tNode.ancestralHall) {
            return vNode.ancestralHall === tNode.ancestralHall;
        }
        return true; // 即使没写房头，同姓在闽系中也常默认同宗
    }
    return false;
}

/**
 * 根据生日及房头计算排行前缀 (大, 二, 三, 小)
 */
function getRankPrefix(targetNode: any, members: any[]) {
    // --- 逻辑 A：名分优先 (针对“二爸”、“老小姨”) ---
    const rawRemark = (targetNode.relationship || "").trim();
    // 匹配前缀：大, 二, 三, 四, 五, 六, 七, 八, 九, 十, 小, 老
    const explicitRankMatch = rawRemark.match(/^(大|二|三|四|五|六|七|八|九|十|小|老)/);
    if (explicitRankMatch) {
        return explicitRankMatch[0]; // 用户手动填了名分，直接锁死，不再看生日
    }

    // --- 逻辑 B：生物学排序 (用户没填排行时触发) ---
    const targetId = Number(targetNode.id);
    const targetGen = targetNode.generationNum;

    const sibs = members.filter(m => {
        if (m.memberType === 'pet' || m.type === 'pet') return false;
        const sameGen = m.generationNum === targetGen;
        // 确保排行是在同一个房头（或同一支脉）内部进行的
        const sameHall = targetNode.ancestralHall === m.ancestralHall;
        return sameGen && sameHall && m.gender === targetNode.gender;
    });

    if (sibs.length <= 1) return "";

    const sorted = [...sibs].sort((a, b) => {
        const da = a.birthDate || a.birth_date || "9999-99-99";
        const db = b.birthDate || b.birth_date || "9999-99-99";
        return da.localeCompare(db);
    });

    const index = sorted.findIndex(s => Number(s.id) === targetId);
    if (index === -1) return "";

    // 针对末位的特殊处理
    if (index === sorted.length - 1 && sorted.length > 1) return "小";

    const chineseNumbers = ["", "大", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    return chineseNumbers[index + 1] || "";
}

/**
 * 严谨的家族关系推导函数
 */
export function getRigorousRelationship(
    viewer: any,
    target: any,
    members: any[],
    depth: number = 0
): string {
    try {
        // 防止递归死循环 (设置最大推导深度)
        if (depth > 2) return target?.relationship || "家人";
        let vId = viewer?.memberId ? Number(viewer.memberId) : (viewer?.id ? Number(viewer.id) : null);
        const tId = target?.id ? Number(target.id) : null;

        // NOTE: 关键修正 - 如果 vId 是 userId，需要在 members 中找到对应的 memberId
        if (vId && !members.some(m => Number(m.id) === vId)) {
            const boundMember = members.find(m => Number(m.userId) === vId);
            if (boundMember) vId = Number(boundMember.id);
        }

        if (tId === null || vId === null) return target?.relationship || "家人";
        if (vId === tId) return "我";

        const vNode = members.find(m => Number(m.id) === vId);
        const tNode = members.find(m => Number(m.id) === tId);
        if (!vNode || !tNode) return target?.relationship || "家人";

        // --- 【关键修正点】物种隔离拦截器 ---
        const isPet = tNode.memberType === 'pet' ||
            tNode.type === 'pet' ||
            tNode.standardRole === 'pet' ||
            tNode.relationship === '宠物';

        if (isPet) {
            // 找到主人的逻辑：优先找 fatherId（挂载在谁名下），没有则找创建者
            const ownerId = tNode.fatherId || tNode.createdByMemberId;
            const owner = members.find(m => Number(m.id) === Number(ownerId));

            // 场景 A：我是主人
            if (vId && owner && Number(owner.id) === vId) {
                const petSuffix = tNode.gender === 'female' ? "毛女儿" : "毛儿子";
                // 显示：旺财 (毛儿子)
                return tNode.name ? `${tNode.name} (${petSuffix})` : petSuffix;
            }

            // 场景 B：别人是主人（二爸家的旺财）
            if (owner) {
                // 递归计算我叫主人什么
                const ownerTitle = getRigorousRelationship(vNode, owner, members, depth + 1);
                const cleanOwnerTitle = getCleanRelationship(ownerTitle);
                // 显示：二爸家的旺财 或 堂姐家的宝贝
                return `${cleanOwnerTitle}家的${tNode.name || '宝贝'}`;
            }

            return tNode.name || "家族萌宠";
        }

        // --- 严谨比对辅助函数 ---
        const eq = (a: any, b: any) => a && b && Number(a) === Number(b);

        // --- 闽系核心：昭穆（代数）判定逻辑 ---
        if (vNode.generationNum !== undefined && tNode.generationNum !== undefined) {
            const genDiff = vNode.generationNum - tNode.generationNum; // V相对于T的代差

            // 如果是同代 (0: 同辈)
            if (genDiff === 0 && !eq(vId, tId)) {
                const isRealSibling = (vNode.fatherId && eq(vNode.fatherId, tNode.fatherId)) ||
                    (vNode.motherId && eq(vNode.motherId, tNode.motherId));

                // 物理支脉判定：如果没有姓氏房头，但能溯源到共同爷爷，强行定性为“堂”
                const getFId = (id: any) => members.find(m => eq(m.id, id))?.fatherId;
                const vGFId = getFId(vNode.fatherId);
                const tGFId = getFId(tNode.fatherId);
                const isPaternalCousin = vGFId && tGFId && eq(vGFId, tGFId);

                const clan = isClan(vNode, tNode) || isPaternalCousin;
                const prefix = getRankPrefix(tNode, members);

                if (isRealSibling) {
                    const vDate = vNode.birthDate || vNode.birth_date || "9999-99-99";
                    const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
                    const isOlder = tDate < vDate;

                    if (tNode.gender === "female") {
                        return isOlder ? "姐姐" : "妹妹";
                    } else {
                        return isOlder ? "哥哥" : "弟弟";
                    }
                }
                if (clan) {
                    const vDate = vNode.birthDate || vNode.birth_date || "9999-99-99";
                    const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
                    const isOlder = tDate < vDate;
                    if (tNode.gender === "female") {
                        return isOlder ? `${prefix}堂姐` : `${prefix}堂妹`;
                    } else {
                        return isOlder ? `${prefix}堂哥` : `${prefix}堂弟`;
                    }
                } else {
                    const vDate = vNode.birthDate || vNode.birth_date || "9999-99-99";
                    const tDate = tNode.birthDate || tNode.birth_date || "9999-99-99";
                    const isOlder = tDate < vDate;
                    if (tNode.gender === "female") {
                        return isOlder ? `${prefix}表姐` : `${prefix}表妹`;
                    } else {
                        return isOlder ? `${prefix}表哥` : `${prefix}表弟`;
                    }
                }
            }

            // 如果长一辈 (1: 对象是我的长辈)
            if (genDiff === 1) {
                const clan = isClan(vNode, tNode);
                const prefix = getRankPrefix(tNode, members);

                const getFId = (id: any) => members.find(m => eq(m.id, id))?.fatherId;
                const vfId = vNode.fatherId;
                const isRealFatherSibling = vfId && tNode.fatherId && eq(getFId(vfId), tNode.fatherId);

                if (clan) {
                    if (isRealFatherSibling) {
                        if (tNode.gender === "female") return `${prefix}姑姑`;
                        // 细化 叔/伯
                        const fNode = members.find(m => eq(m.id, vfId));
                        const fDate = fNode?.birthDate || fNode?.birth_date || "9999-99-99";
                        const tDate = tNode?.birthDate || tNode?.birth_date || "9999-99-99";
                        return tDate < fDate ? `${prefix}伯伯` : `${prefix}叔叔`;
                    } else {
                        return tNode.gender === "female" ? `${prefix}堂姑` : `${prefix}堂叔`;
                    }
                } else {
                    return tNode.gender === "female" ? `${prefix}姨妈` : `${prefix}舅舅`;
                }
            }

            // 如果晚一辈 (-1: 对象是我的晚辈)
            if (genDiff === -1) {
                const clan = isClan(vNode, tNode);
                const prefix = getRankPrefix(tNode, members);
                if (clan) {
                    return tNode.gender === "female" ? `${prefix}堂侄女` : `${prefix}堂侄子`;
                } else {
                    return tNode.gender === "female" ? `${prefix}表外甥女` : `${prefix}表外甥`;
                }
            }
        }

        // 1. 直系父子
        if (eq(tId, vNode.fatherId)) return "爸爸";
        if (eq(tId, vNode.motherId)) return "妈妈";

        // 2. 直系子女
        if (eq(vId, tNode.fatherId) || eq(vId, tNode.motherId)) {
            return tNode.gender === "female" ? "女儿" : "儿子";
        }

        // 3. 兄弟姐妹 (备用，如果代数缺失)
        if ((vNode.fatherId && eq(vNode.fatherId, tNode.fatherId)) ||
            (vNode.motherId && eq(vNode.motherId, tNode.motherId))) {
            return tNode.gender === "female" ? "姐/妹" : "哥/弟";
        }

        // 4. 祖孙 (向上两代)
        const { fId: vf, mId: vm } = getParentIds(vId, members);
        if (vf) {
            const { fId: vff, mId: vfm } = getParentIds(vf, members);
            if (eq(tId, vff)) return "爷爷";
            if (eq(tId, vfm)) return "奶奶";
        }
        if (vm) {
            const { fId: vmf, mId: vmm } = getParentIds(vm, members);
            if (eq(tId, vmf)) return "外公";
            if (eq(tId, vmm)) return "外婆";
        }

        // 5. 孙辈 (向下两代)
        const { fId: tf, mId: tm } = getParentIds(tId, members);
        if (tf) {
            const { fId: tff, mId: tfm } = getParentIds(tf, members);
            if (eq(tff, vId) || eq(tfm, vId)) return tNode.gender === "female" ? "孙女" : "孙子";
        }
        if (tm) {
            const { fId: tmf, mId: tmm } = getParentIds(tm, members);
            if (eq(tmf, vId) || eq(tmm, vId)) return tNode.gender === "female" ? "外孙女" : "外孙子";
        }

        // 6. 配偶 (基于共同子女推断)
        const vIsSpouse = members.some(child =>
            (eq(child.fatherId, vId) && eq(child.motherId, tId)) ||
            (eq(child.motherId, vId) && eq(child.fatherId, tId))
        );
        if (vIsSpouse) return tNode.gender === "female" ? "妻子" : "丈夫";

        // 7. 舅舅/阿姨/叔叔/姑姑 (父母的兄弟姐妹 - 带排行)
        if (vf) {
            const { fId: vff, mId: vfm } = getParentIds(vf, members);
            const fSiblings = members.filter(m => (vff && eq(m.fatherId, vff)) || (vfm && eq(m.motherId, vfm)));
            if (fSiblings.some(s => eq(s.id, tId))) {
                if (tNode.gender === "female") return "姑姑";

                // 细化 叔/伯 (基于父亲与目标的生日对比)
                const fNode = members.find(m => eq(m.id, vf));
                const fDate = fNode?.birthDate || fNode?.birth_date;
                const tDate = tNode?.birthDate || tNode?.birth_date;

                if (fDate && tDate) {
                    return tDate < fDate ? "伯伯" : "叔叔";
                }
                return "叔伯";
            }
        }
        if (vm) {
            const { fId: vmf, mId: vmm } = getParentIds(vm, members);
            const mSiblings = members.filter(m => (vmf && eq(m.fatherId, vmf)) || (vmm && eq(m.motherId, vmm)));
            if (mSiblings.some(s => eq(s.id, tId))) {
                return tNode.gender === "female" ? "阿姨" : "舅舅";
            }
        }

        // 8. 侄子/外甥 (兄弟姐妹的孩子)
        const mySiblings = members.filter(m =>
            !eq(m.id, vId) &&
            ((vNode.fatherId && eq(m.fatherId, vNode.fatherId)) || (vNode.motherId && eq(m.motherId, vNode.motherId)))
        );
        if (mySiblings.some(s => eq(tNode.fatherId, s.id) || eq(tNode.motherId, s.id))) {
            const clan = isClan(vNode, tNode);
            return clan ? (tNode.gender === "female" ? "亲侄女" : "亲侄子") : (tNode.gender === "female" ? "外甥女" : "外甥");
        }

        // --- 映射常量 (置于全局以优化递归性能并修复作用域报错) ---

        const inverseMap: Record<string, { male: string; female: string }> = {
            "儿子": { male: "爸爸", female: "妈妈" },
            "女儿": { male: "爸爸", female: "妈妈" },
            "爸爸": { male: "儿子", female: "女儿" },
            "妈妈": { male: "儿子", female: "女儿" },
            "亲侄": { male: "亲伯/叔", female: "亲姑/婶" },
            "亲外甥": { male: "舅舅/姨丈", female: "阿姨/舅妈" },
            "侄子": { male: "亲伯/叔", female: "亲姑/婶" },
            "外甥": { male: "舅舅/姨丈", female: "阿姨/舅妈" },
            "侄女": { male: "亲伯/叔", female: "亲姑/婶" },
            "外甥女": { male: "舅舅/姨丈", female: "阿姨/舅妈" },
            "内侄": { male: "姑丈", female: "姑姑" },
            "内侄女": { male: "姑丈", female: "姑姑" },
            "孙子": { male: "爷爷/外公", female: "奶奶/外婆" },
            "孙女": { male: "爷爷/外公", female: "奶奶/外婆" },
            "曾孙": { male: "曾祖/外曾祖", female: "曾祖/外曾祖" },
            "爷爷": { male: "孙子", female: "孙女" },
            "奶奶": { male: "孙子", female: "孙女" },
            "外公": { male: "外孙", female: "外孙女" },
            "外婆": { male: "外孙", female: "外孙女" },
            "公公": { male: "儿媳", female: "儿媳" },
            "婆婆": { male: "儿媳", female: "儿媳" },
            "岳父": { male: "女婿", female: "女婿" },
            "岳母": { male: "女婿", female: "女婿" },
            "丈夫": { male: "丈夫", female: "妻子" },
            "妻子": { male: "丈夫", female: "妻子" },
            // 新增扩展：兄弟姐妹及旁系逆向
            "哥哥": { male: "弟弟", female: "妹妹" },
            "弟弟": { male: "哥哥", female: "姐姐" },
            "姐姐": { male: "弟弟", female: "妹妹" },
            "妹妹": { male: "哥哥", female: "姐姐" },
            "哥": { male: "弟弟", female: "妹妹" },
            "弟": { male: "哥哥", female: "姐姐" },
            "姐": { male: "弟弟", female: "妹妹" },
            "妹": { male: "哥哥", female: "姐姐" },
            "表哥": { male: "表弟", female: "表妹" },
            "表弟": { male: "表哥", female: "表姐" },
            "表姐": { male: "表弟", female: "表妹" },
            "表妹": { male: "表哥", female: "表姐" },
            "堂哥": { male: "堂弟", female: "堂妹" },
            "堂弟": { male: "堂哥", female: "堂姐" },
            "堂姐": { male: "堂弟", female: "堂妹" },
            "堂妹": { male: "堂哥", female: "堂姐" },
            "大伯": { male: "侄子", female: "侄女" },
            "叔叔": { male: "侄子", female: "侄女" },
            "伯伯": { male: "侄子", female: "侄女" },
            "姑姑": { male: "内侄", female: "内侄女" },
            "舅舅": { male: "外甥", female: "外甥女" },
            "阿姨": { male: "外甥", female: "外甥女" },
            "姨妈": { male: "外甥", female: "外甥女" },
            "表伯": { male: "表侄子", female: "表侄女" },
            "表叔": { male: "表侄子", female: "表侄女" },
            "表姑": { male: "表侄子", female: "表侄女" },
            "表阿姨": { male: "表外甥", female: "表外甥女" },
            "表姨": { male: "表外甥", female: "表外甥女" },
            "表舅": { male: "表外甥", female: "表外甥女" },
            "堂阿姨": { male: "堂外甥", female: "堂外甥女" },
            "堂舅": { male: "堂外甥", female: "堂外甥女" },
            "表外甥": { male: "表舅", female: "表姨" },
            "表外甥女": { male: "表舅", female: "表姨" },
            "堂外甥": { male: "堂舅", female: "堂姨" },
            "堂外甥女": { male: "堂舅", female: "堂姨" },
            "表侄": { male: "表伯/表叔", female: "表姑" },
            "表侄女": { male: "表伯/表叔", female: "表姑" },
            "堂侄": { male: "堂伯/堂叔", female: "堂姑" },
            "堂侄女": { male: "堂伯/堂叔", female: "堂姑" },
        };

        // 姻亲改口映射表 (观察者相对于配偶家人的称呼)
        const spouseToViewerMap: Record<string, Record<string, string>> = {
            "female": { // 妻子视角：改口称呼夫家
                "爸爸": "公公", "妈妈": "婆婆", "哥哥": "大伯", "弟弟": "小叔", "姐姐": "大姑", "妹妹": "小姑",
                "兄弟": "大伯/小叔", "姐妹": "大姑/小姑", "亲兄弟": "大伯/小叔", "亲姐妹": "大姑/小姑"
            },
            "male": { // 丈夫视角：称呼妻家
                "爸爸": "岳父", "妈妈": "岳母", "哥哥": "大舅子", "弟弟": "小舅子", "姐姐": "大姨子", "妹妹": "小姨子",
                "兄弟": "大舅子/小舅子", "姐妹": "大姨子/小姨子", "亲兄弟": "大舅子/小舅子", "亲姐妹": "大姨子/小姨子"
            }
        };

        const bridgeMap: Record<string, Record<string, string>> = {
            "妈妈": { "儿子": "哥/弟", "女儿": "姐/妹", "孙子": "外甥/外甥女", "孙女": "外甥/外甥女" },
            "爸爸": { "儿子": "哥/弟", "女儿": "姐/妹", "孙子": "侄子/侄女", "孙女": "侄子/侄女" },
            "爷爷": { "兄弟": "伯公/叔公", "姐妹": "姑婆" },
            "奶奶": { "兄弟": "舅公", "姐妹": "姨婆" },
            "外公": { "兄弟": "舅公", "姐妹": "姨婆" },
            "外婆": { "兄弟": "舅公", "姐妹": "姨婆" },
            "曾祖父": { "儿子": "爷爷/外公" },
            "伯公": { "儿子": "叔伯", "女儿": "姑姑" },
            "叔公": { "儿子": "叔伯", "女儿": "姑姑" },
            "舅公": { "儿子": "表叔/表伯", "女儿": "表姑" },
            "姑婆": { "儿子": "表叔", "女儿": "表姑", "孙子": "表哥/弟/姐/妹", "孙女": "表哥/弟/姐/妹" },
            "姨婆": { "儿子": "表叔", "女儿": "表姑" },
            "亲伯": { "儿子": "堂哥/弟", "女儿": "堂姐/妹" },
            "亲叔": { "儿子": "堂哥/弟", "女儿": "堂姐/妹" },
            "亲姑": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "姑父" },
            "大伯": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "妻子": "伯母" },
            "伯母": { "儿子": "堂哥/弟", "女儿": "堂姐/妹" },
            "伯伯": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "妻子": "伯母" },
            "叔叔": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "妻子": "婶婶" },
            "小叔": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "妻子": "婶婶" },
            "婶婶": { "儿子": "堂哥/弟", "女儿": "堂姐/妹" },
            "姑姑": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "姑父" },
            "堂哥": { "儿子": "堂侄", "女儿": "堂侄女", "妻子": "堂嫂" },
            "堂弟": { "儿子": "堂侄", "女儿": "堂侄女", "妻子": "堂弟媳" },
            "堂姐": { "儿子": "堂外甥", "女儿": "堂外甥女", "丈夫": "堂姐夫" },
            "堂妹": { "儿子": "堂外甥", "女儿": "堂外甥女", "丈夫": "堂妹夫" },
            "堂叔": { "儿子": "堂兄弟", "女儿": "堂姐妹", "妻子": "堂婶" },
            "堂伯": { "儿子": "堂兄弟", "女儿": "堂姐妹", "妻子": "堂伯母" },
            "亲兄弟": { "儿子": "亲侄", "女儿": "亲侄女", "孙子": "侄孙", "孙女": "侄孙女" },
            "亲姐妹": { "儿子": "亲外甥", "女儿": "亲外甥女", "孙子": "外甥孙", "孙女": "外甥孙女" },
            "亲兄弟姐妹": { "儿子": "亲侄/亲外甥", "女儿": "亲侄/亲外甥" },
            "表哥": { "儿子": "表侄", "女儿": "表侄女", "妻子": "表嫂" },
            "表弟": { "儿子": "表侄", "女儿": "表侄女", "妻子": "表弟媳" },
            "表姐": { "儿子": "表外甥", "女儿": "表外甥女", "丈夫": "表姐夫" },
            "表妹": { "儿子": "表外甥", "女儿": "表外甥女", "丈夫": "表妹夫" },
            "表兄弟": { "儿子": "表侄", "女儿": "表侄女" },
            "表姐妹": { "儿子": "表外甥", "女儿": "表外甥女" },
            "表兄弟姐妹": { "儿子": "表侄/表外甥", "女儿": "表侄/表外甥" },
            "表伯": { "儿子": "表哥/弟", "女儿": "表姐/妹", "妻子": "表伯母" },
            "表叔": { "儿子": "表哥/弟", "女儿": "表姐/妹", "妻子": "表婶" },
            "表姑": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "表姑父" },
            "舅舅": { "儿子": "表哥/弟", "女儿": "表姐/妹", "妻子": "舅妈" },
            "舅妈": { "儿子": "表哥/弟", "女儿": "表姐/妹" },
            "阿姨": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "姨父" },
            "姨妈": { "儿子": "表哥/弟", "女儿": "表姐/妹", "丈夫": "姨父" },
            "兄弟": { "儿子": "亲侄子", "女儿": "亲侄女" },
            "姐妹": { "儿子": "亲外甥", "女儿": "亲外甥女" },
            "哥哥": { "儿子": "亲侄子", "女儿": "亲侄女", "妻子": "嫂子" },
            "弟弟": { "儿子": "亲侄子", "女儿": "亲侄女", "妻子": "弟媳" },
            "姐姐": { "儿子": "亲外甥", "女儿": "亲外甥女", "丈夫": "姐夫" },
            "妹妹": { "儿子": "亲外甥", "女儿": "亲外甥女", "丈夫": "妹夫" },
            "哥": { "儿子": "亲侄子", "女儿": "亲侄女", "妻子": "嫂子" },
            "弟": { "儿子": "亲侄子", "女儿": "亲侄女", "妻子": "弟媳" },
            "姐": { "儿子": "亲外甥", "女儿": "亲外甥女", "丈夫": "姐夫" },
            "妹": { "儿子": "亲外甥", "女儿": "亲外甥女", "丈夫": "妹夫" },
            "姐/妹": { "儿子": "亲外甥", "女儿": "亲外甥女" },
            "哥/弟": { "儿子": "亲侄子", "女儿": "亲侄女" },
            "儿子": { "妻子": "儿媳", "儿子": "孙子", "女儿": "孙女", "孙辈": "曾孙" },
            "女儿": { "丈夫": "女婿", "儿子": "外孙", "女儿": "外孙女", "孙辈": "外曾孙" },
            "孙子": { "儿子": "曾孙", "女儿": "曾孙女" },
            "外孙": { "儿子": "外曾孙", "女儿": "外曾孙女" },
            "亲侄子": { "妻子": "侄媳妇" },
            "亲外甥": { "妻子": "外甥媳妇" },
            "二爸": { "妻子": "二妈/婶婶", "儿子": "堂哥/弟" },
            "大爸": { "妻子": "大妈/伯母", "儿子": "堂哥/弟" },
            "丈夫": { "爸爸": "公公", "妈妈": "婆婆", "兄弟": "夫家大伯/夫家小叔", "姐妹": "大姑/小姑" },
            "妻子": { "爸爸": "岳父", "妈妈": "岳母", "兄弟": "大舅子/小舅子", "姐妹": "大姨子/小姨子" },
            "夫家大伯": { "儿子": "内侄", "女儿": "内侄女" },
            "夫家小叔": { "儿子": "内侄", "女儿": "内侄女" },
            "大姑": { "儿子": "姑外甥", "女儿": "姑外甥女" },
            "小姑": { "儿子": "姑外甥", "女儿": "姑外甥女" },
            "大舅子": { "儿子": "内侄", "女儿": "内侄女" },
            "小舅子": { "儿子": "内侄", "女儿": "内侄女" },
            "大姨子": { "儿子": "姨外甥", "女儿": "姨外甥女" },
            "小姨子": { "儿子": "姨外甥", "女儿": "姨外甥女" },
            "内侄": { "儿子": "内侄孙", "女儿": "内侄孙女" }
        };


        // 情况 A: target 创建了 viewer，viewer 知道自己是 target 的什么
        // 例如：陈阿妹创建了k仔，k仔的数据库关系存的是“外甥”。k仔(viewer)看陈阿妹(target)
        if (eq(vNode.createdByMemberId, tId)) {
            // --- 优先尊重手动修正 (Manual Override Check) ---
            // 如果 target 身上已经存了一个非默认的关系称呼，且不是“本人”，优先用它的
            const manualRel = tNode.relationship || "";
            if (manualRel && !["本人", "家人", "创建者", ""].includes(manualRel)) {
                return manualRel;
            }

            // viewer 是被 target 创建的。viewer 自身的 relationship 字段存的是“我是 target 的 XX”
            const myRoleToCreator = vNode.relationship || "";
            for (const [key, value] of Object.entries(inverseMap)) {
                if (myRoleToCreator.includes(key)) {
                    return tNode.gender === "female" ? value.female : value.male;
                }
            }
        }

        if (eq(tNode.createdByMemberId, vId)) {
            const raw = tNode.relationship || "创建者";
            // 只有当手动输入了明确称呼时才拦截；如果是模糊称呼，则下沉到算法推导
            if (raw && !["本人", "家人", "创建者", "其他", "创建人"].includes(raw)) {
                const labels: Record<string, { male: string; female: string }> = {
                    "外甥": { male: "外甥", female: "外甥女" },
                    "外甥女": { male: "外甥", female: "外甥女" },
                    "侄子": { male: "侄子", female: "侄女" },
                    "侄女": { male: "侄子", female: "侄女" },
                    "儿子": { male: "儿子", female: "女儿" },
                    "女儿": { male: "儿子", female: "女儿" },
                    "哥哥": { male: "哥哥", female: "姐姐" },
                    "弟弟": { male: "弟弟", female: "妹妹" },
                    "姐姐": { male: "哥哥", female: "姐姐" },
                    "妹妹": { male: "弟弟", female: "妹妹" },
                    "老公": { male: "老公", female: "老婆" },
                    "老婆": { male: "老公", female: "老婆" },
                    "丈夫": { male: "丈夫", female: "妻子" },
                    "妻子": { male: "丈夫", female: "妻子" },
                    "爸爸": { male: "爸爸", female: "妈妈" },
                    "妈妈": { male: "爸爸", female: "妈妈" },
                    "爷爷": { male: "爷爷", female: "奶奶" },
                    "奶奶": { male: "爷爷", female: "奶奶" },
                    "外公": { male: "外公", female: "外婆" },
                    "外婆": { male: "外公", female: "外婆" },
                    "舅舅": { male: "舅舅", female: "舅妈" },
                    "舅妈": { male: "舅舅", female: "舅妈" },
                    "伯伯": { male: "伯伯", female: "伯母" },
                    "伯母": { male: "伯伯", female: "伯母" },
                    "叔叔": { male: "叔叔", female: "婶婶" },
                    "婶婶": { male: "叔叔", female: "婶婶" },
                    "堂哥": { male: "堂哥", female: "堂姐" },
                    "堂兄": { male: "堂哥", female: "堂姐" },
                    "堂弟": { male: "堂弟", female: "堂妹" },
                    "堂姐": { male: "堂哥", female: "堂姐" },
                    "堂妹": { male: "堂弟", female: "堂妹" },
                    "表哥": { male: "表哥", female: "表姐" },
                    "表兄": { male: "表哥", female: "表姐" },
                    "表弟": { male: "表弟", female: "表妹" },
                    "表姐": { male: "表哥", female: "表姐" },
                    "表妹": { male: "表弟", female: "表妹" },
                };
                const entry = labels[raw];
                if (entry) {
                    const corrected = tNode.gender === "female" ? entry.female : entry.male;
                    return injectRankingAndRemark(corrected, tNode, members);
                }
                return injectRankingAndRemark(raw, tNode, members);
            }
        }

        // 情况 C: 级联桥接推算 (Bridge via Recursive Deduction)
        // 在递归之前，先尝试配偶视角切换 (Spouse Perspective Switching)
        const vSpouseId = vNode.spouseId || members.find(m =>
            members.some(child => (eq(child.fatherId, vId) && eq(child.motherId, m.id)) || (eq(child.motherId, vId) && eq(child.fatherId, m.id)))
        )?.id;

        if (vSpouseId && !eq(tId, vSpouseId)) {
            const vSpouse = members.find(m => eq(m.id, vSpouseId));
            if (vSpouse) {
                const sRel = getRigorousRelationship(vSpouse, tNode, members, depth + 1);
                const cleanSRel = getCleanRelationship(sRel);
                const map = spouseToViewerMap[vNode.gender === 'female' ? 'female' : 'male'];
                if (map && map[cleanSRel]) {
                    const finalTitle = map[cleanSRel];
                    return injectRankingAndRemark(finalTitle, tNode, members);
                }
            }
        }

        // 如果 V 和 T 是由同一个人（中间人）创建的
        if (tNode.createdByMemberId && !eq(tNode.createdByMemberId, vId)) {
            const creator = members.find(m => eq(m.id, tNode.createdByMemberId));
            if (creator) {
                // 1. 获取中间人相对于观察者的实时称法
                const cRel = getRigorousRelationship(viewer, creator, members, depth + 1);

                // 2. 获取目标人物相对于其中间人的角色 (多维度识别: 备注/标准角色/英文字符串)
                const rawT = (tNode.relationship || "").replace(/\s+/g, "").toLowerCase();
                const sRole = (tNode.standardRole || tNode.standard_role || "").toLowerCase();

                // 核心改进：优先识别标准角色，防止原始备注中的错误文字干扰推导
                let tRel = "";
                if (sRole === "daughter" || rawT === "女儿" || rawT === "女" || rawT.endsWith("女儿")) tRel = "女儿";
                else if (sRole === "son" || rawT === "儿子" || rawT === "子" || rawT.endsWith("儿子")) tRel = "儿子";
                else if (sRole === "granddaughter" || rawT.includes("孙女")) tRel = "孙女";
                else if (sRole === "grandson" || rawT.includes("孙子")) tRel = "孙子";
                else if (sRole === "brother" || rawT.includes("哥") || rawT.includes("弟")) tRel = "儿子"; // 简化推导，同级挂载为儿子方便级联
                else if (sRole === "sister" || rawT.includes("姐") || rawT.includes("妹")) tRel = "女儿"; // 简化推导
                else tRel = getCleanRelationship(tNode.relationship || ""); // 如果都不是，尝试直接取基础关系

                // 3. 核心增强：执行多重身份拆解判定 (全局 bridgeMap 匹配)
                const cRelOptions = cRel.split("/").map(s => getCleanRelationship(s));

                for (const cleanCRel of cRelOptions) {
                    if (bridgeMap[cleanCRel] && bridgeMap[cleanCRel][tRel]) {
                        const finalTitle = bridgeMap[cleanCRel][tRel].replace("夫家", "");
                        return injectRankingAndRemark(finalTitle, tNode, members);
                    }
                }
            }
        }

        // --- 注入逻辑辅助函数 ---
        function injectRankingAndRemark(baseRel: string, tNode: any, members: any[]) {
            let finalTitle = baseRel;
            // 1. 排行注入 (A逻辑)
            const prefix = getRankPrefix(tNode, members);
            const rankable = ["爸爸", "叔叔", "叔伯", "姑姑", "阿姨", "舅舅", "姐/妹", "哥/弟", "兄弟", "姐妹", "堂姐/妹", "堂兄/弟", "表姐/妹", "表哥/弟"];
            if (prefix && rankable.some(r => baseRel.includes(r))) {
                // 如果 baseRel 还没带前缀且不是排好的，则注入排行
                if (!prefix.split("").some(char => baseRel.startsWith(char))) {
                    finalTitle = prefix + baseRel;
                }
            }

            // 2. 长幼判定 (Seniority Engine)
            const vDate = vNode.birthDate || vNode.birth_date;
            const tDate = tNode.birthDate || tNode.birth_date;
            if (vDate && tDate) {
                const isTargetOlder = tDate < vDate;
                finalTitle = finalTitle
                    .replace("姐/妹", isTargetOlder ? "姐" : "妹")
                    .replace("姊妹", isTargetOlder ? "姐" : "妹")
                    .replace("哥/弟", isTargetOlder ? "哥" : "弟")
                    .replace("兄弟", isTargetOlder ? "哥" : "弟")
                    .replace("姐妹", isTargetOlder ? "姐" : "妹");
            }

            // 3. 备注增强 (语义去重优化)
            const rawRemark = (tNode.relationship || "").trim();
            const isDuplicate =
                !rawRemark ||
                ["本人", "家人", "创建者"].includes(rawRemark) ||
                finalTitle === rawRemark ||
                getCleanRelationship(finalTitle) === getCleanRelationship(rawRemark);

            if (!isDuplicate && !finalTitle.includes(rawRemark)) {
                return `${finalTitle} (${rawRemark})`;
            }
            return finalTitle;
        }

        // 4. 情况 D: 终极反转推演 (Inverse Deduction)
        // 如果上面都没推出来，意味着从 V 看 T 找不到桥梁。
        // 我们尝试反转视角，用 t 作为 viewer 来看 v（只在第一层执行以避免死循环）
        if (depth === 0) {
            const tToV = getRigorousRelationship(tNode, vNode, members, 99); // depth设为99阻止无限反转
            const cleanTToV = getCleanRelationship(tToV);

            // 如果 T 认识 V (tToV)，我们需要推导 V 怎么叫 T。
            // 假设张三(T)看 k仔(V) 叫 "外甥女"，那也就是说 V 在 T 面前的角色是 "外甥女"。
            // inverseMap的结构是： 当我知道自己在某人面前叫 "X"，我该叫对方什么？ 
            // 所以如果 tToV 就是 "外甥女"，那么 inverseMap["外甥女"] 就会告诉我(V)该叫对方(T)什么！
            if (cleanTToV && cleanTToV !== "家人" && cleanTToV !== "我") {
                let inverseMatch = inverseMap[cleanTToV];

                // 没找到全字，尝试基于 key 的包含匹配
                if (!inverseMatch) {
                    for (const key of Object.keys(inverseMap)) {
                        if (cleanTToV.includes(key)) {
                            inverseMatch = inverseMap[key];
                            // 修正：如果是因为 V是表亲而找到的，可能匹配到了直系的兄弟，需要修正为表亲
                            if (cleanTToV.includes("表") && !key.includes("表")) {
                                const mapToPaternal = { "叔/伯": "表叔/表伯", "姑/婶": "表姑", "外甥": "表外甥", "侄": "表侄" };
                            }
                            break;
                        }
                    }
                }

                // 双向备用查找：如果 T(男)叫V(男)为"外甥"，那在逆向查找时，如果没查到 "外甥"，看哪个 value 包含 "外甥"
                if (!inverseMatch) {
                    for (const [key, val] of Object.entries(inverseMap)) {
                        if (val.male.includes(cleanTToV) || val.female.includes(cleanTToV)) {
                            // Found that if someone calls me `key`, I call them `val.male/female`.
                            // But here it's reversed. We know T calls V `cleanTToV`. Which means val matches cleanTToV.
                            // So V should call T `key`!
                            // But wait! If T(男) calls V(男) "外甥"，and we see inverseMap["舅舅"] = {male: "外甥", female: "外甥女"}
                            // Then V calling T is EXACTLY "舅舅"。
                            inverseMatch = { male: key, female: key }; // Fallback rough match
                            break;
                        }
                    }
                }

                if (inverseMatch) {
                    const mappedTitle = tNode.gender === "female" ? inverseMatch.female : inverseMatch.male;
                    // 取出的 mappedTitle 如果带有 "/", 取第一个，例如 "舅舅/姨丈"
                    const finalTitleRaw = mappedTitle.split("/")[0];
                    return injectRankingAndRemark(finalTitleRaw, tNode, members);
                }
            }
        }

        // --- 回退逻辑强化版 ---
        const baseRel = (tNode.relationship || "").trim();
        if (baseRel && !["本人", "家人", "创建者", "其他", "创建人"].includes(baseRel)) {
            return injectRankingAndRemark(baseRel, tNode, members);
        }

        return injectRankingAndRemark(baseRel || "家人", tNode, members);
    } catch (error) {
        console.error("家族逻辑推导异常:", error);
        return target?.relationship || target?.name || "家门亲戚";
    }
}

/**
 * 原有的简单推断逻辑（保留兼容）
 */
export function getRelativeRelationship(
    viewerRole: string | undefined,
    targetRole: string | undefined,
    fallback: string
): string {
    if (!viewerRole || !targetRole) return fallback;
    if (viewerRole === targetRole) return "本人";

    const relMap: Record<string, Record<string, string>> = {
        father: {
            grandfather_paternal: "爷爷", grandmother_paternal: "奶奶",
            grandfather_maternal: "外公", grandmother_maternal: "外婆",
            mother: "妻子", wife: "妻子", son: "儿子", daughter: "女儿",
        },
        son: {
            father: "爸爸", mother: "妈妈",
            grandfather_paternal: "爷爷", grandmother_paternal: "奶奶",
        },
        daughter: {
            father: "爸爸", mother: "妈妈",
            grandfather_paternal: "爷爷", grandmother_paternal: "奶奶",
        }
    };
    return relMap[viewerRole]?.[targetRole] || STANDARD_ROLE_LABELS[targetRole] || fallback;
}

/**
 * 核心：获取关系的详细分类类型
 * @returns 'blood' (宗亲/血亲) | 'affinal' (姻亲) | 'social' (社会关系/朋友)
 */
export function getRelationType(rel: string): 'blood' | 'affinal' | 'social' {
    const clean = getCleanRelationship(rel);
    if (!clean || clean === "本人" || clean === "自己") return 'blood';

    // 1. 判定社会关系 (最外层)
    const socialKeywords = ["战友", "同学", "朋友", "恩师", "创建者", "归档人", "其他", "家人", "宠物", "毛儿子", "毛女儿", "宝贝"];
    if (socialKeywords.some(sw => clean.includes(sw))) return 'social';

    // 2. 判定血亲 (家族核心) - 复用逻辑并反向检查
    const affinalKeywords = ["婿", "媳", "岳", "丈", "妻", "夫", "嫂", "老公", "老婆", "舅子", "姨子", "内侄", "婶", "姆", "妗"];
    const bloodWhiteList = [
        "爸爸", "母亲", "妈妈", "阿姨", "姨妈", "舅舅", "姑姑", "叔叔", "伯伯",
        "爷爷", "奶奶", "外公", "外婆", "阿公", "阿嬷", "外嬷",
        "伯公", "叔公", "姑婆", "舅公", "姨婆", "曾祖", "高祖"
    ];

    if (bloodWhiteList.some(w => clean.includes(w))) return 'blood';

    // 针对 公公/婆婆 进行姻亲判定
    if (clean.includes("公公") || clean.includes("婆婆") || affinalKeywords.some(k => clean.includes(k))) {
        return 'affinal';
    }

    // 3. 默认推定：剩下的大多是 兄弟、姐妹、儿子、女儿、堂/表、叔伯等，均为血亲
    return 'blood';
}

/**
 * 兼容旧逻辑：判定是否为血亲
 */
export function isBloodRelation(rel: string): boolean {
    return getRelationType(rel) === 'blood';
}

/**
 * 核心：获取血缘亲疏标签
 * 【家门】：亲房，同一个爷爷以内
 * 【同宗】：堂房，同一个曾爷爷以内
 * 【远亲】：三代以外
 */
export function getKinshipLabel(vNode: any, tNode: any, members: any[]): string | null {
    if (!vNode || !tNode) return null;
    const vId = Number(vNode.memberId || vNode.id);
    const tId = Number(tNode.id);
    if (vId === tId) return null;

    const rel = getRigorousRelationship(vNode, tNode, members);
    const type = getRelationType(rel);

    if (type === 'social') return "【友】";
    if (type === 'affinal') return "【姻】";

    // 以下为血亲深度判定
    const vFatherId = vNode.fatherId;
    const tFatherId = tNode.fatherId;

    // 房头穿透判定：即便父辈 ID 缺失，只要房头一致，视为【同宗】
    if (vNode.ancestralHall && tNode.ancestralHall && vNode.ancestralHall === tNode.ancestralHall) {
        if (!vFatherId || !tFatherId) return "【同宗】";
    }

    if (!vFatherId || !tFatherId) {
        // 如果没有父辈 ID，尝试通过称谓关键词进行“语境降级”判定
        if (rel.includes("堂") || rel.includes("远")) return "【同宗】";
        if (rel.includes("表")) return "【外戚】";
        return "【家门】";
    }

    // 1. 同父：亲兄弟/亲房 (家门)
    if (Number(vFatherId) === Number(tFatherId)) return "【家门】";

    const getFId = (id: any) => {
        if (!id) return null;
        const m = members.find(m => Number(m.id) === Number(id));
        return m ? m.fatherId : null;
    };

    // 2. 同祖：亲叔伯兄弟 (同一个爷爷 -> 家门)
    const vGFId = getFId(vFatherId);
    const tGFId = getFId(tFatherId);
    if (vGFId && Number(vGFId) === Number(tGFId)) return "【家门】";

    // 3. 同曾祖：堂房 (同一个曾爷爷 -> 同宗)
    const vGGFId = getFId(vGFId);
    const tGGFId = getFId(tGFId);
    if (vGGFId && Number(vGGFId) === Number(tGGFId)) return "【同宗】";

    return "【远亲】";
}
