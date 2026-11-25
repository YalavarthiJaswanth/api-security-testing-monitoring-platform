import mongoose, { Schema, Document } from 'mongoose';

export type WebhookEvent =
  | 'scan.completed'
  | 'scan.failed'
  | 'finding.detected'
  | 'monitoring.alert'
  | 'monitoring.recovered'
  | '*';

export interface IWebhookDelivery {
  event: string;
  statusCode: number;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
  payloadSummary?: string;
  timestamp: Date;
}

export interface IWebhook extends Document {
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  customHeaders?: Record<string, string>;
  failureCount: number;
  lastTriggered?: Date;
  lastStatus?: number;
  deliveryHistory: IWebhookDelivery[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookDeliverySchema = new Schema<IWebhookDelivery>(
  {
    event: { type: String, required: true },
    statusCode: { type: Number, required: true },
    responseTimeMs: { type: Number, required: true },
    success: { type: Boolean, required: true },
    errorMessage: { type: String },
    payloadSummary: { type: String },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const WebhookSchema = new Schema<IWebhook>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    secret: { type: String, required: true },
    events: {
      type: [String],
      default: ['scan.completed', 'finding.detected', 'monitoring.alert'],
      enum: ['scan.completed', 'scan.failed', 'finding.detected', 'monitoring.alert', 'monitoring.recovered', '*']
    },
    isActive: { type: Boolean, default: true },
    customHeaders: { type: Map, of: String, default: {} },
    failureCount: { type: Number, default: 0 },
    lastTriggered: { type: Date },
    lastStatus: { type: Number },
    deliveryHistory: { type: [WebhookDeliverySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

WebhookSchema.index({ createdBy: 1, isActive: 1 });

export const Webhook = mongoose.model<IWebhook>('Webhook', WebhookSchema);
