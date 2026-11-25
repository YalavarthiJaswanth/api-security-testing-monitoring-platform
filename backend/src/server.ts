import express from 'express';
import http from 'http';
import https from 'https';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { monitoringWorker } from './services/monitoringWorker';
import { getOrCreateSslCredentials } from './utils/sslCert';

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

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-sentinel-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    https: config.httpsEnabled ? `Active on port ${config.httpsPort}` : 'Disabled'
  });
});

// Swagger / OpenAPI UI and Specification Endpoints
const swaggerOptions = {
  explorer: true,
  customSiteTitle: 'API Sentinel - OpenAPI Documentation & Explorer'
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
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

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
