"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoDataModel = void 0;
const mongoose_1 = require("mongoose");
// DemoData model without a schema
exports.DemoDataModel = (0, mongoose_1.model)("DemoData", new mongoose_1.Schema({}, { strict: false }));
