import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function testAdd() {
    const payload = {
        name: "真正测试" + Date.now(),
        relationship: "亲戚",
        avatarUrl: "https://avatar.vercel.sh/test.svg",
        familyId: 1,
        memberType: "human",
        ancestralHall: "大房",
        generationNum: 30
    };

    // Simulate what the server does
    const insertPayload: any = {
        family_id: payload.familyId,
        name: payload.name,
        relationship: payload.relationship,
        avatar_url: payload.avatarUrl,
        is_registered: false,
        member_type: payload.memberType,
        ancestral_hall: payload.ancestralHall,
        generation_num: payload.generationNum
    };

    console.log("Attempting insertion with new columns...");
    let { data, error } = await supabase.from("family_members").insert(insertPayload).select().single();

    if (error) {
        console.log("First attempt failed as expected:", error.message);
        if (error.message?.includes("column") || error.code === "PGRST204" || error.code === "42703") {
            console.log("Retrying with fallback...");
            const fallbackPayload = { ...insertPayload };
            delete fallbackPayload.member_type;
            delete fallbackPayload.ancestral_hall;
            delete fallbackPayload.generation_num;
            const result = await supabase.from("family_members").insert(fallbackPayload).select().single();
            data = result.data;
            error = result.error;
        }
    }

    if (error) {
        console.error("Insertion failed even after fallback:", error);
    } else {
        console.log("Success:", data.id);
    }
}

testAdd();
