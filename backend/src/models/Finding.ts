import mongoose, { Document, Schema } from 'mongoose';

export interface IFinding extends Document {
  scanId: mongoose.Types.ObjectId;
  apiId: mongoose.Types.ObjectId;
  title: string;
  owaspCategory: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  endpoint: string;
  method: string;
  evidence: {
    requestUrl?: string;
    requestMethod?: string;
    requestHeaders?: Record<string, any>;
    requestBody?: any;
    responseStatus?: number;
    responseHeaders?: Record<string, any>;
    responseSnippet?: string;
    details?: string;
  };
  explanation: string;
  potentialImpact: string;
  remediation: string;
  confidence: 'confirmed' | 'probable' | 'potential';
  status: 'open' | 'resolved' | 'false_positive';
  isSimulation: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FindingSchema = new Schema<IFinding>(
  {
    scanId: { type: Schema.Types.ObjectId, ref: 'Scan', required: true, index: true },
    apiId: { type: Schema.Types.ObjectId, ref: 'Api', required: true, index: true },
    title: { type: String, required: true },
    owaspCategory: { type: String, required: true, index: true },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'informational'],
      required: true,
      index: true
    },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    evidence: {
      requestUrl: { type: String },
      requestMethod: { type: String },
      requestHeaders: { type: Schema.Types.Mixed },
      requestBody: { type: Schema.Types.Mixed },
      responseStatus: { type: Number },
      responseHeaders: { type: Schema.Types.Mixed },
      responseSnippet: { type: String },
      details: { type: String }
    },
    explanation: { type: String, required: true },
    potentialImpact: { type: String, required: true },
    remediation: { type: String, required: true },
    confidence: {
      type: String,
      enum: ['confirmed', 'probable', 'potential'],
      default: 'probable'
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'false_positive'],
      default: 'open',
      index: true
    },
    isSimulation: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }
  },
  { timestamps: true }
);

FindingSchema.index({ createdBy: 1, severity: 1 });
FindingSchema.index({ createdBy: 1, isSimulation: 1 });

export const Finding = mongoose.model<IFinding>('Finding', FindingSchema);
