import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import handlebars from "handlebars";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"; // Import pdf-lib for PDF generation
import AWS from "aws-sdk";
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

    // HTML template as a string
    const templateContent = `
      <h1>{{title}}</h1>
      <p>{{content}}</p>
    `;

    // Compile the template
    const template = handlebars.compile(templateContent);

    // Generate HTML from the template and data
    const html = template({ title: pdfData.title, content: pdfData.content });

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Add a new page to the document
    const page = pdfDoc.addPage();

    // Load a font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Set the initial position for text drawing
    const { width, height } = page.getSize();
    let yPosition = height - 50;

    // Function to draw text with specific options
    const drawText = (
      text: string,
      fontSize: number,
      color: [number, number, number],
      lineHeight: number
    ) => {
      page.drawText(text, {
        x: 50,
        y: yPosition,
        maxWidth: width - 100,
        size: fontSize,
        font: font,
        color: rgb(color[0], color[1], color[2]),
        lineHeight: lineHeight,
      });
      yPosition -= lineHeight;
    };

    // Split HTML content into parts and draw them separately
    const htmlParts: {
      text: string;
      fontSize: number;
      color: [number, number, number];
      lineHeight: number;
    }[] = [
      { text: pdfData.title, fontSize: 24, color: [0, 0, 0], lineHeight: 30 },
      { text: pdfData.content, fontSize: 12, color: [0, 0, 0], lineHeight: 18 },
    ];

    for (const part of htmlParts) {
      drawText(part.text, part.fontSize, part.color, part.lineHeight);
    }

    // Serialize the PDF document to bytes
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
