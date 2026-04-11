import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log("🚀 Starting detailed family data migration...");

  try {
    // 1. 获取所有真实登录用户的映射 (User -> FamilyID)
    const { data: users, error: userErr } = await supabase.from("users").select("id, family_id, member_id");
    if (userErr) throw userErr;

    console.log(`Found ${users?.length} registered users to reconcile.`);

    for (const user of users || []) {
      if (!user.family_id) continue;
      const fid = String(user.family_id);

      console.log(`\n--- Reconciling Data for User ${user.id} (Family: ${fid}) ---`);

      // A. 将该用户对应的核心档案（member）打上正确的家族戳
      if (user.member_id) {
        const { error: mErr } = await supabase
          .from("family_members")
          .update({ family_id: fid })
          .eq("id", user.member_id);
        if (mErr) console.warn(`   ! Member update failed: ${mErr.message}`);
        else console.log(`   √ Core member ${user.member_id} anchored to family ${fid}`);
        
        // B. 将由该成员创建的所有后续档案归入此家族
        const { error: subErr } = await supabase
            .from("family_members")
            .update({ family_id: fid })
            .eq("added_by_member_id", user.member_id);
        if (subErr) console.warn(`   ! Sub-members update failed: ${subErr.message}`);
        else console.log(`   √ Linked lineage members merged into family ${fid}`);

        // C. 将该成员发表的所有留言归入此家族
        const { error: msgErr } = await supabase
          .from("messages")
          .update({ family_id: fid })
          .eq("family_member_id", user.member_id);
        if (msgErr) console.warn(`   ! Messages update failed: ${msgErr.message}`);
        else console.log(`   √ Message history captured for family ${fid}`);

        // D. 将该成员上传的所有相册/回忆归入此家族
        const { error: memErr } = await supabase
          .from("memories")
          .update({ family_id: fid })
          .eq("author_id", user.member_id);
        if (memErr) console.warn(`   ! Memories update failed: ${memErr.message}`);
        else console.log(`   √ Memories (photos/videos) anchored to family ${fid}`);
      }
    }

    // 2. 特殊补漏：处理没有任何 family_id 的孤儿数据（兜底逻辑）
    // 如果 member_id=1 的人是 cgs，那么关于他的大事记也应该归属于 family_1
    // 这里简单地按 user.member_id 和 family_id 交叉验证来补大事记
    for (const user of users || []) {
        if (!user.family_id || !user.member_id) continue;
        const { error: eErr } = await supabase
            .from("events")
            .update({ family_id: user.family_id })
            .eq("member_id", user.member_id)
            .is("family_id", null);
        if (!eErr) console.log(`   √ Orphaned events for member ${user.member_id} recovered.`);
    }

    console.log("\n✅ Migration complete! Data has been sequestered by family ID.");

  } catch (err: any) {
    console.error("Critical Migration Error:", err.message);
  }
}

migrate();
