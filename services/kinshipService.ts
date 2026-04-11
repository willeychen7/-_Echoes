import { getSupabase } from "../lib/supabase";

export const RANK_MAP: Record<string, number> = {
    "1": 1, "一": 1, "大": 1, "长": 1, "首": 1, "老大": 1,
    "2": 2, "二": 2, "次": 1, "仲": 2, "老二": 2,
    "3": 3, "三": 3, "叔": 3, "老三": 3,
    "4": 4, "四": 4, "季": 4, "老四": 4,
    "5": 5, "五": 5, "老五": 5,
    "6": 6, "六": 6, "老六": 6,
    "7": 7, "七": 7, "老七": 7,
    "8": 8, "八": 8, "老八": 8,
    "9": 9, "九": 9, "老九": 9,
    "10": 10, "十": 10, "老十": 10,
    "11": 11, "十一": 11, "12": 12, "十二": 12, "13": 13, "十三": 13, "14": 14, "十四": 14, "15": 15, "十五": 15,
    "16": 16, "十六": 16, "17": 17, "十七": 17, "18": 18, "十八": 18, "19": 19, "十九": 19, "20": 20, "二十": 20,
    "末": 99, "小": 99, "幼": 99, "幺": 99, "老幺": 99, "老小": 99
};

export const normalizeGender = (g: any) => {
    if (!g) return null;
    const s = String(g).toLowerCase().trim();
    if (s === 'male' || s === '男' || s === 'm') return 'male' as const;
    if (s === 'female' || s === '女' || s === 'f') return 'female' as const;
    return null;
};

export const extractRank = (s: string): number | null => {
    if (!s) return null;
    for (const key of Object.keys(RANK_MAP).sort((a, b) => b.length - a.length)) {
        if (s.includes(key)) return RANK_MAP[key];
    }
    return null;
};

export const COMMON_MAPPINGS: Record<string, string> = {
    // 核心直系
    "本人": "self", "自己": "self",
    "爸爸": "father", "父亲": "father", "爸": "father", "爹": "father", "老爸": "father",
    "妈妈": "mother", "母亲": "mother", "妈": "mother", "娘": "mother", "老妈": "mother",
    "儿子": "son", "女儿": "daughter",
    "老弟": "brother", "弟弟": "brother", "哥哥": "brother", "老哥": "brother", "兄": "brother", "弟": "brother",
    "姐姐": "sister", "妹妹": "sister", "姊": "sister", "妹": "sister",
    "老婆": "spouse", "老公": "spouse", "妻子": "spouse", "丈夫": "spouse", "爱人": "spouse", "媳妇": "spouse",

    // 祖辈/父系
    "爷爷": "grandfather_paternal", "祖父": "grandfather_paternal",
    "奶奶": "grandmother_paternal", "祖母": "grandmother_paternal",
    "伯伯": "uncle_paternal", "叔叔": "uncle_paternal", "伯父": "uncle_paternal", "叔父": "uncle_paternal",
    "姑姑": "aunt_paternal", "姑妈": "aunt_paternal", "姑娘": "aunt_paternal",

    // 祖辈/母系
    "外公": "grandfather_maternal", "姥爷": "grandfather_maternal",
    "外婆": "grandmother_maternal", "姥姥": "grandmother_maternal",
    "舅舅": "uncle_maternal", "阿舅": "uncle_maternal",
    "阿姨": "aunt_maternal", "姨妈": "aunt_maternal", "姨娘": "aunt_maternal",

    // 晚辈
    "孙子": "grandson", "孙女": "granddaughter", "外孙": "grandson", "外孙女": "granddaughter",
    "侄子": "nephew", "外甥": "nephew", "侄女": "niece", "外甥女": "niece",

    // 姻亲与扩展
    "舅妈": "aunt_maternal", "婶婶": "aunt_paternal", "伯母": "aunt_paternal", "姨父": "uncle_maternal", "姑父": "uncle_paternal",
    "公公": "father", "婆婆": "mother", "岳父": "father", "岳母": "mother",
    "大伯子": "brother", "小叔子": "brother", "大姑子": "sister", "小姑子": "sister",
    "大舅子": "brother", "小舅子": "brother", "大姨子": "sister", "小姨子": "sister"
};

