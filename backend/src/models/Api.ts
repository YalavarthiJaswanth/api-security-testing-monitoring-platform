import mongoose, { Document, Schema } from 'mongoose';

export interface IEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    required: boolean;
    type?: string;
    description?: string;
  }>;
  requestBodySchema?: any;
  responseSchema?: any;
  authRequired?: boolean;
}

export interface IApi extends Document {
  name: string;
  baseUrl: string;
  description?: string;
  environment: 'development' | 'staging' | 'production' | 'testing';
  authType: 'none' | 'bearer' | 'apiKey' | 'basic';
  authConfig?: {
    tokenEncrypted?: string;
    apiKeyHeader?: string;
    apiKeyEncrypted?: string;
    username?: string;
    passwordEncrypted?: string;
  };
  endpoints: IEndpoint[];
  openapiSpecRaw?: string;
  isLabApi: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EndpointSchema = new Schema<IEndpoint>(
  {
    path: { type: String, required: true },
    method: {
      type: String,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      uppercase: true
    },
    summary: { type: String },
    description: { type: String },
    parameters: [
      {
        name: { type: String, required: true },
        in: { type: String, enum: ['query', 'header', 'path', 'cookie'], required: true },
        required: { type: Boolean, default: false },
        type: { type: String },
        description: { type: String }
      }
    ],
    requestBodySchema: { type: Schema.Types.Mixed },
    responseSchema: { type: Schema.Types.Mixed },
    authRequired: { type: Boolean, default: false }
  },
  { _id: false }
);

const ApiSchema = new Schema<IApi>(
  {
    name: { type: String, required: true, trim: true },
    baseUrl: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    environment: {
      type: String,
      enum: ['development', 'staging', 'production', 'testing'],
      default: 'development'
    },
    authType: {
      type: String,
      enum: ['none', 'bearer', 'apiKey', 'basic'],
      default: 'none'
    },
    authConfig: {
      tokenEncrypted: { type: String },
      apiKeyHeader: { type: String },
      apiKeyEncrypted: { type: String },
      username: { type: String },
      passwordEncrypted: { type: String }
    },
    endpoints: [EndpointSchema],
    openapiSpecRaw: { type: String },
    isLabApi: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }
  },
  { timestamps: true }
);

ApiSchema.index({ createdBy: 1, name: 1 });

export const Api = mongoose.model<IApi>('Api', ApiSchema);
