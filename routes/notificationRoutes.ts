import express from 'express';
import { getSupabase } from '../lib/supabase';

const router = express.Router();

router.get("/:memberId", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { familyId } = req.query;
    if (!familyId) return res.status(400).json({ error: "familyId is required" });

    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("member_id", req.params.memberId)
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.put("/:id/read", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/read-all/:memberId", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { familyId } = req.query;
        if (!familyId) return res.status(400).json({ error: "familyId is required" });

        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("member_id", req.params.memberId)
            .eq("family_id", familyId);

        if (error) throw error;
        return res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
