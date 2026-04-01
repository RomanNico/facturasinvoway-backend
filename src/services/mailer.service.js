import axios from "axios";

const MAILER_URL = process.env.MAILER_URL;
const MAILER_API_KEY = process.env.MAILER_API_KEY;

export const enviarCorreo = async (to, asunto, html) => {
    try {
        const data = {
            Subject: asunto,
            Template: {
                Type: "text/html",
                Value: html,
            },
            Recipients: [
                {
                    To: to,
                },
            ],
        };

        const response = await axios.post(
            `${MAILER_URL}/api/mailer/delivery`,
            data,
            {
                headers: {
                    accept: "*/*",
                    "Content-Type": "application/json",
                    "x-api-key": MAILER_API_KEY,
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error("Error enviando correo:", error.response?.data || error.message);
        throw error;
    }
};