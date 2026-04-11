import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const run = async () => {
    const key = process.env.VITE_GEMINI_API_KEY;
    if (!key) return console.error("No key found!");
    
    // List models
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log("Models:", JSON.stringify(data, null, 2));
    } catch (e: any) {
        console.error("List Models Error:", e.message);
    }
}

run();