export const getStandardRole = (rel: string): string | null => {
    if (!rel) return null;
    if (COMMON_MAPPINGS[rel]) return COMMON_MAPPINGS[rel];

    const cleanRel = rel.replace(/^[大二三四五六七八九十小]+/, "");
    if (COMMON_MAPPINGS[cleanRel]) return COMMON_MAPPINGS[cleanRel];

    if (rel.endsWith("舅")) return COMMON_MAPPINGS["舅舅"];
    if (rel.endsWith("姨")) return COMMON_MAPPINGS["阿姨"];
    if (rel.endsWith("哥")) return COMMON_MAPPINGS["哥哥"];
    if (rel.endsWith("姐")) return COMMON_MAPPINGS["姐姐"];
    if (rel.endsWith("弟")) return COMMON_MAPPINGS["弟弟"];
    if (rel.endsWith("妹")) return COMMON_MAPPINGS["妹妹"];

    return null;
};

export const checkGenderConflict = (rel: string, gender: string) => {
    if (!rel || !gender) return false;
    const femaleKeywords = ["姑", "姨", "妈", "娘", "奶", "婆", "姐", "妹", "嫂", "侄女", "外甥女", "媳", "婶", "妗", "姥", "女"];
    const maleKeywords = ["叔", "伯", "爸", "爹", "爷", "公", "哥", "弟", "婿", "夫", "男", "侄子", "外甥", "舅"];
    const isRelFemale = femaleKeywords.some(k => rel.includes(k));
    const isRelMale = maleKeywords.some(k => rel.includes(k));

    const normG = normalizeGender(gender);
    if (normG === "male" && isRelFemale && !isRelMale) return true;
    if (normG === "female" && isRelMale && !isRelFemale) return true;
    return false;
};

