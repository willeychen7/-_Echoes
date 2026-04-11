import { Resend } from "resend";

let resend: Resend | null = null;

export const getResend = () => {
    if (resend) return resend;

    const resendApiKey = process.env.RESEND_API_KEY || "";
    if (!resendApiKey) {
        console.warn("[LIB:RESEND] Missing Resend API Key.");
        return null;
    }

    resend = new Resend(resendApiKey);
    return resend;
};
