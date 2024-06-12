import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import handlebars from "handlebars";
import AWS from "aws-sdk";
import pdf from "html-pdf";
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
    const template = handlebars.compile(templateContent);

    // Generate HTML from the template and data
    const html = template({ title: pdfData.title, content: pdfData.content });

    // Use html-pdf to generate the PDF
    pdf.create(html).toFile((err, fileInfo) => {
      if (err) {
        console.error("Error generating PDF:", err);
        return res.status(500).json({
          success: false,
          message: "Failed to generate PDF",
          error: err,
        });
      }

      // Upload the PDF to AWS S3
      const fileContent = fs.readFileSync(fileInfo.filename);
      const uploadParams = {
        Bucket: "loamic-media",
        Key: `pdfs/${Date.now()}-${path.basename(fileInfo.filename)}`,
        Body: fileContent,
        ContentType: "application/pdf",
      };

      s3.upload(uploadParams, async (uploadErr: any, data: any) => {
        if (uploadErr) {
          console.error("Error uploading to S3:", uploadErr);
          fs.unlinkSync(fileInfo.filename); // Ensure temporary file is deleted even on upload failure
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

        // Delete temporary file
        fs.unlinkSync(fileInfo.filename);

        res.json({
          downloadUrl: signedUrl,
          message: "Email sent successfully",
        });
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
