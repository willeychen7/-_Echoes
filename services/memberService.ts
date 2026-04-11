import { getSupabase } from "../lib/supabase";

export const syncMemberContent = async (memberId: string | number, name: string, oldName: string | null, avatarUrl: string | null, relationship: string | null) => {
    const supabase = getSupabase();
    if (!supabase) return;

    const memoriesFields: any = {};
    if (name) memoriesFields.author_name = name;
    if (avatarUrl) memoriesFields.author_avatar = avatarUrl;
    if (relationship) memoriesFields.author_relationship = relationship;

    if (Object.keys(memoriesFields).length > 0) {
        await supabase
            .from("memories")
            .update(memoriesFields)
            .eq("author_id", memberId);
    }

    const messageFields: any = {};
    if (name) messageFields.author_name = name;
    if (avatarUrl) messageFields.author_avatar = avatarUrl;
    if (relationship) messageFields.author_role = relationship;

    if (Object.keys(messageFields).length > 0) {
        await supabase
            .from("messages")
            .update(messageFields)
            .eq("family_member_id", memberId)
            .not("event_id", "is", null);
    }
};

export const normalizeGender = (g: any): "male" | "female" | "unknown" => {
    if (!g) return "unknown";
    const s = String(g).toLowerCase();
    if (s === 'male' || s === '男' || s === '1' || s === 'm') return 'male';
    if (s === 'female' || s === '女' || s === '0' || s === 'f') return 'female';
    return 'unknown';
};
