import express from 'express';
import { getSupabase } from '../lib/supabase';

const router = express.Router();

router.get("/", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { familyId, memberId } = req.query;
    if (!familyId) {
        return res.status(400).json({ error: "Missing familyId. Family isolation is strictly enforced." });
    }

    let query = supabase.from("events").select("*").eq("family_id", familyId);
    
    if (memberId) {
        query = query.or(`member_id.eq.${memberId},member_ids.cs.{${memberId}}`);
    }

    const { data, error } = await query.order("date", { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });

    const events = (data || []).map((e: any) => ({
        ...e,
        isRecurring: e.is_recurring,
        memberId: e.member_id,
        memberIds: e.member_ids,
        customMemberName: e.custom_member_name
    }));

    try {
        const { data: members } = await supabase.from("family_members").select("*").eq("family_id", familyId);
        if (members) {
            const birthdayEvents = members
                .filter((m: any) => m.birth_date && !(m.member_type === 'virtual' || m.is_placeholder))
                .map((m: any) => {
                    const d = new Date(m.birth_date);
                    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                    const dd = d.getDate().toString().padStart(2, '0');
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

            birthdayEvents.forEach((virtualEvent: any) => {
                const matchesMember = !memberId || Number(virtualEvent.memberId) === Number(memberId);
                if (matchesMember && !events.some((e: any) => e.title === virtualEvent.title)) {
                    events.push(virtualEvent as any);
                }
            });
        }
    } catch (err) {
        console.error("[EVENTS] Error generating birthday events:", err);
    }

    res.json(events);
});

router.post("/", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { family_id, title, date, type, description, isRecurring, memberId, customMemberName, location, notes } = req.body;
    const memberIds = req.body.memberIds || [];

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

    let { data, error } = await supabase.from("events").insert(insertPayload).select().single();

    if (error && (error.message?.includes("member_ids") || error.code === "PGRST204" || error.code === "42703")) {
        const fallbackPayload = { ...insertPayload };
        delete fallbackPayload.member_ids;
        const result = await supabase.from("events").insert(fallbackPayload).select().single();
        data = result.data;
        error = result.error;
    }

    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data.id });
});

router.delete("/:id", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { error } = await supabase.from("events").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.get("/question-bank", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const limit = parseInt(req.query.limit as string) || 3;
        const { data, error } = await supabase.from("question_bank").select("content");
        if (error) throw error;
        if (!data || data.length === 0) return res.json([]);

        const arr = [...data];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        res.json(arr.slice(0, limit).map(q => q.content));
    } catch (err: any) {
        res.status(500).json({ error: "无法获取题库" });
    }
});

export default router;
