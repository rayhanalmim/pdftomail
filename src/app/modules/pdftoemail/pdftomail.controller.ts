import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import handlebars from "handlebars";
import AWS from "aws-sdk";
import { PDFDocument } from "pdf-lib"; // Import pdf-lib for creating PDFs
import config from "../../config";

// Configure AWS
AWS.config.update({
  accessKeyId: config.aws_access_key_id,
  secretAccessKey: config.aws_secret_access_key,
  region: config.aws_region,
  signatureVersion: "v4",
});
const s3 = new AWS.S3();

const generateAndUploadPdf = async (req: Request, res: Response) => {
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
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    // Draw title and content on the page
    page.drawText(pdfData.title, { x: 50, y: 750 });
    page.drawText(pdfData.content, { x: 50, y: 700 });

    // Serialize the PDFDocument to bytes
    const pdfBytes = await pdfDoc.save();

    // Upload the PDF to AWS S3
    const uploadParams = {
      Bucket: "loamic-media",
      Key: `pdfs/${Date.now()}-output.pdf`,
      Body: pdfBytes,
      ContentType: "application/pdf",
    };

    s3.upload(uploadParams, async (uploadErr: any, data: any) => {
      if (uploadErr) {
        console.error("Error uploading to S3:", uploadErr);
        return res.status(500).json({
          success: false,
          message: "Failed to upload PDF to S3",
          error: uploadErr,
        });
      }

      // Generate a pre-signed URL for the uploaded PDF
      const signedUrl = await s3.getSignedUrlPromise("getObject", {
        Bucket: "loamic-media",
        Key: uploadParams.Key,
        Expires: 60 * 5, // Link expires in 5 minutes
      });

      res.json({
        downloadUrl: signedUrl,
        message: "PDF generated and uploaded successfully",
      });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      success: false,
      message: "Something went wrong!",
      error: error,
    });
  }
};

export const PdfController = {
  generateAndUploadPdf,
};
