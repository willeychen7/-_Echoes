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

    // --- 新增：逆向称谓推断 (基于创建档案时的备注关系) ---
    // 如果没有树状连边，但 viewer 是由 target 创建的，或者 target 是由 viewer 创建的
    // 我们根据已有的一方称谓 + 性别，强行推导出另一方的显示称谓

    // 映射表：目标角色 -> 观察者应该看到的称谓 (基于观察者性别)
    const inverseMap: Record<string, { male: string; female: string }> = {
        "儿子": { male: "爸爸", female: "妈妈" },
        "女儿": { male: "爸爸", female: "妈妈" },
        "爸爸": { male: "儿子", female: "女儿" },
        "妈妈": { male: "儿子", female: "女儿" },
        "侄子": { male: "叔伯", female: "姑妈" },
        "外甥": { male: "舅舅", female: "阿姨" },
        "侄女": { male: "叔伯", female: "姑妈" },
        "外甥女": { male: "舅舅", female: "阿姨" },
        "孙子": { male: "爷爷/外公", female: "奶奶/外婆" },
        "孙女": { male: "爷爷/外公", female: "奶奶/外婆" },
        "爷爷": { male: "孙子", female: "孙女" },
        "奶奶": { male: "孙子", female: "孙女" },
        "外公": { male: "外孙", female: "外孙女" },
        "外婆": { male: "外孙", female: "外孙女" },
        "丈夫": { male: "丈夫", female: "妻子" },
        "妻子": { male: "丈夫", female: "妻子" },
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

    // 情况 B: viewer 创建了 target，target 的 relationship 存的是“他是我的 XX”
    // 例如：陈阿妹(viewer)看k仔(target)。k仔记录里存的是“外甥”
    if (eq(tNode.createdByMemberId, vId)) {
        const raw = tNode.relationship || "创建者";
        // 自动纠正性别敏感的称呼 (Gender-Correction for static labels)
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
        };
        const entry = labels[raw];
        if (entry) {
            return tNode.gender === "female" ? entry.female : entry.male;
        }
        return raw;
    }

    // 情况 C: 级联桥接推算 (Bridge via Recursive Deduction)
    // 如果 V 和 T 是由同一个人（中间人）创建的，我们通过“中间人”的身份进行二次换算
    if (tNode.createdByMemberId && !eq(tNode.createdByMemberId, vId)) {
        const creator = members.find(m => eq(m.id, tNode.createdByMemberId));
        if (creator) {
            // 1. 获取中间人相对于观察者的实时称法 (可能是 "妈妈", 也可能是用户刚才改的 "舅妈")
            const cRel = getRigorousRelationship(viewer, creator, members);

            // 2. 获取目标人物相对于其中间人的角色 (多维度识别: 备注/标准角色/英文字符串)
            const rawT = (tNode.relationship || "").replace(/\s+/g, "").toLowerCase();
            const sRole = (tNode.standardRole || tNode.standard_role || "").toLowerCase();

            const tRel = (rawT.includes("女儿") || sRole === "daughter" || rawT === "daughter") ? "女儿" :
                (rawT.includes("儿子") || sRole === "son" || rawT === "son") ? "儿子" :
                    (rawT.includes("孙女") || sRole === "granddaughter" || rawT === "granddaughter") ? "孙女" :
                        (rawT.includes("孙子") || sRole === "grandson" || rawT === "grandson") ? "孙子" :
                            (tNode.relationship || "");

            // 3. 级联推算映射表 (基于 cRel 的显示称谓进行二次映射)
            const bridgeMap: Record<string, Record<string, string>> = {
                "妈妈": { "儿子": "兄弟", "女儿": "姐妹", "孙子": "侄子/外甥", "孙女": "侄女/外甥女" },
                "爸爸": { "儿子": "兄弟", "女儿": "姐妹", "孙子": "侄子/外甥", "孙女": "侄女/外甥女" },
                "舅舅": { "儿子": "表哥/弟", "女儿": "表姐/妹", "孙子": "表侄", "孙女": "表侄女" },
                "舅妈": { "儿子": "表哥/弟", "女儿": "表姐/妹", "孙子": "表侄", "孙女": "表侄女" },
                "阿姨": { "儿子": "表哥/弟", "女儿": "表姐/妹", "孙子": "表外甥", "孙女": "表外甥女" },
                "姨妈": { "儿子": "表哥/弟", "女儿": "表姐/妹", "孙子": "表外甥", "孙女": "表外甥女" },
                "姨婆": { "儿子": "表舅", "女儿": "表姨" },
                "叔叔": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "孙子": "堂侄", "孙女": "堂侄女" },
                "伯伯": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "孙子": "堂侄", "孙女": "堂侄女" },
                "姑姑": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "孙子": "堂侄", "孙女": "堂侄女" },
                "婶婶": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "孙子": "堂侄", "孙女": "堂侄女" },
                "伯母": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "孙子": "堂侄", "孙女": "堂侄女" },
                "姑父": { "儿子": "堂哥/弟", "女儿": "堂姐/妹", "孙子": "堂侄", "孙女": "堂侄女" },
                "哥哥": { "儿子": "侄子", "女儿": "侄女" },
                "弟弟": { "儿子": "侄子", "女儿": "侄女" },
                "姐姐": { "儿子": "外甥", "女儿": "外甥女" },
                "妹妹": { "儿子": "外甥", "女儿": "外甥女" }
            };

            // 4. 执行匹配
            const tMap = bridgeMap[cRel];
            if (tMap && tMap[tRel]) {
                return tMap[tRel];
            }
        }
    }

    // --- 回退逻辑 ---
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
