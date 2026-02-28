import createApp from '../server';
let cachedApp: any;

export default async (req: any, res: any) => {
    if (!cachedApp) {
        cachedApp = await createApp();
    }
    // Vercel handles the routing to the express app
    return cachedApp(req, res);
};
