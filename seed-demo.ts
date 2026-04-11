import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDemo() {
  console.log("🌟 Re-seeding Demo data with REAL avatars...");

  const familyId = 1;

  // Clear existing first for clean seed
  await supabase.from('archive_memory_creators').delete().in('member_id', [1,2,3,4,5,6,7]);
  await supabase.from('family_members').delete().in('id', [1,2,3,4,5,6,7]);
  await supabase.from('users').delete().eq('id', 1);

  // 1. Create Demo Family
  await supabase.from('families').upsert({
    id: 1, 
    name: "陈家大院 (官方演示)"
  });

  // 2. Create Users & Members
  const membersData = [
    { id: 1, family_id: familyId, user_id: 1, name: "陈小明", relationship: "本人", gender: "male", generation_num: 30, is_registered: true, avatar_url: "/demo-avatars/son.png" },
    { id: 2, family_id: familyId, name: "陈大平", relationship: "爷爷", gender: "male", generation_num: 28, avatar_url: "/demo-avatars/grandpa.png" },
    { id: 3, family_id: familyId, name: "李阿婆", relationship: "奶奶", gender: "female", generation_num: 28, avatar_url: "/demo-avatars/grandma.png" },
    { id: 4, family_id: familyId, name: "陈建国", relationship: "爸爸", gender: "male", generation_num: 29, father_id: 2, mother_id: 3, avatar_url: "/demo-avatars/papa.png" },
    { id: 5, family_id: familyId, name: "张美丽", relationship: "妈妈", gender: "female", generation_num: 29, avatar_url: "/demo-avatars/mama.png" },
    { id: 6, family_id: familyId, name: "陈小红", relationship: "妹妹", gender: "female", generation_num: 30, father_id: 4, mother_id: 5, avatar_url: "/demo-avatars/sister.png" },
    { id: 7, family_id: familyId, name: "咪咪", relationship: "宠物猫", member_type: "pet", avatar_url: "/demo-avatars/cat.png" }
  ];

  for (const m of membersData) {
    await supabase.from('family_members').insert(m);
  }

  await supabase.from('users').insert({
    id: 1,
    phone_or_email: "demo@echoes.com",
    password: "password123",
    name: "陈小明",
    family_id: familyId,
    home_family_id: familyId,
    member_id: 1,
    home_member_id: 1,
    avatar_url: "/demo-avatars/son.png",
    gender: "male"
  });

  // 3. Create Events
  await supabase.from('events').upsert([
    { id: 1, family_id: familyId, title: "爷爷 80 大寿", date: "2026-06-15", type: "birthday", member_id: 2 },
    { id: 2, family_id: familyId, title: "家族春节跨年晚宴", date: "2026-02-17", type: "anniversary" }
  ]);

  // 4. Create Messages & Memories
  await supabase.from('messages').insert([
    { family_member_id: 1, author_name: "陈小明", author_role: "孙子", author_avatar: "/demo-avatars/son.png", content: "祝爷爷福如东海，寿比南山！🎂", type: "text", event_id: 1, family_id: String(familyId) },
    { family_member_id: 6, author_name: "陈小红", author_role: "孙女", author_avatar: "/demo-avatars/sister.png", content: "爷爷生日快乐！我给你画了张画～", type: "text", event_id: 1, family_id: String(familyId) }
  ]);

  await supabase.from('memories').insert([
    { member_id: 2, author_id: 1, author_name: "陈小明", author_avatar: "/demo-avatars/son.png", content: "小时候最喜欢听爷爷在院子里讲抗美援朝的故事，那把藤椅现在还在老家。", type: "text", family_id: String(familyId) },
    { member_id: 7, author_id: 1, author_name: "陈小明", author_avatar: "/demo-avatars/son.png", content: "咪咪是 2022 年来到我们家的，它是家里的开心果。", type: "text", family_id: String(familyId) }
  ]);

  // 5. Create Notifications
  await supabase.from('notifications').insert([
    { member_id: 1, title: "陈小红 留言了", content: "爷爷 80 大寿的消息下有新回复", type: "comment", family_id: String(familyId) },
    { member_id: 1, title: "张美丽 点赞了", content: "点赞了关于“咪咪”的记忆片段", type: "like", family_id: String(familyId) }
  ]);

  console.log("✅ Demo data seeded successfully with REAL avatars!");
}

seedDemo();
