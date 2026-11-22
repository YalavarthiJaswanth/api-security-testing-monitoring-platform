import mongoose, { Document, Schema } from 'mongoose';

export interface IMonitoringCheck {
  timestamp: Date;
  statusCode: number;
  responseTimeMs: number;
  isHealthy: boolean;
  errorMessage?: string;
}

export interface IMonitoringConfig extends Document {
  apiId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  isEnabled: boolean;
  intervalMinutes: number;
  timeoutMs: number;
  latencyThresholdMs: number;
  lastChecked?: Date;
  currentStatus: 'healthy' | 'degraded' | 'down' | 'unmonitored';
  uptimePercentage: number;
  averageResponseTimeMs: number;
  history: IMonitoringCheck[];
  createdAt: Date;
  updatedAt: Date;
}

const MonitoringCheckSchema = new Schema<IMonitoringCheck>(
  {
    timestamp: { type: Date, default: Date.now },
    statusCode: { type: Number, required: true },
    responseTimeMs: { type: Number, required: true },
    isHealthy: { type: Boolean, required: true },
    errorMessage: { type: String }
  },
  { _id: false }
);

const MonitoringConfigSchema = new Schema<IMonitoringConfig>(
  {
    apiId: { type: Schema.Types.ObjectId, ref: 'Api', required: true, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isEnabled: { type: Boolean, default: true },
    intervalMinutes: { type: Number, default: 5 },
    timeoutMs: { type: Number, default: 5000 },
    latencyThresholdMs: { type: Number, default: 1000 },
    lastChecked: { type: Date },
    currentStatus: {
      type: String,
      enum: ['healthy', 'degraded', 'down', 'unmonitored'],
      default: 'unmonitored'
    },
    uptimePercentage: { type: Number, default: 100 },
    averageResponseTimeMs: { type: Number, default: 0 },
    history: {
      type: [MonitoringCheckSchema],
      default: []
    }
  },
  { timestamps: true }
);

export const MonitoringConfig = mongoose.model<IMonitoringConfig>('MonitoringConfig', MonitoringConfigSchema);
