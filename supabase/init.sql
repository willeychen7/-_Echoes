-- 岁月留声 Supabase 数据库及存储一键初始化脚本
-- 警告：运行此脚本将清空所有现有数据并重置表结构！

-- ==========================================
-- 0. 按依赖顺序删除旧表及策略
-- ==========================================
DROP TABLE IF EXISTS archive_memory_creators; -- 新增：档案创建关系表
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS memories;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS family_members;
DROP TABLE IF EXISTS families;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS question_bank;
DROP TABLE IF EXISTS otp_codes;

-- 尝试删除存储策略
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
    DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
    DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- ==========================================
-- 1. 基础架构表
-- ==========================================

-- 家族表
CREATE TABLE families (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 系统用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone_or_email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    family_id INTEGER REFERENCES families(id) ON DELETE SET NULL,
    member_id INTEGER,
    relationship TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 家族成员画像表
CREATE TABLE family_members (
    id SERIAL PRIMARY KEY,
    family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT,
    avatar_url TEXT,
    bio TEXT,
    birth_date DATE,
    gender TEXT,
    father_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    mother_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    spouse_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    invite_code TEXT UNIQUE,
    is_registered BOOLEAN DEFAULT FALSE,
    standard_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 档案创建维护表 (Archive Memory Creators)
-- NOTE: 记录哪个成员创建了谁的档案，实现权限和归属的分离
CREATE TABLE archive_memory_creators (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE, -- 被创建的人
    creator_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL, -- 创建者
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 家族大事记 (Events)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT,
    description TEXT,
    is_recurring BOOLEAN DEFAULT TRUE,
    member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    member_ids INTEGER[] DEFAULT '{}',  -- 多人关联大事记，存储多个成员 ID
    custom_member_name TEXT,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 互动留言墙 (Messages / Blessings) - 关联大事记
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    family_member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT,
    author_avatar TEXT,
    content TEXT NOT NULL, 
    type TEXT NOT NULL, 
    media_url TEXT,
    duration INTEGER,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    likes INTEGER DEFAULT 0,
    liked_by TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 个人记忆瞬间 (Memories) - 关联档案
CREATE TABLE memories (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    author_relationship TEXT,
    content TEXT NOT NULL, 
    type TEXT NOT NULL,
    media_url TEXT,
    duration INTEGER,
    likes INTEGER DEFAULT 0, -- 缓存的点赞数
    liked_by TEXT[] DEFAULT '{}', -- 缓存的点赞者列表
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 点赞记录表 (Likes) - 专门用于解耦点赞逻辑
-- NOTE: 这里的 target_type 可以是 'message' 或 'memory'
CREATE TABLE likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER, -- 谁点赞
    target_id INTEGER NOT NULL, -- 被点赞的 ID
    target_type TEXT NOT NULL, -- message 或 memory
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 消息通知表
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    link_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 验证码表
CREATE TABLE otp_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 题库表
CREATE TABLE question_bank (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. 安全策略 (RLS)
-- ==========================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_memory_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access" ON families FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON family_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON archive_memory_creators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON likes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON otp_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON question_bank FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 3. 云存储
-- ==========================================

INSERT INTO storage.buckets (id, name, public) VALUES ('family_media', 'family_media', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'family_media' );
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'family_media' );
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING ( bucket_id = 'family_media' );

-- ==========================================
-- 4. 初始数据
-- ==========================================

INSERT INTO question_bank (content, category) VALUES 
('您还记得他/她小时候最喜欢的一件玩具或食物吗？', 'family'),
('描述一个让您感到自豪的时刻。', 'family'),
('他/她对您影响最深的一句话是什么？', 'inspiration'),
('分享一个您和他/她之间最难忘的旅行经历。', 'travel'),
('如果可以用一个词形容他/她，您会选什么？', 'emotion'),
('他/她最拿手的一道菜是什么？', 'life'),
('您最想和他/她一起完成的一个心愿是什么？', 'future'),
('哪一次全家一起做的事，让你印象很深？', 'family'),
('你最希望我们家一直保留的传统是什么？', 'family');
