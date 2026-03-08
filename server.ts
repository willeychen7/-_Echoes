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
          try {
            await supabase.rpc('exec_sql', {
              sql_query: `
              ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
              ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
              ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
              ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
            ` });
          } catch (err: any) {
            console.log("Users Migration check failed:", err.message);
          }

          // Add user_id and gender to family_members for persistent identity and rigorous relationships
          // Also add new columns for pets, clan ranking and generation tracking
          try {
            await supabase.rpc('exec_sql', {
              sql_query: `
              ALTER TABLE family_members ADD COLUMN IF NOT EXISTS user_id INTEGER;
              ALTER TABLE family_members ADD COLUMN IF NOT EXISTS gender TEXT;
              ALTER TABLE family_members ADD COLUMN IF NOT EXISTS member_type TEXT;
              ALTER TABLE family_members ADD COLUMN IF NOT EXISTS ancestral_hall TEXT;
              ALTER TABLE family_members ADD COLUMN IF NOT EXISTS generation_num INTEGER;
              ALTER TABLE family_members ADD COLUMN IF NOT EXISTS logic_tag TEXT;
            ` });
          } catch (err: any) {
            console.log("Members Migration check failed:", err.message);
          }
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
    const syncMemberContent = async (memberId: string | number, name: string, oldName: string | null, avatarUrl: string | null, relationship: string | null) => {
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

      // 核心增强：通过嵌入查询 (Embedded Select) 一次性抓取成员信息及对应的创建者 ID
      // 感谢 Supabase，这可以代替复杂的 SQL Join
      const { data, error } = await supabase
        .from("family_members")
        .select(`
          *,
          archive_memory_creators!member_id(creator_member_id)
        `)
        .eq("family_id", familyId)
        .order("id", { ascending: true });

      if (error) return res.status(500).json({ error: error.message });

      // 扁平化处理：将嵌套的 creator_member_id 拍平到一级字段 createdByMemberId
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
          memberType: m.member_type,
          logicTag: m.logic_tag,
          createdByMemberId: createdByMemberId || null,
          addedByMemberId: m.added_by_member_id || null,
          siblingOrder: m.sibling_order || null
        };
      });
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

    // 新增：手动修正关系称谓，帮助系统学习
    app.post("/api/family-members/:id/relationship", async (req, res) => {
      const { id } = req.params;
      const { relationship } = req.body;
      if (!relationship) return res.status(400).json({ error: "关系称谓不能为空" });

      // 学习逻辑：如果输入的是常用标准称呼，自动同步 standard_role
      const commonMappings: Record<string, string> = {
        "爸爸": "father", "父亲": "father", "爸": "father",
        "妈妈": "mother", "母亲": "mother", "妈": "mother",
        "儿子": "son", "女儿": "daughter",
        "哥哥": "brother", "弟弟": "brother", "兄": "brother", "弟": "brother",
        "姐姐": "sister", "妹妹": "sister", "姊": "sister", "妹": "sister",
        "老婆": "spouse", "老公": "spouse", "妻子": "spouse", "丈夫": "spouse", "爱人": "spouse",
        "爷爷": "grandfather", "外公": "grandfather", "姥爷": "grandfather",
        "奶奶": "grandmother", "外婆": "grandmother", "姥姥": "grandmother",
        "孙子": "grandson", "孙女": "granddaughter", "外孙": "grandson", "外孙女": "granddaughter",
        "舅舅": "uncle", "阿姨": "aunt", "叔叔": "uncle", "伯伯": "uncle", "姑姑": "aunt",
        "侄子": "nephew", "外甥": "nephew", "侄女": "niece", "外甥女": "niece",
        "舅妈": "aunt", "婶婶": "aunt", "伯母": "aunt", "姨妈": "aunt", "姑父": "uncle", "姨父": "uncle"
      };

      const updatePayload: any = { relationship };
      if (commonMappings[relationship]) {
        updatePayload.standard_role = commonMappings[relationship];
      }

      const { data, error } = await supabase
        .from("family_members")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
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
      const { name, relationship, avatarUrl, bio, birthDate, gender, ancestralHall, logicTag } = req.body;

      // 1. 先获取旧的名称，以便同步之前的留言
      const { data: oldMember } = await supabase
        .from("family_members")
        .select("name")
        .eq("id", req.params.id)
        .single();

      // 2. 更新成员表
      const updatePayload: any = {};
      if (name !== undefined) updatePayload.name = name;
      if (relationship !== undefined) updatePayload.relationship = relationship;
      if (avatarUrl !== undefined) updatePayload.avatar_url = avatarUrl;
      if (bio !== undefined) updatePayload.bio = bio;
      if (birthDate !== undefined) updatePayload.birth_date = (birthDate === "" ? null : birthDate);
      if (gender !== undefined) updatePayload.gender = gender;
      if (ancestralHall !== undefined) updatePayload.ancestral_hall = ancestralHall;
      if (logicTag !== undefined) updatePayload.logic_tag = logicTag;

      const { error } = await supabase
        .from("family_members")
        .update(updatePayload)
        .eq("id", req.params.id);

      if (error) {
        console.error("[API] PUT family-member error:", error.message);
        return res.status(500).json({ error: error.message });
      }

      // 3. 核心同步逻辑：更新关联的 users 表
      const userUpdate: any = { name, relationship };
      if (gender) userUpdate.gender = gender;
      if (bio) userUpdate.bio = bio;
      if (birthDate) userUpdate.birth_date = birthDate;
      if (avatarUrl) userUpdate.avatar_url = avatarUrl;
      await supabase.from("users").update(userUpdate).eq("member_id", req.params.id);

      // 4. 角色自动修正逻辑 (Gender-aware standard_role sync)
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

          // 如果性别与角色不匹配，尝试翻转
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
      if (!supabase) return res.status(500).json({ error: "服务器初始化失败：数据库未连接" });
      try {
        const { name, relationship, avatarUrl, bio, birthDate, standardRole, familyId, createdByMemberId, fatherId, ancestralHall, gender, memberType, generationNum, logicTag } = req.body;
        // NOTE: 不再生成旧的 FA- 格式邀请码
        // 邀请码统一使用前端动态生成的 INV-{targetId}-{inviterId} 格式

        console.log(`[API:MEMBER] Creating member: ${name} in family ${familyId}`);
        const { data: existing, error: existError } = await supabase
          .from("family_members")
          .select("id")
          .eq("name", name)
          .eq("family_id", familyId)
          .maybeSingle();

        if (existError) console.warn("[API:MEMBER] Existing check error:", existError.message);
        if (existing) {
          console.log(`[API:MEMBER] Existing member found: ${existing.id}`);
          return res.json({ id: existing.id, linked: true });
        }

        const insertPayload: any = {
          family_id: familyId,
          name,
          relationship,
          avatar_url: avatarUrl,
          bio,
          birth_date: birthDate || null,
          invite_code: null,
          is_registered: false,
          standard_role: standardRole || "",
          father_id: fatherId || null,
          ancestral_hall: ancestralHall || null,
          gender: gender || null,
          member_type: memberType || 'human',
          generation_num: generationNum || null,
          logic_tag: logicTag || null,
          origin_side: req.body.originSide || null,
          is_placeholder: req.body.is_placeholder || false,
          added_by_member_id: createdByMemberId || null,  // 记录是谁把此人加入家族的
          sibling_order: req.body.siblingOrder || null    // 家中排行
        };

        console.log("[API:MEMBER] Attempting primary insert...");
        let { data, error } = await supabase
          .from("family_members")
          .insert(insertPayload)
          .select()
          .single();

        // 核心兜底：如果某些新增加的列（如 member_type, ancestral_hall）在数据库中不存在，降级重试
        if (error && (error.message?.includes("column") || error.code === "PGRST204" || error.code === "42703")) {
          console.warn(`[MEMBER:FALLBACK] Column missing, retrying without problematic fields. Error: ${error.message}`);
          const fallbackPayload = { ...insertPayload };
          // 仅在明确报错缺失时才删除
          if (error.message.includes("member_type")) delete fallbackPayload.member_type;
          if (error.message.includes("ancestral_hall")) delete fallbackPayload.ancestral_hall;
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
          console.error("[API:MEMBER] Insert error:", error.message, error);
          return res.status(500).json({ error: error.message });
        }

        console.log(`[API:MEMBER] Successfully created member: ${data.id}`);

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

        res.json({ id: data.id, linked: false });
      } catch (err: any) {
        console.error("[MEMBER] POST error:", err.message);
        res.status(500).json({ error: err.message || "创建档案失败，请稍后重试" });
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
          inviterGender: inviter.gender,
          inviterAncestralHall: inviter.ancestral_hall,
          inviterGenerationNum: inviter.generation_num,
          inviterSiblingOrder: inviter.sibling_order,
          targetName: target.name,
          targetId: target.id,
          targetRole: target.relationship,
          targetStandardRole: target.standard_role,
          targetAvatar: target.avatar_url,
          targetAncestralHall: target.ancestral_hall,
          targetGenerationNum: target.generation_num,
          targetSiblingOrder: target.sibling_order,
          inviterFamilyId: inviter.family_id
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
              targetStandardRole: target.standard_role,
              targetAvatar: target.avatar_url,
              inviterFamilyId: inviter.family_id
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
          targetStandardRole: target.standard_role,
          inviterFamilyId: target.family_id // If self-claim, target's family is the inviter's family
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

    // --- Helper: Get Inverse Relationship Label ---
    const getInverseLabel = async (relText: string, targetGender: string) => {
      const g = (targetGender || 'male') === 'female' ? '女' : '男';
      // 增加更全面的反转映射
      const invMap: Record<string, string> = {
        "堂姐": g === '女' ? "堂妹" : "堂弟", "堂哥": g === '女' ? "堂妹" : "堂弟",
        "表姐": g === '女' ? "表妹" : "表弟", "表哥": g === '女' ? "表妹" : "表弟",
        "姐姐": g === '女' ? "妹妹" : "弟弟", "哥哥": g === '女' ? "妹妹" : "弟弟",
        "叔叔": g === '女' ? "侄女" : "侄子", "伯伯": g === '女' ? "侄女" : "侄子", "舅舅": g === '女' ? "外甥女" : "外甥", "姑姑": g === '女' ? "内侄女" : "内侄",
        "姨妈": g === '女' ? "姨甥女" : "姨甥", "儿子": g === '女' ? "母亲" : "父亲", "女儿": g === '女' ? "母亲" : "父亲"
      };
      return invMap[relText] || relText;
    };

    // --- Helper: Kinship Gender Guard ---
    const checkGenderConflict = (rel: string, gender: string) => {
      const femaleKeywords = ["姑", "姨", "妈", "娘", "奶", "婆", "姐", "妹", "嫂", "侄女", "外甥女", "媳", "婶", "妗", "姥", "女"];
      const maleKeywords = ["叔", "伯", "爸", "爹", "爷", "公", "哥", "弟", "婿", "夫", "男", "侄子", "外甥", "舅"];
      const isRelFemale = femaleKeywords.some(k => rel.includes(k));
      const isRelMale = maleKeywords.some(k => rel.includes(k));
      if (gender === 'male' && isRelFemale && !isRelMale) return true;
      if (gender === 'female' && isRelMale && !isRelFemale) return true;
      return false;
    };

    /**
     * --- 🚨 Helper: Recursive Family Unification (归宗引擎) ---
     * 当一个成员 ID 变更家族时，递归将其所有带入的人及其资产一并迁移
     */
    const syncFamilyRecursive = async (memberId: number, newFamilyId: number, visited = new Set<number>()) => {
      if (visited.has(memberId)) return;
      visited.add(memberId);

      console.log(`[SYNC-FAMILY] 正在将成员 ${memberId} 及其子树递归迁移至家族 ${newFamilyId}`);

      // 1. 更新成员自身的 family_id
      await supabase.from("family_members").update({ family_id: newFamilyId }).eq("id", memberId);

      // 2. 更新该成员名下的所有核心资产
      await supabase.from("memories").update({ family_id: newFamilyId }).eq("member_id", memberId);
      await supabase.from("messages").update({ family_id: newFamilyId }).eq("family_member_id", memberId);
      await supabase.from("events").update({ family_id: newFamilyId }).eq("member_id", memberId);

      // 2.5 核心补充：如果该档案已绑定真实用户，同步更新用户的 family_id 字段
      await supabase.from("users").update({ family_id: newFamilyId }).eq("member_id", memberId);

      // 3. 核心：递归寻找“我录入的人” (By added_by_member_id)
      const { data: children } = await supabase.from("family_members").select("id").eq("added_by_member_id", memberId);
      if (children && children.length > 0) {
        for (const child of children) {
          await syncFamilyRecursive(child.id, newFamilyId, visited);
        }
      }

      // 4. 补充：寻找通过 archive_memory_creators 建立的创建关系（防止旧数据断链）
      const { data: createdRefs } = await supabase.from("archive_memory_creators").select("member_id").eq("creator_member_id", memberId);
      if (createdRefs && createdRefs.length > 0) {
        for (const ref of createdRefs) {
          if (ref.member_id) await syncFamilyRecursive(ref.member_id, newFamilyId, visited);
        }
      }
    };

    // --- Helper: Rigorous Relationship Resolver ---
    const resolveRigorousRel = async (role: string, inviter: any, targetId: number, explicitGender?: "male" | "female" | null) => {
      let updateData: any = { id: targetId, gender: explicitGender || undefined };
      let invUpdate: any = { id: inviter.id };

      // Get target's current data for reconciliation
      const { data: targetRecord } = await supabase.from("family_members").select("*").eq("id", targetId).single();

      // 0. Robust Role Mapping (back-end fallback)
      let effectiveRole = role;
      if (effectiveRole === "other") {
        const r = targetRecord?.relationship || "";
        if (r.includes("堂") || r.includes("表")) effectiveRole = "cousin";
        else if (r.includes("侄") || r.includes("外甥")) effectiveRole = "nephew";
        else if (r.includes("叔") || r.includes("伯") || r.includes("舅") || r.includes("姨")) effectiveRole = "uncle";
      }

      // 1. Generation Deduction (forward & inverse)
      if (inviter.generation_num != null) {
        const g = Number(inviter.generation_num);
        if (["father", "mother", "uncle", "aunt"].includes(effectiveRole)) updateData.generation_num = g - 1;
        else if (["son", "daughter", "nephew", "niece"].includes(effectiveRole)) updateData.generation_num = g + 1;
        else if (["grandfather", "grandmother"].includes(effectiveRole)) updateData.generation_num = g - 2;
        else if (["grandson", "granddaughter"].includes(effectiveRole)) updateData.generation_num = g + 2;
        else if (["brother", "sister", "cousin", "spouse"].includes(effectiveRole)) updateData.generation_num = g;
      } else if (targetRecord?.generation_num != null) {
        // Inverse deduction: if inviter's gen is missing but target's is known
        const g = Number(targetRecord.generation_num);
        if (["father", "mother", "uncle", "aunt"].includes(effectiveRole)) invUpdate.generation_num = g + 1;
        else if (["son", "daughter", "nephew", "niece"].includes(effectiveRole)) invUpdate.generation_num = g - 1;
        else if (["grandfather", "grandmother"].includes(effectiveRole)) invUpdate.generation_num = g + 2;
        else if (["grandson", "granddaughter"].includes(effectiveRole)) invUpdate.generation_num = g - 2;
        else if (["brother", "sister", "cousin", "spouse"].includes(effectiveRole)) invUpdate.generation_num = g;
      }

      // 2. Ancestral Hall (Paternal Branch) Propagation
      if (inviter.ancestral_hall && !targetRecord?.ancestral_hall) {
        if (["father", "son", "brother", "grandfather", "grandson", "uncle", "nephew", "cousin"].includes(effectiveRole)) {
          updateData.ancestral_hall = inviter.ancestral_hall;
        }
      }

      // 3. Biological Linkage Implementation
      const ensureParent = async (memberId: number, gen: 'male' | 'female') => {
        const { data: m } = await supabase.from("family_members").select("*").eq("id", memberId).single();
        let pId = gen === 'male' ? m.father_id : m.mother_id;
        if (!pId) {
          const { data: nP } = await supabase.from("family_members").insert({
            family_id: m.family_id,
            name: `${m.name}的${gen === 'male' ? '父亲' : '母亲'}`,
            gender: gen,
            is_registered: false,
            member_type: 'virtual'
          }).select().single();
          if (nP) pId = nP.id;
        }
        return pId;
      };

      const ensureSiblingParents = async (memberId: number) => {
        const fId = await ensureParent(memberId, 'male');
        const mId = await ensureParent(memberId, 'female');
        return { fId, mId };
      };

      if (effectiveRole === "father") {
        invUpdate.father_id = targetId;
        updateData.gender = "male";
      } else if (effectiveRole === "mother") {
        invUpdate.mother_id = targetId;
        updateData.gender = "female";
      } else if (effectiveRole === "son" || effectiveRole === "daughter") {
        updateData.gender = effectiveRole === "son" ? "male" : "female";
        if (inviter.gender === "female") updateData.mother_id = inviter.id;
        else updateData.father_id = inviter.id;
      } else if (effectiveRole === "brother" || effectiveRole === "sister") {
        const { fId, mId } = await ensureSiblingParents(inviter.id);
        updateData.father_id = fId;
        updateData.mother_id = mId;
        updateData.gender = effectiveRole === "brother" ? "male" : "female";
      } else if (effectiveRole === "spouse") {
        updateData.spouse_id = inviter.id;
        invUpdate.spouse_id = targetId;
        updateData.gender = inviter.gender === "male" ? "female" : "male";
      } else if (effectiveRole === "grandfather" || effectiveRole === "grandmother") {
        const pId = await ensureParent(inviter.id, 'male');
        if (pId) {
          if (effectiveRole === "grandfather") await supabase.from("family_members").update({ father_id: targetId }).eq("id", pId);
          else await supabase.from("family_members").update({ mother_id: targetId }).eq("id", pId);
        }
        updateData.gender = effectiveRole === "grandfather" ? "male" : "female";
      } else if (effectiveRole === "grandson" || effectiveRole === "granddaughter") {
        const { data: child } = await supabase.from("family_members").insert({
          family_id: inviter.family_id,
          name: `${inviter.name}的孩子`,
          is_registered: false,
          member_type: 'virtual',
          [inviter.gender === 'female' ? 'mother_id' : 'father_id']: inviter.id
        }).select().single();
        if (child) updateData[inviter.gender === 'female' ? 'mother_id' : 'father_id'] = child.id;
        updateData.gender = effectiveRole === "grandson" ? "male" : "female";
      } else if (effectiveRole === "uncle" || effectiveRole === "aunt") {
        const parentId = await ensureParent(inviter.id, 'male');
        if (parentId) {
          const { fId, mId } = await ensureSiblingParents(parentId);
          updateData.father_id = fId;
          updateData.mother_id = mId;
        }
        updateData.gender = effectiveRole === "uncle" ? "male" : "female";
      } else if (effectiveRole === "nephew" || effectiveRole === "niece") {
        const gps = await ensureSiblingParents(inviter.id);
        const { data: sib } = await supabase.from("family_members").insert({
          family_id: inviter.family_id,
          name: `${inviter.name}的兄弟姐妹`,
          is_registered: false,
          member_type: 'virtual',
          father_id: gps.fId,
          mother_id: gps.mId
        }).select().single();
        if (sib) updateData[inviter.gender === 'male' ? 'father_id' : 'mother_id'] = sib.id;
        updateData.gender = effectiveRole === "nephew" ? "male" : "female";
      } else if (effectiveRole === "cousin") {
        const pId = await ensureParent(inviter.id, 'male');
        if (pId) {
          // 同步父亲的代数和房分
          await supabase.from("family_members").update({
            ancestral_hall: inviter.ancestral_hall,
            generation_num: inviter.generation_num ? inviter.generation_num - 1 : null
          }).eq("id", pId);

          const gpId = await ensureParent(pId, 'male');
          if (gpId) {
            const { data: vSib } = await supabase.from("family_members").insert({
              family_id: inviter.family_id,
              name: `${inviter.ancestral_hall || ''}的伯叔辈`,
              is_registered: false,
              member_type: 'virtual',
              father_id: gpId,
              generation_num: inviter.generation_num ? inviter.generation_num - 1 : null,
              ancestral_hall: inviter.ancestral_hall // 保持同宗房分
            }).select().single();
            if (vSib) updateData.father_id = vSib.id;
          }
        }
      }

      // 4. Logic Tag Generation (Absolute Coordinate for UI)
      if (updateData.generation_num != null || updateData.ancestral_hall) {
        updateData.logic_tag = `G${updateData.generation_num || '?'}-H${updateData.ancestral_hall || '?'}`;
      }

      return { updateData, invUpdate };
    };

    app.post("/api/register-claim", async (req, res) => {
      try {
        const { inviteCode, name, avatarUrl, relationshipToInviter, standardRole, phone, password, birthDate, gender, inviterAncestralHall, inviterGenerationNum } = req.body;
        if (!inviteCode || !name || !phone || !password) {
          console.error("[CLAIM:ERROR] Missing fields:", { inviteCode: !!inviteCode, name: !!name, phone: !!phone, password: !!password });
          return res.status(400).json({ error: "Required fields missing (name, phone, password)" });
        }

        if (gender && checkGenderConflict(relationshipToInviter, gender)) {
          return res.status(400).json({ error: `礼法冲突：身份“${relationshipToInviter}”与选定性别不符。` });
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

        let invUpdate: any = { id: inviter.id };
        // 1.9 Synchronize potential inviter info provided by claiming user
        if (inviterAncestralHall && !inviter.ancestral_hall) {
          inviter.ancestral_hall = inviterAncestralHall;
          invUpdate.ancestral_hall = inviterAncestralHall;
        }
        if (inviterGenerationNum && !inviter.generation_num) {
          inviter.generation_num = inviterGenerationNum;
          invUpdate.generation_num = inviterGenerationNum;
        }

        // 2. Perform rigorous relationship calculation & data update
        const { updateData, invUpdate: derivedInvUpdate } = await resolveRigorousRel(standardRole, inviter, target.id);

        // Merge derived updates into our final invUpdate
        invUpdate = { ...invUpdate, ...derivedInvUpdate };

        // Merge additional fields
        const finalTargetData = {
          ...updateData,
          is_registered: true,
          name,
          avatar_url: avatarUrl,
          relationship: await getInverseLabel(relationshipToInviter, gender),
          birth_date: birthDate || null,
          gender: gender || null
        };

        // 3. Update target member
        const { data, error } = await supabase.from("family_members").update(finalTargetData).eq("id", target.id).select().single();
        if (error) throw error;

        // 4. Update inviter if needed
        if (Object.keys(invUpdate).length > 1) {
          const { id, ...rest } = invUpdate;
          await supabase.from("family_members").update(rest).eq("id", id);
        }

        // 5. Create or retrieve user account (safe upsert)
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // 先查询是否已存在该 phone 账号
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("phone_or_email", phone)
          .maybeSingle();

        let userData: any;
        if (existingUser) {
          // 已存在账号 -> 仅更新相关字段（不覆盖密码以免误伤）
          console.log("[CLAIM] Existing user found, updating:", existingUser.id);
          const { data: updated, error: updateErr } = await supabase
            .from("users")
            .update({
              name,
              relationship: "我",
              family_id: inviter.family_id,
              member_id: data.id,
              avatar_url: avatarUrl || undefined
            })
            .eq("id", existingUser.id)
            .select()
            .single();
          if (updateErr) throw updateErr;
          userData = updated;
        } else {
          // 全新账号 -> insert
          console.log("[CLAIM] Creating new user for phone:", phone);
          const { data: created, error: insertErr } = await supabase
            .from("users")
            .insert({
              phone_or_email: phone,
              password: hashedPassword,
              name,
              relationship: "我",
              family_id: inviter.family_id,
              member_id: data.id,
              avatar_url: avatarUrl || ""
            })
            .select()
            .single();
          if (insertErr) throw insertErr;
          userData = created;
        }

        // 5. Persistence link & Recursive Sync (归宗)
        // 5. Persistence link
        if (userData) {
          await supabase.from("family_members").update({ user_id: userData.id }).eq("id", targetId);
        }

        // 5. Recursive Sync (归宗)
        // 确保认领者带入的所有子树和资产全量同步到新家族
        await syncFamilyRecursive(data.id, inviter.family_id);

        // 6. Final Logic Check
        await syncMemberContent(data.id, name, target.name, avatarUrl, "我");

        console.log("[CLAIM] Success:", { memberId: data.id, familyId: inviter.family_id, userId: userData?.id });
        res.json({ success: true, memberId: data.id, familyId: inviter.family_id, userId: userData?.id });
      } catch (err: any) {
        console.error("[CLAIM] Error:", err.message, err);
        res.status(500).json({ error: err.message });
      }
    });

    // 预检：先查询用户当前家族情况，为迁移对话框提供数据
    app.get("/api/check-migration", async (req, res) => {
      // NOTE: 优先使用 userId（UUID）进行身份识别，比手机号更安全，避免 phone 字段丢失
      const userId = req.query.userId as string;
      const phone = req.query.phone as string; // 向下兼容旧调用
      const targetFamilyId = parseInt(req.query.targetFamilyId as string);
      if ((!userId && !phone) || !targetFamilyId) return res.status(400).json({ error: "Missing params" });

      try {
        // 优先用 UUID 查询，降级到 phone
        const query = userId
          ? supabase.from("users").select("id, name, family_id, member_id").eq("id", userId).maybeSingle()
          : supabase.from("users").select("id, name, family_id, member_id").eq("phone_or_email", phone).maybeSingle();
        const { data: currentUser } = await query;

        if (!currentUser || !currentUser.family_id) {
          return res.json({ needsMigration: false });
        }
        if (currentUser.family_id === targetFamilyId) {
          return res.json({ needsMigration: false });
        }

        // 家族1里共有多少成员？多少是真实注册用户？
        const { data: allMembers } = await supabase.from("family_members")
          .select("id, name, is_registered, user_id").eq("family_id", currentUser.family_id);

        const totalMembers = allMembers?.length || 0;
        const registeredOthers = (allMembers || []).filter(
          (m: any) => m.is_registered && m.user_id && m.user_id !== currentUser.id
        ).length;

        // 用户自己的内容量：记忆、留言
        const { count: memoryCount } = await supabase.from("memories")
          .select("id", { count: "exact", head: true })
          .eq("member_id", currentUser.member_id);
        const { count: messageCount } = await supabase.from("messages")
          .select("id", { count: "exact", head: true })
          .eq("family_member_id", currentUser.member_id);

        const willFamilyBeDeleted = registeredOthers === 0; // 走后家族1将无真实用户

        res.json({
          needsMigration: true,
          currentFamilyId: currentUser.family_id,
          totalMembers,
          registeredOthers,
          willFamilyBeDeleted,
          contentCount: (memoryCount || 0) + (messageCount || 0)
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/accept-invite", async (req, res) => {
      try {
        // NOTE: 优先使用 userId（UUID）识别用户，不再依赖容易丢失的 phone 字段
        const { userId, phone, inviteCode, relationshipToInviter, standardRole, name, avatarUrl, mode, targetSiblingOrder, inviterAncestralHall, inviterGenerationNum, birthDate, gender } = req.body;
        // mode: "migrate" 迁移内容 | "clear" 清空内容 | "direct" 默认直接加入
        let effectiveMode: string = mode || "direct";
        if ((!userId && !phone) || !inviteCode) {
          console.error("[ACCEPT:ERROR] Missing fields:", { userId: !!userId, phone: !!phone, inviteCode: !!inviteCode });
          return res.status(400).json({ error: "Required fields missing" });
        }

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
        let { updateData, invUpdate } = await resolveRigorousRel(standardRole, inviter, target.id);

        // 1.5 IDENTITY GUARD & DATA MIGRATION
        // NOTE: 优先用 userId（UUID）查询，不再依赖 phone——UUID 是最稳定的用户唯一标识
        const userQuery = userId
          ? supabase.from("users").select("id, name, avatar_url, family_id, member_id").eq("id", userId).maybeSingle()
          : supabase.from("users").select("id, name, avatar_url, family_id, member_id").eq("phone_or_email", phone).maybeSingle();
        const { data: currentUser, error: userErr } = await userQuery;
        if (userErr) console.error("[ACCEPT-INVITE] fetch user error:", userErr);
        if (!currentUser) throw new Error("用户未在系统注册（userId: " + userId + "，phone: " + phone + "）");

        // SECURITY: Check if the profile (target.id) is already "owned" by someone else
        if (target.user_id && target.user_id !== currentUser.id) {
          return res.status(403).json({
            error: "身份不匹配：该档案曾属于另一位用户，您无法认领此档案。",
            code: "IDENTITY_MISMATCH"
          });
        }

        // HANDLE: 如果用户已有家族（不是目标家族），根据 mode 参数决定策略
        if (currentUser.family_id && currentUser.family_id !== inviter.family_id) {
          // 查询旧家族成员情况
          const { data: oldMembers } = await supabase
            .from("family_members")
            .select("id, name, is_registered, user_id")
            .eq("family_id", currentUser.family_id);

          const registeredOthers = (oldMembers || []).filter(
            (m: any) => m.is_registered && m.user_id && m.user_id !== currentUser.id
          ).length;

          if (!mode || mode === "direct") {
            // 没有指定 mode，说明前端没有检查迁移情况，返回需要确认的状态
            if (registeredOthers > 0) {
              return res.status(409).json({
                error: `您已经属于另一个有 ${registeredOthers} 位注册用户的家族，无法直接切换。`,
                code: "ALREADY_IN_FAMILY"
              });
            }
            // 没有其他注册用户，可以直接切换（清理空家族）
            effectiveMode = "clear";
          }

          if (effectiveMode === "migrate") {
            // 迁移模式：把旧家族里用户自己的内容重定向到新 member 档案
            const oldMemberId = currentUser.member_id;
            if (oldMemberId) {
              // 迁移元数据：将旧档案的辈分、房分、性别等带入新档案，以触发更精准的关系推导
              const { data: oldMember } = await supabase.from("family_members").select("generation_num, ancestral_hall, gender, birth_date, bio").eq("id", oldMemberId).single();
              if (oldMember) {
                const updateBag: any = {};
                if (oldMember.generation_num && !target.generation_num) updateBag.generation_num = oldMember.generation_num;
                if (oldMember.ancestral_hall && !target.ancestral_hall) updateBag.ancestral_hall = oldMember.ancestral_hall;
                if (oldMember.birth_date && !target.birth_date) updateBag.birth_date = oldMember.birth_date;
                if (oldMember.gender && !target.gender) updateBag.gender = oldMember.gender;
                if (oldMember.bio && !target.bio) updateBag.bio = oldMember.bio;

                if (Object.keys(updateBag).length > 0) {
                  await supabase.from("family_members").update(updateBag).eq("id", target.id);
                  // 同步更新本地 target 对象，供 resolveRigorousRel 实时推导
                  Object.assign(target, updateBag);
                }
              }

              await supabase.from("memories").update({ member_id: target.id }).eq("member_id", oldMemberId);
              await supabase.from("memories").update({ author_id: target.id }).eq("author_id", oldMemberId);
              await supabase.from("messages").update({ family_member_id: target.id }).eq("family_member_id", oldMemberId);
              await supabase.from("notifications").update({ member_id: target.id }).eq("member_id", oldMemberId);
              await supabase.from("archive_memory_creators").update({ member_id: target.id }).eq("member_id", oldMemberId);
              await supabase.from("archive_memory_creators").update({ creator_member_id: target.id }).eq("creator_member_id", oldMemberId);

              // 迁移用户在这个小家族里辛辛苦苦创建的其他未注册亲戚（把他们的 family_id 指向新家族）
              await supabase.from("family_members")
                .update({ family_id: inviter.family_id })
                .eq("family_id", currentUser.family_id)
                .neq("id", oldMemberId);

              // 同理，同步转移用户在原家族里发的大事记
              await supabase.from("events")
                .update({ family_id: inviter.family_id })
                .eq("family_id", currentUser.family_id);

              // 如果这些未注册亲戚把旧用户设为了父母/配偶等，也要同步把相对关系转给新的用户档案
              await supabase.from("family_members").update({ father_id: target.id }).eq("father_id", oldMemberId);
              await supabase.from("family_members").update({ mother_id: target.id }).eq("mother_id", oldMemberId);
              await supabase.from("family_members").update({ spouse_id: target.id }).eq("spouse_id", oldMemberId);
              await supabase.from("family_members").update({ added_by_member_id: target.id }).eq("added_by_member_id", oldMemberId);
            }
          }

          if (effectiveMode === "clear") {
            // 清空模式：删除旧家族里用户自己的内容
            const oldMemberId = currentUser.member_id;
            if (oldMemberId) {
              console.log(`[ACCEPT-INVITE:CLEAR] Deleting content of old member ${oldMemberId}`);
              await supabase.from("memories").delete().eq("member_id", oldMemberId);
              await supabase.from("messages").delete().eq("family_member_id", oldMemberId);
              await supabase.from("notifications").delete().eq("member_id", oldMemberId);
              await supabase.from("archive_memory_creators").delete().eq("member_id", oldMemberId);
            }
          }

          // 如果旧家族没有其他注册用户，删除旧家族和旧成员档案
          if (registeredOthers === 0) {
            console.log(`[ACCEPT-INVITE] Cleaning up old solo family ${currentUser.family_id}`);
            if (currentUser.member_id) {
              await supabase.from("family_members").delete().eq("id", currentUser.member_id);
            }
            await supabase.from("families").delete().eq("id", currentUser.family_id);
          }

          // === 房分对齐（Branch Reconcile）===
          // 迁移后，被带来的成员（如堂哥）的 father_id 仍指向旧家族的虚拟父节点。
          // 通过 ancestral_hall + generation_num，将虚拟节点与主家族里对应的真实成员对齐。
          // 例如：堂哥.father_id → 虚拟"大房"节点 → 识别并对齐为 大伯（主家族里的真实大房成员）
          const reconcileByBranch = async (familyId: number) => {
            try {
              const { data: allMembers } = await supabase
                .from("family_members")
                .select("id, name, ancestral_hall, generation_num, is_placeholder, member_type, father_id, mother_id, is_registered")
                .eq("family_id", familyId);
              if (!allMembers || allMembers.length === 0) return;

              // 虚拟占位节点 = 迁移过来的旧家族的虚拟父级，需要被真实节点替代
              const virtualNodes = allMembers.filter((m: any) =>
                (m.is_placeholder || m.member_type === 'virtual') && m.ancestral_hall
              );
              // 真实成员 = 正式录入的、已注册的，或明确有代数信息的成员
              const realNodes = allMembers.filter((m: any) =>
                !m.is_placeholder && m.member_type !== 'virtual' && m.ancestral_hall
              );

              for (const vNode of virtualNodes) {
                const hall = vNode.ancestral_hall;
                const gen = vNode.generation_num;
                const role = vNode.standard_role;

                // 查找候选：
                // 1. 如果有房分，按房号+代数+排行精准找 (最稳固)
                // 2. 如果没房分但有 standard_role（如爷爷/奶奶），按角色+代数找 (祖辈/直系)
                const matches = realNodes.filter((r: any) => {
                  if (hall && r.ancestral_hall === hall) {
                    const genMatch = (gen == null || r.generation_num == null || Number(r.generation_num) === Number(gen));
                    const rankMatch = (vNode.sibling_order == null || r.sibling_order == null || Number(r.sibling_order) === Number(vNode.sibling_order));
                    return genMatch && rankMatch;
                  }
                  // 针对祖辈：如果没有房分，但在同代中有唯一的角色匹配（如爷爷）
                  if (!hall && role && r.standard_role === role) {
                    return (gen == null || r.generation_num == null || Number(r.generation_num) === Number(gen));
                  }
                  return false;
                });

                // 姻亲关键词扩展：涵盖父系、母系、及长辈配偶
                const affinalKeywords = ['妻', '婶', '伯母', '嫂', '配偶', 'wife', '婆', '妈', '娘', '公', '奶', '舅妈', '姨丈'];
                const bloodMatches = matches.filter((r: any) => {
                  const rel = (r.relationship || '').toLowerCase();
                  return !affinalKeywords.some(k => rel.includes(k));
                });
                const finalMatches = bloodMatches.length > 0 ? bloodMatches : matches;

                if (finalMatches.length === 1) {
                  const realNode = finalMatches[0];
                  console.log(`[RECONCILE] 虚拟节点 ${vNode.id}（${vNode.name}/${hall}）→ 对齐到真实节点 ${realNode.id}（${realNode.name}）`);

                  // 把所有把 vNode 当爸/妈的成员，改指向 realNode
                  await supabase.from("family_members").update({ father_id: realNode.id }).eq("father_id", vNode.id);
                  await supabase.from("family_members").update({ mother_id: realNode.id }).eq("mother_id", vNode.id);

                  // === 核心增强：配偶/姻亲对齐 ===
                  // 如果 vNode 本身是一个代表姻亲的对象（如 B 录的大伯母镜像），尝试与真实的血亲（A 录的大伯）连线
                  const vRel = (vNode.relationship || '').toLowerCase();
                  const isVNodeAffinal = affinalKeywords.some(k => vRel.includes(k));

                  if (isVNodeAffinal) {
                    // vNode（迁移来的伯母虚拟镜像）指向 realNode（主家真实大伯）为配偶
                    // 在真实场景中，我们直接更新迁移过来的、基于 vNode 关系的成员
                    await supabase.from("family_members").update({ spouse_id: realNode.id }).eq("spouse_id", vNode.id);
                  }

                  // 删除虚拟节点
                  await supabase.from("family_members").delete().eq("id", vNode.id);
                } else if (finalMatches.length > 1) {
                  console.log(`[RECONCILE] 虚拟节点 ${vNode.id}（${hall}）去姻亲后仍有多个候选（${finalMatches.map((m: any) => m.name).join('，')}），跳过自动合并，需人工确认`);
                }
                // finalMatches.length === 0 → 没有对应真实节点，保留虚拟节点
              }
            } catch (err: any) {
              console.warn("[RECONCILE] 房分对齐出错（非致命）:", err.message);
            }
          };
          await reconcileByBranch(inviter.family_id);
        }

        // MIGRATION: Check if THIS user had a DIFFERENT legacy record (ID 123) in this family
        const { data: legacyRecord } = await supabase
          .from("family_members")
          .select("id")
          .eq("family_id", inviter.family_id)
          .eq("user_id", currentUser.id)
          .neq("id", target.id) // Must be a different record
          .maybeSingle();

        if (legacyRecord) {
          console.log(`[MIGRATION] Transferring all assets from OLD ID ${legacyRecord.id} to NEW ID ${target.id}`);

          // 1. Move memories (as owner and author)
          await supabase.from("memories").update({ member_id: target.id }).eq("member_id", legacyRecord.id);
          await supabase.from("memories").update({ author_id: target.id }).eq("author_id", legacyRecord.id);

          // 2. Move messages
          await supabase.from("messages").update({ family_member_id: target.id }).eq("family_member_id", legacyRecord.id);

          // 3. Move notifications
          await supabase.from("notifications").update({ member_id: target.id }).eq("member_id", legacyRecord.id);

          // 4. Move ownership records
          await supabase.from("archive_memory_creators").update({ member_id: target.id }).eq("member_id", legacyRecord.id);
          await supabase.from("archive_memory_creators").update({ creator_member_id: target.id }).eq("creator_member_id", legacyRecord.id);

          // 5. Move Events Participation
          await supabase.from("events").update({ member_id: target.id }).eq("member_id", legacyRecord.id);

          // 6. KINSHIP REPAIR: If anyone had legacyRecord as their relative, update to target.id
          await supabase.from("family_members").update({ father_id: target.id }).eq("father_id", legacyRecord.id);
          await supabase.from("family_members").update({ mother_id: target.id }).eq("mother_id", legacyRecord.id);
          await supabase.from("family_members").update({ spouse_id: target.id }).eq("spouse_id", legacyRecord.id);

          // FINALLY: Delete the legacy skeleton record (ID 123 is now fully drained of value)
          await supabase.from("family_members").delete().eq("id", legacyRecord.id);
        }

        const finalTargetId = target.id;
        const finalGender = gender || target.gender;

        // --- Kinship Firewall: Gender consistency check ---
        if (finalGender && checkGenderConflict(relationshipToInviter, finalGender)) {
          return res.status(400).json({ error: `礼法冲突：身份“${relationshipToInviter}”与系统记录的性别不符。` });
        }

        // 1.9 Pre-sync inviter info from request to influence final resolution
        if (inviterAncestralHall && !inviter.ancestral_hall) {
          inviter.ancestral_hall = inviterAncestralHall;
          invUpdate.ancestral_hall = inviterAncestralHall;
        }
        if (inviterGenerationNum && !inviter.generation_num) {
          inviter.generation_num = inviterGenerationNum;
          invUpdate.generation_num = inviterGenerationNum;
        }

        // 2. Perform rigorous relationship calculation
        const resolved = await resolveRigorousRel(standardRole, inviter, finalTargetId);
        updateData = resolved.updateData;
        // Merge derived invUpdate from resolver
        invUpdate = { ...invUpdate, ...resolved.invUpdate };

        const finalTargetData: any = {
          ...updateData,
          is_registered: true,
          user_id: currentUser.id,
          relationship: await getInverseLabel(relationshipToInviter, updateData.gender || target.gender) // 关键：反转称谓视角，存入受邀者档案
        };
        // 核心逻辑：如果前端传了确认/修改后的姓名和头像，优先使用；否则保留用户当前资料
        finalTargetData.name = name || currentUser.name || target.name;
        finalTargetData.avatar_url = avatarUrl || currentUser.avatar_url || target.avatar_url;
        finalTargetData.birth_date = birthDate || null;

        // 3. Update active family member (ID 456)
        if (targetSiblingOrder != null) {
          finalTargetData.sibling_order = targetSiblingOrder;
        }

        const { data: finalMember, error: mErr } = await supabase.from("family_members").update(finalTargetData).eq("id", finalTargetId).select().single();
        if (mErr) throw mErr;

        // 4. Update inviter back-link
        if ((inviterAncestralHall && !inviter.ancestral_hall) || (inviterGenerationNum && !inviter.generation_num)) {
          if (inviterAncestralHall && !inviter.ancestral_hall) invUpdate.ancestral_hall = inviterAncestralHall;
          if (inviterGenerationNum && !inviter.generation_num) invUpdate.generation_num = inviterGenerationNum;
          // Only guard ancestral_hall in self-update loop, but allow properties set by user
          if (inviter.id === target.id && !inviterAncestralHall) delete invUpdate.ancestral_hall;

          // === 核心新增：发送协作确认通知给邀请人 ===
          try {
            const relMap: any = { "大伯": "大房", "二伯": "二房", "三伯": "三房", "爸爸": "同房" };
            // 找到 B 对 A 父亲的原始称呼（逆推）
            const elderRelName = Object.keys(relMap).find(key => relMap[key] === inviterAncestralHall) || "长辈";

            await supabase.from("notifications").insert({
              member_id: inviter.id,
              sender_name: name || target.name,
              sender_avatar: avatarUrl || target.avatar_url,
              type: "identity_update",
              content: `已根据受邀者的反馈，协助补全了您的支脉信息（${inviterAncestralHall || ''} 第${inviterGenerationNum || ''}代），这有助于完善家族树排位。若不准请点击修正。`,
              link_url: "/profile",
              is_read: false
            });
          } catch (notifErr) {
            console.error("[ACCEPT-INVITE] Failed to send id-update notif:", notifErr);
          }
        }

        if (Object.keys(invUpdate).length > 1) {
          const { id, ...rest } = invUpdate;
          await supabase.from("family_members").update(rest).eq("id", id);
        }

        // 5. Update the User record and synchronize
        await supabase.from("users").update({
          relationship: relationshipToInviter,
          family_id: inviter.family_id,
          member_id: finalMember.id,
          name: finalTargetData.name,
          avatar_url: finalTargetData.avatar_url
        }).eq("id", currentUser.id);

        // 6. Recursive Sync (归宗)
        // 确保受邀者带入的所有子树和资产递归搬迁到大家族
        await syncFamilyRecursive(finalMember.id, inviter.family_id);

        res.json({ success: true, memberId: finalMember.id, familyId: inviter.family_id, userId: currentUser.id });
      } catch (err: any) {
        console.error("[ACCEPT-INVITE] Error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // Generic registration (creates family for standalone user)
    app.post("/api/register-new", async (req, res) => {
      if (!supabase) return res.status(500).json({ error: "服务器初始化失败：数据库未连接" });
      console.log("[REGISTER-NEW] Start registration for:", req.body.phone);
      try {
        const { name, phone, password, avatar, birthDate } = req.body;
        if (!name || !phone || !password) {
          return res.status(400).json({ error: "Missing required fields (name, phone, password)" });
        }

        // 先检查是否已存在
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("phone_or_email", phone)
          .maybeSingle();
        if (existingUser) {
          return res.status(400).json({ error: "该手机号或邮箱已被注册，请返回直接登录。" });
        }

        // 1. 创建家族
        const { data: family, error: fError } = await supabase
          .from("families")
          .insert({ name: `${name}的家族` })
          .select()
          .single();
        if (fError) throw new Error(`Family creation failed: ${fError.message}`);

        // 2. 创建家族成员档案
        const { data: member, error: mError } = await supabase
          .from("family_members")
          .insert({
            name,
            family_id: family.id,
            relationship: "创建者",
            avatar_url: avatar || "",
            gender: req.body.gender,
            birth_date: birthDate || null,
            is_registered: true,
            standard_role: "creator"
          })
          .select()
          .single();
        if (mError) throw new Error(`Member creation failed: ${mError.message}`);

        // 3. 创建用户账号
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const { data: userData, error: uError } = await supabase.from("users").insert({
          phone_or_email: phone,
          password: hashedPassword,
          name,
          relationship: "我",
          member_id: member.id,
          family_id: family.id,
          avatar_url: avatar || "",
          birth_date: birthDate
        }).select("id").single();
        if (uError) throw uError;

        // 4. 绑定家族创建者
        if (userData?.id) {
          await supabase.from("families").update({ creator_id: userData.id }).eq("id", family.id);
          await supabase.from("family_members").update({ user_id: userData.id }).eq("id", member.id);
        }

        console.log("[REGISTER-NEW] Created user with family:", { userId: userData?.id, familyId: family.id });
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

        // 4. 获取用户统计数据 (并行执行，避免任务阻塞)
        let memoriesCount = 0;
        let likesCount = 0;
        if (member) {
          try {
            // 获取留言总数
            const { count: mCount } = await supabase.from("messages")
              .select("*", { count: 'exact', head: true })
              .eq("family_member_id", member.id);
            memoriesCount = mCount || 0;

            // 获取点赞总数 (先查出该作者的所有留言 ID)
            const { data: memberMessages } = await supabase
              .from("messages")
              .select("id")
              .eq("family_member_id", member.id);

            if (memberMessages && memberMessages.length > 0) {
              const msgIds = memberMessages.map(m => m.id);
              const { count: lCount } = await supabase
                .from("likes")
                .select("*", { count: 'exact', head: true })
                .eq("target_type", "message")
                .in("target_id", msgIds);
              likesCount = lCount || 0;
            }
          } catch (statsErr) {
            console.error("[LOGIN] Stats fetching error:", statsErr);
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
      try {
        const limit = parseInt(req.query.limit as string) || 3;
        const { data, error } = await supabase
          .from("question_bank")
          .select("content");

        if (error) throw error;
        if (!data || data.length === 0) return res.json([]);

        // 使用 Fisher-Yates 洗牌算法确保更好的随机性
        const arr = [...data];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }

        const selected = arr.slice(0, limit).map(q => q.content);
        res.json(selected);
      } catch (err: any) {
        console.error("[API] Get question-bank error:", err.message);
        res.status(500).json({ error: "无法获取题库" });
      }
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

        // 1. 获取目标档案的所有留言
        const { data: memories, error } = await supabase
          .from("memories")
          .select("*")
          .eq("member_id", Number(memberId))
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!memories || memories.length === 0) return res.json([]);

        // 2. 优化：仅获取作者的最新资料，而不是全量表
        // 提取留言中涉及的所有作者 ID
        const authorIds = [...new Set(memories.map(m => m.author_id).filter(Boolean))];
        let authorMap: Record<number, any> = {};

        if (authorIds.length > 0) {
          const { data: authors } = await supabase
            .from("family_members")
            .select("id, name, avatar_url")
            .in("id", authorIds);

          authors?.forEach(a => {
            authorMap[a.id] = a;
          });
        }

        const formatted = memories.map(m => {
          const author = m.author_id ? authorMap[m.author_id] : null;
          return {
            id: m.id,
            familyMemberId: m.member_id,
            authorId: m.author_id,
            authorName: author?.name || m.author_name,
            authorRole: m.author_relationship,
            authorAvatar: author?.avatar_url || m.author_avatar,
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
        let { userId, memberId, familyId, takeArchives } = req.body;

        // Enhanced: Resolve userId from memberId if missing (backward compatibility)
        if (!userId && memberId) {
          const { data: u } = await supabase.from("users").select("id").eq("member_id", memberId).maybeSingle();
          if (u) userId = u.id;
        }

        // 2. Clear user's family links
        const { error: uError } = await supabase
          .from("users")
          .update({
            family_id: null,
            member_id: null,
            relationship: null
          })
          .eq("id", userId);

        if (uError) throw uError;

        // 4. OWNERSHIP SUCCESSION & CLEANUP DECISION
        let familyToCleanup: any = null;
        const { data: familyObj } = await supabase.from("families").select("creator_id").eq("id", familyId).maybeSingle();

        // If leaving user is the creator
        if (familyObj && familyObj.creator_id === userId) {
          // Find successor: earliest joined registered member
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
            console.log(`[SUCCESSION] Transferring Family ${familyId} to new creator ${successor.user_id}`);
            await supabase.from("families").update({ creator_id: successor.user_id }).eq("id", familyId);
            await supabase.from("family_members").update({ standard_role: "creator" }).eq("id", successor.id);
          } else {
            console.log(`[SUCCESSION] No survivor for Family ${familyId}. Marking for death.`);
            familyToCleanup = familyId;
          }
        } else {
          // If not creator, check if they were the literal last member
          const { count } = await supabase
            .from("family_members")
            .select("id", { count: 'exact', head: true })
            .eq("family_id", familyId)
            .neq("user_id", userId);
          if (!count || count === 0) familyToCleanup = familyId;
        }

        // 5. PHYSICAL CLEANUP (Only if no survivors)
        if (familyToCleanup) {
          console.log(`[CLEANUP] Purging empty family ${familyToCleanup}`);
          await supabase.from("memories").delete().eq("member_id", memberId);
          await supabase.from("messages").delete().eq("family_member_id", memberId);
          await supabase.from("family_members").delete().eq("id", memberId);
          await supabase.from("families").delete().eq("id", familyToCleanup);
        } else if (memberId) {
          // Just unregister the departing member but KEEP user_id AND invite_code for re-entry
          await supabase.from("family_members").update({
            is_registered: false
            // NOTE: We keep invite_code and user_id to ensure the identity is persistent
          }).eq("id", memberId);
        }

        // 6. ENFORCE PERSONAL HUD (Home Base)
        const { data: authUser } = await supabase.from("users").select("name, family_id").eq("id", userId).single();
        if (!authUser.family_id) {
          let { data: myArchive } = await supabase.from("family_members")
            .select("id, family_id")
            .eq("name", authUser.name)
            .is("is_registered", true)
            .eq("standard_role", "creator")
            .limit(1).maybeSingle();

          if (!myArchive) {
            const { data: nF } = await supabase.from("families").insert({
              name: `${authUser.name}的个人空间`,
              creator_id: userId
            }).select().single();
            const { data: nM } = await supabase.from("family_members").insert({
              family_id: nF.id,
              name: authUser.name,
              relationship: "我",
              is_registered: true,
              standard_role: "creator",
              user_id: userId
            }).select().single();
            myArchive = { id: nM.id, family_id: nF.id };
          }

          await supabase.from("users").update({
            family_id: myArchive.family_id,
            member_id: myArchive.id,
            relationship: "我"
          }).eq("id", userId);

          // --- 核心增强：反向迁移行李 (Reverse Migration) ---
          // 当用户搬家离开时，根据用户选择(takeArchives)，把在这个家族里曾经创建过的“随行档案”（未注册成员）和对应的大事记一并带走
          if (takeArchives && memberId && myArchive.family_id) {
            console.log(`[LEAVE-FAMILY:REVERSE-MIGRATE] Moving assets for user ${userId} to new space ${myArchive.family_id}`);

            // 1. 找到所有由我创建的、且尚未注册（随行状态）的成员
            const { data: myCreatedMembers } = await supabase
              .from("archive_memory_creators")
              .select("member_id")
              .eq("creator_member_id", memberId);

            if (myCreatedMembers && myCreatedMembers.length > 0) {
              const orphanIds = myCreatedMembers.map(m => m.member_id);

              // 2. 检查这些成员是否真的还是“随行”状态（没注册）
              const { data: orphans } = await supabase
                .from("family_members")
                .select("id")
                .in("id", orphanIds)
                .is("is_registered", false);

              if (orphans && orphans.length > 0) {
                const finalIds = orphans.map(o => o.id);
                console.log(`[REVERSE-MIGRATE] Taking ${finalIds.length} followers back to private space.`);

                // A. 转移成员归属
                await supabase.from("family_members")
                  .update({ family_id: myArchive.family_id })
                  .in("id", finalIds);

                // B. 转移对应的记忆创建者记录（更新 creator_member_id 到新的我）
                await supabase.from("archive_memory_creators")
                  .update({ creator_member_id: myArchive.id })
                  .eq("creator_member_id", memberId);

                // C. 找到并转移用户曾经在老家族里发的大事记 (Events)
                // 注意：这里只转移作者是离开者的 Events
                await supabase.from("events")
                  .update({ family_id: myArchive.family_id })
                  .eq("member_id", memberId);
              }
            }
          }
          // ---------------------------------------------

          return res.json({
            success: true,
            message: takeArchives ? "已带着您的档案成功退出家族。" : "已成功退出家族。",
            newFamilyId: myArchive.family_id,
            newMemberId: myArchive.id
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

        // Only update 'name' and 'avatar_url' in users table if provided
        const userUpdate: any = {};
        if (name) userUpdate.name = name;
        if (avatarUrl) userUpdate.avatar_url = avatarUrl;

        if (Object.keys(userUpdate).length > 0) {
          const { error } = await supabase.from("users").update(userUpdate).eq("id", numericUserId);
          if (error) console.warn("User profile sync warning:", error.message);
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
            avatar_url: avatarUrl || undefined,
            birth_date: birthDate || undefined // Add birthDate here
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
