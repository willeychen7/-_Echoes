import express from 'express';
import { getSupabase } from '../lib/supabase';

const router = express.Router();

router.get("/", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { eventId, memberId, familyId } = req.query;
    if (!familyId) return res.status(400).json({ error: "familyId is required" });

    let query = supabase.from("messages").select("*").eq("family_id", familyId);

    if (eventId) {
        query = query.eq("event_id", Number(eventId));
    } else if (memberId) {
        query = query.eq("family_member_id", Number(memberId)).is("event_id", null);
    }

    const { data: rawData, error } = await query
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) return res.status(500).json({ error: error.message });

    const { data: familyMembers } = await supabase.from("family_members").select("id, name, avatar_url");
    const nameToAvatarMap: Record<string, string> = {};
    familyMembers?.forEach((f: any) => {
        if (f.avatar_url) {
            nameToAvatarMap[String(f.id)] = f.avatar_url;
        }
    });

    const formatted = (rawData || []).map((m: any) => {
        const authorId = m.event_id ? m.family_member_id : (m.author_id || null);
        const authorAvatar = authorId ? nameToAvatarMap[String(authorId)] : (m.author_avatar || m.authorAvatar);

        return {
            id: m.id,
            familyMemberId: m.family_member_id || m.familyMemberId,
            authorId,
            authorName: m.author_name || m.authorName || "家人",
            authorRole: m.author_role || m.authorRole || "家人",
            authorAvatar,
            content: m.content || "",
            type: m.type || "text",
            mediaUrl: m.media_url || m.mediaUrl,
            duration: m.duration,
            createdAt: m.created_at || m.createdAt,
            likes: m.likes || 0,
            likedBy: m.liked_by || [],
            eventId: m.event_id || m.eventId
        };
    });

    res.json(formatted);
});

router.post("/", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { familyMemberId, authorName, authorRole, authorAvatar, content, type, mediaUrl, duration, eventId, familyId } = req.body;
    
    if (!familyId) return res.status(400).json({ error: "familyId is required for isolation" });

    try {
        const { data: message, error } = await supabase
            .from("messages")
            .insert({
                family_member_id: familyMemberId,
                author_name: authorName,
                author_role: authorRole,
                author_avatar: authorAvatar,
                content,
                type,
                media_url: mediaUrl,
                duration,
                event_id: eventId,
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

        if (eventId) {
            const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
            if (event && event.member_id) {
                const { data: targetMember } = await supabase.from("family_members").select("name").eq("id", event.member_id).single();
                if (authorName !== targetMember?.name) {
                    await supabase.from("notifications").insert({
                        member_id: event.member_id,
                        title: "大事记新动态",
                        content: `${authorName} 回应了关于您的事件【${event.title}】`,
                        type: "event_comment",
                        link_url: "/square"
                    });
                }
            }
        }

        res.json({ id: message.id });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/:id/like", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { id } = req.params;
    const { senderName, senderId } = req.body;

    const { data: current } = await supabase
        .from("messages")
        .select("likes, family_member_id, author_id, liked_by, event_id")
        .eq("id", id)
        .single();
    if (!current) return res.status(404).json({ error: "消息不存在" });

    const likedBy: string[] = current.liked_by || [];
    const userKey = senderId ? String(senderId) : (senderName || "匿名");
    const alreadyLiked = likedBy.includes(userKey);

    let newLikes: number = alreadyLiked ? Math.max(0, (current.likes || 0) - 1) : (current.likes || 0) + 1;
    let newLikedBy: string[] = alreadyLiked ? likedBy.filter(u => u !== userKey) : [...likedBy, userKey];

    const { data: updated, error } = await supabase
        .from("messages")
        .update({ likes: newLikes, liked_by: newLikedBy })
        .eq("id", id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // 🚀 核心修复：优先通知留言作者 (current.author_id)
    const targetMemberId = current.author_id || current.family_member_id;
    if (!alreadyLiked && targetMemberId) {
        try {
            const linkUrl = current.event_id
                ? `/blessing/${current.event_id}?highlightMsg=${id}`
                : `/archive/${current.family_member_id}?highlightMsg=${id}`;
            await supabase.from("notifications").insert({
                member_id: targetMemberId,
                title: "有人给您点赞了",
                content: `${senderName || "有人"} 赞了您的${current.event_id ? '大事记留言' : '记忆档案留言'}`,
                type: "like",
                link_url: linkUrl
            });
        } catch (e) {
            console.error("[NOTIF] Failed like notif:", e);
        }
    }

    res.json({ success: true, likes: updated.likes, isLiked: !alreadyLiked });
});

router.delete("/:id", async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database not connected" });

    const { error } = await supabase.from("messages").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

export default router;
