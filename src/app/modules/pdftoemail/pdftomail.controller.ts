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
    if (!pdfData.title || !pdfData.content || !pdfData.items) {
      return res.status(400).json({
        success: false,
        message: "Title, content, and items are required.",
      });
    }

    // HTML template as a string with inline CSS for invoice design
    const templateContent = `
      <style>
        body { font-family: Arial, sans-serif; }
        .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 16px; line-height: 24px; color: #555; }
        .invoice-box table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
        .invoice-box table td { padding: 5px; vertical-align: top; }
        .invoice-box table tr td:nth-child(2) { text-align: right; }
        .invoice-box table tr.top table td { padding-bottom: 20px; }
        .invoice-box table tr.top table td.title { font-size: 45px; line-height: 45px; color: #333; }
        .invoice-box table tr.information table td { padding-bottom: 40px; }
        .invoice-box table tr.heading td { background: #eee; border-bottom: 1px solid #ddd; font-weight: bold; }
        .invoice-box table tr.details td { padding-bottom: 20px; }
        .invoice-box table tr.item td { border-bottom: 1px solid #eee; }
        .invoice-box table tr.item.last td { border-bottom: none; }
        .invoice-box table tr.total td:nth-child(2) { border-top: 2px solid #eee; font-weight: bold; }
      </style>
      <div class="invoice-box">
        <table cellpadding="0" cellspacing="0">
          <tr class="top">
            <td colspan="2">
              <table>
                <tr>
                  <td class="title">
                    <h1>{{title}}</h1>
                  </td>
                  <td>
                    Invoice #: 123<br />
                    Created: {{date}}<br />
                    Due: {{dueDate}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr class="information">
            <td colspan="2">
              <table>
                <tr>
                  <td>
                    {{senderAddress}}
                  </td>
                  <td>
                    {{recipientAddress}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr class="heading">
            <td>Item</td>
            <td>Price</td>
          </tr>
          {{#each items}}
          <tr class="item">
            <td>{{this.description}}</td>
            <td>{{this.price}}</td>
          </tr>
          {{/each}}
          <tr class="total">
            <td></td>
            <td>Total: {{total}}</td>
          </tr>
        </table>
      </div>
    `;

    // Compile the template
    const template = handlebars.compile(templateContent);

    // Generate HTML from the template and data
    const html = template({
      title: pdfData.title,
      date: pdfData.date,
      dueDate: pdfData.dueDate,
      senderAddress: pdfData.senderAddress,
      recipientAddress: pdfData.recipientAddress,
      items: pdfData.items,
      total: pdfData.total,
    });

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
      { text: html, fontSize: 12, color: [0, 0, 0], lineHeight: 18 },
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

const test = async (req: Request, res: Response) => {
  res.send({ messege: "hello from test api" });
};

export const PdfController = {
  generateAndUploadPdf,
  test,
};
