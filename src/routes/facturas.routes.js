import express from "express";
import multer from "multer";
import {
    uploadExcel,
    getFacturas,
    eliminarFactura,
    enviarFacturasResponsable,
    descargarExcel
} from "../controllers/facturas.controller.js";

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), uploadExcel);

router.get("/", getFacturas);
router.get("/excel", descargarExcel);
router.delete("/:documento", eliminarFactura);
router.post("/enviar", enviarFacturasResponsable);

export default router;