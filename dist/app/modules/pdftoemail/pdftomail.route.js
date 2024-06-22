"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdftomail = void 0;
const express_1 = __importDefault(require("express"));
const pdftomail_controller_1 = require("./pdftomail.controller");
const router = express_1.default.Router();
router.get("/generate-pdf", pdftomail_controller_1.PdfController.generateAndUploadInvoicePdf);
exports.pdftomail = router;
