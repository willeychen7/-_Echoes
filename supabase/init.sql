-- 岁月留声 Supabase 数据库一键重置脚本
-- 警告：运行此脚本将清空所有现有数据！

-- 0. 按依赖顺序删除旧表
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS family_members;
DROP TABLE IF EXISTS families;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS question_bank;
DROP TABLE IF EXISTS otp_codes;

-- 1. 家族基础表
CREATE TABLE families (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 系统用户表（用于登录和安全校验）
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    phone_or_email TEXT UNIQUE NOT NULL, -- 账号
    password TEXT NOT NULL,              -- 存储 bcrypt 哈希
    name TEXT,
    family_id INTEGER REFERENCES families(id) ON DELETE SET NULL, -- 所属家族
    member_id INTEGER,                                            -- 对应 family_members 表中的 ID
    relationship TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 家族成员画像表 (family_members)
CREATE TABLE family_members (
    id SERIAL PRIMARY KEY,
    family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT,
    avatar_url TEXT,
    bio TEXT,
    birth_date DATE,
    gender TEXT, -- male, female
    father_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    mother_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    spouse_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    invite_code TEXT UNIQUE,
    is_registered BOOLEAN DEFAULT FALSE,
    standard_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 家族大事记 (events)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    family_id INTEGER REFERENCES families(id) ON DELETE CASCADE, -- 解决空白页的关键
    title TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT, -- birthday, anniversary, other
    description TEXT,
    is_recurring BOOLEAN DEFAULT TRUE,
    member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
    custom_member_name TEXT,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 互动留言墙 (messages)
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    family_member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT,
    author_avatar TEXT,
    content TEXT NOT NULL,
    type TEXT NOT NULL, -- text, audio, image
    media_url TEXT,
    duration INTEGER,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 验证码表 (otp_codes)
CREATE TABLE otp_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 题库表 (question_bank)
CREATE TABLE question_bank (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 安全策略 (Row Level Security)
-- ==========================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（由后端 API 逻辑保护）
CREATE POLICY "Enable all for backend" ON families FOR ALL USING (true);
CREATE POLICY "Enable all for backend" ON users FOR ALL USING (true);
CREATE POLICY "Enable all for backend" ON family_members FOR ALL USING (true);
CREATE POLICY "Enable all for backend" ON events FOR ALL USING (true);
CREATE POLICY "Enable all for backend" ON messages FOR ALL USING (true);
CREATE POLICY "Enable all for backend" ON otp_codes FOR ALL USING (true);
CREATE POLICY "Enable all for backend" ON question_bank FOR ALL USING (true);

-- 插入初始题库数据
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
