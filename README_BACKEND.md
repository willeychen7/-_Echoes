# 岁月留声 - 后端配置指南

本项目已迁移至 **FastAPI + Supabase** 架构，实现前后端联通。

## 1. 数据库准备 (Supabase)

1. 登录 [Supabase Console](https://supabase.com/).
2. 创建新项目。
3. 在 **SQL Editor** 中运行根目录下的 `DATABASE.sql` 脚本以初始化数据表。
4. 获取项目的 `URL` 和 `Anon Key`。

## 2. 环境配置

在 `backend/.env` 文件中填入你的 Supabase 凭据：

```env
SUPABASE_URL=你的Supabase项目地址
SUPABASE_KEY=你的Supabase匿名密钥
PORT=8000
```

## 3. 运行后端

```bash
cd backend
pip install -r requirements.txt
python app/main.py
```

## 4. 运行前端

```bash
npm install
npm run dev
```

前端请求会自动代理到 `http://localhost:8000/api`。
