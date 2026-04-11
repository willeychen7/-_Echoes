import express from 'express';
import { getSupabase } from '../lib/supabase';
import { normalizeGender, getStandardRole, resolveRigorousRel, cloneVirtualLineageRecursive, syncAssetsByUuid } from '../services/kinshipService';
import { syncMemberContent } from '../services/memberService';

const router = express.Router();

router.get("/", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { familyId } = req.query;
    if (!familyId) {
        return res.status(400).json({ error: "Missing familyId. Family isolation is strictly enforced." });
    }

    const { data, error } = await supabase
        .from("family_members")
        .select(`
          *,
          archive_memory_creators!member_id(creator_member_id)
        `)
        .eq("family_id", familyId)
        .order("id", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const members = (data || []).map((m: any) => {
        const creatorLink = m.archive_memory_creators;
        const createdByMemberId = Array.isArray(creatorLink)
            ? creatorLink[0]?.creator_member_id
            : creatorLink?.creator_member_id;

        return {
            ...m,
            userId: m.user_id,
            isRegistered: m.is_registered,
            inviteCode: m.invite_code,
            avatarUrl: m.avatar_url,
            birthDate: m.birth_date,
            standardRole: m.standard_role,
            fatherId: m.father_id,
            motherId: m.mother_id,
            spouseId: m.spouse_id,
            ancestralHall: m.ancestral_hall,
            generationNum: m.generation_num,
            gender: normalizeGender(m.gender),
            memberType: m.member_type,
            logicTag: m.logic_tag,
            createdByMemberId: createdByMemberId || null,
            addedByMemberId: m.added_by_member_id || null,
            siblingOrder: m.sibling_order || null
        };
    });
    res.json(members);
});

