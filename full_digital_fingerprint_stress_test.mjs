import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runStressTest() {
  console.log("🚀 Starting Complex Digital Fingerprint Stress Test...");

  const testName = `TestUser_${Math.floor(Math.random() * 1000)}`;
  const childName = `TestChild_${Math.floor(Math.random() * 1000)}`;

  // 1. Setup Family F1 and User A
  const { data: family1 } = await supabase.from('families').insert({ name: 'Fingerprint Family F1' }).select().single();
  const f1Id = family1.id;

  const { data: userA } = await supabase.from('users').insert({
    phone_or_email: `${testName}@test.com`,
    password: 'password',
    name: testName,
    family_id: f1Id
  }).select().single();

  const { data: memberA1 } = await supabase.from('family_members').insert({
    family_id: f1Id,
    user_id: userA.id,
    name: testName,
    is_registered: true,
    standard_role: 'creator'
  }).select().single();

  await supabase.from('users').update({ member_id: memberA1.id, home_family_id: f1Id, home_member_id: memberA1.id }).eq('id', userA.id);

  // 2. Add Virtual Child and Assets
  const { data: virtualChild } = await supabase.from('family_members').insert({
    family_id: f1Id,
    name: childName,
    member_type: 'virtual',
    added_by_member_id: memberA1.id
  }).select().single();

  // Check if sync_uuid exists
  const { data: cols } = await supabase.rpc('exec_sql', {
     sql_query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'memories' AND column_name = 'sync_uuid';"
  });
  const hasSyncUuid = cols && cols.length > 0;
  console.log(`DB Schema status: sync_uuid ${hasSyncUuid ? 'exists' : 'missing'}`);

  const selectCols = hasSyncUuid ? 'id, content, sync_uuid' : 'id, content';

  // Create assets (Memories, Messages, Events)
  const { data: m1, error: m1Err } = await supabase.from('memories').insert({
    member_id: virtualChild.id,
    content: 'Memory 1: Birth',
    author_id: memberA1.id,
    author_name: testName,
    type: 'text'
  }).select(selectCols).single();
  if (m1Err) console.error("M1 Insert Error:", m1Err.message);

  const { data: g1, error: g1Err } = await supabase.from('messages').insert({
    family_member_id: virtualChild.id,
    author_name: testName,
    content: 'Message 1: Welcome',
    type: 'text'
  }).select(selectCols).single();
  if (g1Err) console.error("G1 Insert Error:", g1Err.message);

  const { data: e1, error: e1Err } = await supabase.from('events').insert({
    family_id: f1Id,
    member_id: virtualChild.id,
    title: 'Event 1: First Step',
    date: '2025-01-01',
    type: 'life_event'
  }).select(hasSyncUuid ? 'id, title, sync_uuid' : 'id, title').single();
  if (e1Err) console.error("E1 Insert Error:", e1Err.message);

  if (!m1 || !g1 || !e1) {
    console.error("Setup failed: One or more assets were not created.");
    process.exit(1);
  }

  console.log(`✅ Setup complete. M1 sync_uuid: ${m1.sync_uuid}`);

  // 3. User A Leaves with Archives
  console.log("🏃 User A leaving F1 with archives...");
  const leaveRes = await fetch("http://localhost:3001/api/leave-family", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: userA.id, memberId: memberA1.id, takeArchives: true })
  });
  const leaveData = await leaveRes.json();
  console.log("✅ Leave Success. New Family ID (Personal Space):", leaveData.newFamilyId);

  // 4. Interaction in F1 (Orphaned state)
  // Someone else (simulation) adds content to the orphaned profile in F1
  const { data: orphanChild } = await supabase.from('family_members')
    .select('id')
    .eq('family_id', f1Id)
    .eq('name', childName)
    .single();

  await supabase.from('memories').insert({
    member_id: orphanChild.id,
    content: 'Memory 2: Added in F1 while A was gone',
    author_name: 'Random Cousin',
    type: 'text'
  });

  await supabase.from('events').insert({
    family_id: f1Id,
    member_id: orphanChild.id,
    title: 'Event 2: Second Birthday in F1',
    date: '2026-01-01',
    type: 'life_event'
  });

  console.log("✅ Created conflict assets in F1.");

  // 5. User A Rejoins F1 (Claim Orphan)
  console.log("🤝 User A rejoining F1 with syncArchives: true...");
  const joinRes = await fetch("http://localhost:3001/api/users/claim-orphan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: userA.id, name: testName, syncArchives: true })
  });
  const joinData = await joinRes.json();
  const finalMemberId = joinData.memberId;
  console.log("✅ Join Success. Final Member ID in F1:", finalMemberId);

  // 6. Verification
  console.log("🧐 Verifying Deep Merge Results...");

  // Get final child in F1
  const { data: finalChild } = await supabase.from('family_members')
    .select('id')
    .eq('family_id', f1Id)
    .eq('name', childName)
    .single();

  const { data: finalMemories } = await supabase.from('memories').select('*').eq('member_id', finalChild.id);
  const { data: finalMessages } = await supabase.from('messages').select('*').eq('family_member_id', finalChild.id);
  const { data: finalEvents } = await supabase.from('events').select('*').eq('member_id', finalChild.id);

  console.log(`Memories count: ${finalMemories.length} (Expected: 2)`);
  console.log(`Messages count: ${finalMessages.length} (Expected: 1)`);
  console.log(`Events count: ${finalEvents.length} (Expected: 2)`);

  // Check for duplication based on fingerprint (UUID or Content)
  const hasDuplicateM1 = finalMemories.filter(m => (m.sync_uuid && m.sync_uuid === m1.sync_uuid) || m.content === m1.content).length > 1;
  const hasDuplicateE1 = finalEvents.filter(e => (e.sync_uuid && e.sync_uuid === e1.sync_uuid) || e.title === e1.title).length > 1;

  if (finalMemories.length === 2 && finalMessages.length === 1 && finalEvents.length === 2 && !hasDuplicateM1 && !hasDuplicateE1) {
    console.log("🎊 SUCCESS: Deep fingerprint merge successful. No duplicates found!");
    process.exit(0);
  } else {
    console.error("❌ FAILURE: Data mismatch detected.");
    console.table(finalMemories);
    console.table(finalEvents);
    process.exit(1);
  }

  // Cleanup (optional but good for repeated runs)
  // await supabase.from('users').delete().eq('id', userA.id);
  // await supabase.from('families').delete().in('id', [f1Id, leaveData.newFamilyId]);
}

runStressTest().catch(console.error);
