import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const run = async () => {
    const key = process.env.VITE_GEMINI_API_KEY;
    if (!key) return console.error("No key found!");
    
    console.log("Checking models...");
    const genAI = new GoogleGenerativeAI(key);
    const names = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-pro", "gemini-1.5-pro-latest"];
    
    for (const name of names) {
        for (const version of ['v1', 'v1beta']) {
            try {
                console.log(`Trying ${name} with ${version}...`);
                const model = genAI.getGenerativeModel({ model: name }, { apiVersion: version });
                const result = await model.generateContent("ping");
                console.log(`✅ Model ${name} (${version}) is working!`);
            } catch (e: any) {
                console.log(`❌ Model ${name} (${version}) failed: ${e.message}`);
            }
        }
    }
}

run();
