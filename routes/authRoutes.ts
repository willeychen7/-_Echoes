import express from 'express';
import { getSupabase } from '../lib/supabase';
import { getResend } from '../lib/resend';
import { resolveRigorousRel, syncFamilyRecursive, syncAssetsByUuid, cloneVirtualLineageRecursive, mergeVirtualNodes, checkGenderConflict } from '../services/kinshipService';
import { syncMemberContent } from '../services/memberService';
import { normalizeGender } from '../services/memberService'; // Move to lib or service if needed
import bcrypt from 'bcryptjs';

const router = express.Router();
const BCRYPT_SALT_ROUNDS = 10;

router.post("/send-code", async (req, res) => {
    const supabase = getSupabase();
    const resend = getResend();
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();

    if (!supabase) return res.status(500).json({ error: "数据库服务未配置" });

    const { error } = await supabase
        .from("otp_codes")
        .upsert({ email, code, expires_at: expiresAt });

    if (error) return res.status(500).json({ error: error.message });

    try {
        if (resend) {
            await resend.emails.send({
                from: "岁月留声 <onboarding@resend.dev>",
                to: email,
                subject: "【岁月留声】您的家族验证码",
                html: `
                <div style="font-family: sans-serif; padding: 20px;">
                  <h2>您好！</h2>
                  <p>您正在尝试操作<strong>岁月留声</strong>家族档案系统的账号安全服务。</p>
                  <p>您的验证码是：<strong style="font-size: 24px; color: #eab308; background: #fffbeb; padding: 5px 10px; border-radius: 8px;">${code}</strong></p>
                  <p>该验证码将在 5 分钟后失效，请勿泄露给他人。</p>
                </div>
              `
            });
        } else {
            console.warn(`[AUTH] RESEND_API_KEY NOT FOUND. Verification code for ${email}: ${code}`);
            if (!process.env.VERCEL) {
                return res.json({ success: true, message: `[DEV MODE] 验证码已记录在服务器控制台: ${code}` });
            }
            return res.status(500).json({ error: "服务器未配置邮件服务" });
        }
        res.json({ success: true, message: "验证码已发送至您的邮箱，请查收。" });
    } catch (emailError: any) {
        res.status(500).json({ error: "发送验证码邮件失败" });
    }
});

router.post("/reset-password", async (req, res) => {
    const supabase = getSupabase();
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) return res.status(400).json({ error: "邮箱、验证码和新密码均为必填" });

        const { data: otpData, error: otpError } = await supabase
            .from("otp_codes")
            .select("*")
            .eq("email", email)
            .single();

        if (otpError || !otpData) return res.status(400).json({ error: "验证码无效或未发送" });
        if (otpData.code !== code) return res.status(400).json({ error: "验证码不正确" });
        if (new Date(otpData.expires_at) < new Date()) return res.status(400).json({ error: "验证码已过期" });

        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

        const { error: uError } = await supabase
            .from("users")
            .update({ password: hashedPassword })
            .eq("phone_or_email", email);

        if (uError) throw new Error(`密码更新失败: ${uError.message}`);
        await supabase.from("otp_codes").delete().eq("email", email);

        res.json({ success: true, message: "密码重置成功，请重新登录" });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/verify-code", async (req, res) => {
    const supabase = getSupabase();
    const { email: rawEmail, code } = req.body;
    if (!rawEmail || !code) return res.status(400).json({ error: "Email and code are required" });
    const email = rawEmail.trim().toLowerCase();

    // 只在非生产环境下允许测试验证码
    if (code === "888888" && process.env.NODE_ENV !== "production") return res.json({ success: true });

    const { data: otpData, error: otpError } = await supabase
        .from("otp_codes")
        .select("*")
        .eq("email", email)
        .single();

    if (otpError || !otpData) return res.status(400).json({ error: "验证码已失效或未发送" });
    if (otpData.code !== code) return res.status(400).json({ error: "验证码不正确" });
    if (new Date(otpData.expires_at) < new Date()) return res.status(400).json({ error: "验证码已过期" });

    res.json({ success: true });
});

