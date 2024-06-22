import express from "express";
import { PdfController } from "./pdftomail.controller";
const router = express.Router();

router.get("/generate-pdf", PdfController.generateAndUploadInvoicePdf);

export const pdftomail = router;