export const resolveRigorousRel = async (
    role: string,
    inviter: any,
    targetId: number,
    explicitGender?: "male" | "female" | null,
    explicitParentId?: number | null,
    explicitSide?: 'paternal' | 'maternal' | null,
    relHint?: string,
    providedLogicTag?: string | null
) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase not initialized");

    let isConfused = false;
    let updateData: any = { id: targetId, gender: explicitGender || undefined };
    let invUpdate: any = { id: inviter.id };

    const { data: targetRecord } = await supabase.from("family_members").select("*").eq("id", targetId).maybeSingle();

    const effectiveFatherId = explicitParentId || targetRecord?.father_id || null;
    const effectiveMotherId = targetRecord?.mother_id || null;

    if (explicitSide) updateData.origin_side = explicitSide;

    let effectiveRole = role;
    if (effectiveRole === "other") {
        const r = relHint || targetRecord?.relationship || "";

        if (r.includes("舅婆")) effectiveRole = "great_aunt";
        else if (r.includes("高祖") || r.includes("天祖") || r.includes("烈祖") || r.includes("远祖") || r.includes("鼻祖")) effectiveRole = "great_grandfather";
        else if (r.includes("曾叔") || r.includes("曾伯") || r.includes("曾伯祖") || r.includes("太公") || r.includes("曾祖")) effectiveRole = "great_grandfather";
        else if (r.includes("玄孙") || r.includes("来孙") || r.includes("晜孙")) effectiveRole = "great_great_grandson";
        else if (r.includes("曾孙")) effectiveRole = "great_grandson";
        else if (r.includes("堂") || r.includes("表")) {
            if (r.includes("叔") || r.includes("伯") || r.includes("姑") || r.includes("舅") || r.includes("姨")) {
                effectiveRole = "uncle_cousin_elder";
            } else if (r.includes("侄") || r.includes("外甥")) {
                effectiveRole = "nephew";
            } else if (r.includes("爷") || r.includes("公")) {
                effectiveRole = "grandfather";
            } else if (r.includes("孙")) {
                effectiveRole = "grandson";
            } else {
                effectiveRole = "cousin";
            }
        }
        else if (r.includes("叔") || r.includes("伯") || r.includes("舅") || r.includes("姨") || r.includes("姑")) {
            effectiveRole = (r.includes("舅妈") || r.includes("审") || r.includes("姑父") || r.includes("姑丈") || r.includes("姨父") || r.includes("姨丈")) ? "uncle_affinal" : "uncle";
        }
        else if (r.includes("侄") || r.includes("外甥")) effectiveRole = "nephew";
        else if (r.includes("婆") || r.includes("奶") || r.includes("姥") || r.includes("爷") || r.includes("公")) {
            if (r.includes("婆") || r.includes("奶") || r.includes("姥")) effectiveRole = "grandmother";
            else effectiveRole = "grandfather";
        }
        else if (r.includes("爸") || r.includes("父") || r.includes("爹")) effectiveRole = "father";
        else if (r.includes("妈") || r.includes("母") || r.includes("娘")) effectiveRole = "mother";
        else if (r.includes("子") || r.includes("儿") || r.includes("嗣")) effectiveRole = "son";
        else if (r.includes("女")) effectiveRole = "daughter";
        else if (r.includes("孙")) effectiveRole = "grandson";
        else if (r.includes("哥") || r.includes("兄") || r.includes("姐") || r.includes("弟") || r.includes("妹")) effectiveRole = "brother";

        if (effectiveRole === "other" || !effectiveRole || effectiveRole.trim() === "") {
            isConfused = true;
        }
    }

    if (explicitParentId) {
        updateData.father_id = explicitParentId;
    }

    if (inviter.generation_num != null) {
        const g = Number(inviter.generation_num);
        if (["father", "mother", "uncle", "aunt"].includes(effectiveRole)) updateData.generation_num = g - 1;
        else if (["son", "daughter", "nephew", "niece"].includes(effectiveRole)) updateData.generation_num = g + 1;
        else if (["grandfather", "grandmother"].includes(effectiveRole)) updateData.generation_num = g - 2;
        else if (["grandson", "granddaughter"].includes(effectiveRole)) updateData.generation_num = g + 2;
        else if (effectiveRole === "great_grandfather") updateData.generation_num = g - 3;
        else if (effectiveRole === "great_grandson") updateData.generation_num = g + 3;
        else if (effectiveRole === "great_great_grandson") updateData.generation_num = g + 4;
        else if (["brother", "sister", "cousin", "spouse"].includes(effectiveRole)) updateData.generation_num = g;
    } else if (targetRecord?.generation_num != null) {
        const g = Number(targetRecord.generation_num);
        if (["father", "mother", "uncle", "aunt"].includes(effectiveRole)) invUpdate.generation_num = g + 1;
        else if (["son", "daughter", "nephew", "niece"].includes(effectiveRole)) invUpdate.generation_num = g - 1;
        else if (["grandfather", "grandmother"].includes(effectiveRole)) invUpdate.generation_num = g + 2;
        else if (["grandson", "granddaughter"].includes(effectiveRole)) invUpdate.generation_num = g - 2;
        else if (["brother", "sister", "cousin", "spouse"].includes(effectiveRole)) invUpdate.generation_num = g;
    }

    if (inviter.ancestral_hall && !targetRecord?.ancestral_hall) {
        if (["father", "son", "brother", "grandfather", "grandson", "uncle", "nephew", "cousin"].includes(effectiveRole)) {
            updateData.ancestral_hall = inviter.ancestral_hall;
        }
    }

    const findExistingParent = async (memberId: number, gen: 'male' | 'female', inviterId: number) => {
        const { data: m } = await supabase.from("family_members").select("*").eq("id", memberId).single();
        // 严格遵循“不强行连线”原则：如果当前档案中没有明确指向，则不进行自动搜索或匹配
        const pId = gen === 'male' ? m.father_id : m.mother_id;
        return pId || null;
    };

    const findExistingSiblingParents = async (memberId: number, inviterId: number) => {
        const fId = await findExistingParent(memberId, 'male', inviterId);
        const mId = await findExistingParent(memberId, 'female', inviterId);
        return { fId, mId };
    };

    if (effectiveRole === "father") {
        invUpdate.father_id = targetId;
        updateData.gender = "male";
        if (inviter.generation_num) updateData.generation_num = Number(inviter.generation_num) - 1;
        updateData.ancestral_hall = inviter.ancestral_hall;
    } else if (effectiveRole === "mother") {
        invUpdate.mother_id = targetId;
        updateData.gender = "female";
        if (inviter.generation_num) updateData.generation_num = Number(inviter.generation_num) - 1;
        updateData.ancestral_hall = inviter.ancestral_hall;
    } else if (effectiveRole === "son" || effectiveRole === "daughter") {
        updateData.gender = effectiveRole === "son" ? "male" : "female";
        if (inviter.gender === "female") {
            updateData.mother_id = inviter.id;
            updateData.father_id = effectiveFatherId;
        } else {
            updateData.father_id = inviter.id;
            updateData.mother_id = effectiveMotherId;
        }
        if (inviter.generation_num) updateData.generation_num = Number(inviter.generation_num) + 1;
        updateData.ancestral_hall = inviter.ancestral_hall;
    } else if (["brother", "sister", "older_brother", "younger_brother", "older_sister", "younger_sister"].includes(effectiveRole)) {
        const { fId, mId } = await findExistingSiblingParents(inviter.id, inviter.id);
        updateData.father_id = effectiveFatherId || fId;
        updateData.mother_id = effectiveMotherId || mId;
        updateData.gender = (effectiveRole.includes("brother")) ? "male" : "female";
        updateData.generation_num = Number(inviter.generation_num);
        updateData.ancestral_hall = inviter.ancestral_hall;
    } else if (effectiveRole === "spouse") {
        updateData.spouse_id = inviter.id;
        invUpdate.spouse_id = targetId;
        updateData.gender = inviter.gender === "male" ? "female" : "male";
        updateData.generation_num = Number(inviter.generation_num);
    } else if (effectiveRole === "grandfather" || effectiveRole === "grandmother" || effectiveRole === "great_aunt") {
        // ❌ 彻底移除自动回刷父母指向的逻辑
        // 不再自动更新 inviter 的父/母亲节点，使其指向这位新加入的祖辈
        updateData.gender = (effectiveRole === "great_aunt" || effectiveRole === "grandmother") ? "female" : "male";
        if (inviter.generation_num) updateData.generation_num = Number(inviter.generation_num) - 2;
        updateData.ancestral_hall = inviter.ancestral_hall;
    } else if (effectiveRole === "grandson" || effectiveRole === "granddaughter") {
        updateData.gender = effectiveRole === "grandson" ? "male" : "female";
        if (inviter.generation_num) updateData.generation_num = Number(inviter.generation_num) + 2;
        updateData.ancestral_hall = inviter.ancestral_hall;
    } else if (effectiveRole === "uncle" || effectiveRole === "aunt" || effectiveRole === "uncle_affinal") {
        if (!explicitParentId) {
            const parentId = await findExistingParent(inviter.id, (explicitSide === 'maternal' || (relHint && ["舅", "姨"].some(k => relHint.includes(k)))) ? 'female' : 'male', inviter.id);
            if (parentId) {
                const { fId, mId } = await findExistingSiblingParents(parentId, inviter.id);
                updateData.father_id = fId;
                updateData.mother_id = mId;
            }
        }
        if (!explicitGender) {
            updateData.gender = (effectiveRole === "aunt" || (relHint && ["妈", "婶", "姆", "姨"].some(k => relHint.includes(k)))) ? "female" : "male";
        }
        if (inviter.generation_num) updateData.generation_num = Number(inviter.generation_num) - 1;
        updateData.ancestral_hall = inviter.ancestral_hall;
    } else if (effectiveRole === "nephew" || effectiveRole === "niece") {
        updateData.gender = effectiveRole === "nephew" ? "male" : "female";
        if (inviter.generation_num) updateData.generation_num = Number(inviter.generation_num) + 1;
        updateData.ancestral_hall = inviter.ancestral_hall;
    } else if (effectiveRole === "cousin") {
        if (!explicitParentId) {
            const pId = await findExistingParent(inviter.id, 'male', inviter.id);
            if (pId) {
                // 如果发现该父辈没有代际或堂号信息，可以同步一下，但不创建新节点
                await supabase.from("family_members").update({
                    ancestral_hall: inviter.ancestral_hall,
                    generation_num: inviter.generation_num ? Number(inviter.generation_num) - 1 : null
                }).eq("id", pId).is('generation_num', null);
            }
        }
        updateData.generation_num = Number(inviter.generation_num);
        updateData.ancestral_hall = inviter.ancestral_hall;
    }

    if (providedLogicTag) {
        updateData.logic_tag = providedLogicTag;
    } else if (targetRecord?.logic_tag) {
        updateData.logic_tag = targetRecord.logic_tag;
    } else if (updateData.generation_num != null || updateData.ancestral_hall) {
        const side = inviter.logic_tag?.startsWith('[M]') ? '[M]' : '[F]';
        updateData.logic_tag = `${side}-GH${updateData.generation_num}${updateData.ancestral_hall ? '-o' + updateData.ancestral_hall : ''}`;
    }

    console.log(`[REL:RESOLVE] Result for role:${role}:`, { updateData, invUpdate });
    return { updateData, invUpdate, isConfused };
};

