import dotenv from "dotenv";
dotenv.config();

import { WebSocketServer } from "ws";
import { GoogleGenAI } from "@google/genai";
import supabase from "./src/config/supabase.js";
import cron from "node-cron";

const ai = new GoogleGenAI({
    apiKey:process.env.key
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

// Run Low Stock Alert check every 1 minute
cron.schedule("* * * * *", async () => {
    try {
        console.log("Checking for low stock medicines...");

        // 1. Fetch medicines from Supabase
        const { data: medicines, error } = await supabase
            .from("medicines")
            .select("id, name, stock, low_stock_threshold");

        if (error) {
            console.error("Supabase error during low stock check:", error.message);
            return;
        }

        if (!medicines || medicines.length === 0) {
            return;
        }

        // 2. Find medicines where stock < low_stock_threshold
        const lowStockMedicines = medicines.filter(
            (med) => med.low_stock_threshold !== null &&
                     med.low_stock_threshold !== undefined &&
                     med.stock < med.low_stock_threshold
        );

        // If no medicines are below the threshold, do nothing
        if (lowStockMedicines.length === 0) {
            return;
        }

        // 3. Send one WebSocket message for each low-stock medicine to all connected clients
        for (const med of lowStockMedicines) {
            const alertMessage = JSON.stringify({
                type: "LOW_STOCK_ALERT",
                medicine_id: med.id,
                medicine_name: med.name,
                stock: med.stock,
                threshold: med.low_stock_threshold
            });

            wss.clients.forEach((client) => {
                // 1 indicates client.readyState is OPEN
                if (client.readyState === 1) {
                    client.send(alertMessage);
                }
            });
        }
    } catch (error) {
        console.error("Error in low stock alert cron job:", error.message);
    }
});