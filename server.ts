import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

// NOTE: 密码哈希的 salt 轮数，12 是生产级别的安全默认值
const BCRYPT_SALT_ROUNDS = 12;

// Load environment variables
dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in .env.local");
  // Exit or throw error if essential environment variables are missing
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/family-members", async (req, res) => {
    const { familyId } = req.query;
    if (!familyId) {
      return res.status(400).json({ error: "Missing familyId. Family isolation is strictly enforced." });
    }

    const query = supabase.from("family_members").select("*").eq("family_id", familyId).order("id", { ascending: true });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Map snake_case to camelCase for frontend compatibility if needed
    const members = (data || []).map(m => ({
      ...m,
      isRegistered: m.is_registered,
      inviteCode: m.invite_code,
      avatarUrl: m.avatar_url,
      birthDate: m.birth_date,
      standardRole: m.standard_role
    }));
    res.json(members);
  });

  app.get("/api/family-members/:id", async (req, res) => {
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const member = {
      ...data,
      isRegistered: data.is_registered,
      inviteCode: data.invite_code,
      avatarUrl: data.avatar_url,
      birthDate: data.birth_date,
      standardRole: data.standard_role
    };
    res.json(member);
  });

  app.put("/api/family-members/:id", async (req, res) => {
    const { name, relationship, avatarUrl, bio, birthDate } = req.body;
    const { error } = await supabase
      .from("family_members")
      .update({
        name,
        relationship,
        avatar_url: avatarUrl,
        bio,
        birth_date: birthDate
      })
      .eq("id", req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.delete("/api/family-members/:id", async (req, res) => {
    // Delete messages first (Cascade is preferred in DB, but let's be explicit if needed)
    const { error: messageDeleteError } = await supabase.from("messages").delete().eq("family_member_id", req.params.id);
    if (messageDeleteError) console.error("Error deleting messages:", messageDeleteError.message); // Log but don't block if messages don't exist

    // Delete events related to this family member
    const { error: eventDeleteError } = await supabase.from("events").delete().eq("member_id", req.params.id);
    if (eventDeleteError) console.error("Error deleting events:", eventDeleteError.message);

    const { error } = await supabase.from("family_members").delete().eq("id", req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.post("/api/family-members", async (req, res) => {
    const { name, relationship, avatarUrl, bio, birthDate, standardRole } = req.body;
    const inviteCode = `FA-${Math.floor(1000 + Math.random() * 9000)}`;

    // Check if member already exists
    const { data: existing } = await supabase
      .from("family_members")
      .select("id")
      .eq("name", name)
      .single();

    if (existing) {
      return res.json({ id: existing.id, linked: true });
    }

    const { data, error } = await supabase
      .from("family_members")
      .insert({
        name,
        relationship,
        avatar_url: avatarUrl,
        bio,
        birth_date: birthDate,
        invite_code: inviteCode,
        is_registered: false,
        standard_role: standardRole || ""
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data.id, linked: false, inviteCode });
  });

  // NOTE: 验证邀请码 - 返回邀请人信息，供前端显示关系选择界面
  app.get("/api/validate-invite", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).json({ error: "Missing code" });

    let targetMemberId: number | null = null;
    let inviterId: number | null = null;

    if (code.startsWith("INV-")) {
      const parts = code.split("-");
      targetMemberId = parseInt(parts[1]);
      inviterId = parseInt(parts[2]);
    } else {
      // Fallback to legacy static invite code
      const { data: legacyMember } = await supabase.from("family_members").select("*").eq("invite_code", code).single();
      if (legacyMember) {
        return res.json({ inviterName: legacyMember.name, inviterRole: legacyMember.standard_role || legacyMember.relationship, inviterId: legacyMember.id });
      }
      return res.status(404).json({ error: "Invalid invite code" });
    }

    const { data: inviter, error: inviterError } = await supabase.from("family_members").select("*").eq("id", inviterId).single();
    const { data: target, error: targetError } = await supabase.from("family_members").select("*").eq("id", targetMemberId).single();

    if (inviterError || !inviter || targetError || !target) {
      return res.status(404).json({ error: "Invalid invitation link" });
    }

    res.json({
      inviterName: inviter.name,
      inviterRole: inviter.standard_role || inviter.relationship,
      inviterId: inviter.id,
      targetName: target.name,
      targetId: target.id
    });
  });

  app.post("/api/register-claim", async (req, res) => {
    try {
      const { inviteCode, name, avatarUrl, relationshipToInviter, standardRole, phone, password } = req.body;
      if (!inviteCode || !name || !phone || !password) {
        return res.status(400).json({ error: "Required fields missing" });
      }

      let targetId: number | null = null;
      let inviterId: number | null = null;

      if (inviteCode.startsWith("INV-")) {
        const parts = inviteCode.split("-");
        targetId = parseInt(parts[1]);
        inviterId = parseInt(parts[2]);
      }

      // 1. Get inviter and target
      const { data: inviter } = await supabase.from("family_members").select("*").eq("id", inviterId).single();
      const { data: target } = await supabase.from("family_members").select("*").eq("id", targetId).single();

      if (!inviter || !target) return res.status(404).json({ error: "Invitation not found" });

      // 2. Perform Relationship Mapping (Atomic Logic)
      async function resolveRigorousRel(role: string, inviter: any, targetId: number) {
        let updateData: any = { id: targetId };
        let invUpdate: any = { id: inviter.id };

        const ensureParent = async (memberId: number, gender: 'male' | 'female') => {
          const { data: m } = await supabase.from("family_members").select("*").eq("id", memberId).single();
          let pId = gender === 'male' ? m.father_id : m.mother_id;
          if (!pId) {
            const { data: nP } = await supabase.from("family_members").insert({
              family_id: m.family_id,
              name: `${m.name}的${gender === 'male' ? '父亲' : '母亲'}`,
              gender: gender,
              is_registered: false
            }).select().single();
            if (nP) {
              pId = nP.id;
              await supabase.from("family_members").update({ [gender === 'male' ? 'father_id' : 'mother_id']: pId }).eq("id", memberId);
            }
          }
          return pId;
        };

        const ensureSiblingParents = async (memberId: number) => {
          const fId = await ensureParent(memberId, 'male');
          const mId = await ensureParent(memberId, 'female');
          return { fId, mId };
        };

        if (role === "father") {
          invUpdate.father_id = targetId;
          updateData.gender = "male";
        } else if (role === "mother") {
          invUpdate.mother_id = targetId;
          updateData.gender = "female";
        } else if (role === "son" || role === "daughter") {
          updateData.gender = role === "son" ? "male" : "female";
          if (inviter.gender === "female") updateData.mother_id = inviter.id;
          else updateData.father_id = inviter.id;
        } else if (role === "brother" || role === "sister") {
          const { fId, mId } = await ensureSiblingParents(inviter.id);
          updateData.father_id = fId;
          updateData.mother_id = mId;
          updateData.gender = role === "brother" ? "male" : "female";
        } else if (role === "spouse") {
          updateData.spouse_id = inviter.id;
          invUpdate.spouse_id = targetId;
          updateData.gender = inviter.gender === "male" ? "female" : "male";
        } else if (role === "grandfather" || role === "grandmother") {
          const pId = await ensureParent(inviter.id, 'male'); // Default to father's path for simplicity
          if (role === "grandfather") await supabase.from("family_members").update({ father_id: targetId }).eq("id", pId);
          else await supabase.from("family_members").update({ mother_id: targetId }).eq("id", pId);
          updateData.gender = role === "grandfather" ? "male" : "female";
        } else if (role === "grandson" || role === "granddaughter") {
          // Create anchor child if not exists
          const { data: child } = await supabase.from("family_members").insert({
            family_id: inviter.family_id,
            name: `${inviter.name}的孩子`,
            is_registered: false,
            [inviter.gender === 'female' ? 'mother_id' : 'father_id']: inviter.id
          }).select().single();
          if (child) {
            updateData[inviter.gender === 'female' ? 'mother_id' : 'father_id'] = child.id;
          }
          updateData.gender = role === "grandson" ? "male" : "female";
        } else if (role === "uncle" || role === "aunt") {
          const parentId = await ensureParent(inviter.id, 'male');
          const { fId, mId } = await ensureSiblingParents(parentId);
          updateData.father_id = fId;
          updateData.mother_id = mId;
          updateData.gender = role === "uncle" ? "male" : "female";
        } else if (role === "nephew" || role === "niece") {
          // Nephew is child of sibling
          const { data: sibling } = await supabase.from("family_members").insert({
            family_id: inviter.family_id,
            name: `${inviter.name}的兄弟姐妹`,
            is_registered: false,
            father_id: (await ensureSiblingParents(inviter.id)).fId, // Ensure inviter has parents for sibling
            mother_id: (await ensureSiblingParents(inviter.id)).mId
          }).select().single();
          if (sibling) {
            updateData[inviter.gender === 'male' ? 'father_id' : 'mother_id'] = sibling.id; // Link target as child of sibling
          }
          updateData.gender = role === "nephew" ? "male" : "female";
        }

        return { updateData, invUpdate };
      }

      const { updateData, invUpdate } = await resolveRigorousRel(standardRole, inviter, target.id);

      // Merge additional fields
      const finalTargetData = { ...updateData, is_registered: true, name, avatar_url: avatarUrl };

      // 3. Update target member
      const { data, error } = await supabase.from("family_members").update(finalTargetData).eq("id", target.id).select().single();
      if (error) throw error;

      // 4. Update inviter if needed
      if (Object.keys(invUpdate).length > 1) {
        const { id, ...rest } = invUpdate;
        await supabase.from("family_members").update(rest).eq("id", id);
      }

      // 5. Create user account
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      await supabase.from("users").upsert({
        phone_or_email: phone,
        password: hashedPassword,
        name,
        relationship: relationshipToInviter,
        family_id: inviter.family_id,
        member_id: data.id
      });

      res.json({ success: true, memberId: data.id, familyId: inviter.family_id });
    } catch (err: any) {
      console.error("[CLAIM] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/accept-invite", async (req, res) => {
    try {
      const { phone, inviteCode, relationshipToInviter, standardRole } = req.body;
      if (!phone || !inviteCode) return res.status(400).json({ error: "Required fields missing" });

      let targetId: number | null = null;
      let inviterId: number | null = null;

      if (inviteCode.startsWith("INV-")) {
        const parts = inviteCode.split("-");
        targetId = parseInt(parts[1]);
        inviterId = parseInt(parts[2]);
      } else {
        return res.status(400).json({ error: "Invalid invite code format" });
      }

      // 1. Get inviter and target
      const { data: inviter } = await supabase.from("family_members").select("*").eq("id", inviterId).single();
      const { data: target } = await supabase.from("family_members").select("*").eq("id", targetId).single();

      if (!inviter || !target) return res.status(404).json({ error: "Invitation record not found" });

      // 2. Resolve Relationship
      async function resolveRigorousRel(role: string, inviter: any, targetId: number) {
        let updateData: any = { id: targetId };
        let invUpdate: any = { id: inviter.id };

        const ensureParent = async (memberId: number, gender: 'male' | 'female') => {
          const { data: m } = await supabase.from("family_members").select("*").eq("id", memberId).single();
          let pId = gender === 'male' ? m.father_id : m.mother_id;
          if (!pId) {
            const { data: nP } = await supabase.from("family_members").insert({
              family_id: m.family_id,
              name: `${m.name}的${gender === 'male' ? '父亲' : '母亲'}`,
              gender: gender,
              is_registered: false
            }).select().single();
            if (nP) {
              pId = nP.id;
              await supabase.from("family_members").update({ [gender === 'male' ? 'father_id' : 'mother_id']: pId }).eq("id", memberId);
            }
          }
          return pId;
        };

        const ensureSiblingParents = async (memberId: number) => {
          const fId = await ensureParent(memberId, 'male');
          const mId = await ensureParent(memberId, 'female');
          return { fId, mId };
        };

        if (role === "father") {
          invUpdate.father_id = targetId;
          updateData.gender = "male";
        } else if (role === "mother") {
          invUpdate.mother_id = targetId;
          updateData.gender = "female";
        } else if (role === "son" || role === "daughter") {
          updateData.gender = role === "son" ? "male" : "female";
          if (inviter.gender === "female") updateData.mother_id = inviter.id;
          else updateData.father_id = inviter.id;
        } else if (role === "brother" || role === "sister") {
          const { fId, mId } = await ensureSiblingParents(inviter.id);
          updateData.father_id = fId;
          updateData.mother_id = mId;
          updateData.gender = role === "brother" ? "male" : "female";
        } else if (role === "spouse") {
          updateData.spouse_id = inviter.id;
          invUpdate.spouse_id = targetId;
          updateData.gender = inviter.gender === "male" ? "female" : "male";
        } else if (role === "grandfather" || role === "grandmother") {
          const pId = await ensureParent(inviter.id, 'male');
          if (role === "grandfather") await supabase.from("family_members").update({ father_id: targetId }).eq("id", pId);
          else await supabase.from("family_members").update({ mother_id: targetId }).eq("id", pId);
          updateData.gender = role === "grandfather" ? "male" : "female";
        } else if (role === "grandson" || role === "granddaughter") {
          const { data: child } = await supabase.from("family_members").insert({
            family_id: inviter.family_id,
            name: `${inviter.name}的孩子`,
            is_registered: false,
            [inviter.gender === 'female' ? 'mother_id' : 'father_id']: inviter.id
          }).select().single();
          if (child) {
            updateData[inviter.gender === 'female' ? 'mother_id' : 'father_id'] = child.id;
          }
          updateData.gender = role === "grandson" ? "male" : "female";
        } else if (role === "uncle" || role === "aunt") {
          const parentId = await ensureParent(inviter.id, 'male');
          const { fId, mId } = await ensureSiblingParents(parentId);
          updateData.father_id = fId;
          updateData.mother_id = mId;
          updateData.gender = role === "uncle" ? "male" : "female";
        } else if (role === "nephew" || role === "niece") {
          const { data: sibling } = await supabase.from("family_members").insert({
            family_id: inviter.family_id,
            name: `${inviter.name}的兄弟姐妹`,
            is_registered: false,
            father_id: (await ensureSiblingParents(inviter.id)).fId,
            mother_id: (await ensureSiblingParents(inviter.id)).mId
          }).select().single();
          if (sibling) {
            updateData[inviter.gender === 'male' ? 'father_id' : 'mother_id'] = sibling.id;
          }
          updateData.gender = role === "nephew" ? "male" : "female";
        }

        return { updateData, invUpdate };
      }

      const { updateData, invUpdate } = await resolveRigorousRel(standardRole, inviter, target.id);

      const finalTargetData = { ...updateData, is_registered: true };

      // 3. Update the targeted family member
      const { data, error } = await supabase.from("family_members").update(finalTargetData).eq("id", target.id).select().single();
      if (error) throw error;

      // 4. Update inviter back-link
      if (Object.keys(invUpdate).length > 1) {
        const { id, ...rest } = invUpdate;
        await supabase.from("family_members").update(rest).eq("id", id);
      }

      // 5. Update the User record
      const { error: uError } = await supabase.from("users").update({
        relationship: relationshipToInviter,
        family_id: inviter.family_id,
        member_id: data.id
      }).eq("phone_or_email", phone);

      if (uError) console.error("Update user rel error:", uError.message);

      res.json({ success: true, memberId: data.id, familyId: inviter.family_id });
    } catch (err: any) {
      console.error("[ACCEPT-INVITE] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Generic registration (creating new family)
  app.post("/api/register-new", async (req, res) => {
    try {
      const { name, phone, password, avatar } = req.body;
      if (!name || !phone || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // 1. Create family
      const { data: family, error: fError } = await supabase
        .from("families")
        .insert({ name: `${name}的家族` })
        .select()
        .single();

      if (fError) throw new Error(`Family creation failed: ${fError.message}`);

      // 2. Create member
      const { data: member, error: mError } = await supabase
        .from("family_members")
        .insert({
          name,
          family_id: family.id,
          relationship: "创建者",
          avatar_url: avatar || "",
          is_registered: true,
          standard_role: "creator"
        })
        .select()
        .single();

      if (mError) throw new Error(`Member creation failed: ${mError.message}`);

      // 3. 密码哈希后存入 users 表
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      const { error: uError } = await supabase.from("users").upsert({
        phone_or_email: phone,
        password: hashedPassword,
        name,
        relationship: "创建者"
      });

      if (uError) console.error("User info storage error (non-blocking):", uError.message);

      res.json({ success: true, memberId: member.id, familyId: family.id });
    } catch (err: any) {
      console.error("[REGISTER] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Secure Login Endpoint
  app.post("/api/login", async (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) return res.status(400).json({ error: "Missing phone or password" });

      // 1. Fetch user by phone/email
      const { data: user, error: uError } = await supabase
        .from("users")
        .select("*")
        .eq("phone_or_email", phone)
        .single();

      if (uError || !user) return res.status(401).json({ error: "账号或密码错误" });

      // 2. Compare hashed password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ error: "账号或密码错误" });

      // 3. Find the associated family member record to get familyId
      const { data: member, error: mError } = await supabase
        .from("family_members")
        .select("*")
        .eq("name", user.name)
        .is("is_registered", true)
        .limit(1)
        .single();

      if (mError || !member) return res.status(401).json({ error: "关联成员信息查询失败" });

      // 4. Return user info without password
      const safeUser = {
        name: user.name,
        relationship: user.relationship,
        phone: user.phone_or_email,
        memberId: member.id,
        familyId: member.family_id,
        avatar: member.avatar_url
      };

      res.json({ success: true, user: safeUser });
    } catch (err: any) {
      console.error("[LOGIN] Error:", err.message);
      res.status(500).json({ error: "登录系统异常" });
    }
  });

  app.get("/api/events", async (req, res) => {
    const { familyId } = req.query;
    if (!familyId) {
      return res.status(400).json({ error: "Missing familyId. Family isolation is strictly enforced." });
    }

    const query = supabase.from("events").select("*").eq("family_id", familyId).order("date", { ascending: true });

    const { data, error } = await query;
    if (error) {
      console.error("[EVENTS] Fetch error:", error.message, "Query familyId:", familyId);
      return res.status(500).json({ error: error.message });
    }

    const events = (data || []).map(e => ({
      ...e,
      isRecurring: e.is_recurring,
      memberId: e.member_id,
      customMemberName: e.custom_member_name
    }));
    res.json(events);
  });

  app.delete("/api/events/:id", async (req, res) => {
    console.log(`Deleting event with id: ${req.params.id}`);
    const { error } = await supabase.from("events").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.get("/api/question-bank", async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 3;
    const { data, error } = await supabase
      .from("question_bank")
      .select("content")
      .order("id", { ascending: true }) // Supabase doesn't have RANDOM() directly, order by ID for consistency or implement client-side shuffle
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map(q => q.content));
  });

  app.post("/api/events", async (req, res) => {
    const { family_id, title, date, type, description, isRecurring, memberId, customMemberName, location, notes } = req.body;
    const { data, error } = await supabase
      .from("events")
      .insert({
        family_id,
        title,
        date,
        type,
        description,
        is_recurring: !!isRecurring,
        member_id: memberId,
        custom_member_name: customMemberName,
        location: location || "",
        notes: notes || ""
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data.id });
  });

  app.get("/api/messages/:memberId", async (req, res) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("family_member_id", req.params.memberId)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const messages = (data || []).map(m => ({
      ...m,
      familyMemberId: m.family_member_id,
      authorName: m.author_name,
      authorRole: m.author_role,
      authorAvatar: m.author_avatar,
      mediaUrl: m.media_url,
      eventId: m.event_id,
      createdAt: m.created_at
    }));
    res.json(messages);
  });

  app.get("/api/messages", async (req, res) => {
    const { eventId } = req.query;
    if (!eventId) {
      return res.status(400).json({ error: "Missing eventId. Data isolation is strictly enforced." });
    }

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const messages = (data || []).map(m => ({
      ...m,
      familyMemberId: m.family_member_id,
      authorName: m.author_name,
      authorRole: m.author_role,
      authorAvatar: m.author_avatar,
      mediaUrl: m.media_url,
      eventId: m.event_id,
      createdAt: m.created_at
    }));
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    const { familyMemberId, authorName, authorRole, authorAvatar, content, type, mediaUrl, duration, eventId } = req.body;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        family_member_id: familyMemberId,
        author_name: authorName,
        author_role: authorRole,
        author_avatar: authorAvatar,
        content,
        type,
        media_url: mediaUrl,
        duration,
        event_id: eventId
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data.id });
  });

  // OTP Verification Logic
  app.post("/api/send-code", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000).toISOString(); // 5 minutes expiry

    const { error } = await supabase
      .from("otp_codes")
      .upsert({
        email,
        code,
        expires_at: expiresAt
      });

    if (error) return res.status(500).json({ error: error.message });

    // Mock sending email
    console.log(`[AUTH] Verification code for ${email}: ${code}`);

    // NOTE: In production, use Resend/SendGrid/Nodemailer here
    res.json({ success: true, message: "验证码已发送（请查看服务器日志）" });
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ error: "邮箱、验证码和新密码均为必填" });
      }

      // 1. 验证 OTP
      const { data: otpData, error: otpError } = await supabase
        .from("otp_codes")
        .select("*")
        .eq("email", email)
        .single();

      if (otpError || !otpData) return res.status(400).json({ error: "验证码无效或未发送" });
      if (otpData.code !== code) return res.status(400).json({ error: "验证码错误" });
      if (new Date(otpData.expires_at) < new Date()) return res.status(400).json({ error: "验证码已过期" });

      // 2. 哈希新密码
      const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

      // 3. 更新用户密码
      const { error: uError } = await supabase
        .from("users")
        .update({ password: hashedPassword })
        .eq("phone_or_email", email);

      if (uError) throw new Error(`密码更新失败: ${uError.message}`);

      // 4. 清理验证码
      await supabase.from("otp_codes").delete().eq("email", email);

      res.json({ success: true, message: "密码重置成功，请重新登录" });
    } catch (err: any) {
      console.error("[RESET] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/verify-code", async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

    // First, verify the OTP code
    const { data: otpData, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .single();

    if (otpError || !otpData) return res.status(400).json({ error: "验证码已失效或未发送" });

    if (otpData.code !== code) {
      return res.status(400).json({ error: "验证码不正确" });
    }

    const isExpired = new Date(otpData.expires_at) < new Date();
    if (isExpired) {
      return res.status(400).json({ error: "验证码已过期" });
    }

    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Supabase integrated: ${supabaseUrl}`);
  });
}

startServer();
