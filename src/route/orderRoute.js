import express from "express";
import { placeOrder, getOrderDetails } from "../controllers/orderController.js";

const router = express.Router();

router.post("/place", placeOrder);
router.get("/:order_id", getOrderDetails);

export default router;
