import { getAI } from "../lib/ai";

export const generateAIContent = async (type: string, payload: any) => {
    const ai = getAI();
    if (!ai) throw new Error("AI not initialized");

    const { messages, memberName, eventTitle, eventRange, events, almanac } = payload;
    const modelNames = ["gemini-2.5-flash", "Gemma-3-1B"];

    let prompt = "";
    const messageContext = (messages || []).map((m: any) => `${m.authorName} (${m.authorRole}): ${m.content}`).join("\n");

    if (type === "biography") {
        const eventsContext = (events || []).map((e: any) => `- ${e.date}: ${e.title} (${e.notes || ""})`).join("\n");
        prompt = `
            你是家族记忆整理师。请根据以下关于 ${memberName} 的生平素材，整理成一篇感人至深、文采斐然的人生小传。
            
            【大事记编年史】：
            ${eventsContext || "暂无具体大事记"}
            
            【家内温馨留言】：
            ${messageContext || "暂无家人口述素材"}
            
            要求：
            1. 采用“见微知著”的叙事风格，将历史节点与家人情感交织在一起。
            2. 语言要温暖、细腻，具有文学性，避免流水账。
            3. 结构清晰，能够展现出人物的性格特质和生命力量。
            4. 字数控制在 400-600 字左右。
            5. 如果素材较少，请基于现有信息进行合理的文学性升华，不要胡编乱造。
        `;
    } else if (type === "summary") {
        prompt = `你是家族记忆整理师。请根据以下家人在${eventTitle}时的祝福：\n${messageContext}\n\n写一段温馨的家族总结。要求语言温暖、细腻。字数300字左右。`;
    } else if (type === "family-secretary") {
        const timeLabel = eventRange === "today" ? "今日" : eventRange === "month" ? "本月" : "本年";
        const eventsText = (events || []).map((e: any) => `- ${e.title} (${e.date})${e.description ? ': ' + e.description : ''}`).join("\n") || "（暂无安排）";
        const almanacContext = almanac
            ? `\n【今日黄历参考】：农历 ${almanac.lunarDate}，${almanac.gzYear}年 ${almanac.gzDay}日，五行${almanac.nayin}，冲${almanac.clash}。喜神${almanac.gods?.xi}、财神${almanac.gods?.cai}。${almanac.festival ? `节令：${almanac.festival}。` : ""}`
            : "";
        prompt = `你是一个温暖的家庭小秘书，懂得将传统黄历智慧转化为现代家庭建议。
${timeLabel}家族大事：
${eventsText}
${almanacContext}
要求：
1. 先用 1-2 句话精炼总结大事（没有就说"今日暂无特别安排"）。
2. 如有黄历数据，自然引入 1 句结合时令的温馨提醒（生活化语言，无迷信色彩）。
3. 使用加粗标题：**${timeLabel}提要：** 和（如有黄历）**时令小提醒：**。
4. 全文 100 字以内，语气亲切自然。`;
    } else if (type === "almanac-interpretation") {
        const { date, lunar, gzYear, gzDay, nayin, clash, gods, yi, ji } = payload;
        prompt = `
            你是一个“家庭日历助手”，负责结合传统黄历和现代生活方式，为一个普通家庭生成每日建议。
            
            【原始黄历数据】：
            日期：${date}
            农历：${lunar}
            岁次：${gzYear}年 ${gzDay}日
            五行：${nayin}
            冲煞：${clash}
            吉位：喜神${gods.xi}、财神${gods.cai}
            宜：${(yi || []).join("、")}
            忌：${(ji || []).join("、")}
            
            【核心要求】：
            1. 不使用任何迷信、恐吓或玄学色彩浓厚的词汇。
            2. 使用温和、平实、生活化的暖心表达。
            3. 将古老的宜忌逻辑转化为具体的现代家庭行为建议。
            
            【输出必须包含以下三部分】：
            1. **今日整体节奏：**(另起一行展示，例如：适合高效推进 / 适合全家放松)
            2. **适合的家庭活动：**(另起一行展示，提供 2 个具体的建议，不要多，也不要少)
            3. **温馨提示：**(另起一行展示，一句话的心灵叮咛)
            
            请务必保留以上 \`**...：**\` 的加粗标题格式，各部分直接换行，字数在 150 字以内。
        `;
    } else if (type === "voice-assistant-command") {
        const { text, currentUser } = payload;
        prompt = `
你是一个极具亲和力、温暖且真实的家庭语音助理【包包小管家】。
当前用户：${currentUser?.name || "家人"}。
用户口述：“${text}”

【核心任务】：
1. 识别用户的操作意图 (add-event, navigate, chat)。
2. 为你的回复（feedback 字段）编写适合【ElevenLabs Bella】音色背景朗读的脚本。

【朗读脚本规范】：
- 开头第一个字符必须是左方括号，提供一个情绪标签。格式：[情绪、场景]。例如：[温柔、深夜陪伴]
- 脚本必须是极其自然的口语。像好朋友、好家人在耳边轻轻呢喃。
- 拒绝书面语，拒绝死板，控制在 2-4 句之间。多用语气词（呀、吧、喔、呢）。
- 语气风格参考：亲近、从容、有温度。

【操作映射】：
- 跳转：/square(广场), /calendar(日历), /archive(档案), /profile(我的), /notifications(消息)
- 记录：如果用户想记事，提取标题、日期、类型和备注。

【重要】：直接返回 JSON 代码块，不要包含任何前后解释文字。
{
  "action": "add-event" | "navigate" | "chat" | "none",
  "params": { "title": "...", "date": "...", "path": "..." },
  "feedback": "[温柔、亲近] 噢，我在呢。你想去哪儿或是想记点什么吗？跟我说就好啦。"
}
`;
    }

    let result;
    let lastError: any = null;

    for (const modelId of modelNames) {
        try {
            const model = ai.getGenerativeModel({ model: modelId });
            result = await model.generateContent(prompt);
            break;
        } catch (err: any) {
            lastError = err;
        }
    }

    if (!result) throw lastError;
    const response = await result.response;
    return response.text();
};
