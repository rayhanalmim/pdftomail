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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const html_pdf_1 = __importDefault(require("html-pdf"));
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
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Document</title>
        </head>
        <body>
          <h1>{{title}}</h1>
          <p>{{content}}</p>
        </body>
      </html>
    `;
        // Compile the template
        const template = handlebars_1.default.compile(templateContent);
        // Generate HTML from the template and data
        const html = template({ title: pdfData.title, content: pdfData.content });
        // Use html-pdf to generate the PDF
        html_pdf_1.default.create(html).toFile((err, fileInfo) => {
            if (err) {
                console.error("Error generating PDF:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to generate PDF",
                    error: err,
                });
            }
            // Upload the PDF to AWS S3
            const fileContent = fs_1.default.readFileSync(fileInfo.filename);
            const uploadParams = {
                Bucket: "loamic-media",
                Key: `pdfs/${Date.now()}-${path_1.default.basename(fileInfo.filename)}`,
                Body: fileContent,
                ContentType: "application/pdf",
            };
            s3.upload(uploadParams, (uploadErr, data) => __awaiter(void 0, void 0, void 0, function* () {
                if (uploadErr) {
                    console.error("Error uploading to S3:", uploadErr);
                    fs_1.default.unlinkSync(fileInfo.filename); // Ensure temporary file is deleted even on upload failure
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
                // Delete temporary file
                fs_1.default.unlinkSync(fileInfo.filename);
                res.json({
                    downloadUrl: signedUrl,
                    message: "Email sent successfully",
                });
            }));
        });
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
