import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getSupabase } from "./lib/supabase";

// Internal Route Modules
import memberRoutes from "./routes/memberRoutes";
import eventRoutes from "./routes/eventRoutes";
import memoryRoutes from "./routes/memoryRoutes";
import messageRoutes from "./routes/messageRoutes";
import authRoutes from "./routes/authRoutes";
import aiRoutes from "./routes/aiRoutes";
import notificationRoutes from "./routes/notificationRoutes";

export async function createApp() {
  const app = express();

  // Load environment variables locally
  if (!process.env.VERCEL) {
    try {
      const dotenv = await import("dotenv");
      dotenv.config({ path: ".env.local" });
    } catch (e) {
      console.warn("dotenv not found or .env.local missing, ignoring.");
    }
  }

  // Database Migration (Minimal digital fingerprint check)
  const supabase = getSupabase();
  if (supabase) {
    (async () => {
      try {
        const migQuery = `
          ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sync_uuid UUID DEFAULT gen_random_uuid();
          ALTER TABLE memories ADD COLUMN IF NOT EXISTS sync_uuid UUID DEFAULT gen_random_uuid();
          ALTER TABLE messages ADD COLUMN IF NOT EXISTS sync_uuid UUID DEFAULT gen_random_uuid();
          ALTER TABLE messages ADD COLUMN IF NOT EXISTS family_id TEXT;
          ALTER TABLE events ADD COLUMN IF NOT EXISTS sync_uuid UUID DEFAULT gen_random_uuid();
          ALTER TABLE notifications ADD COLUMN IF NOT EXISTS family_id TEXT;
          NOTIFY pgrst, 'reload schema';
        `;
        await supabase.rpc('exec_sql', { sql_query: migQuery });
      } catch (err: any) {
        console.warn("[MIGRATION] Migration check skipped (exec_sql missing?)");
      }
    })();
  }

  // Middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Error Handling
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    if (err.status === 413) {
      return res.status(413).json({ error: "Payload too large. Please use a smaller image." });
    }
    next();
  });

  // Health Check
  app.get("/api/ping", (req, res) => {
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      supabaseInitialized: !!getSupabase()
    });
  });

  // Mount API Routes
  app.use("/api/family-members", memberRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/memories", memoryRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api", authRoutes); // Includes /login, /register, /me etc.
  app.use("/api", aiRoutes);   // Includes /ai-generate, /generate-blessing-summary
  app.use("/api/notifications", notificationRoutes);

  // 🚀 API 404 Fallback: Prevent infinite PENDING for non-matching API routes
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Static Assets (for Production)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const buildPath = path.resolve(__dirname, "dist");
  app.use(express.static(buildPath));
  app.get("*", (req, res) => {
    if (!req.url.startsWith("/api")) {
      res.sendFile(path.join(buildPath, "index.html"), (err) => {
        if (err) res.status(404).json({ error: "Frontend build not found" });
      });
    }
  });

  return app;
}

// Start Server if run directly
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  createApp().then(app => {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => console.log(`[SERVER] Modular server listening on port ${PORT}`));
  });
}