export const mergeVirtualNodes = async (sourceId: number, targetId: number, familyId: any, visited = new Set<number>()) => {
    const supabase = getSupabase();
    if (!supabase || sourceId === targetId || visited.has(sourceId)) return;
    visited.add(sourceId);

    console.log(`[DEEP-MERGE] Merging virtual node ${sourceId} into ${targetId}`);

    await supabase.from("memories").update({ member_id: targetId, family_id: familyId }).eq("member_id", sourceId);
    await supabase.from("events").update({ member_id: targetId, family_id: familyId }).eq("member_id", sourceId);
    await supabase.from("messages").update({ family_member_id: targetId, family_id: familyId }).eq("family_member_id", sourceId);

    await supabase.from("family_members").update({ father_id: targetId }).eq("father_id", sourceId);
    await supabase.from("family_members").update({ mother_id: targetId }).eq("mother_id", sourceId);
    await supabase.from("family_members").update({ spouse_id: targetId }).eq("spouse_id", sourceId);

    const { data: sNode } = await supabase.from("family_members").select("father_id, mother_id").eq("id", sourceId).single();
    const { data: tNode } = await supabase.from("family_members").select("father_id, mother_id").eq("id", targetId).single();

    if (sNode && tNode) {
        if (sNode.father_id && tNode.father_id && sNode.father_id !== tNode.father_id) {
            await mergeVirtualNodes(sNode.father_id, tNode.father_id, familyId, visited);
        }
        if (sNode.mother_id && tNode.mother_id && sNode.mother_id !== tNode.mother_id) {
            await mergeVirtualNodes(sNode.mother_id, tNode.mother_id, familyId, visited);
        }
    }

    await supabase.from("family_members").delete().eq("id", sourceId);
};

