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
 * 严谨的家族关系推导函数
 * 基于 fatherId, motherId 和 gender 进行树状遍历
 */
export function getRigorousRelationship(
    viewerId: number | undefined,
    targetId: number | undefined,
    members: any[]
): string {
    if (!viewerId || !targetId) return "家人";
    if (viewerId === targetId) return "本人";

    const viewer = members.find(m => m.id === viewerId);
    const target = members.find(m => m.id === targetId);

    if (!viewer || !target) return "家人";

    // 1. 直系父子/母子关系
    if (target.id === viewer.fatherId) return "爸爸";
    if (target.id === viewer.motherId) return "妈妈";

    // 2. 直系子女关系
    if (viewer.id === target.fatherId) return target.gender === "female" ? "女儿" : "儿子";
    if (viewer.id === target.motherId) return target.gender === "female" ? "女儿" : "儿子";

    // 3. 祖孙关系
    const viewerFather = members.find(m => m.id === viewer.fatherId);
    const viewerMother = members.find(m => m.id === viewer.motherId);

    if (viewerFather) {
        if (target.id === viewerFather.fatherId) return "爷爷";
        if (target.id === viewerFather.motherId) return "奶奶";
    }
    if (viewerMother) {
        if (target.id === viewerMother.fatherId) return "外公";
        if (target.id === viewerMother.motherId) return "外婆";
    }

    // 4. 孙辈关系
    const targetFather = members.find(m => m.id === target.fatherId);
    const targetMother = members.find(m => m.id === target.motherId);

    if (targetFather) {
        if (viewer.id === targetFather.fatherId || viewer.id === targetFather.motherId) {
            return target.gender === "female" ? "孙女" : "孙子";
        }
    }
    if (targetMother) {
        if (viewer.id === targetMother.fatherId || viewer.id === targetMother.motherId) {
            return target.gender === "female" ? "外孙女" : "外孙子";
        }
    }

    // 5. 兄弟姐妹关系 (同父或同母)
    if ((viewer.fatherId && viewer.fatherId === target.fatherId) ||
        (viewer.motherId && viewer.motherId === target.motherId)) {
        if (target.gender === "female") return "姐妹";
        return "兄弟";
    }

    // 6. 配偶关系
    // 如果 target 是 viewer 孩子的另一个家长
    const viewerChildren = members.filter(m => m.fatherId === viewer.id || m.motherId === viewer.id);
    const isSpouse = viewerChildren.some(child =>
        (child.fatherId === viewer.id && child.motherId === target.id) ||
        (child.motherId === viewer.id && child.fatherId === target.id)
    );
    if (isSpouse) return target.gender === "female" ? "妻子" : "丈夫";

    // 回退到原始 relationship 字段或 standardRole
    return target.relationship || STANDARD_ROLE_LABELS[target.standardRole] || "家人";
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
