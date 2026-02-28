import createApp from '../server';

export default async (req: any, res: any) => {
    const app = await createApp();
    // Vercel handles the routing to the express app
    return app(req, res);
};
