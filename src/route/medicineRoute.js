import express from "express";
import {addMedicine,updateStock, getMedicines} from "../controllers/medicineController.js";

const router = express.Router();

router.post("/add", addMedicine);
router.patch("/:id/stock", updateStock);
router.get("/get", getMedicines)
export default router;