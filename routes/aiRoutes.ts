import express from 'express';
import { generateAIContent } from '../services/aiService';
import WebSocket from 'ws';
import crypto from 'crypto';

const router = express.Router();

/**
 * 🚀 Microsoft Edge TTS (Xiaoxiao) - Perfect Free Mandarin
 */
router.post("/tts/edge", async (req, res) => {
    let ws: WebSocket | null = null;
    try {
        const { text } = req.body;
        const voice = "zh-CN-XiaoxiaoNeural";
        console.log(`[Edge TTS] Synthesizing "${text?.slice(0, 15)}..." using Xiaoxiao`);

        const requestID = crypto.randomBytes(16).toString('hex').toUpperCase();
        console.log(`[Edge TTS] Connecting with ID: ${requestID}`);
        
        ws = new WebSocket(`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9787D7EB30531FA5A2&ConnectionId=${requestID}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
                "Origin": "chrome-extension://jdncjkikncnoocnjhjojidbebedhfhlh",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh;q=0.9"
            }
        });

        const buffers: Buffer[] = [];
        let isDone = false;

        const timeout = setTimeout(() => {
            if (!isDone) {
                console.error("[Edge TTS] Timeout reached");
                ws?.close();
                if (!res.headersSent) res.status(504).json({ error: "Edge TTS Timeout" });
            }
        }, 15000);

        ws.on('open', () => {
            console.log("[Edge TTS] WS Opened");
            const configMsg = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
            ws?.send(configMsg);

            const ssmlMsg = `X-RequestId:${requestID}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='${voice}'>${text}</voice></speak>`;
            ws?.send(ssmlMsg);
        });

        ws.on('message', (data: Buffer, isBinary: boolean) => {
            if (isBinary) {
                const packet = Buffer.from(data);
                const audioHeader = "Path:audio\r\n";
                if (packet.toString().includes(audioHeader)) {
                    const audioContent = packet.subarray(packet.indexOf("\r\n\r\n") + 4);
                    buffers.push(audioContent);
                }
            } else {
                const msg = data.toString();
                if (msg.includes("Path:turn.end")) {
                    isDone = true;
                    clearTimeout(timeout);
                    const finalBuffer = Buffer.concat(buffers);
                    console.log(`[Edge TTS] Synthesis complete, buffer size: ${finalBuffer.length}`);
                    res.set({'Content-Type': 'audio/mpeg', 'Content-Length': finalBuffer.length});
                    res.send(finalBuffer);
                    ws?.close();
                }
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`[Edge TTS] Connection closed: ${code} ${reason}`);
            clearTimeout(timeout);
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            console.error("[Edge TTS WebSocket Error]", err);
            if (!res.headersSent) res.status(500).json({ error: `Edge TTS Internal Error: ${err.message}` });
        });

    } catch (err: any) {
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

const FISH_API_KEY = "4c7d31cb1b154cbdba9cafcd47752a5c";
const DEFAULT_REF_ID = "df1e48bd79b24888a70081d0543669ca";
const ELEVENLABS_API_KEY = "sk_e44e7a0979227f91e6363d2d5414afb93a289d872a1bd2d2";
const ELEVENLABS_VOICE_ID = "hpp4J3VqNfWAUOO0d1Us"; // Bella (Standard - Verified Working for Free Plan)

/**
 * 🚀 ElevenLabs TTS Proxy (Optimized for Mandarin) with Fallback
 */
router.post("/tts/elevenlabs", async (req, res) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 🚀 8s 强行超时，触发备选
    
    try {
        const { text } = req.body;
        console.log(`[Assistant] Synthesizing "${text?.slice(0, 15)}..." using ElevenLabs Bella`);

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
            method: "POST",
            headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.json();
            console.error("[ElevenLabs Error]", error);
            throw new Error("ElevenLabs Failure");
        }

        const audioBuffer = await response.arrayBuffer();
        console.log("[ElevenLabs] Success, sending audio...");
        res.set({ "Content-Type": "audio/mpeg", "Content-Length": audioBuffer.byteLength });
        res.send(Buffer.from(audioBuffer));
    } catch (err: any) {
        clearTimeout(timeoutId);
        console.warn(`[TTS Fallback] ElevenLabs failed/timed out, switching to Volcengine (Doubao): ${err.message}`);
        
        try {
            // 🚀 备选方案：火山引擎 (通常国内访问更快更稳)
            const text = req.body.text;
            const reqid = crypto.randomUUID();
            const volcRes = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer;${VOLC_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    app: { appid: VOLC_APPID, token: VOLC_TOKEN, cluster: "volcano_tts" },
                    user: { uid: "baobao_fallback" },
                    audio: { voice_type: "zh_female_shuangkuai", encoding: "mp3" },
                    request: { reqid, text, text_type: "plain", operation: "query" }
                })
            });

            if (!volcRes.ok) {
                const error = await volcRes.json();
                console.error("[Volcengine Fallback Error]", error);
                throw new Error("Volcengine Fallback Failed");
            }
            const volcData = await volcRes.json();
            if (volcData.data) {
                const buffer = Buffer.from(volcData.data, 'base64');
                console.log("[TTS] Volcengine fallback successful.");
                res.set({ "Content-Type": "audio/mpeg", "Content-Length": buffer.byteLength });
                return res.send(buffer);
            }
            throw new Error("No data in Volcengine response");
        } catch (fallbackErr: any) {
            console.error("[TTS Final Error] All providers failed:", fallbackErr.message);
            res.status(500).json({ error: "All TTS providers failed" });
        }
    }
});

/**
 * 🚀 Fish Audio TTS Proxy (Cai Xukun)
 */
router.post("/tts/fish", async (req, res) => {
    try {
        const { text, reference_id } = req.body;
        const refId = reference_id || DEFAULT_REF_ID;

        console.log(`[TTS] Requesting Fish Audio for text: ${text?.slice(0, 20)}...`);

        const response = await fetch("https://api.fish.audio/v1/tts", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${FISH_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text,
                reference_id: refId,
                format: "mp3",
                latency: "normal"
            })
        });

        console.log(`[Fish Audio] Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Fish Audio API Error]", errorText);
            return res.status(response.status).json({ error: errorText });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': buffer.length,
            'Cache-Control': 'no-cache'
        });
        
        res.send(buffer);

    } catch (err: any) {
        console.error("[TTS Proxy Exception]", err);
        res.status(500).json({ error: "TTS Proxy Internal Error" });
    }
});