router.get("/validate-invite", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });
    const code = req.query.code as string;
    if (!code) return res.status(400).json({ error: "Code is required" });

    try {
        let targetId, inviterId;
        if (code.startsWith("INV-")) {
            const parts = code.split("-");
            targetId = parseInt(parts[1]);
            inviterId = parseInt(parts[2]);
        } else {
            const { data: legacy } = await supabase.from("family_members").select("*").eq("invite_code", code).single();
            if (!legacy) return res.status(404).json({ error: "无效的邀请码" });
            targetId = legacy.id;
            const { data: creatorLink } = await supabase.from("archive_memory_creators").select("creator_member_id").eq("member_id", targetId).maybeSingle();
            inviterId = creatorLink ? creatorLink.creator_member_id : targetId;
        }

        const { data: target } = await supabase.from("family_members").select("*").eq("id", targetId).single();
        const { data: inviter } = await supabase.from("family_members").select("*").eq("id", inviterId).single();

        if (!target || !inviter) return res.status(404).json({ error: "邀请信息不存在" });

        res.json({
            inviterName: inviter.name,
            inviterRole: inviter.relationship,
            inviterId: inviter.id,
            inviterAncestralHall: inviter.ancestral_hall,
            inviterGenerationNum: inviter.generation_num,
            targetName: target.name,
            targetAvatar: target.avatar_url,
            targetBirthDate: target.birth_date,
            targetRole: target.relationship
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/register", async (req, res) => {
    // Alias for register-new
    return res.redirect(307, "/api/register-new");
});

router.post("/register-new", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { name, phone: rawPhone, password, avatar, birthDate, gender } = req.body;
        const phone = rawPhone?.trim().toLowerCase();

        if (!name || !phone || !password || !gender || !birthDate) {
            return res.status(400).json({ error: "必填项缺失（姓名、手机/邮箱、密码、性别、生日）" });
        }

        const { data: existingUser } = await supabase.from("users").select("id").eq("phone_or_email", phone).maybeSingle();
        if (existingUser) return res.status(400).json({ error: "该账号已被注册，请直接登录。" });

        const { data: family, error: fError } = await supabase.from("families").insert({ name: `${name}的家族` }).select().single();
        if (fError) throw fError;

        const { data: member, error: mError } = await supabase.from("family_members").insert({
            name,
            family_id: family.id,
            relationship: "创建者",
            avatar_url: avatar || "",
            gender: normalizeGender(gender),
            birth_date: birthDate || null,
            is_registered: true,
            standard_role: "creator",
            generation_num: 30,
            logic_tag: "G30-H1",
        }).select().single();
        if (mError) throw mError;

        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const { data: userData, error: uError } = await supabase.from("users").insert({
            phone_or_email: phone,
            password: hashedPassword,
            name,
            relationship: "我",
            member_id: member.id,
            family_id: family.id,
            home_member_id: member.id,
            home_family_id: family.id,
            avatar_url: avatar || "",
            birth_date: birthDate,
            gender: normalizeGender(gender)
        }).select("id").single();
        if (uError) throw uError;

        if (userData?.id) {
            await supabase.from("families").update({ creator_id: userData.id }).eq("id", family.id);
            await supabase.from("family_members").update({ user_id: userData.id }).eq("id", member.id);
        }

        res.json({ success: true, memberId: member.id, familyId: family.id, userId: userData?.id });
    } catch (err: any) {
        console.error("[REGISTER-NEW] Fatal Error:", err.message);
        res.status(500).json({ error: "注册系统执行异常，请稍后重试" });
    }
});

router.post("/login", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { phone: rawPhone, password } = req.body;
        if (!rawPhone || !password) return res.status(400).json({ error: "请输入账号和密码" });
        const phone = rawPhone.trim().toLowerCase();

        const { data: user, error: uError } = await supabase.from("users").select("*").eq("phone_or_email", phone).single();
        if (uError || !user) return res.status(401).json({ error: "账号或密码错误" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "账号或密码错误" });

        let member: any = null;
        if (user.member_id) {
            const { data: m } = await supabase.from("family_members").select("*").eq("id", user.member_id).single();
            member = m;
            if (member && !member.user_id) {
                await supabase.from("family_members").update({ user_id: user.id }).eq("id", member.id);
            }
        }

        let memoriesCount = 0;
        let likesCount = 0;
        if (member) {
            const { count: mCount } = await supabase.from("messages").select("*", { count: 'exact', head: true }).eq("family_member_id", member.id);
            memoriesCount = mCount || 0;
            const { data: memberMessages } = await supabase.from("messages").select("id").eq("family_member_id", member.id);
            if (memberMessages && memberMessages.length > 0) {
                const { count: lCount } = await supabase.from("likes").select("*", { count: 'exact', head: true }).eq("target_type", "message").in("target_id", memberMessages.map(m => m.id));
                likesCount = lCount || 0;
            }
        }

        const days = Math.max(1, Math.floor((Date.now() - new Date(user.created_at || Date.now()).getTime()) / 86400000));
        const safeUser = {
            id: user.id,
            name: member?.name || user.name || "家人",
            relationship: member?.relationship || user.relationship || "我",
            phone: user.phone_or_email,
            memberId: member?.id || null,
            familyId: member?.family_id || user.family_id || null,
            avatar: member?.avatar_url || (user as any).avatar_url || "",
            bio: member?.bio || (user as any).bio || "",
            birthday: member?.birth_date || (user as any).birth_date || "",
            gender: normalizeGender(member?.gender || (user as any).gender) || "male",
            joinDate: user.created_at || new Date().toISOString(),
            stats: { memories: memoriesCount, likes: likesCount, days }
        };

        res.status(200).json({ user: safeUser });
    } catch (err: any) {
        res.status(500).json({ error: "登录系统异常" });
    }
});

