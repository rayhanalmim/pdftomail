"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfController = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const pdf_lib_1 = require("pdf-lib"); // Import pdf-lib for creating PDFs
const config_1 = __importDefault(require("../../config"));
// Configure AWS
aws_sdk_1.default.config.update({
    accessKeyId: config_1.default.aws_access_key_id,
    secretAccessKey: config_1.default.aws_secret_access_key,
    region: config_1.default.aws_region,
    signatureVersion: "v4",
});
const s3 = new aws_sdk_1.default.S3();
const generateAndUploadPdf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pdfData = req.body;
        // Validate input data
        if (!pdfData.title || !pdfData.content) {
            return res.status(400).json({
                success: false,
                message: "Title and content are required.",
            });
        }
        // Create a new PDF document
        const pdfDoc = yield pdf_lib_1.PDFDocument.create();
        const page = pdfDoc.addPage();
        // Draw title and content on the page
        page.drawText(pdfData.title, { x: 50, y: 750 });
        page.drawText(pdfData.content, { x: 50, y: 700 });
        // Serialize the PDFDocument to bytes
        const pdfBytes = yield pdfDoc.save();
        // Upload the PDF to AWS S3
        const uploadParams = {
            Bucket: "loamic-media",
            Key: `pdfs/${Date.now()}-output.pdf`,
            Body: pdfBytes,
            ContentType: "application/pdf",
        };
        s3.upload(uploadParams, (uploadErr, data) => __awaiter(void 0, void 0, void 0, function* () {
            if (uploadErr) {
                console.error("Error uploading to S3:", uploadErr);
                return res.status(500).json({
                    success: false,
                    message: "Failed to upload PDF to S3",
                    error: uploadErr,
                });
            }
            // Generate a pre-signed URL for the uploaded PDF
            const signedUrl = yield s3.getSignedUrlPromise("getObject", {
                Bucket: "loamic-media",
                Key: uploadParams.Key,
                Expires: 60 * 5, // Link expires in 5 minutes
            });
            res.json({
                downloadUrl: signedUrl,
                message: "PDF generated and uploaded successfully",
            });
        }));
    }
    catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({
            success: false,
            message: "Something went wrong!",
            error: error,
        });
    }
});
exports.PdfController = {
    generateAndUploadPdf,
};
