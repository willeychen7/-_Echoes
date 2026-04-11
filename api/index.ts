import { createApp } from '../server.js';
let cachedApp: any;

export default async function handler(req: any, res: any) {
    try {
        if (!cachedApp) {
            console.log("[VERCEL] Booting Express App...");
            cachedApp = await createApp();
        }
        return cachedApp(req, res);
    } catch (e: any) {
        console.error("[VERCEL] Entry Crash:", e);
        res.status(500).json({
            error: "Server Initialization Failed",
            details: e.message
        });
    }
}