router.get("/:id", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { familyId } = req.query;
        if (!familyId) return res.status(400).json({ error: "familyId is required for security isolation" });

        const { data, error } = await supabase
            .from("family_members")
            .select("*")
            .eq("id", req.params.id)
            .eq("family_id", familyId)
            .single();

        if (error) return res.status(500).json({ error: error.message });

        let targetUserId = data.user_id;
        if (!targetUserId && data.is_registered) {
            const { data: linkMatch } = await supabase.from("users").select("id").eq("member_id", data.id).maybeSingle();
            if (linkMatch) targetUserId = linkMatch.id;
        }

        let member = {
            ...data,
            userId: targetUserId,
            isRegistered: data.is_registered,
            inviteCode: data.invite_code,
            avatarUrl: data.avatar_url,
            birthDate: data.birth_date,
            standardRole: data.standard_role,
            fatherId: data.father_id,
            motherId: data.mother_id,
            spouseId: data.spouse_id,
            ancestralHall: data.ancestral_hall,
            generationNum: data.generation_num,
            memberType: data.member_type,
            logicTag: data.logic_tag
        };

        if (targetUserId) {
            const { data: userData } = await supabase
                .from("users")
                .select("id, name")
                .eq("id", targetUserId)
                .maybeSingle();

            if (userData) {
                member = {
                    ...member,
                    name: userData.name || member.name,
                    userId: userData.id
                };
            }
        }
        res.json(member);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { name, relationship, avatarUrl, bio, birthDate, standardRole, familyId, createdByMemberId, ancestralHall, gender, memberType, generationNum, logicTag, kinshipType } = req.body;
        const fatherId = req.body.fatherId || req.body.father_id || req.body.parentId || req.body.parent_id || null;
        const motherId = req.body.motherId || req.body.mother_id || null;

        let finalPayload: any = {
            family_id: familyId,
            name,
            relationship,
            avatar_url: avatarUrl,
            bio,
            birth_date: birthDate || null,
            invite_code: req.body.inviteCode || req.body.invite_code || null,
            is_registered: false,
            standard_role: standardRole || "",
            father_id: fatherId || null,
            mother_id: motherId || null,
            ancestral_hall: ancestralHall || null,
            gender: normalizeGender(gender),
            member_type: memberType || 'human',
            kinship_type: kinshipType || (memberType === 'pet' ? 'social' : 'blood'),
            generation_num: generationNum || null,
            logic_tag: logicTag || null,
            origin_side: req.body.originSide || null,
            is_placeholder: req.body.is_placeholder || false,
            added_by_member_id: createdByMemberId || null,
            sibling_order: req.body.siblingOrder || null
        };

        if (createdByMemberId) {
            const { data: creator } = await supabase.from("family_members").select("*").eq("id", createdByMemberId).single();
            if (creator) {
                const { updateData, isConfused } = await resolveRigorousRel(
                    standardRole || "other",
                    creator,
                    0,
                    req.body.gender,
                    req.body.selectedParentId,
                    req.body.selectedSide,
                    relationship,
                    logicTag
                );

                if (isConfused && !req.body.forceCreate) {
                    return res.status(200).json({
                        needDisambiguation: true,
                        message: `系统无法确定“${relationship}”在族谱中的精确位置，是否将其作为不关联的物理档案创建？`,
                        suggestedGender: updateData.gender
                    });
                }

                if (updateData.generation_num && !finalPayload.generation_num) finalPayload.generation_num = updateData.generation_num;
                if (updateData.ancestral_hall && !finalPayload.ancestral_hall) finalPayload.ancestral_hall = updateData.ancestral_hall;
                if (updateData.father_id && !finalPayload.father_id) finalPayload.father_id = updateData.father_id;
                if (updateData.mother_id && !finalPayload.mother_id) finalPayload.mother_id = updateData.mother_id;
                if (updateData.spouse_id && !finalPayload.spouse_id) finalPayload.spouse_id = updateData.spouse_id;
                if (updateData.sibling_order && !finalPayload.sibling_order) finalPayload.sibling_order = updateData.sibling_order;
                if (updateData.gender && (!finalPayload.gender || finalPayload.gender === 'unknown')) finalPayload.gender = updateData.gender;
                if (updateData.logic_tag && !finalPayload.logic_tag) finalPayload.logic_tag = updateData.logic_tag;
            }
        }

        if (finalPayload.member_type === 'virtual') {
            let query = supabase.from("family_members").select("id").match({
                family_id: finalPayload.family_id,
                gender: finalPayload.gender,
                member_type: 'virtual'
            });

            let hasAnchor = false;
            if (finalPayload.spouse_id) {
                query = query.eq('spouse_id', finalPayload.spouse_id);
                hasAnchor = true;
            } else if (finalPayload.father_id || finalPayload.mother_id) {
                if (finalPayload.father_id) query = query.eq('father_id', finalPayload.father_id);
                else query = query.is('father_id', null);

                if (finalPayload.mother_id) query = query.eq('mother_id', finalPayload.mother_id);
                else query = query.is('mother_id', null);
                hasAnchor = true;
            }

            if (hasAnchor) {
                const { data: existingVirtual } = await query.maybeSingle();
                if (existingVirtual) {
                    return res.json({ id: existingVirtual.id, linked: true, merged: true });
                }
            }
        }

        let { data, error } = await supabase
            .from("family_members")
            .insert(finalPayload)
            .select()
            .single();

        if (error && (error.message?.includes("column") || error.code === "PGRST204" || error.code === "42703")) {
            const fallbackPayload = { ...finalPayload };
            if (error.message.includes("member_type")) delete fallbackPayload.member_type;
            if (error.message.includes("ancestral_hall")) delete fallbackPayload.ancestral_hall;
            if (error.message.includes("kinship_type")) delete fallbackPayload.kinship_type;
            if (error.message.includes("generation_num")) delete fallbackPayload.generation_num;
            if (error.message.includes("logic_tag")) delete fallbackPayload.logic_tag;
            if (error.message.includes("origin_side")) delete fallbackPayload.origin_side;
            if (error.message.includes("added_by_member_id")) delete fallbackPayload.added_by_member_id;
            if (error.message.includes("sibling_order")) delete fallbackPayload.sibling_order;
            const result = await supabase.from("family_members").insert(fallbackPayload).select().single();
            data = result.data;
            error = result.error;
        }

        if (error) {
            if (error.code === "23503" && error.message?.includes("family_id")) {
                return res.status(403).json({ error: "家族已过期或不存在，无法添加成员" });
            }
            throw error;
        }

        res.json(data);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/:id", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { name, relationship, avatarUrl, bio, birthDate, gender, ancestralHall, logicTag, fatherId, motherId, spouseId, generationNum, isPlaceholder, siblingOrder } = req.body;

    const { data: oldMember } = await supabase
        .from("family_members")
        .select("name")
        .eq("id", req.params.id)
        .single();

    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = name;
    if (relationship !== undefined) updatePayload.relationship = relationship;
    if (avatarUrl !== undefined) updatePayload.avatar_url = avatarUrl;
    if (bio !== undefined) updatePayload.bio = bio;
    if (birthDate !== undefined) updatePayload.birth_date = (birthDate === "" ? null : birthDate);
    if (gender !== undefined) updatePayload.gender = normalizeGender(gender);
    if (ancestralHall !== undefined) updatePayload.ancestral_hall = ancestralHall;
    if (logicTag !== undefined) updatePayload.logic_tag = logicTag;
    if (fatherId !== undefined) updatePayload.father_id = fatherId;
    if (motherId !== undefined) updatePayload.mother_id = motherId;
    if (spouseId !== undefined) updatePayload.spouse_id = spouseId;
    if (generationNum !== undefined) updatePayload.generation_num = generationNum;
    if (isPlaceholder !== undefined) updatePayload.is_placeholder = isPlaceholder;
    if (siblingOrder !== undefined) updatePayload.sibling_order = siblingOrder;

    const { error } = await supabase
        .from("family_members")
        .update(updatePayload)
        .eq("id", req.params.id);

    if (error) return res.status(500).json({ error: error.message });

    const userUpdate: any = { name, relationship };
    if (gender) userUpdate.gender = normalizeGender(gender);
    if (bio) userUpdate.bio = bio;
    if (birthDate) userUpdate.birth_date = birthDate;
    if (avatarUrl) userUpdate.avatar_url = avatarUrl;
    await supabase.from("users").update(userUpdate).eq("member_id", req.params.id);

    if (gender) {
        const { data: member } = await supabase.from("family_members").select("standard_role").eq("id", req.params.id).single();
        if (member?.standard_role) {
            const roleMap: Record<string, string> = {
                "son": "daughter", "daughter": "son",
                "father": "mother", "mother": "father",
                "brother": "sister", "sister": "brother",
                "husband": "wife", "wife": "husband",
                "nephew": "niece", "niece": "nephew",
                "grandson": "granddaughter", "granddaughter": "grandson",
                "grandfather": "grandmother", "grandmother": "grandfather"
            };
            const currentRole = member.standard_role;
            let newRole = currentRole;
            if (gender === "male") {
                if (["daughter", "mother", "sister", "wife", "niece", "granddaughter", "grandmother"].includes(currentRole)) {
                    newRole = Object.keys(roleMap).find(key => roleMap[key] === currentRole) || currentRole;
                }
            } else if (gender === "female") {
                if (["son", "father", "brother", "husband", "nephew", "grandson", "grandfather"].includes(currentRole)) {
                    newRole = roleMap[currentRole] || currentRole;
                }
            }
            if (newRole !== currentRole) {
                await supabase.from("family_members").update({ standard_role: newRole }).eq("id", req.params.id);
            }
        }
    }

    await syncMemberContent(req.params.id, name, oldMember?.name, avatarUrl, relationship);
    res.json({ success: true });
});

router.delete("/:id", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { data: member, error: fetchError } = await supabase
            .from("family_members")
            .select("is_registered")
            .eq("id", req.params.id)
            .maybeSingle();

        if (fetchError || !member) return res.status(404).json({ error: "档案未找到" });
        if (member.is_registered) return res.status(403).json({ error: "该成员已正式注册，您无权删除其实名档案" });

        await supabase.from("messages").delete().eq("family_member_id", req.params.id);
        await supabase.from("events").delete().eq("member_id", req.params.id);
        await supabase.from("archive_memory_creators").delete().eq("member_id", req.params.id);
        
        const { error } = await supabase.from("family_members").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: "删除失败，系统异常" });
    }
});


router.get("/archive-creators/:id", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { data, error } = await supabase
            .from("archive_memory_creators")
            .select("creator_member_id")
            .eq("member_id", req.params.id)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.json({ creatorName: "系统" });

        const { data: creator } = await supabase
            .from("family_members")
            .select("name")
            .eq("id", data.creator_member_id)
            .maybeSingle();

        res.json({ creatorName: creator?.name || "未知" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
