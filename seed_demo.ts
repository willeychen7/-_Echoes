import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
dotenv.config({ path: ".env.local" });

const BCRYPT_SALT_ROUNDS = 12;

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function seed() {
    console.log("Seeding demo data...");

    // 1. Ensure Family 1 exists (Chern's family)
    // Since id is SERIAL, we might need to upsert or delete and insert.
    // We'll delete everything first to be sure it's clean (as requested: "Keep demo data in demo square")
    await supabase.from("family_members").delete().filter("family_id", "eq", 1);
    await supabase.from("families").upsert([{ id: 1, name: "陈建国的家庭" }]);

    // 2. Members
    const members = [
        {
            id: 1,
            family_id: 1,
            name: "林月娥",
            relationship: "老伴",
            avatar_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDvg6W6IFZ2JuDXanowe2po0Ndn_QmJPFENhHjprVqA22bvfwP64ioaH-ScdlzVoD4OmDEq4Owhiwy5JcXd5r_eQmBI6g7e8qSO3v3gjR7IbsNRaRePyLPJ6-oO0li96mEPtfaFA4JYAQquay2Gxj2UDAsTG6Be_k0WdXbKGyFieLqreF6K2rDFmxJe_hG6CM0TdKAPDlUh5ys0cfZjZKaXgY_Ceu9arfujNoJmvo9lhnmPK7BmGE1H-6dLGdB9a7wtp2FsoTpjA2w",
            bio: "喜欢种花和听京剧。",
            birth_date: "1948-10-12",
            standard_role: "mother"
        },
        {
            id: 2,
            family_id: 1,
            name: "陈兴华",
            relationship: "父亲",
            avatar_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMmK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y",
            bio: "退休教师，喜欢写书法。",
            birth_date: "1945-03-20",
            standard_role: "father"
        },
        {
            id: 3,
            family_id: 1,
            name: "陈建国",
            relationship: "本人",
            avatar_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwusjFRipiiPuQPnlu8lyXqpESaqMYI6iBbwhGJSByETLCJin8fxLFhx7yFrgNeTWxNRtJhFvUv-QBWwbIDe9NLVWYMMmK0ykgD39DQ6Im6Fk0zsKWn7prx2EIM__QjICrYLFWoCn6sYCrGgJ0SCCKFDFbrFjQu3IQKzsQ-dTR4tL8GPT25YU3k5ptELq8GvkLOFJQxqZx9IGQa0VEF8olYdHwYHJxmLi4809HoLMucZNjXNwQFYofjtn4dvk6wJiX6mgddchqj_Y",
            bio: "热爱生活，记录美好。",
            birth_date: "1965-05-12",
            standard_role: "father",
            is_registered: true
        },
        {
            id: 4,
            family_id: 1,
            name: "李美芳",
            relationship: "妻子",
            avatar_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDIwxfzAvsOl_ZzsdHKppuFhs_5iM26_e_p9y0kU5_hiLIVc9JAY_Q8otsTMmOgX5pbn8EPDA2b_WN2KHmuEYiQ_xNJvM7vhbd7cZi38m3JnyKMW5xfg3al0T0-wRjr8BHYEW-69XFpOpqZ0CLKqXYOqBmT2ZzMxzoX_kgqVkuAi9Dx-uoZIO6209WL5x1iIvXLkAyJcupmiN4VgbJxG_YZoKIVS_i2I8CFGTfPC8qlUUhPO4BjYxqiYHbOdcLlV1QacYME0v_b-4Q",
            bio: "家里的主厨，喜欢广场舞。",
            birth_date: "1968-08-15",
            standard_role: "mother"
        },
        {
            id: 5,
            family_id: 1,
            name: "陈小明",
            relationship: "孙子",
            avatar_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBAdiBHDqEr2K33fyt5BaRHdl7JV-ITKpBOKDmyz87kyHbJXbxViiMpAoqF0v8hkObP0481dOZWZeNK5mf151CBcsTi2zydCD56k2lIlrJNwk9IImtHScfDETFF-h9tJxjbmxUOZY_g8jEIokPEDj37oagfY6VWKEMIw6Fyk_Uxew_PYRxZzLw_28b4pO4EMCBITCWArexcIpjk4HIlC4udrqA9MrjKSueMBgGE3UpXfLjRdUIZ9OgHLbrq0JWsvpsm1Xm135ZE81s",
            bio: "记录爷爷奶奶的故事。",
            birth_date: "2000-06-01",
            standard_role: "son",
            invite_code: "FA-8888"
        }
    ];

    await supabase.from("family_members").upsert(members);

    // 3. Events
    const events = [
        {
            family_id: 1,
            title: "陈兴华的生日",
            date: new Date().toISOString().split('T')[0], // 设为今天方便演示
            type: "birthday",
            member_id: 2,
            description: "家里的大日子"
        },
        {
            family_id: 1,
            title: "结婚40周年纪念日",
            date: "2024-10-20",
            type: "anniversary",
            member_id: 2,
            description: "红宝石婚"
        }
    ];
    await supabase.from("events").delete().filter("family_id", "eq", 1);
    await supabase.from("events").insert(events);

    // 4. Seed User for Login
    console.log("Seeding user login...");
    const hashedPassword = await bcrypt.hash("123456", BCRYPT_SALT_ROUNDS);
    await supabase.from("users").upsert([{
        phone_or_email: "13800138000",
        password: hashedPassword,
        name: "陈建国",
        relationship: "父亲"
    }]);

    console.log("Demo data seeded successfully!");
}

seed();