router.post("/generate-blessing-summary", async (req, res) => {
    try {
        const { messages, eventTitle } = req.body;
        const text = await generateAIContent("summary", { messages, eventTitle });
        res.json({ text });
    } catch (err: any) {
        res.status(500).json({ error: "AI生成失败: " + err.message });
    }
});

router.post("/ai-generate", async (req, res) => {
    try {
        console.log(`[AI] Generating content for type: ${req.body.type}...`);
        const text = await generateAIContent(req.body.type, req.body);
        console.log(`[AI] Successfully generated content (length: ${text?.length || 0})`);
        res.json({ text });
    } catch (err: any) {
        const errorMsg = err.message || "未知 AI 错误";
        console.error(`[AI] Error generating content: ${errorMsg}`);
        res.status(500).json({ 
          error: errorMsg.includes("429") ? "家族记忆 AI 正忙（配额暂满），请等 1 分钟后再试。" : errorMsg 
        });
    }
});

const VOLC_APPID = "2123412173";
const VOLC_TOKEN = "4bd2162f-f3c5-4340-8360-b0f624f08509";

// --- D-ID AI Animation Integration ---
const DID_API_KEY = process.env.DID_API_KEY || "YOUR_DID_API_KEY"; // 用户需在 .env 填充

/**
 * 🚀 D-ID Photo Animation Route
 */
router.post("/animate/create", async (req, res) => {
    try {
        const { imageUrl, scriptText } = req.body;
        
        if (!imageUrl) return res.status(400).json({ error: "Missing image URL" });
        if (!DID_API_KEY || DID_API_KEY === "YOUR_DID_API_KEY") {
            return res.status(500).json({ error: "D-ID API Key not configured in server environment." });
        }

        console.log(`[D-ID] Creating talk for image: ${imageUrl.slice(0, 50)}...`);

        const response = await fetch("https://api.d-id.com/talks", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${Buffer.from(DID_API_KEY + ":").toString('base64')}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                source_url: imageUrl,
                script: {
                    type: "text",
                    subtitles: "false",
                    provider: { type: "microsoft", voice_id: "zh-CN-XiaoxiaoNeural" },
                    input: scriptText || "亲爱的家人，见到你真高兴！咱们家族的记忆，永远是最温暖的陪伴。"
                },
                config: {
                    fluent: "true",
                    pad_audio: "0.0",
                    stitch: true // Ensure head is stitched back to background
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("[D-ID Create Error]", data);
            return res.status(response.status).json(data);
        }

        console.log(`[D-ID] Talk created, ID: ${data.id}`);
        res.json({ id: data.id });
    } catch (err: any) {
        console.error("[D-ID Exception]", err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/animate/status/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(`https://api.d-id.com/talks/${id}`, {
            headers: {
                "Authorization": `Basic ${Buffer.from(DID_API_KEY + ":").toString('base64')}`
            }
        });

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);

        console.log(`[D-ID] Status for ${id}: ${data.status}`);
        res.json({
            status: data.status,
            result_url: data.result_url,
            error: data.error
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 🚀 Volcengine (ByteDance/Doubao) TTS Proxy
 */
router.post("/tts/volcengine", async (req, res) => {
    try {
        const { text } = req.body;
        const reqid = crypto.randomUUID();
        console.log(`[Assistant] Synthesizing "${text?.slice(0, 15)}..." using Volcengine (Doubao)`);

        const response = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
            method: "POST",
            headers: {
                "Authorization": `Bearer;${VOLC_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                app: {
                    appid: VOLC_APPID,
                    token: VOLC_TOKEN,
                    cluster: "volcano_tts"
                },
                user: {
                    uid: "family_secretary_baobao"
                },
                audio: {
                    voice_type: "zh_female_shuangkuai", // Standard Brisk Young Female
                    encoding: "mp3",
                    speed_ratio: 1.0,
                    volume_ratio: 1.0,
                    pitch_ratio: 1.0
                },
                request: {
                    reqid,
                    text,
                    text_type: "plain",
                    operation: "query"
                }
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("[Volcengine Error]", error);
            return res.status(response.status).json(error);
        }

        const data = await response.json();
        if (data.data) {
            const audioBuffer = Buffer.from(data.data, 'base64');
            res.set({ "Content-Type": "audio/mpeg", "Content-Length": audioBuffer.byteLength });
            res.send(audioBuffer);
        } else {
            console.error("[Volcengine] No audio data in response", data);
            res.status(500).json({ error: "Empty Audio Data" });
        }
    } catch (err: any) {
        console.error("[Volcengine Proxy Error]", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
