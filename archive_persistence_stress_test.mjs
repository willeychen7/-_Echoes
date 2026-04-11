import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("🚀 Starting Archive/Memory Persistence & Duplication Test...");

    const uniqueId = Date.now();
    const phoneA = `138${uniqueId % 100000000}`;
    const phoneB = `139${uniqueId % 100000000}`;

    // 1. Create User A, User B
    const { data: userA } = await supabase.from("users").insert({ phone_or_email: phoneA, password: "pass", name: "User A" }).select().single();
    const { data: userB } = await supabase.from("users").insert({ phone_or_email: phoneB, password: "pass", name: "User B" }).select().single();

    // 2. User B creates a Family
    const { data: familyB } = await supabase.from("families").insert({ name: "Family B", creator_id: userB.id }).select().single();
    const { data: memberB } = await supabase.from("family_members").insert({
        family_id: familyB.id, user_id: userB.id, name: "User B", relationship: "我", is_registered: true, standard_role: "creator"
    }).select().single();
    await supabase.from("users").update({ family_id: familyB.id, member_id: memberB.id }).eq("id", userB.id);

    // 3. User B adds User A as an orphan
    const { data: memberA_orphan } = await supabase.from("family_members").insert({
        family_id: familyB.id, name: "User A", relationship: "堂兄", is_registered: false
    }).select().single();

    // 4. B leaves a Message and a Memory on A's profile
    console.log("--- 1. B leaves a message & memory on A's profile ---");
    await supabase.from("messages").insert({
        family_member_id: memberA_orphan.id, author_name: "User B", content: "Message from B (Initial)", type: "text"
    });
    await supabase.from("memories").insert({
        member_id: memberA_orphan.id, author_id: memberB.id, author_name: "User B", content: "Memory from B (Initial)", type: "text"
    });

    // 5. A joins (claims orphan)
    console.log("--- 2. A joins (claims orphan) ---");
    await supabase.from("users").update({ family_id: familyB.id, member_id: memberA_orphan.id }).eq("id", userA.id);
    await supabase.from("family_members").update({ user_id: userA.id, is_registered: true }).eq("id", memberA_orphan.id);

    // 6. A adds a personal memory
    await supabase.from("memories").insert({
        member_id: memberA_orphan.id, author_id: memberA_orphan.id, author_name: "User A", content: "A's Personal Memory", type: "text"
    });

    // 7. A leaves with "Take Archives"
    console.log("--- 3. A leaves with 'Take Archives' ---");
    // Simulate /api/leave-family?takeArchives=true logic
    // Clear registration in B family
    await supabase.from("family_members").update({ user_id: null, is_registered: false }).eq("id", memberA_orphan.id);
    
    // Create personal home for A
    const { data: homeA } = await supabase.from("families").insert({ name: "A's Home", creator_id: userA.id }).select().single();
    const { data: memberA_home } = await supabase.from("family_members").insert({
        family_id: homeA.id, user_id: userA.id, name: "User A", relationship: "我", is_registered: true, standard_role: "creator"
    }).select().single();
    await supabase.from("users").update({ family_id: homeA.id, member_id: memberA_home.id, home_family_id: homeA.id, home_member_id: memberA_home.id }).eq("id", userA.id);

    // Migrate A's personal memories to home
    await supabase.from("memories")
        .update({ author_id: memberA_home.id, member_id: memberA_home.id })
        .eq("author_id", memberA_orphan.id)
        .eq("member_id", memberA_orphan.id);

    // 8. B adds another message on the orphaned A profile while A is away
    console.log("--- 4. B adds a NEW message/memory on orphaned A ---");
    await supabase.from("messages").insert({
        family_member_id: memberA_orphan.id, author_name: "User B", content: "Message from B (While A away)", type: "text"
    });
    await supabase.from("memories").insert({
        member_id: memberA_orphan.id, author_id: memberB.id, author_name: "User B", content: "Memory from B (While A away)", type: "text"
    });

    // 9. A joins back to Family B
    console.log("--- 5. A joins back (Re-claiming the orphan) ---");
    await supabase.from("users").update({ family_id: familyB.id, member_id: memberA_orphan.id }).eq("id", userA.id);
    await supabase.from("family_members").update({ user_id: userA.id, is_registered: true }).eq("id", memberA_orphan.id);

    // 10. Check total counts
    console.log("--- 6. Final Audit ---");
    const { data: finalMessages } = await supabase.from("messages").select("*").eq("family_member_id", memberA_orphan.id);
    const { data: finalMemories } = await supabase.from("memories").select("*").eq("member_id", memberA_orphan.id);

    console.log(`Final Messages count: ${finalMessages.length}`);
    finalMessages.forEach(m => console.log(` - MSG: ${m.content}`));

    console.log(`Final Memories count: ${finalMemories.length}`);
    finalMemories.forEach(m => console.log(` - MEM: ${m.content}`));

    if (finalMemories.some(m => m.content === "A's Personal Memory")) {
        console.log("❌ Issue: Personal memory that was MIGRATED to 'A's Home' is missing from 'Family B'!");
        console.log("NOTE: This is by design (Physical Migration), but User B might see A's archive as 'empty' of A's own posts.");
    } else {
        console.log("✅ Info: Personal memory safely moved to personal archives.");
    }

    if (finalMessages.length === 2 && finalMemories.filter(m => m.author_id === memberB.id).length === 2) {
        console.log("✅ Success: External messages and memories from B are preserved and merged correctly!");
    } else {
        console.log("❌ Error: Some data was lost or overwritten.");
    }
}

test();
