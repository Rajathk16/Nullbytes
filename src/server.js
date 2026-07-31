import express from "express";
import dotenv from "dotenv";
import medicineRoutes from "./route/medicineRoute.js";
import orderRoutes from "./route/orderRoute.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/medicines", medicineRoutes);
app.use("/api/orders", orderRoutes);


app.listen(3000, () => {
    console.log("Server running on port 3000");
});