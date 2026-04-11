import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const run = async () => {
    const key = process.env.VITE_GEMINI_API_KEY;
    if (!key) return console.error("No key found!");
    
    // Test raw fetch to v1
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`;
    const payload = {
        contents: [{ parts: [{ text: "ping" }] }]
    };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log("Raw Response status:", res.status);
        console.log("Raw Response body:", JSON.stringify(data, null, 2));
    } catch (e: any) {
        console.error("Fetch Error:", e.message);
    }
}

run();
