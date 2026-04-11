import express from 'express';
import { getSupabase } from '../lib/supabase';

const router = express.Router();

router.get("/", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { memberId, familyId } = req.query;
    if (!familyId) return res.status(400).json({ error: "family_id is required for isolation" });
        if (!memberId) return res.status(400).json({ error: "memberId is required" });

        const { data: memories, error } = await supabase
            .from("memories")
            .select("*")
            .eq("member_id", memberId)
            .eq("family_id", familyId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        if (!memories || memories.length === 0) return res.json([]);

        const authorIds = [...new Set(memories.map((m: any) => m.author_id).filter(Boolean))];
        let authorMap: Record<number, any> = {};

        if (authorIds.length > 0) {
            const { data: authors } = await supabase
                .from("family_members")
                .select("id, name, avatar_url")
                .in("id", authorIds);

            authors?.forEach((a: any) => {
                authorMap[a.id] = a;
            });
        }

        const formatted = memories.map((m: any) => {
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
        res.status(500).json({ error: err.message });
    }
});

router.post("/", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { familyMemberId, authorId, authorName, authorRole, authorAvatar, content, type, mediaUrl, duration, familyId } = req.body;
        
        if (!familyId) return res.status(400).json({ error: "family_id is required for isolation" });

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
                duration,
                family_id: familyId
            })
            .select()
            .single();

        if (error) throw error;

        if (familyMemberId) {
            const { data: currentMember } = await supabase.from("family_members").select("name").eq("id", familyMemberId).single();
            if (authorName !== currentMember?.name) {
                await supabase.from("notifications").insert({
                    member_id: familyMemberId,
                    family_id: familyId,
                    title: "记忆档案有新留言",
                    content: `${authorName} 在您的记忆档案中留言了：“${content.substring(0, 20)}${content.length > 20 ? '...' : ''}”`,
                    type: "archive_comment",
                    link_url: `/archive/${familyMemberId}`
                });
            }
        }

        res.json({ id: data.id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    try {
        const { error } = await supabase.from("memories").delete().eq("id", req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/:id/like", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { id } = req.params;
    const { senderId, senderName } = req.body;
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

    if (!alreadyLiked && current.member_id) {
        try {
            const linkUrl = `/archive/${current.member_id}?highlightMsg=${id}`;
            await supabase.from("notifications").insert({
                member_id: current.member_id,
                title: "有人给您点赞了",
                content: `${senderName || "有人"} 赞了您的记忆档案留言`,
                type: "like",
                link_url: linkUrl
            });
        } catch (e) {
            console.error("[NOTIF] Failed memory like notif:", e);
        }
    }

    res.json({ success: true, likes: updated.likes, isLiked: !alreadyLiked });
});

export default router;