export const syncFamilyRecursive = async (memberId: number, newFamilyId: any, visited = new Set<number>(), isLeaving = false) => {
    const supabase = getSupabase();
    if (!supabase) return;
    if (visited.has(memberId)) return;
    visited.add(memberId);

    const { data: member } = await supabase.from("family_members").select("*").eq("id", memberId).single();
    if (!member) return;

    if (member.father_id) await syncFamilyRecursive(member.father_id, newFamilyId, visited, isLeaving);
    if (member.mother_id) await syncFamilyRecursive(member.mother_id, newFamilyId, visited, isLeaving);
    if (member.spouse_id) await syncFamilyRecursive(member.spouse_id, newFamilyId, visited, isLeaving);

    await supabase.from("events").update({ family_id: newFamilyId }).eq("member_id", memberId);

    const [childrenRes, creatorsRes] = await Promise.all([
        supabase.from("family_members").select("id").eq("added_by_member_id", memberId),
        supabase.from("archive_memory_creators").select("member_id").eq("creator_member_id", memberId)
    ]);

    const childIds = (childrenRes.data || []).map(c => c.id);
    const creatorRefIds = (creatorsRes.data || []).filter(r => r.member_id).map(r => r.member_id as number);
    const allToSync = [...new Set([...childIds, ...creatorRefIds])];

    let currentAnchorId = memberId;
    if (!member.is_registered || isLeaving) {
        if (member.member_type === 'virtual') {
            let activeQuery = supabase.from("family_members").select("id").match({
                family_id: newFamilyId,
                gender: member.gender,
                member_type: 'virtual'
            });

            if (member.generation_num != null) activeQuery = activeQuery.eq('generation_num', member.generation_num);
            else activeQuery = activeQuery.is('generation_num', null);
            if (member.logic_tag) {
                activeQuery = activeQuery.eq('logic_tag', member.logic_tag);
            } else {
                activeQuery = activeQuery.eq('relationship', member.relationship);
                if (!member.relationship) activeQuery = activeQuery.is('relationship', null);
            }

            const { data: matched } = await activeQuery.maybeSingle();

            if (matched && matched.id !== memberId) {
                const { data: sm } = await supabase.from("family_members").select("name").eq("id", memberId).single();
                const { data: tm } = await supabase.from("family_members").select("name").eq("id", matched.id).single();
                const isV = (n: string) => n?.includes("父辈") || n?.includes("伯叔") || n?.includes("与") || n?.includes("虚拟");
                if (sm?.name === tm?.name || isV(sm?.name || "") || isV(tm?.name || "")) {
                    await mergeVirtualNodes(memberId, matched.id, newFamilyId, visited);
                    currentAnchorId = matched.id;
                } else {
                    await supabase.from("family_members").update({ family_id: newFamilyId }).eq("id", memberId);
                }
            } else {
                await supabase.from("family_members").update({ family_id: newFamilyId }).eq("id", memberId);
            }
        } else {
            const { data: matchedMe } = await supabase.from("family_members")
                .select("id")
                .eq("family_id", newFamilyId)
                .eq("user_id", member.user_id)
                .neq("id", memberId)
                .maybeSingle();
            
            if (matchedMe) {
                await mergeVirtualNodes(memberId, matchedMe.id, newFamilyId, visited);
                currentAnchorId = matchedMe.id;
            } else {
                await supabase.from("family_members").update({ family_id: newFamilyId }).eq("id", memberId);
            }
        }
    }

    for (const nextId of allToSync) {
        await syncFamilyRecursive(nextId, newFamilyId, visited, isLeaving);
    }
};

