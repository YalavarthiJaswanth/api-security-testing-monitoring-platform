import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { monitoringWorker } from './services/monitoringWorker';

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

const app = express();

// Security & utility middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
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
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
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

// Centralized Error Handling
app.use(errorHandler);

// Database Connection & Server Startup
export async function startServer() {
  try {
    console.log(`[Database] Connecting to MongoDB: ${config.mongoUri}`);
    await mongoose.connect(config.mongoUri);
    console.log('[Database] MongoDB connection established successfully.');

    // Start background monitoring scheduler
    monitoringWorker.start(config.monitoringIntervalDefault);

    const server = app.listen(config.port, () => {
      console.log(`[API Sentinel Backend] Server running on port ${config.port} (${config.nodeEnv})`);
    });

    return server;
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