router.get("/check-migration", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const userId = req.query.userId as string;
    const phone = req.query.phone as string;
    const targetFamilyId = parseInt(req.query.targetFamilyId as string);
    if ((!userId && !phone) || !targetFamilyId) return res.status(400).json({ error: "Missing params" });

    try {
        const query = userId
            ? supabase.from("users").select("id, name, family_id, member_id").eq("id", userId).maybeSingle()
            : supabase.from("users").select("id, name, family_id, member_id").eq("phone_or_email", phone).maybeSingle();
        const { data: currentUser } = await query;

        if (!currentUser || !currentUser.family_id || currentUser.family_id === targetFamilyId) {
            return res.json({ needsMigration: false });
        }

        const { data: allMembers } = await supabase.from("family_members").select("id, name, is_registered, user_id").eq("family_id", currentUser.family_id);
        const totalMembers = allMembers?.length || 0;
        const registeredOthers = (allMembers || []).filter((m: any) => m.is_registered && m.user_id && m.user_id !== currentUser.id).length;

        const { count: memoryCount } = await supabase.from("memories").select("id", { count: "exact", head: true }).eq("member_id", currentUser.member_id);
        const { count: messageCount } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("family_member_id", currentUser.member_id);

        let kinshipMatch = null;
        if (currentUser.member_id) {
            const { data: myMember } = await supabase.from("family_members").select("father_id, mother_id").eq("id", currentUser.member_id).single();
            if (myMember && (myMember.father_id || myMember.mother_id)) {
                const myParentId = myMember.father_id || myMember.mother_id;
                const { data: myParent } = await supabase.from("family_members").select("name, generation_num, ancestral_hall").eq("id", myParentId).single();
                if (myParent && myParent.name) {
                    const { data: targetParent } = await supabase.from("family_members").select("id, name, family_id").eq("family_id", targetFamilyId).eq("name", myParent.name).eq("generation_num", myParent.generation_num).eq("ancestral_hall", myParent.ancestral_hall).maybeSingle();
                    if (targetParent) {
                        const { data: targetFam } = await supabase.from("families").select("name").eq("id", targetFamilyId).single();
                        kinshipMatch = { ancestorName: targetParent.name, targetFamilyName: targetFam?.name || "目标家族", isSameHall: true };
                    }
                }
            }
        }

        res.json({
            needsMigration: true,
            currentFamilyId: currentUser.family_id,
            totalMembers,
            registeredOthers,
            willFamilyBeDeleted: registeredOthers === 0,
            contentCount: (memoryCount || 0) + (messageCount || 0),
            kinshipMatch
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/accept-invite", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { userId, phone, inviteCode, relationshipToInviter, standardRole, name, avatarUrl, mode, targetSiblingOrder, inviterAncestralHall, inviterGenerationNum, birthDate, gender, syncArchives } = req.body;
        let effectiveMode: string = mode || "direct";

        const userQuery = userId
            ? supabase.from("users").select("*").eq("id", userId).maybeSingle()
            : supabase.from("users").select("*").eq("phone_or_email", phone).maybeSingle();
        const { data: currentUser } = await userQuery;
        if (!currentUser) return res.status(404).json({ error: "用户未在系统注册" });

        let targetId, inviterId;
        if (inviteCode.startsWith("INV-")) {
            const parts = inviteCode.split("-");
            targetId = parseInt(parts[1]);
            inviterId = parseInt(parts[2]);
        } else {
            const { data: legacyTarget } = await supabase.from("family_members").select("*").eq("invite_code", inviteCode).single();
            if (!legacyTarget) return res.status(400).json({ error: "邀请码无效" });
            targetId = legacyTarget.id;
            const { data: creatorLink } = await supabase.from("archive_memory_creators").select("creator_member_id").eq("member_id", targetId).maybeSingle();
            inviterId = creatorLink ? creatorLink.creator_member_id : targetId;
        }

        const { data: inviter } = await supabase.from("family_members").select("*").eq("id", inviterId).single();
        const { data: target } = await supabase.from("family_members").select("*").eq("id", targetId).single();
        if (!inviter || !target) return res.status(404).json({ error: "档案不存在" });

        if (target.is_registered && target.user_id && target.user_id !== currentUser.id) {
            return res.status(409).json({ error: "该档案已被他人入驻，请联系家族管理员。" });
        }

        const effectiveGender = normalizeGender(gender || currentUser.gender || target.gender) || 'male';
        if (checkGenderConflict(relationshipToInviter, effectiveGender)) {
            return res.status(400).json({ error: `礼法冲突：您选择的称谓“${relationshipToInviter}”与您的性别不符。` });
        }

        if (inviterAncestralHall && !inviter.ancestral_hall) inviter.ancestral_hall = inviterAncestralHall;
        if (inviterGenerationNum && !inviter.generation_num) inviter.generation_num = inviterGenerationNum;

        let { updateData } = await resolveRigorousRel(standardRole || "other", inviter, target.id);

        if (currentUser.family_id && currentUser.family_id !== inviter.family_id) {
            const { data: oldMembers } = await supabase.from("family_members").select("id").eq("family_id", currentUser.family_id).eq("is_registered", true).neq("user_id", currentUser.id);
            if ((!mode || mode === "direct") && oldMembers && oldMembers.length > 0) {
                return res.status(409).json({ error: `您已属于另一个家族，无法直接加入。`, code: "ALREADY_IN_FAMILY" });
            }
            effectiveMode = oldMembers?.length === 0 ? "clear" : effectiveMode;
        }

        const { data: legacyShadow } = await supabase.from("family_members").select("id").eq("family_id", inviter.family_id).eq("user_id", currentUser.id).neq("id", target.id).maybeSingle();
        if (legacyShadow) {
            // 批量迁移资产到新档案 ID
            await supabase.from("memories").update({ member_id: target.id }).eq("member_id", legacyShadow.id);
            await supabase.from("memories").update({ author_id: target.id }).eq("author_id", legacyShadow.id);
            await supabase.from("messages").update({ family_member_id: target.id }).eq("family_member_id", legacyShadow.id);
            await supabase.from("notifications").update({ member_id: target.id }).eq("member_id", legacyShadow.id);
            await supabase.from("events").update({ member_id: target.id }).eq("member_id", legacyShadow.id);
            
            // 修复亲属关系引用
            await supabase.from("family_members").update({ father_id: target.id }).eq("father_id", legacyShadow.id);
            await supabase.from("family_members").update({ mother_id: target.id }).eq("mother_id", legacyShadow.id);
            await supabase.from("family_members").update({ spouse_id: target.id }).eq("spouse_id", legacyShadow.id);
            
            // 清理旧占位档案
            await supabase.from("family_members").delete().eq("id", legacyShadow.id);
        }

        const finalPayload: any = {
            ...updateData,
            is_registered: true,
            user_id: currentUser.id,
            relationship: relationshipToInviter || target.relationship,
            name: name || currentUser.name || target.name,
            avatar_url: avatarUrl || currentUser.avatar_url || target.avatar_url,
            birth_date: birthDate || null,
            sibling_order: targetSiblingOrder || target.sibling_order
        };

        const { data: finalMember } = await supabase.from("family_members").update(finalPayload).eq("id", target.id).select().single();

        const userUpdateObj: any = { family_id: inviter.family_id, member_id: finalMember.id, gender: effectiveGender, generation_num: finalMember.generation_num };
        if (!currentUser.home_family_id) {
            userUpdateObj.home_family_id = inviter.family_id;
            userUpdateObj.home_member_id = finalMember.id;
        }
        await supabase.from("users").update(userUpdateObj).eq("id", currentUser.id);

        if (syncArchives && currentUser.home_member_id) {
            await syncAssetsByUuid(currentUser.home_member_id, finalMember.id, finalMember.family_id);
        }
        if (currentUser.family_id && currentUser.family_id !== inviter.family_id && (effectiveMode === "migrate" || effectiveMode === "clear")) {
            const oldMemberId = currentUser.member_id;
            if (oldMemberId) {
                const transferMap = new Map<number, number>();
                transferMap.set(oldMemberId, finalMember.id);
                await cloneVirtualLineageRecursive(oldMemberId, inviter.family_id, finalMember.id, transferMap);
                
                // ALSO CLONE FOLLOWERS (archives added by this person)
                const { data: followers } = await supabase.from("family_members")
                    .select("id")
                    .eq("added_by_member_id", oldMemberId)
                    .eq("family_id", currentUser.family_id)
                    .eq("is_registered", false);
                
                if (followers && followers.length > 0) {
                    console.log(`[MIGRATE] Cloning ${followers.length} followers for member ${oldMemberId}`);
                    for (const f of followers) {
                        try {
                            const cid = await cloneVirtualLineageRecursive(f.id, inviter.family_id, finalMember.id, transferMap);
                            console.log(`[MIGRATE] Follower ${f.id} cloned to ${cid}`);
                        } catch (cloneErr) {
                            console.error(`[MIGRATE] Follower clone failed:`, cloneErr);
                        }
                    }
                } else {
                    console.log(`[MIGRATE] No followers found for ${oldMemberId} in family ${currentUser.family_id}`);
                }
                await supabase.from("memories").update({ member_id: finalMember.id }).eq("member_id", oldMemberId);
                await supabase.from("memories").update({ author_id: finalMember.id }).eq("author_id", oldMemberId);
                await supabase.from("messages").update({ family_member_id: finalMember.id }).eq("family_member_id", oldMemberId);
                await supabase.from("events").update({ member_id: finalMember.id, family_id: inviter.family_id }).eq("member_id", oldMemberId);
                await supabase.from("family_members").update({ added_by_member_id: finalMember.id }).eq("added_by_member_id", oldMemberId);
            }
        }

        res.json({ success: true, memberId: finalMember.id, familyId: inviter.family_id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/register-claim", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { phone: rawPhone, password, name, avatarUrl, relationshipToInviter, standardRole, birthDate, gender, inviteCode, inviterAncestralHall, inviterGenerationNum } = req.body;
        const phone = rawPhone?.trim().toLowerCase();

        if (!name || !phone || !password || !gender || !birthDate || !inviteCode) {
            return res.status(400).json({ error: "必填参数缺失" });
        }
        
        // 1. Resolve Target from Code
        let targetId, inviterId;
        if (inviteCode.startsWith("INV-")) {
            const parts = inviteCode.split("-");
            targetId = parseInt(parts[1]);
            inviterId = parseInt(parts[2]);
        } else {
            const { data: legacyTarget } = await supabase.from("family_members").select("*").eq("invite_code", inviteCode).single();
            if (!legacyTarget) return res.status(400).json({ error: "邀请码无效" });
            targetId = legacyTarget.id;
            const { data: creatorLink } = await supabase.from("archive_memory_creators").select("creator_member_id").eq("member_id", targetId).maybeSingle();
            inviterId = creatorLink ? creatorLink.creator_member_id : targetId;
        }

        const { data: inviter } = await supabase.from("family_members").select("*").eq("id", inviterId).single();
        const { data: target } = await supabase.from("family_members").select("*").eq("id", targetId).single();
        if (!inviter || !target) return res.status(404).json({ error: "档案不存在" });

        // 2. Resolve Relationships
        const { updateData } = await resolveRigorousRel(standardRole || "other", inviter, target.id);

        // 3. Create User
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const { data: userData, error: uError } = await supabase.from("users").insert({
            phone_or_email: phone,
            password: hashedPassword,
            name: name || target.name,
            relationship: "我",
            family_id: inviter.family_id,
            member_id: target.id,
            home_family_id: inviter.family_id,
            home_member_id: target.id,
            avatar_url: avatarUrl || target.avatar_url || "",
            gender: normalizeGender(gender || target.gender),
            birth_date: birthDate || target.birth_date
        }).select().single();

        if (uError) {
            if (uError.code === '23505') return res.status(400).json({ error: "该手机号已注册" });
            throw uError;
        }

        // 4. Update Member
        const finalPayload = {
            ...updateData,
            is_registered: true,
            user_id: userData.id,
            name: name || target.name,
            avatar_url: avatarUrl || target.avatar_url,
            birth_date: birthDate || target.birth_date,
            gender: normalizeGender(gender || target.gender)
        };
        await supabase.from("family_members").update(finalPayload).eq("id", target.id);

        // 5. Recursive Sync
        await syncFamilyRecursive(target.id, inviter.family_id);

        res.json({ success: true, memberId: target.id, familyId: inviter.family_id, userId: userData.id });
    } catch (err: any) {
        console.error("[REGISTER-CLAIM] Fatal Error:", err.message);
        res.status(500).json({ error: "受邀入驻流程异常" });
    }
});

router.post("/claim-profile", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { phone: rawPhone, password, targetId, inviterId, relationshipToInviter, standardRole, inviterAncestralHall, inviterGenerationNum, name, avatarUrl, birthDate, gender } = req.body;
        const phone = rawPhone?.trim().toLowerCase();
        const { data: inviter } = await supabase.from("family_members").select("*").eq("id", inviterId).single();
        const { data: target } = await supabase.from("family_members").select("*").eq("id", targetId).single();
        if (!target || !inviter) return res.status(404).json({ error: "Profile or Inviter not found" });

        const { updateData, invUpdate } = await resolveRigorousRel(standardRole, inviter, target.id);
        const finalTargetData = { ...updateData, is_registered: true, name, avatar_url: avatarUrl, relationship: relationshipToInviter || target.relationship, birth_date: birthDate || null, gender: gender || null };
        const { data: memberData } = await supabase.from("family_members").update(finalTargetData).eq("id", target.id).select().single();

        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const { data: existingUser } = await supabase.from("users").select("id").eq("phone_or_email", phone).maybeSingle();

        let userData;
        if (existingUser) {
            userData = (await supabase.from("users").update({ name, relationship: "我", family_id: inviter.family_id, member_id: memberData.id, avatar_url: avatarUrl }).eq("id", existingUser.id).select().single()).data;
        } else {
            userData = (await supabase.from("users").insert({ phone_or_email: phone, password: hashedPassword, name, relationship: "我", family_id: inviter.family_id, member_id: memberData.id, home_family_id: inviter.family_id, home_member_id: memberData.id, avatar_url: avatarUrl || "" }).select().single()).data;
        }

        if (userData) {
            await supabase.from("family_members").update({ user_id: userData.id }).eq("id", targetId);
            await syncFamilyRecursive(memberData.id, inviter.family_id);
            await syncMemberContent(memberData.id, name, target.name, avatarUrl, "我");
        }

        res.json({ success: true, memberId: memberData.id, familyId: inviter.family_id, userId: userData?.id });
    } catch (err: any) {
        console.error("[CLAIM-PROFILE] Fatal Error:", err.message);
        res.status(500).json({ error: "完善档案资料时发生错误" });
    }
});

router.post("/leave-family", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        let { userId, memberId, familyId, takeArchives } = req.body;
        if (!userId && memberId) {
            const { data: u } = await supabase.from("users").select("id").eq("member_id", memberId).maybeSingle();
            if (u) userId = u.id;
        }

        await supabase.from("users").update({ family_id: null, member_id: null, relationship: null }).eq("id", userId);

        let familyToCleanup = null;
        const { data: familyObj } = await supabase.from("families").select("creator_id").eq("id", familyId).maybeSingle();

        if (familyObj && familyObj.creator_id === userId) {
            const { data: successor } = await supabase
                .from("family_members")
                .select("id, user_id")
                .eq("family_id", familyId)
                .neq("user_id", userId)
                .is("is_registered", true)
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();

            if (successor) {
                await supabase.from("families").update({ creator_id: successor.user_id }).eq("id", familyId);
                await supabase.from("family_members").update({ standard_role: "creator" }).eq("id", successor.id);
            } else {
                familyToCleanup = familyId;
            }
        } else {
            const { count } = await supabase.from("family_members").select("id", { count: 'exact', head: true }).eq("family_id", familyId).neq("user_id", userId);
            if (!count || count === 0) familyToCleanup = familyId;
        }

        const { data: uInfo } = await supabase.from("users").select("home_family_id").eq("id", userId).single();
        console.log(`[LEAVE] familyToCleanup:${familyToCleanup} homeFamilyId:${uInfo?.home_family_id}`);
        if (familyToCleanup && uInfo?.home_family_id === familyToCleanup) {
            console.log(`[LEAVE] Safeguard hit: not cleaning up home family`);
            familyToCleanup = null;
        }

        if (memberId) {
            await supabase.from("family_members").update({ is_registered: false, user_id: null }).eq("id", memberId);
        }

        const { data: userRecord } = await supabase.from("users").select("name, id, home_family_id, home_member_id").eq("id", userId).single();
        let finalFamilyId = userRecord.home_family_id;
        let finalMemberId = userRecord.home_member_id;

        if (!finalFamilyId) {
            const { data: nF } = await supabase.from("families").insert({ name: `${userRecord.name}的个人空间`, creator_id: userId }).select().single();
            const { data: nM } = await supabase.from("family_members").insert({
                family_id: nF.id, name: userRecord.name, relationship: "我", is_registered: true,
                standard_role: "creator", user_id: userId, generation_num: 30
            }).select().single();
            finalFamilyId = nF.id;
            finalMemberId = nM.id;
            await supabase.from("users").update({ home_family_id: finalFamilyId, home_member_id: finalMemberId }).eq("id", userId);
        }

        if (finalFamilyId && finalMemberId) {
            await supabase.from("users").update({ family_id: finalFamilyId, member_id: finalMemberId, relationship: "我" }).eq("id", userId);
            await supabase.from("family_members").update({ is_registered: true, user_id: userId }).eq("id", finalMemberId);
        }

        if (takeArchives && finalFamilyId && memberId) {
            const { data: meInOldFam } = await supabase.from("family_members").select("id, father_id, mother_id, spouse_id").eq("id", memberId).single();
            if (meInOldFam) {
                const clonedMap = new Map<number, number>();
                if (meInOldFam.father_id) {
                    const newF = await cloneVirtualLineageRecursive(meInOldFam.father_id, finalFamilyId, finalMemberId, clonedMap);
                    await supabase.from("family_members").update({ father_id: newF }).eq("id", finalMemberId);
                }
                if (meInOldFam.mother_id) {
                    const newM = await cloneVirtualLineageRecursive(meInOldFam.mother_id, finalFamilyId, finalMemberId, clonedMap);
                    await supabase.from("family_members").update({ mother_id: newM }).eq("id", finalMemberId);
                }
                if (meInOldFam.spouse_id) {
                    const newS = await cloneVirtualLineageRecursive(meInOldFam.spouse_id, finalFamilyId, finalMemberId, clonedMap);
                    await supabase.from("family_members").update({ spouse_id: newS }).eq("id", finalMemberId);
                }

                const { data: followers } = await supabase.from("family_members").select("id").eq("added_by_member_id", memberId).eq("family_id", familyId).eq("is_registered", false);
                if (followers && followers.length > 0) {
                    const fClonedMap = new Map<number, number>();
                    for (const f of followers) {
                        await cloneVirtualLineageRecursive(f.id, finalFamilyId, finalMemberId, fClonedMap);
                    }
                }
                await supabase.from("memories").update({ author_id: finalMemberId, member_id: finalMemberId, family_id: finalFamilyId }).eq("author_id", memberId).eq("member_id", memberId);
                await supabase.from("events").update({ member_id: finalMemberId, family_id: finalFamilyId }).eq("member_id", memberId);
            }
        }

        if (familyToCleanup) {
            await supabase.from("memories").delete().eq("family_id", familyToCleanup);
            await supabase.from("messages").delete().eq("family_id", familyToCleanup);
            await supabase.from("family_members").delete().match({ family_id: familyToCleanup, is_registered: false });
            const { count: survivors } = await supabase.from("family_members").select("id", { count: 'exact', head: true }).eq("family_id", familyToCleanup);
            if (!survivors || survivors === 0) {
                await supabase.from("families").delete().eq("id", familyToCleanup);
            }
        }

        res.json({ success: true, newFamilyId: finalFamilyId, newMemberId: finalMemberId });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/users/claim-orphan", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { userId, name, syncArchives } = req.body;
        const { data: member } = await supabase.from("family_members").select("id, family_id").eq("name", name).is("user_id", null).maybeSingle();
        if (!member) return res.json({ success: false, message: "No orphan found" });

        if (syncArchives) {
            const { data: userRec } = await supabase.from("users").select("home_member_id, home_family_id").eq("id", userId).single();
            if (userRec?.home_member_id) {
                await syncAssetsByUuid(userRec.home_member_id, member.id, member.family_id);
            }
        }

        await supabase.from("users").update({ member_id: member.id, family_id: member.family_id }).eq("id", userId);
        await supabase.from("family_members").update({ user_id: userId, is_registered: true }).eq("id", member.id);
        await supabase.from("memories").update({ author_id: member.id }).eq("member_id", member.id).eq("author_name", name).is("author_id", null);

        res.json({ success: true, memberId: member.id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/users/sync", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { phone } = req.query;
        const { data } = await supabase.from("users").select("id").eq("phone_or_email", phone).single();
        res.json({ id: data?.id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/users/sync-profile", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { userId, name, bio, birthDate, avatarUrl, gender, memberId } = req.body;
        const userUpdate: any = {};
        if (name) userUpdate.name = name;
        if (avatarUrl) userUpdate.avatar_url = avatarUrl;
        if (bio) userUpdate.bio = bio;
        if (birthDate) userUpdate.birth_date = birthDate;
        if (gender) userUpdate.gender = normalizeGender(gender);

        if (Object.keys(userUpdate).length > 0) {
            await supabase.from("users").update(userUpdate).eq("id", userId);
        }

        const { data: syncedMembers } = await supabase.from("family_members").update({
            name: name || undefined,
            bio: bio || undefined,
            birth_date: birthDate || undefined,
            avatar_url: avatarUrl || undefined,
            gender: normalizeGender(gender) || undefined
        }).eq("user_id", userId).select("id");

        if ((!syncedMembers || syncedMembers.length === 0) && !memberId) {
            await supabase.from("users").update({ member_id: null, family_id: null }).eq("id", userId);
        } else if (syncedMembers && syncedMembers.length > 0) {
            for (const m of syncedMembers) {
                await syncMemberContent(m.id, name, null, avatarUrl, null);
            }
        }

        if (memberId) {
            await supabase.from("family_members").update({
                name: name || undefined,
                avatar_url: avatarUrl || undefined,
                birth_date: birthDate || undefined
            }).eq("id", memberId);
            await syncMemberContent(memberId, name, null, avatarUrl, null);
        }

        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/users/:id", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { data: user, error } = await supabase
            .from("users")
            .select("id, name, phone_or_email, family_id, member_id, created_at, bio, birth_date, gender, avatar_url")
            .eq("id", req.params.id)
            .single();

        if (error) throw error;

        if (user.family_id && user.family_id !== null) {
            const { data: family } = await supabase.from("families").select("id").eq("id", user.family_id).maybeSingle();
            if (!family) {
                // 如果家族不存在，设置为 null 而不是共用的 1 号家族
                await supabase.from("users").update({ family_id: null, member_id: null }).eq("id", user.id);
                user.family_id = null;
                user.member_id = null;
            }
        }
        if (user.member_id) {
            const { data: member } = await supabase.from("family_members").select("id").eq("id", user.member_id).maybeSingle();
            if (!member) {
                await supabase.from("users").update({ member_id: null }).eq("id", user.id);
                user.member_id = null;
            }
        }
        res.json(user);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/stats/:memberId", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const mid = Number(req.params.memberId);
    const [msgsRes, memsRes] = await Promise.all([
        supabase.from("messages").select("likes").eq("family_member_id", mid),
        supabase.from("memories").select("likes").eq("member_id", mid)
    ]);

    const msgLikes = (msgsRes.data || []).reduce((s: any, m: any) => s + (m.likes || 0), 0);
    const memLikes = (memsRes.data || []).reduce((s: any, m: any) => s + (m.likes || 0), 0);
    const msgCount = (msgsRes.data || []).length;
    const memCount = (memsRes.data || []).length;

    res.json({
        likes: msgLikes + memLikes,
        memories: msgCount + memCount
    });
});

router.get("/me", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { userId, phone } = req.query;
    if (!userId && !phone) return res.status(400).json({ error: "Missing identity" });

    const query = userId
        ? supabase.from("users").select("*").eq("id", userId).maybeSingle()
        : supabase.from("users").select("*").eq("phone_or_email", phone).maybeSingle();

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "User not found" });

    res.json({
        id: data.id,
        name: data.name,
        phone: data.phone_or_email,
        avatar: data.avatar_url,
        familyId: data.family_id,
        memberId: data.member_id,
        gender: data.gender,
        isRegistered: true
    });
});

export default router;