export const cloneVirtualLineageRecursive = async (oldParentId: number, newFamilyId: number, creatorId: number, clonedMap = new Map<number, number>(), visited = new Set<number>()) => {
    const supabase = getSupabase();
    if (!supabase) return null;

    if (!oldParentId || visited.has(oldParentId)) return clonedMap.get(oldParentId) || null;
    visited.add(oldParentId);

    const { data: member } = await supabase.from("family_members").select("*").eq("id", oldParentId).single();
    if (!member || member.member_type === 'virtual') return null;

    let currentNewId = clonedMap.get(oldParentId) || null;

    if (!currentNewId && !member.is_registered) {
        let query = supabase.from("family_members")
            .select("id")
            .eq("family_id", newFamilyId)
            .eq("name", member.name);

        if (member.generation_num === null) {
            query = query.is("generation_num", null);
        } else {
            query = query.eq("generation_num", member.generation_num);
        }

        if (member.relationship === null) {
            query = query.is("relationship", null);
        } else {
            query = query.eq("relationship", member.relationship);
        }

        const { data: matched } = await query.maybeSingle();

        if (matched) {
            currentNewId = matched.id;
            clonedMap.set(oldParentId, currentNewId);
            await supabase.from("family_members").update({
                logic_tag: member.logic_tag,
                birth_date: member.birth_date,
                gender: member.gender,
                avatar_url: member.avatar_url,
                member_type: member.member_type
            }).eq("id", currentNewId);
        } else {
            const { data: cloned } = await supabase.from("family_members").insert({
                family_id: newFamilyId,
                name: member.name,
                gender: member.gender,
                relationship: member.relationship,
                member_type: member.member_type,
                added_by_member_id: creatorId,
                generation_num: member.generation_num,
                logic_tag: member.logic_tag,
                ancestral_hall: member.ancestral_hall,
                surname: member.surname,
                avatar_url: member.avatar_url,
                sync_uuid: member.sync_uuid,
                is_registered: false
            }).select().single();
            if (cloned) {
                currentNewId = cloned.id;
                clonedMap.set(oldParentId, currentNewId);
            }
        }
    }

    if (currentNewId) {
        // Sync memories/messages/events for this node
        await syncAssetsByUuid(oldParentId, currentNewId, newFamilyId);
    }

    const updatableId = currentNewId || (member.is_registered ? clonedMap.get(oldParentId) : null);

    if (updatableId) {
        if (member.father_id) {
            const newF = await cloneVirtualLineageRecursive(member.father_id, newFamilyId, creatorId, clonedMap, visited);
            if (newF) await supabase.from("family_members").update({ father_id: newF }).eq("id", updatableId);
        }
        if (member.mother_id) {
            const newM = await cloneVirtualLineageRecursive(member.mother_id, newFamilyId, creatorId, clonedMap, visited);
            if (newM) await supabase.from("family_members").update({ mother_id: newM }).eq("id", updatableId);
        }
        if (member.spouse_id) {
            const newS = await cloneVirtualLineageRecursive(member.spouse_id, newFamilyId, creatorId, clonedMap, visited);
            if (newS) await supabase.from("family_members").update({ spouse_id: newS }).eq("id", updatableId);
        }
    }

    const { data: descendants } = await supabase.from("family_members")
        .select("id")
        .eq("added_by_member_id", oldParentId)
        .eq("is_registered", false);

    const { data: children } = await supabase.from("family_members")
        .select("id")
        .or(`father_id.eq.${oldParentId},mother_id.eq.${oldParentId}`)
        .eq("is_registered", false);

    const toCheck = new Set([...(descendants || []).map(d => d.id), ...(children || []).map(c => c.id)]);

    if (toCheck.size > 0) {
        for (const targetSubId of toCheck) {
            const newSubId = await cloneVirtualLineageRecursive(targetSubId, newFamilyId, creatorId, clonedMap, visited);
            if (newSubId) {
                const newParentId = currentNewId || (member.is_registered ? clonedMap.get(oldParentId) : null);
                if (newParentId) {
                    const { data: d } = await supabase.from("family_members").select("father_id, mother_id").eq("id", targetSubId).single();
                    if (d) {
                        const updateObj: any = {};
                        if (d.father_id === oldParentId) updateObj.father_id = newParentId;
                        if (d.mother_id === oldParentId) updateObj.mother_id = newParentId;
                        if (Object.keys(updateObj).length > 0) {
                            await supabase.from("family_members").update(updateObj).eq("id", newSubId);
                        }
                    }
                }
            }
        }
    }

    return currentNewId;
};

