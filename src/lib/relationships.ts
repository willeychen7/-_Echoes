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
    cousin: "表兄弟/堂兄弟",
    family: "家人",
};

// NOTE: 用于 AddMemberPage 选择关系时的选项列表
export const RELATIONSHIP_OPTIONS = [
    { value: "grandfather_paternal", label: "爷爷" },
    { value: "grandmother_paternal", label: "奶奶" },
    { value: "grandfather_maternal", label: "外公" },
    { value: "grandmother_maternal", label: "外婆" },
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
    { value: "grandson", label: "孙子" },
    { value: "granddaughter", label: "孙女" },
    { value: "nephew", label: "侄子/外甥" },
    { value: "niece", label: "侄女/外甥女" },
    { value: "cousin", label: "表亲/堂亲" },
    { value: "family", label: "其他家人" },
];

/**
 * 根据关系字符串推断标准角色标识
 */
export function deduceRole(relationship: string): string {
    const map: Record<string, string> = {
        "爷爷": "grandfather_paternal",
        "奶奶": "grandmother_paternal",
        "外公": "grandfather_maternal",
        "外婆": "grandmother_maternal",
        "父亲": "father",
        "爸爸": "father",
        "母亲": "mother",
        "妈妈": "mother",
        "丈夫": "husband",
        "妻子": "wife",
        "兄弟": "brother",
        "哥哥": "brother",
        "弟弟": "brother",
        "姐姐": "sister",
        "妹妹": "sister",
        "姐妹": "sister",
        "叔叔": "uncle_paternal",
        "伯伯": "uncle_paternal",
        "姑姑": "aunt_paternal",
        "舅舅": "uncle_maternal",
        "阿姨": "aunt_maternal",
        "儿子": "son",
        "女儿": "daughter",
        "孙子": "grandson",
        "孙女": "granddaughter",
        "侄子": "nephew",
        "外甥": "nephew",
        "侄女": "niece",
        "外甥女": "niece",
        "表亲": "cousin",
        "堂亲": "cousin",
    };
    return map[relationship] || "family";
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
 * 严谨的家族关系推导函数
 */
export function getRigorousRelationship(
    viewer: any,
    target: any,
    members: any[]
): string {
    const vId = viewer?.memberId ? Number(viewer.memberId) : (viewer?.id ? Number(viewer.id) : null);
    const tId = target?.id ? Number(target.id) : null;

    if (tId === null || vId === null) return target?.relationship || "家人";
    if (vId === tId) return "我";

    const vNode = members.find(m => Number(m.id) === vId);
    const tNode = members.find(m => Number(m.id) === tId);
    if (!vNode || !tNode) return target?.relationship || "家人";

    // --- 严谨比对辅助函数 ---
    const eq = (a: any, b: any) => a && b && Number(a) === Number(b);

    // 1. 直系父子
    if (eq(tId, vNode.fatherId)) return "爸爸";
    if (eq(tId, vNode.motherId)) return "妈妈";

    // 2. 直系子女
    if (eq(vId, tNode.fatherId) || eq(vId, tNode.motherId)) {
        return tNode.gender === "female" ? "女儿" : "儿子";
    }

    // 3. 兄弟姐妹
    if ((vNode.fatherId && eq(vNode.fatherId, tNode.fatherId)) ||
        (vNode.motherId && eq(vNode.motherId, tNode.motherId))) {
        return tNode.gender === "female" ? "姐妹" : "兄弟";
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
        if (eq(tf, vId)) return tNode.gender === "female" ? "女儿" : "儿子"; // fallback
        const { fId: tff, mId: tfm } = getParentIds(tf, members);
        if (eq(tff, vId) || eq(tfm, vId)) return tNode.gender === "female" ? "孙女" : "孙子";
    }
    if (tm) {
        if (eq(tm, vId)) return tNode.gender === "female" ? "女儿" : "儿子"; // fallback
        const { fId: tmf, mId: tmm } = getParentIds(tm, members);
        if (eq(tmf, vId) || eq(tmm, vId)) return tNode.gender === "female" ? "外孙女" : "外孙子";
    }

    // 6. 配偶 (基于共同子女推断)
    const vIsSpouse = members.some(child =>
        (eq(child.fatherId, vId) && eq(child.motherId, tId)) ||
        (eq(child.motherId, vId) && eq(child.fatherId, tId))
    );
    if (vIsSpouse) return tNode.gender === "female" ? "妻子" : "丈夫";

    // 7. 舅舅/阿姨/叔叔/姑姑 (父母的兄弟姐妹)
    if (vf) {
        const { fId: vff, mId: vfm } = getParentIds(vf, members);
        const fSiblings = members.filter(m => (vff && eq(m.fatherId, vff)) || (vfm && eq(m.motherId, vfm)));
        if (fSiblings.some(s => eq(s.id, tId))) {
            return tNode.gender === "female" ? "姑姑" : "叔伯";
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
        return tNode.gender === "female" ? "侄女/外甥女" : "侄子/外甥";
    }

    // 回退：如果没有任何树状连边，尝试显示数据库存的原始称呼
    const baseRel = tNode.relationship || "家人";
    if (tNode.createdByMemberId && !eq(tNode.createdByMemberId, vId)) {
        const creator = members.find(m => eq(m.id, tNode.createdByMemberId));
        if (creator && !["爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆"].includes(baseRel)) {
            return `${creator.name}的${baseRel}`;
        }
    }
    return baseRel;
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
