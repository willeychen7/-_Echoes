import { GoogleGenerativeAI } from "@google/generative-ai";

let ai: GoogleGenerativeAI | null = null;

export const getAI = () => {
    if (ai) return ai;

    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("[LIB:AI] Missing Gemini API Key.");
        return null;
    }

    ai = new GoogleGenerativeAI(apiKey);
    return ai;
};
