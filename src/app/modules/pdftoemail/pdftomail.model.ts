import { Document, model, Schema } from "mongoose";

// DemoData model without a schema
export const DemoDataModel = model<Document>(
  "DemoData",
  new Schema({}, { strict: false })
);
