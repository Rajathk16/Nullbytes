import dotenv from "dotenv";
dotenv.config();

import { WebSocketServer } from "ws";
import { GoogleGenAI } from "@google/genai";
import supabase from "./src/config/supabase.js";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.key
});

const wss = new WebSocketServer({
    port: 9999
});

console.log("WebSocket Server is running on port 9999");

wss.on("connection", (ws) => {

    ws.send("Welcome to Medicine Recommendation System");

    ws.on("message", async (message) => {
        try {
            const input = message.toString().trim();

            if (!input) {
                return ws.send("Please provide a medicine name or symptoms.");
            }

            // Check if input matches a medicine in Supabase
            const { data: medicines } = await supabase
                .from("medicines")
                .select("name, category")
                .ilike("name", `%${input}%`)
                .limit(1);

            let prompt = "";

            if (medicines && medicines.length > 0) {
                const medicine = medicines[0];
                prompt = `
Medicine: ${medicine.name}
Category: ${medicine.category}

Suggest related or alternative medicines.
Do not prescribe dosage.
Do not diagnose.
Reply strictly as clear, plain text.
`;
            } else {
                prompt = `
Symptoms/Query: ${input}

Suggest medicines that may be related to these symptoms or query.
Do not prescribe dosage.
Do not diagnose.
Reply strictly as clear, plain text.
`;
            }

            const response = await ai.models.generateContent({
                model: "gemini-flash-latest",
                contents: prompt
            });

            // Send response back as plain text
            ws.send(response.text);

        } catch (error) {
            console.error(error);
            ws.send("Something went wrong while generating recommendations.");
        }
    });
});