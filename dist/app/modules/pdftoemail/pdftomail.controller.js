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
const handlebars_1 = __importDefault(require("handlebars"));
const pdf_lib_1 = require("pdf-lib"); // Import pdf-lib for PDF generation
const aws_sdk_1 = __importDefault(require("aws-sdk"));
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
        // HTML template as a string
        const templateContent = `
      <h1>{{title}}</h1>
      <p>{{content}}</p>
    `;
        // Compile the template
        const template = handlebars_1.default.compile(templateContent);
        // Generate HTML from the template and data
        const html = template({ title: pdfData.title, content: pdfData.content });
        // Create a new PDF document
        const pdfDoc = yield pdf_lib_1.PDFDocument.create();
        // Add a new page to the document
        const page = pdfDoc.addPage();
        // Load a font
        const font = yield pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
        // Set the initial position for text drawing
        const { width, height } = page.getSize();
        let yPosition = height - 50;
        // Function to draw text with specific options
        const drawText = (text, fontSize, color, lineHeight) => {
            page.drawText(text, {
                x: 50,
                y: yPosition,
                maxWidth: width - 100,
                size: fontSize,
                font: font,
                color: (0, pdf_lib_1.rgb)(color[0], color[1], color[2]),
                lineHeight: lineHeight,
            });
            yPosition -= lineHeight;
        };
        // Split HTML content into parts and draw them separately
        const htmlParts = [
            { text: pdfData.title, fontSize: 24, color: [0, 0, 0], lineHeight: 30 },
            { text: pdfData.content, fontSize: 12, color: [0, 0, 0], lineHeight: 18 },
        ];
        for (const part of htmlParts) {
            drawText(part.text, part.fontSize, part.color, part.lineHeight);
        }
        // Serialize the PDF document to bytes
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
