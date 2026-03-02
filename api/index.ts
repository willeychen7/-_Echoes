import createApp from '../server';
let cachedApp: any;

export default async (req: any, res: any) => {
    try {
        if (!cachedApp) {
            console.log("[VERCEL] Initializing app...");
            cachedApp = await createApp();
            console.log("[VERCEL] App initialized successfully.");
        }
        return cachedApp(req, res);
    } catch (err: any) {
        console.error("[VERCEL] CRITICAL: App failed to start:", err);
        res.status(500).json({
            error: "App initialization failed",
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};
