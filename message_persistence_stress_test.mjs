import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("🚀 Starting Message Persistence Stress Test...");

    const uniqueId = Date.now();
    const phoneA = `138${uniqueId % 100000000}`;
    const phoneB = `139${uniqueId % 100000000}`;

    // 1. Create User A, User B
    console.log("--- 1. Creating Users ---");
    const { data: userA } = await supabase.from("users").insert({
        phone_or_email: phoneA,
        password: "pass",
        name: "User A"
    }).select().single();

    const { data: userB } = await supabase.from("users").insert({
        phone_or_email: phoneB,
        password: "pass",
        name: "User B"
    }).select().single();

    // 2. User B creates a Family
    console.log("--- 2. User B creates a Family ---");
    const { data: familyB } = await supabase.from("families").insert({
        name: "B's Home",
        creator_id: userB.id
    }).select().single();

    // Add B as member
    const { data: memberB } = await supabase.from("family_members").insert({
        family_id: familyB.id,
        user_id: userB.id,
        name: "User B",
        relationship: "我",
        is_registered: true,
        standard_role: "creator"
    }).select().single();

    await supabase.from("users").update({ family_id: familyB.id, member_id: memberB.id }).eq("id", userB.id);

    // 3. User B adds User A (as an orphan)
    console.log("--- 3. User B adds User A (orphan) ---");
    const { data: memberA_orphan } = await supabase.from("family_members").insert({
        family_id: familyB.id,
        name: "User A",
        relationship: "堂兄",
        is_registered: false
    }).select().single();

    // 4. User B leaves a message on A's profile
    console.log("--- 4. User B leaves message 1 ---");
    await supabase.from("messages").insert({
        family_member_id: memberA_orphan.id,
        author_name: "User B",
        content: "Hello A, this is message 1",
        type: "text"
    });

    // 5. A joins (claims the orphan)
    console.log("--- 5. User A joins (claims orphan) ---");
    await supabase.from("users").update({ family_id: familyB.id, member_id: memberA_orphan.id }).eq("id", userA.id);
    await supabase.from("family_members").update({ user_id: userA.id, is_registered: true }).eq("id", memberA_orphan.id);

    // 6. A leaves the family
    console.log("--- 6. User A leaves family ---");
    // Simulate /api/leave-family logic
    await supabase.from("users").update({ family_id: null, member_id: null }).eq("id", userA.id);
    await supabase.from("family_members").update({ user_id: null, is_registered: false }).eq("id", memberA_orphan.id);

    // 7. B leaves another message on the (now orphaned) A profile
    console.log("--- 7. User B leaves message 2 ---");
    await supabase.from("messages").insert({
        family_member_id: memberA_orphan.id,
        author_name: "User B",
        content: "Hello A again, message 2",
        type: "text"
    });

    // 8. A joins back
    console.log("--- 8. User A joins back (claims same orphan) ---");
    await supabase.from("users").update({ family_id: familyB.id, member_id: memberA_orphan.id }).eq("id", userA.id);
    await supabase.from("family_members").update({ user_id: userA.id, is_registered: true }).eq("id", memberA_orphan.id);

    // 9. Check messages
    console.log("--- 9. Verifying Results ---");
    const { data: messages } = await supabase.from("messages")
        .select("*")
        .eq("family_member_id", memberA_orphan.id);

    console.log(`Found ${messages.length} messages:`);
    messages.forEach(m => console.log(` - [${m.author_name}]: ${m.content}`));

    if (messages.length === 2) {
        console.log("✅ Success: Messages were merged correctly (old and new coexist).");
    } else if (messages.length === 1) {
        console.log("❌ Warning: Message was overwritten!");
    } else {
        console.log("⚠️ Unexpected result count.");
    }

    // Cleanup (optional but good for reuse)
    // await supabase.from("messages").delete().eq("family_member_id", memberA_orphan.id);
    // await supabase.from("family_members").delete().eq("family_id", familyB.id);
    // await supabase.from("families").delete().eq("id", familyB.id);
    // await supabase.from("users").delete().or(`id.eq.${userA.id},id.eq.${userB.id}`);
}

test();
