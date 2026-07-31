import express from "express";
import dotenv from "dotenv";
import medicineRoutes from "./route/medicineRoute.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/medicines", medicineRoutes);


app.listen(3000, () => {
    console.log("Server running on port 3000");
});