export const syncAssetsByUuid = async (fromMemberId: number, toMemberId: number, toFamilyId: number) => {
    const supabase = getSupabase();
    if (!supabase) return;

    console.log(`[SYNC-ASSETS] from:${fromMemberId} to:${toMemberId} family:${toFamilyId}`);
    const getPseudoId = (item: any, type: 'mem' | 'msg' | 'evt') => {
        if (type === 'mem') return `${item.content}_${item.author_name}_${item.type}`;
        if (type === 'msg') return `${item.content}_${item.author_name}_${item.type}`;
        return `${item.title}_${item.date}_${item.type}`;
    };

    const { data: fromMemories } = await supabase.from("memories").select("*").eq("member_id", fromMemberId);
    if (fromMemories) {
        const { data: toMemories } = await supabase.from("memories").select("*").eq("member_id", toMemberId);
        const toFingerprints = new Set(toMemories?.map((m: any) => m.sync_uuid || getPseudoId(m, 'mem')));

        for (const mem of fromMemories) {
            const myId = mem.sync_uuid || getPseudoId(mem, 'mem');
            if (!toFingerprints.has(myId)) {
                const { id, created_at, ...copyData } = mem;
                await supabase.from("memories").insert({ ...copyData, member_id: toMemberId, family_id: toFamilyId });
                toFingerprints.add(myId);
            }
        }
    }

    const { data: fromMessages } = await supabase.from("messages").select("*").eq("family_member_id", fromMemberId);
    if (fromMessages) {
        const { data: toMessages } = await supabase.from("messages").select("*").eq("family_member_id", toMemberId);
        const toFingerprints = new Set(toMessages?.map((m: any) => m.sync_uuid || getPseudoId(m, 'msg')));

        for (const msg of fromMessages) {
            const myId = msg.sync_uuid || getPseudoId(msg, 'msg');
            if (!toFingerprints.has(myId)) {
                const { id, created_at, ...copyData } = msg;
                await supabase.from("messages").insert({ ...copyData, family_member_id: toMemberId, family_id: toFamilyId });
                toFingerprints.add(myId);
            }
        }
    }

    const { data: fromEvents } = await supabase.from("events").select("*").eq("member_id", fromMemberId);
    if (fromEvents) {
        const { data: toEvents } = await supabase.from("events").select("*").eq("member_id", toMemberId);
        const toFingerprints = new Set(toEvents?.map((e: any) => e.sync_uuid || getPseudoId(e, 'evt')));

        for (const evt of fromEvents) {
            const myId = evt.sync_uuid || getPseudoId(evt, 'evt');
            if (!toFingerprints.has(myId)) {
                const { id, created_at, ...copyData } = evt;
                await supabase.from("events").insert({ ...copyData, member_id: toMemberId, family_id: toFamilyId });
                toFingerprints.add(myId);
            }
        }
    }
};
