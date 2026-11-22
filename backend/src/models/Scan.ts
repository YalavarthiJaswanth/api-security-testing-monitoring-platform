import mongoose, { Document, Schema } from 'mongoose';

export interface IScan extends Document {
  apiId: mongoose.Types.ObjectId;
  scanType: 'full_owasp' | 'quick_audit' | 'misconfiguration' | 'simulation_lab';
  status: 'pending' | 'running' | 'completed' | 'failed';
  isSimulation: boolean;
  targetBaseUrl: string;
  endpointsTested: number;
  durationMs: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
  findingsCount: number;
  logs: string[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ScanSchema = new Schema<IScan>(
  {
    apiId: { type: Schema.Types.ObjectId, ref: 'Api', required: true, index: true },
    scanType: {
      type: String,
      enum: ['full_owasp', 'quick_audit', 'misconfiguration', 'simulation_lab'],
      default: 'full_owasp'
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending'
    },
    isSimulation: { type: Boolean, default: false, index: true },
    targetBaseUrl: { type: String, required: true },
    endpointsTested: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    severityCounts: {
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      informational: { type: Number, default: 0 }
    },
    findingsCount: { type: Number, default: 0 },
    logs: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }
  },
  { timestamps: true }
);

export const Scan = mongoose.model<IScan>('Scan', ScanSchema);
