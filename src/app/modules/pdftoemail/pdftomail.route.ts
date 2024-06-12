import express from "express";
import { PdfController } from "./pdftomail.controller";
const router = express.Router();

router.post("/generate-pdf", PdfController.generateAndUploadPdf);

export const pdftomail = router;
