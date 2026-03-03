import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { GoogleGenerativeAI } from "@google/generative-ai";

const BCRYPT_SALT_ROUNDS = 12;

// Top-level variables for caching
let supabase: any;
let resend: any;

export async function createApp() {
  try {
    // Only load environment variables locally
    if (!process.env.VERCEL) {
      try {
        const dotenv = await import("dotenv");
        dotenv.config({ path: ".env.local" });
      } catch (e) {
        console.warn("dotenv not found or .env.local missing, ignoring.");
      }
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    const resendApiKey = process.env.RESEND_API_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
      console.error("[SERVER] Warning: Missing Supabase URL or Key.");
    }

    // Initialize clients if not already initialized
    if (!supabase && supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
    }
    if (!resend && resendApiKey) {
      resend = new Resend(resendApiKey);
    }

    const app = express();

    // --- Database Migration ---
    (async () => {
      try {
        if (supabase) {
          // Add profile fields to users table
          await supabase.rpc('exec_sql', {
            sql_query: `
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
          ` }).catch(err => console.log("Users Migration check:", err.message));

          // Add user_id to family_members for persistent identity
          await supabase.rpc('exec_sql', {
            sql_query: `
            ALTER TABLE family_members ADD COLUMN IF NOT EXISTS user_id INTEGER;
          ` }).catch(err => console.log("Members Migration check:", err.message));
        }
      } catch (e) {
        console.warn("Migration error:", e);
      }
    })();

    // Express middleware
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // Logging middleware
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });

    // Error handling middleware for parsing errors
    app.use((err: any, req: any, res: any, next: any) => {
      if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
        console.error("[EXPRESS] JSON Syntax Error:", err.message);
        return res.status(400).json({ error: "Invalid JSON payload" });
      }
      if (err.status === 413) {
        console.error("[EXPRESS] Payload Too Large");
        return res.status(413).json({ error: "Payload too large. Please use a smaller image." });
      }
      next();
    });

    // Only handle static serving / Vite in local development
    if (!process.env.VERCEL) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      if (process.env.NODE_ENV !== "production") {
        console.log("[SERVER] Development mode: using Vite middleware");
        try {
          const { createServer: createViteServer } = await import("vite");
          const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
          });
          app.use(vite.middlewares);
        } catch (err) {
          console.warn("[SERVER] Vite middleware failed to load.");
        }
      } else {
        console.log("[SERVER] Production mode: serving static files from dist");
        const distPath = path.join(__dirname, "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
          if (req.url.startsWith("/api")) return res.status(404).json({ error: "API not found" });
          res.sendFile(path.join(distPath, "index.html"));
        });
      }
    }

    // API Routes
    app.get("/api/ping", async (req, res) => {
      res.json({
        status: "ok",
        time: new Date().toISOString(),
        env: {
          hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
          hasSupabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
          hasResendKey: !!process.env.RESEND_API_KEY,
          nodeEnv: process.env.NODE_ENV,
          isVercel: !!process.env.VERCEL
        },
        supabaseInitialized: !!supabase
      });
    });

    app.post("/api/generate-blessing-summary", async (req, res) => {
      try {
        const { messages, eventTitle } = req.body;
        const apiKey = process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: "Missing API Key" });

        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

        const messageContext = (messages || []).map((m: any) => `${m.authorName} (${m.authorRole}): ${m.content}`).join("\n");
        const prompt = `你是家族记忆整理师。请根据以下家人在${eventTitle}时的祝福：\n${messageContext}\n\n写一段温馨的家族总结。要求语言温暖、细腻。字数300字左右。`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ text: response.text() });
      } catch (err: any) {
        console.error("[GEMINI] Error:", err.message);
        res.status(500).json({ error: "AI生成失败: " + err.message });
      }
    });

    app.post("/api/ai-generate", async (req, res) => {
      try {
        const { type, messages, memberName, eventTitle, eventRange, events } = req.body;
        const apiKey = process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: "Missing API Key" });

        const ai = new GoogleGenerativeAI(apiKey);
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

        let prompt = "";
        const messageContext = (messages || []).map((m: any) => `${m.authorName} (${m.authorRole}): ${m.content}`).join("\n");

        if (type === "biography") {
          prompt = `你是家族记忆整理师。以下是关于${memberName}的故事素材：\n${messageContext}\n\n请整理成深刻的传记。要求语言温暖、细腻。字数300字左右。`;
        } else if (type === "summary") {
          prompt = `你是家族记忆整理师。请根据以下家人在${eventTitle}时的祝福：\n${messageContext}\n\n写一段温馨的家族总结。要求语言温暖、细腻。字数200字左右。`;
        } else if (type === "family-secretary") {
          prompt = `
          你是一个温暖的家庭小秘书。请根据以下家族大事记列表，生成一个精准、简炼的总结。
          时间跨度：${eventRange === "week" ? "本周" : eventRange === "month" ? "本月" : "本年"}大事记总结
          事件列表：${(events || []).map((e: any) => `- ${e.title} (${e.date}, ${e.type}): ${e.description || ""} ${e.notes || ""}`).join("\n")}
          要求：
          1. 语气亲切，用词精准。
          2. 不要啰嗦，去掉所有客套话，直接开门见山总结重点。
          3. 80字以内。
          4. 你的开头必须是：“本${eventRange === "week" ? "周" : eventRange === "month" ? "月" : "年"}家族记忆总结：”
        `;
        } else {
          return res.status(400).json({ error: "Unsupported AI generation type" });
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ text: response.text() });
      } catch (err: any) {
        console.error("[AI-GEN] Error:", err.message);
        res.status(500).json({ error: "AI生成失败: " + err.message });
      }
    });

    // --- Helper for syncing member profile changes to messages/memories ---
    async function syncMemberContent(memberId: string | number, name: string, oldName: string | null, avatarUrl: string | null, relationship: string | null) {
      if (!supabase) return;

      const memoriesFields: any = {};
      if (name) memoriesFields.author_name = name;
      if (avatarUrl) memoriesFields.author_avatar = avatarUrl;
      if (relationship) memoriesFields.author_relationship = relationship;

      // 1. Update memories
      if (Object.keys(memoriesFields).length > 0) {
        // STRICT: Only update by numeric ID. 
        // We never use author_name here to avoid duplicate name collisions.
        await supabase
          .from("memories")
          .update(memoriesFields)
          .eq("author_id", memberId);
      }

      // 2. Update messages (where family_member_id is author, i.e., events)
      const messageFields: any = {};
      if (name) messageFields.author_name = name;
      if (avatarUrl) messageFields.author_avatar = avatarUrl;
      if (relationship) messageFields.author_role = relationship;

      if (Object.keys(messageFields).length > 0) {
        // STRICT: Update by family_member_id only
        await supabase
          .from("messages")
          .update(messageFields)
          .eq("family_member_id", memberId)
          .not("event_id", "is", null);
      }
    }

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
        userId: m.user_id, // CRITICAL: Map database user_id to frontend userId
        isRegistered: m.is_registered,
        inviteCode: m.invite_code,
        avatarUrl: m.avatar_url,
        birthDate: m.birth_date,
        standardRole: m.standard_role
      }));
      res.json(members);
    });

    app.get("/api/family-members/:id", async (req, res) => {
      try {
        const { data, error } = await supabase
          .from("family_members")
          .select("*")
          .eq("id", req.params.id)
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
          standardRole: data.standard_role
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

    app.post("/api/users/bind-member", async (req, res) => {
      try {
        const { userId, memberId } = req.body;
        if (!userId || !memberId) return res.status(400).json({ error: "Missing IDs" });

        // 1. Verify if this member record is already claimed by someone else
        const { data: member } = await supabase.from("family_members").select("user_id").eq("id", memberId).single();
        if (member && member.user_id && member.user_id != userId) {
          return res.status(403).json({ error: "档案已被其他账户绑定" });
        }

        // 2. Perform the binding and sync latest profile data
        const { data: user } = await supabase.from("users").select("id, name").eq("id", userId).single();
        if (user) {
          await supabase.from("family_members").update({
            user_id: userId,
            name: user.name || "家人"
          }).eq("id", memberId);

          return res.json({ success: true });
        }
        res.status(404).json({ error: "Account not found" });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.put("/api/family-members/:id", async (req, res) => {
      const { name, relationship, avatarUrl, bio, birthDate } = req.body;

      // 1. 先获取旧的名称，以便同步之前的留言
      const { data: oldMember } = await supabase
        .from("family_members")
        .select("name")
        .eq("id", req.params.id)
        .single();

      // 2. 更新成员表
      const { error } = await supabase
        .from("family_members")
        .update({
          name: name || undefined,
          relationship: relationship || undefined,
          avatar_url: avatarUrl || undefined,
          bio: bio || undefined,
          birth_date: birthDate || undefined
        })
        .eq("id", req.params.id);

      if (error) {
        console.error("[API] PUT family-member error:", error.message);
        return res.status(500).json({ error: error.message });
      }

      // 3. 核心同步逻辑：更新关联的 users 表
      await supabase.from("users").update({ name, relationship }).eq("member_id", req.params.id);

      // 4. Sync profile changes to past content
      await syncMemberContent(req.params.id, name, oldMember?.name, avatarUrl, relationship);

      res.json({ success: true });
    });

    app.delete("/api/family-members/:id", async (req, res) => {
      try {
        // 1. 获取目标成员状态
        const { data: member, error: fetchError } = await supabase
          .from("family_members")
          .select("is_registered")
          .eq("id", req.params.id)
          .maybeSingle();

        if (fetchError || !member) {
          return res.status(404).json({ error: "档案未找到" });
        }

        // 2. 核心逻辑：如果档案已注册为真实用户，禁止他人删除
        if (member.is_registered) {
          return res.status(403).json({ error: "该成员已正式注册，您无权删除其实名档案" });
        }

        // 3. 执行级联删除逻辑
        // 删除关联留言
        const { error: messageDeleteError } = await supabase.from("messages").delete().eq("family_member_id", req.params.id);
        if (messageDeleteError) console.error("Error deleting messages:", messageDeleteError.message);

        // 删除关联大事记
        const { error: eventDeleteError } = await supabase.from("events").delete().eq("member_id", req.params.id);
        if (eventDeleteError) console.error("Error deleting events:", eventDeleteError.message);

        // 删除创建者记录
        await supabase.from("archive_memory_creators").delete().eq("member_id", req.params.id);

        // 最后删除成员本身
        const { error } = await supabase.from("family_members").delete().eq("id", req.params.id);

        if (error) throw error;
        res.json({ success: true });
      } catch (err: any) {
        console.error("[MEMBER] DELETE error:", err.message);
        res.status(500).json({ error: "删除失败，系统异常" });
      }
    });

    app.post("/api/family-members", async (req, res) => {
      try {
        const { name, relationship, avatarUrl, bio, birthDate, standardRole, familyId, createdByMemberId } = req.body;
        const inviteCode = `FA-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const { data: existing } = await supabase
          .from("family_members")
          .select("id")
          .eq("name", name)
          .eq("family_id", familyId)
          .maybeSingle();

        if (existing) {
          return res.json({ id: existing.id, linked: true });
        }

        const { data, error } = await supabase
          .from("family_members")
          .insert({
            family_id: familyId,
            name,
            relationship,
            avatar_url: avatarUrl,
            bio,
            birth_date: birthDate || null,
            invite_code: inviteCode,
            is_registered: false,
            standard_role: standardRole || ""
          })
          .select()
          .single();

        if (error) throw error;

        // 记录创建者关系
        if (createdByMemberId) {
          try {
            await supabase.from("archive_memory_creators").insert({
              member_id: data.id,
              creator_member_id: createdByMemberId
            });
          } catch (subErr) {
            console.warn("[MEMBER] Warning: Failed to record creator linkage:", subErr);
          }
        }

        res.json({ id: data.id, linked: false, inviteCode });
      } catch (err: any) {
        console.error("[MEMBER] POST error:", err.message);
        res.status(500).json({ error: "创建档案失败，请稍后重试" });
      }
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

        const { data: inviter } = await supabase.from("family_members").select("*").eq("id", inviterId).single();
        const { data: target } = await supabase.from("family_members").select("*").eq("id", targetMemberId).single();

        if (!inviter || !target) {
          return res.status(404).json({ error: "Invalid invitation link" });
        }

        return res.json({
          inviterName: inviter.name,
          inviterRole: inviter.standard_role || inviter.relationship,
          inviterId: inviter.id,
          targetName: target.name,
          targetId: target.id,
          targetRole: target.relationship,
          targetStandardRole: target.standard_role
        });
      } else {
        // Legacy: FA-XXXX-XXXX
        const { data: target } = await supabase.from("family_members").select("*").eq("invite_code", code).single();
        if (!target) return res.status(404).json({ error: "Invalid invite code" });

        // Find who created this profile
        const { data: creatorLink } = await supabase
          .from("archive_memory_creators")
          .select("creator_member_id")
          .eq("member_id", target.id)
          .maybeSingle();

        if (creatorLink) {
          const { data: inviter } = await supabase.from("family_members").select("*").eq("id", creatorLink.creator_member_id).single();
          if (inviter) {
            return res.json({
              inviterName: inviter.name,
              inviterRole: inviter.standard_role || inviter.relationship,
              inviterId: inviter.id,
              targetName: target.name,
              targetId: target.id,
              targetRole: target.relationship,
              targetStandardRole: target.standard_role
            });
          }
        }

        // Fallback: If no creator found, it's a self-claim or root invite
        return res.json({
          inviterName: target.name,
          inviterRole: target.standard_role || target.relationship,
          inviterId: target.id,
          targetName: target.name,
          targetId: target.id,
          targetRole: target.relationship,
          targetStandardRole: target.standard_role
        });
      }
    });

    // --- NEW: Archive Creator Info ---
    app.get("/api/archive-creators/:memberId", async (req, res) => {
      const { memberId } = req.params;
      const { data, error } = await supabase
        .from("archive_memory_creators")
        .select(`
        id,
        creator_member_id,
        family_members!archive_memory_creators_creator_member_id_fkey (
          name
        )
      `)
        .eq("member_id", Number(memberId))
        .single();

      if (error) {
        if (error.code === "PGRST116") return res.json({ creatorName: "系统" });
        return res.status(500).json({ error: error.message });
      }

      res.json({
        creatorId: data.creator_member_id,
        creatorName: (data.family_members as any)?.name || "系统"
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
        } else {
          // Legacy check
          const { data: legacyTarget } = await supabase.from("family_members").select("*").eq("invite_code", inviteCode).single();
          if (legacyTarget) {
            targetId = legacyTarget.id;
            const { data: creatorLink } = await supabase.from("archive_memory_creators").select("creator_member_id").eq("member_id", targetId).maybeSingle();
            if (creatorLink) {
              inviterId = creatorLink.creator_member_id;
            } else {
              // Self-claim (no creator link)
              inviterId = targetId;
            }
          }
        }

        // 1. Get inviter and target
        const { data: inviter } = await supabase.from("family_members").select("*").eq("id", inviterId).single();
        const { data: target } = await supabase.from("family_members").select("*").eq("id", targetId).single();

        if (!target) return res.status(404).json({ error: "Target profile not found" });
        if (!inviter) return res.status(404).json({ error: "Inviter not found" });

        // 2. Perform Relationship Mapping (Atomic Logic)
        const resolveRigorousRel = async (role: string, inviter: any, targetId: number) => {
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
        };

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
        const { data: userData, error: userError } = await supabase.from("users").upsert({
          phone_or_email: phone,
          password: hashedPassword,
          name,
          relationship: "我", // Terminology Fix
          family_id: inviter.family_id,
          member_id: data.id,
          avatar_url: avatarUrl // New Column
        }).select().single();

        if (userError) throw userError;

        // NEW: Persistence link
        if (userData) {
          await supabase.from("family_members").update({ user_id: userData.id }).eq("id", data.id);
        }

        // 6. Sync profile changes (especially avatar/name from registration) to past content
        await syncMemberContent(data.id, name, target.name, avatarUrl, "我");

        res.json({ success: true, memberId: data.id, familyId: inviter.family_id, userId: userData.id });
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
          // Fallback: lookup by invite_code (Legacy FA- format)
          const { data: legacyTarget } = await supabase.from("family_members").select("*").eq("invite_code", inviteCode).single();
          if (!legacyTarget) return res.status(400).json({ error: "邀请码无效或格式不匹配" });

          targetId = legacyTarget.id;
          // Find who created this profile
          const { data: creatorLink } = await supabase.from("archive_memory_creators").select("creator_member_id").eq("member_id", targetId).maybeSingle();
          inviterId = creatorLink ? creatorLink.creator_member_id : targetId;
        }

        // 1. Get inviter and target
        const { data: inviter } = await supabase.from("family_members").select("*").eq("id", inviterId).single();
        const { data: target } = await supabase.from("family_members").select("*").eq("id", targetId).single();

        if (!inviter || !target) return res.status(404).json({ error: "Invitation record not found" });

        // 2. Resolve Relationship
        const resolveRigorousRel = async (role: string, inviter: any, targetId: number) => {
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
        };

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

        // 5. Update the User record and sync profile back to the new family member
        const { data: userData } = await supabase.from("users").select("*").eq("phone_or_email", phone).single();
        if (userData) {
          // Sync global profile AND persistent link to the member record
          await supabase.from("family_members").update({
            name: userData.name || target.name,
            avatar_url: (userData as any).avatar_url || target.avatar_url,
            bio: (userData as any).bio || target.bio,
            birth_date: (userData as any).birth_date || target.birth_date,
            gender: (userData as any).gender || target.gender,
            user_id: userData.id // PERSISTENT LINK
          }).eq("id", target.id);

          await supabase.from("users").update({
            relationship: relationshipToInviter,
            family_id: inviter.family_id,
            member_id: data.id
          }).eq("id", userData.id);
        }

        res.json({ success: true, memberId: data.id, familyId: inviter.family_id, userId: userData?.id });
      } catch (err: any) {
        console.error("[ACCEPT-INVITE] Error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // Generic registration (creating new family)
    app.post("/api/register-new", async (req, res) => {
      if (!supabase) return res.status(500).json({ error: "服务器初始化失败：数据库未连接" });
      console.log("[REGISTER-NEW] Start registration for:", req.body.phone);
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
        const { data: userData, error: uError } = await supabase.from("users").upsert({
          phone_or_email: phone,
          password: hashedPassword,
          name,
          relationship: "我",
          member_id: member.id,
          family_id: family.id,
          avatar_url: avatar || ""
        }).select("id").single();

        if (uError) console.error("User info storage error (non-blocking):", uError.message);

        res.json({ success: true, memberId: member.id, familyId: family.id, userId: userData?.id });
      } catch (err: any) {
        console.error("[REGISTER] Error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // Secure Login Endpoint
    app.post("/api/login", async (req, res) => {
      if (!supabase) return res.status(500).json({ error: "服务器初始化失败：数据库未连接" });
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

        // 3. Find the associated family member record accurately by memberId link
        let member: any = null;
        if (user.member_id) {
          const { data: m, error: mError } = await supabase
            .from("family_members")
            .select("*")
            .eq("id", user.member_id)
            .single();
          member = m;

          // HEAL: If user is linked but persistent user_id is missing, fix it now
          if (member && !member.user_id) {
            await supabase.from("family_members").update({ user_id: user.id }).eq("id", member.id);
          }
        }

        // 4. 获取用户统计数据 (仅当有关联档案时)
        let memoriesCount = 0;
        let likesCount = 0;
        if (member) {
          const { count: mCount } = await supabase.from("messages").select("*", { count: 'exact', head: true }).eq("family_member_id", member.id);
          memoriesCount = mCount || 0;

          const { data: memberMessages } = await supabase.from("messages").select("id").eq("family_member_id", member.id);
          if (memberMessages?.length) {
            const msgIds = memberMessages.map(m => m.id);
            const { count: lCount } = await supabase.from("likes").select("*", { count: 'exact', head: true }).in("message_id", msgIds);
            likesCount = lCount || 0;
          }
        }

        const days = Math.max(1, Math.floor((Date.now() - new Date(user.created_at || Date.now()).getTime()) / 86400000));

        // 5. Return user info without password
        const safeUser = {
          id: user.id, // Primary ID
          name: member?.name || user.name || "家人",
          relationship: member?.relationship || user.relationship || "我",
          phone: user.phone_or_email,
          memberId: member?.id || null,
          familyId: member?.family_id || user.family_id || 1,
          avatar: member?.avatar_url || (user as any).avatar_url || "",
          bio: member?.bio || (user as any).bio || "",
          birthday: member?.birth_date || (user as any).birth_date || "",
          gender: member?.gender || (user as any).gender || "男",
          joinDate: user.created_at || new Date().toISOString(),
          stats: {
            memories: memoriesCount,
            likes: likesCount,
            days
          }
        };

        res.status(200).json({ user: safeUser });
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
        memberIds: e.member_ids, // Supabase JSONB maps directly to array
        customMemberName: e.custom_member_name
      }));

      try {
        const { data: members } = await supabase.from("family_members").select("*").eq("family_id", familyId);
        if (members) {
          const birthdayEvents = members.filter(m => m.birth_date).map(m => {
            const d = new Date(m.birth_date);
            const mm = (d.getMonth() + 1).toString().padStart(2, '0');
            const dd = d.getDate().toString().padStart(2, '0');
            // virtual ID starting from 100000 to avoid collision
            return {
              id: 100000 + m.id,
              title: `${m.name}的生日`,
              date: `${new Date().getFullYear()}-${mm}-${dd}`,
              type: 'person',
              isRecurring: true,
              memberId: m.id,
              customMemberName: m.name,
              location: '系统自动生成',
              notes: `大家快来为${m.name}送上生日祝福吧！`,
              created_at: new Date().toISOString()
            };
          });

          birthdayEvents.forEach(virtualEvent => {
            if (!events.some(e => e.title === virtualEvent.title)) {
              events.push(virtualEvent as any);
            }
          });
        }
      } catch (err) {
        console.error("[EVENTS] Error generating birthday events:", err);
      }

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
      const memberIds = req.body.memberIds || [];

      // NOTE: 先尝试含 member_ids 的插入，如失败则降级（兼容旧数据库结构）
      const insertPayload: any = {
        family_id,
        title,
        date,
        type,
        description,
        is_recurring: !!isRecurring,
        member_id: memberId,
        member_ids: memberIds,
        custom_member_name: customMemberName,
        location: location || "",
        notes: notes || ""
      };

      let { data, error } = await (supabase as any)
        .from("events")
        .insert(insertPayload)
        .select()
        .single();

      // 如果 member_ids 列不存在，降级重试（不带 member_ids）
      if (error && (error.message?.includes("member_ids") || error.code === "PGRST204" || error.code === "42703")) {
        console.warn("[EVENTS] member_ids column may not exist, retrying without it:", error.message);
        const fallbackPayload = { ...insertPayload };
        delete fallbackPayload.member_ids;
        const result = await (supabase as any).from("events").insert(fallbackPayload).select().single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("[EVENTS] Insert error:", error.message, JSON.stringify(error));
        return res.status(500).json({ error: error.message });
      }
      res.json({ id: data.id });
    });

    // 已合并到通用的 /api/messages 路由中，通过 query params 灵活过滤

    app.delete("/api/messages/:id", async (req, res) => {
      const { id } = req.params;
      const { error } = await supabase.from("messages").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    });

    app.get("/api/messages", async (req, res) => {
      // 通用留言查询：支持通过 eventId 或 memberId 过滤
      const { eventId, memberId } = req.query;

      console.log(`[API] Fetching messages for eventId: ${eventId}, memberId: ${memberId}`);

      let query = supabase.from("messages").select("*");

      if (eventId) {
        query = query.eq("event_id", Number(eventId));
      } else if (memberId) {
        // NOTE: 记忆档案的留言墙不与大事记共享。大事记的留言必定有 event_id，档案留言必定没有 event_id
        query = query.eq("family_member_id", Number(memberId)).is("event_id", null);
      }

      const { data: rawData, error } = await query
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("[API] Messages fetch error:", error.message);
        return res.status(500).json({ error: error.message });
      }

      // 精准同步：获取该家族所有成员名单及最新头像，强制纠偏旧数据
      const { data: familyMembers } = await supabase.from("family_members").select("id, name, avatar_url");
      const nameToIdMap: Record<string, number> = {};
      const nameToAvatarMap: Record<string, string> = {};
      familyMembers?.forEach(f => {
        nameToIdMap[f.name] = f.id;
        // IMPORTANT: Fingerprinting for names like "test_profile"
        const cleanKey = f.name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
        if (cleanKey) nameToIdMap[cleanKey] = f.id;

        if (f.avatar_url) {
          nameToAvatarMap[f.name] = f.avatar_url;
          nameToAvatarMap[String(f.id)] = f.avatar_url; // Direct ID index
          if (cleanKey) nameToAvatarMap[cleanKey] = f.avatar_url;
        }
      });

      const formatted = (rawData || []).map((m: any) => {
        // STRICT ID RESOLUTION: Link by ID only
        const authorId = m.event_id ? m.family_member_id : (m.author_id || null);
        const authorAvatar = authorId ? nameToAvatarMap[String(authorId)] : (m.author_avatar || m.authorAvatar);

        return {
          id: m.id,
          familyMemberId: m.family_member_id || m.familyMemberId,
          authorId,
          authorName: m.author_name || m.authorName || "家人",
          authorRole: m.author_role || m.authorRole || "家人",
          authorAvatar,
          content: m.content || "",
          type: m.type || "text",
          mediaUrl: m.media_url || m.mediaUrl,
          duration: m.duration,
          createdAt: m.created_at || m.createdAt,
          likes: m.likes || 0,
          likedBy: m.liked_by || [],
          eventId: m.event_id || m.eventId
        };
      });

      res.json(formatted);
    });

    app.post("/api/messages", async (req, res) => {
      const { familyMemberId, authorName, authorRole, authorAvatar, content, type, mediaUrl, duration, eventId } = req.body;
      try {
        // 1. Save the message
        const { data: message, error } = await supabase
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

        if (error) throw error;

        // 2. Logic for Triggering Notifications
        // Case A: Memory Archive Comment (familyMemberId provided)
        if (familyMemberId) {
          // Prevent notifying self
          const { data: currentMember } = await supabase.from("family_members").select("name").eq("id", familyMemberId).single();
          if (authorName !== currentMember?.name) {
            await supabase.from("notifications").insert({
              member_id: familyMemberId,
              title: "记忆档案有新留言",
              content: `${authorName} 在您的记忆档案中留言了：“${content.substring(0, 20)}${content.length > 20 ? '...' : ''}”`,
              type: "archive_comment",
              link_url: `/archive/${familyMemberId}`
            });
          }
        }

        // Case B: Event Comment (eventId provided)
        if (eventId) {
          const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
          if (event && event.member_id) {
            // Notify the person this event is about (e.g. Birthday boy/girl)
            const { data: targetMember } = await supabase.from("family_members").select("name").eq("id", event.member_id).single();
            if (authorName !== targetMember?.name) {
              await supabase.from("notifications").insert({
                member_id: event.member_id,
                title: "大事记新动态",
                content: `${authorName} 回应了关于您的事件【${event.title}】`,
                type: "event_comment",
                link_url: "/square"
              });
            }
          }
        }

        res.json({ id: message.id });
      } catch (err: any) {
        console.error("[MESSAGES] Post error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // --- NEW: Memories Endpoints (Archive Specific) ---
    app.get("/api/memories", async (req, res) => {
      try {
        const { memberId } = req.query;
        if (!memberId) return res.status(400).json({ error: "memberId is required" });

        const { data, error } = await supabase
          .from("memories")
          .select("*")
          .eq("member_id", Number(memberId))
          .order("created_at", { ascending: false });

        if (error) throw error;

        // 增强同步：从姓名和 ID 映射出作者最新资料，防止记忆中的数据过时
        const { data: familyMembers } = await supabase.from("family_members").select("id, name, avatar_url");
        const nameToIdMap: Record<string, number> = {};
        const nameToAvatarMap: Record<string, string> = {};
        familyMembers?.forEach(f => {
          nameToIdMap[f.name] = f.id;
          // IMPORTANT: Better finger-printing for names like "test_profile"
          const cleanKey = f.name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
          if (cleanKey) nameToIdMap[cleanKey] = f.id;

          if (f.avatar_url) {
            nameToAvatarMap[f.name] = f.avatar_url;
            nameToAvatarMap[String(f.id)] = f.avatar_url; // NEW: Map ID directly to avatar
            if (cleanKey) nameToAvatarMap[cleanKey] = f.avatar_url;
          }
        });

        const formatted = (data || []).map(m => {
          // STRICT ID RESOLUTION: Only link to latest profile if author_id is explicitly present
          const authorId = m.author_id || null;
          const authorAvatar = authorId ? nameToAvatarMap[String(authorId)] : m.author_avatar;

          return {
            id: m.id,
            familyMemberId: m.member_id,
            authorId,
            authorName: m.author_name,
            authorRole: m.author_relationship,
            authorAvatar,
            content: m.content,
            type: m.type,
            mediaUrl: m.media_url,
            duration: m.duration,
            likes: m.likes || 0,
            likedBy: m.liked_by || [],
            createdAt: m.created_at
          };
        });
        res.json(formatted);
      } catch (err: any) {
        console.error("[API] GET Memories error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/memories", async (req, res) => {
      try {
        console.log("[API] POST Memory Payload:", JSON.stringify(req.body).substring(0, 200));
        const { familyMemberId, authorId, authorName, authorRole, authorAvatar, content, type, mediaUrl, duration } = req.body;
        const { data, error } = await supabase
          .from("memories")
          .insert({
            member_id: familyMemberId,
            author_id: authorId,
            author_name: authorName,
            author_relationship: authorRole,
            author_avatar: authorAvatar,
            content,
            type,
            media_url: mediaUrl,
            duration
          })
          .select()
          .single();

        if (error) throw error;
        res.json({ id: data.id });
      } catch (err: any) {
        console.error("[API] POST Memories error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    app.delete("/api/memories/:id", async (req, res) => {
      try {
        const { error } = await supabase.from("memories").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ success: true });
      } catch (err: any) {
        console.error("[API] DELETE Memory error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/memories/:id/like", async (req, res) => {
      const { id } = req.params;
      const { senderId } = req.body;
      const { data: current } = await supabase.from("memories").select("*").eq("id", id).single();
      if (!current) return res.status(404).json({ error: "Memory not found" });

      const likedBy = current.liked_by || [];
      const alreadyLiked = likedBy.includes(String(senderId));
      const newLikedBy = alreadyLiked ? likedBy.filter((u: string) => u !== String(senderId)) : [...likedBy, String(senderId)];
      const newLikes = alreadyLiked ? Math.max(0, (current.likes || 0) - 1) : (current.likes || 0) + 1;

      const { data: updated, error } = await supabase
        .from("memories")
        .update({ likes: newLikes, liked_by: newLikedBy })
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true, likes: updated.likes, isLiked: !alreadyLiked });
    });

    // --- NEW: Stats Endpoint ---
    app.get("/api/stats/:memberId", async (req, res) => {
      const mid = Number(req.params.memberId);

      const [msgsRes, memsRes] = await Promise.all([
        supabase.from("messages").select("likes").eq("family_member_id", mid),
        supabase.from("memories").select("likes").eq("member_id", mid)
      ]);

      const msgLikes = (msgsRes.data || []).reduce((s, m) => s + (m.likes || 0), 0);
      const memLikes = (memsRes.data || []).reduce((s, m) => s + (m.likes || 0), 0);
      const msgCount = (msgsRes.data || []).length;
      const memCount = (memsRes.data || []).length;

      res.json({
        likes: msgLikes + memLikes,
        memories: msgCount + memCount
      });
    });

    app.post("/api/messages/:id/like", async (req, res) => {
      const { id } = req.params;
      const { senderName, senderAvatar, senderId } = req.body;

      const { data: current } = await supabase
        .from("messages")
        .select("likes, family_member_id, liked_by, event_id")
        .eq("id", id)
        .single();
      if (!current) return res.status(404).json({ error: "消息不存在" });

      const likedBy: string[] = current.liked_by || [];
      const userKey = senderId ? String(senderId) : (senderName || "匿名");
      const alreadyLiked = likedBy.includes(userKey);

      let newLikes: number;
      let newLikedBy: string[];

      if (alreadyLiked) {
        newLikes = Math.max(0, (current.likes || 0) - 1);
        newLikedBy = likedBy.filter(u => u !== userKey);
      } else {
        newLikes = (current.likes || 0) + 1;
        newLikedBy = [...likedBy, userKey];
      }

      const { data: updated, error } = await supabase
        .from("messages")
        .update({ likes: newLikes, liked_by: newLikedBy })
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });

      if (!alreadyLiked && current.family_member_id) {
        try {
          // NOTE: 点赞通知精准携带跳转地址：大事记留言跳祝福页并高亮留言，档案留言跳档案页
          const linkUrl = current.event_id
            ? `/blessing/${current.event_id}?highlightMsg=${id}`
            : `/archive/${current.family_member_id}?highlightMsg=${id}`;
          await supabase.from("notifications").insert({
            member_id: current.family_member_id,
            title: "有人给您点赞了",
            content: `${senderName || "有人"} 赞了您的${current.event_id ? '大事记留言' : '记忆档案留言'}`,
            type: "like",
            link_url: linkUrl
          });
        } catch (e) {
          console.error("[NOTIF] Failed to send like notification:", e);
        }
      }

      res.json({ success: true, likes: updated.likes, isLiked: !alreadyLiked });
    });

    // OTP Verification Logic
    app.post("/api/send-code", async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60000).toISOString(); // 5 minutes expiry

      if (!supabase) {
        return res.status(500).json({ error: "数据库服务未配置，请检查环境变量" });
      }

      const { error } = await supabase
        .from("otp_codes")
        .upsert({
          email,
          code,
          expires_at: expiresAt
        });

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
          console.log(`[AUTH] Resend email sent to ${email}`);
        } else {
          console.warn(`[AUTH] RESEND_API_KEY not found. Verification code for ${email}: ${code}`);
          return res.status(500).json({ error: "服务器未配置邮件服务，请联系管理员" });
        }

        res.json({ success: true, message: "验证码已发送至您的邮箱，请查收。" });
      } catch (emailError: any) {
        console.error("[AUTH] Error sending email via Resend:", emailError);
        res.status(500).json({ error: "发送验证码邮件失败，请稍后重试" });
      }
    });

    app.post("/api/reset-password", async (req, res) => {
      try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) {
          return res.status(400).json({ error: "邮箱、验证码和新密码均为必填" });
        }

        const { data: otpData, error: otpError } = await supabase
          .from("otp_codes")
          .select("*")
          .eq("email", email)
          .single();

        if (otpError || !otpData) return res.status(400).json({ error: "验证码无效或未发送" });
        if (otpData.code !== code) return res.status(400).json({ error: "验证码错误" });
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

    // Notifications Endpoints
    app.get("/api/notifications/:memberId", async (req, res) => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("member_id", req.params.memberId)
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    });

    app.put("/api/notifications/read-all/:memberId", async (req, res) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("member_id", req.params.memberId);

        if (error) throw error;
        res.json({ success: true });
      } catch (err: any) {
        console.error("[NOTIF] Read all error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/leave-family", async (req, res) => {
      try {
        let { userId, memberId } = req.body;

        // Enhanced: Resolve userId from memberId if missing (backward compatibility)
        if (!userId && memberId) {
          const { data: u } = await supabase.from("users").select("id").eq("member_id", memberId).maybeSingle();
          if (u) userId = u.id;
        }

        // 2. Fetch family context
        const { data: userData } = await supabase.from("users").select("family_id").eq("id", userId).maybeSingle();
        const familyToCleanup = userData?.family_id;

        // 3. Clear user's family links
        const { error: uError } = await supabase
          .from("users")
          .update({
            family_id: null,
            member_id: null,
            relationship: null
          })
          .eq("id", userId);

        if (uError) throw uError;

        // 4. Update member record to mark as unregistered but keep ownership for persistence
        if (memberId) {
          await supabase
            .from("family_members")
            .update({
              is_registered: false,
              invite_code: null,
              user_id: userId
            })
            .eq("id", memberId);
        }

        // 5. AUTO-CLEANUP: If family only had this user, delete the whole family
        if (familyToCleanup) {
          const { data: others } = await supabase
            .from("family_members")
            .select("id, user_id")
            .eq("family_id", familyToCleanup)
            .neq("user_id", userId);

          // Check for anyone else owning a record or registered in this family
          if (!others || others.length === 0) {
            console.log(`[CLEANUP] Deleting orphaned family ${familyToCleanup}`);
            await supabase.from("memories").delete().eq("member_id", memberId);
            await supabase.from("messages").delete().eq("family_member_id", memberId);
            await supabase.from("family_members").delete().eq("id", memberId);
            await supabase.from("families").delete().eq("id", familyToCleanup);
          }
        }

        // 6. ENFORCE PERSONAL HUB: If the user now has NO family_id in users table, they need back to their own.
        // Or if they just left, find if they have ANY other membership.
        const { data: currentAuth } = await supabase.from("users").select("name, family_id, member_id").eq("id", userId).single();
        if (!currentAuth.family_id) {
          // Find their own-named family or create one
          let { data: myOwn } = await supabase.from("family_members").select("id, family_id").eq("name", currentAuth.name).is("is_registered", true).limit(1).maybeSingle();

          if (!myOwn) {
            const { data: newF } = await supabase.from("families").insert({ name: `${currentAuth.name}的个人空间` }).select().single();
            const { data: newM } = await supabase.from("family_members").insert({
              family_id: newF.id,
              name: currentAuth.name,
              relationship: "我",
              is_registered: true,
              standard_role: "creator"
            }).select().single();
            myOwn = { id: newM.id, family_id: newF.id };
          }

          await supabase.from("users").update({
            family_id: myOwn.family_id,
            member_id: myOwn.id
          }).eq("id", userId);

          return res.json({
            success: true,
            message: "已成功退出家族。由于您当前没有其他家族，系统已为您恢复个人档案空间。",
            newFamilyId: myOwn.family_id,
            newMemberId: myOwn.id
          });
        }

        res.json({ success: true, message: "已成功退出家族。" });
      } catch (err: any) {
        console.error("[API] Leave family error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/users/claim-orphan", async (req, res) => {
      try {
        const { userId, name } = req.body;
        if (!userId || !name) return res.status(400).json({ error: "Missing userId or name" });

        // Try to find an UNCLAIMED member with EXACTLY the same name
        const { data: member, error } = await supabase
          .from("family_members")
          .select("id, family_id")
          .eq("name", name)
          .is("user_id", null)
          .maybeSingle();

        if (error) throw error;
        if (!member) return res.json({ success: false, message: "No orphan found" });

        // Bind them
        await supabase.from("users").update({ member_id: member.id, family_id: member.family_id }).eq("id", userId);
        await supabase.from("family_members").update({ user_id: userId, is_registered: true }).eq("id", member.id);

        // DATA PATCH: Backfill author_id for legacy orphaned memories in this archive
        // This ensures old 'test_profile' memories get the correct ID once claimed
        await supabase.from("memories")
          .update({ author_id: member.id })
          .eq("member_id", member.id)
          .eq("author_name", name)
          .is("author_id", null);

        res.json({ success: true, memberId: member.id });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get("/api/users/sync", async (req, res) => {
      try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json({ error: "Missing phone" });
        const { data, error } = await supabase.from("users").select("id").eq("phone_or_email", phone).single();
        if (error) throw error;
        res.json({ id: data.id });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/users/sync-profile", async (req, res) => {
      try {
        const { userId, name, bio, birthDate, avatarUrl, gender, memberId } = req.body;
        if (!userId) return res.status(400).json({ error: "Missing userId" });
        const numericUserId = parseInt(String(userId));

        // Only update 'name' in users table if name is provided
        if (name) {
          const { error } = await supabase.from("users").update({
            name
          }).eq("id", numericUserId);
          if (error) console.warn("User name update warning:", error.message);
        }

        // SYNC: Also update ALL family_member records that belong to this user
        const { data: syncedMembers } = await supabase.from("family_members").update({
          name: name || undefined,
          bio: bio || undefined,
          birth_date: birthDate || undefined,
          avatar_url: avatarUrl || undefined,
          gender: gender || undefined
        }).eq("user_id", numericUserId).select("id");

        // NEW: BEST-EFFORT SYNC BY NAME (For unlinked accounts like 'test_profile')
        // DETACHMENT LOGIC: If a user has no linked family members
        if ((!syncedMembers || syncedMembers.length === 0) && !memberId) {
          // Clear residual stale data in users table
          await supabase.from("users").update({
            member_id: null,
            family_id: null
          }).eq("id", numericUserId);
        } else if (syncedMembers && syncedMembers.length > 0) {
          // Proactively sync all linked archive records
          for (const m of syncedMembers) {
            await syncMemberContent(m.id, name, null, avatarUrl, null);
          }
        }

        // EXTRA FALLBACK: For manual sync (from Profile page Save)
        if (memberId) {
          await supabase.from("family_members").update({
            name: name || undefined,
            avatar_url: avatarUrl || undefined
          }).eq("id", memberId);
          await syncMemberContent(memberId, name, null, avatarUrl, null);
        }

        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get("/api/users/:id", async (req, res) => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, name, phone_or_email, family_id, member_id, created_at")
          .eq("id", req.params.id)
          .single();

        if (error) throw error;
        res.json(data);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });



    app.put("/api/notifications/:id/read", async (req, res) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", req.params.id);

        if (error) throw error;
        res.json({ success: true });
      } catch (err: any) {
        console.error("[NOTIF] Read single error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    return app;
  } catch (err: any) {
    console.error("[SERVER] Initialization crash:", err);
    throw err;
  }
}

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;
  createApp().then(app => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Supabase integrated.`);
    });
  }).catch(err => {
    console.error("Failed to start server locally:", err);
  });
}

export default createApp;
