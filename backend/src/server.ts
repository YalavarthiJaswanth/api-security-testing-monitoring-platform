import express from 'express';
import http from 'http';
import https from 'https';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config/env';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { monitoringWorker } from './services/monitoringWorker';
import { getOrCreateSslCredentials } from './utils/sslCert';
import { seedDefaultUser } from './utils/seedDefaultUser';

import authRoutes from './routes/authRoutes';
import apiRoutes from './routes/apiRoutes';
import testRoutes from './routes/testRoutes';
import scanRoutes from './routes/scanRoutes';
import findingRoutes from './routes/findingRoutes';
import monitoringRoutes from './routes/monitoringRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import reportRoutes from './routes/reportRoutes';
import simulationRoutes from './routes/simulationRoutes';
import settingsRoutes from './routes/settingsRoutes';
import webhookRoutes from './routes/webhookRoutes';

const app = express();

// Security & utility middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false // Allows Swagger UI inline scripts & styles
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

let dbConnectionPromise: Promise<typeof mongoose> | null = null;

/**
 * Reuse cached Mongoose connection across serverless invocations while keeping
 * traditional server startup unchanged for Docker/Kubernetes/local runs.
 */
export async function ensureDatabaseConnected(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (process.env.VERCEL && !process.env.MONGODB_URI) {
    const cfgErr: any = new Error('Database configuration missing: MONGODB_URI must be configured in Vercel environment variables.');
    cfgErr.statusCode = 503;
    throw cfgErr;
  }
  if (!dbConnectionPromise) {
    dbConnectionPromise = mongoose
      .connect(config.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      })
      .catch((err) => {
        dbConnectionPromise = null;
        const dbErr: any = new Error(`Database connection failed: ${err.message}`);
        dbErr.statusCode = 503;
        throw dbErr;
      });
  }
  await dbConnectionPromise;
}

// Health Check Endpoint
app.get(['/health', '/api/health'], async (req, res) => {
  let dbError: string | undefined;
  if (process.env.VERCEL && config.nodeEnv !== 'test') {
    try {
      await ensureDatabaseConnected();
    } catch (err: any) {
      dbError = err.message;
    }
  }
  const dbConnected = mongoose.connection.readyState === 1;
  const httpStatus = process.env.VERCEL && !dbConnected ? 503 : 200;
  res.status(httpStatus).json({
    status: dbConnected ? 'healthy' : 'degraded',
    service: 'api-sentinel-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
    ...(dbError ? { error: dbError } : {}),
    https: config.httpsEnabled ? `Active on port ${config.httpsPort}` : 'Disabled'
  });
});

// Ensure MongoDB connection is ready during Vercel serverless invocations
app.use(async (req, res, next) => {
  if (process.env.VERCEL && config.nodeEnv !== 'test' && req.path !== '/health' && req.path !== '/api/health') {
    try {
      await ensureDatabaseConnected();
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Swagger / OpenAPI UI and Specification Endpoints (guarded for serverless asset bundling)
const swaggerOptions = {
  explorer: true,
  customSiteTitle: 'API Sentinel - OpenAPI Documentation & Explorer'
};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const swaggerUi = require('swagger-ui-express');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
} catch (swaggerErr: any) {
  console.warn('[Swagger UI Warning] Interactive UI unavailable in this runtime:', swaggerErr?.message);
}
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

// Mount API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/apis', apiRoutes);
app.use('/api/v1/test', testRoutes);
app.use('/api/v1/scans', scanRoutes);
app.use('/api/v1/findings', findingRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/simulation', simulationRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// Centralized Error Handling
app.use(errorHandler);

export interface RunningServers {
  httpServer: http.Server;
  httpsServer?: https.Server;
}

// Database Connection & Server Startup
export async function startServer(): Promise<RunningServers | undefined> {
  try {
    console.log(`[Database] Connecting to MongoDB: ${config.mongoUri}`);
    await mongoose.connect(config.mongoUri);
    console.log('[Database] MongoDB connection established successfully.');

    // Seed default local development demo user only outside production/serverless
    if (config.nodeEnv !== 'production' && !process.env.VERCEL) {
      await seedDefaultUser();
    }

    // Start background monitoring scheduler
    monitoringWorker.start(config.monitoringIntervalDefault);

    // Initialize HTTP Server
    const httpServer = http.createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(config.port, () => {
        console.log(`[API Sentinel Backend] HTTP server running on port ${config.port} (${config.nodeEnv})`);
        console.log(`[Swagger UI] Interactive API documentation: http://localhost:${config.port}/api-docs`);
        resolve();
      });
    });

    let httpsServer: https.Server | undefined;

    // Initialize HTTPS Server if enabled
    if (config.httpsEnabled) {
      try {
        const credentials = await getOrCreateSslCredentials(config.sslKeyPath, config.sslCertPath);
        httpsServer = https.createServer(
          {
            key: credentials.key,
            cert: credentials.cert
          },
          app
        );

        await new Promise<void>((resolve) => {
          httpsServer!.listen(config.httpsPort, () => {
            console.log(`[API Sentinel Backend] HTTPS server running on port ${config.httpsPort} (${config.nodeEnv})`);
            console.log(`[HTTPS Docs] Secure API documentation: https://localhost:${config.httpsPort}/api-docs`);
            resolve();
          });
        });
      } catch (sslErr: any) {
        console.error('[HTTPS Warning] Failed to start HTTPS listener:', sslErr.message);
      }
    }

    return { httpServer, httpsServer };
  } catch (err: any) {
    console.error('[Startup Error] Failed to initialize server:', err.message);
    if (config.nodeEnv !== 'test') {
      process.exit(1);
    }
  }
}

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  startServer();
}

export default app;

// Expose callable Express app for both CommonJS (module.exports) and ESM default loaders on Vercel
Object.defineProperty(app, '__esModule', { value: true });
Object.assign(app, {
  default: app,
  ensureDatabaseConnected,
  startServer
});
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
}
