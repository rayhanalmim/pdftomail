import express from "express";
import { PdfController } from "./pdftomail.controller";
const router = express.Router();

router.post("/generate-pdf", PdfController.generateAndUploadPdf);
router.get("/test", PdfController.test);

export const pdftomail = router;
