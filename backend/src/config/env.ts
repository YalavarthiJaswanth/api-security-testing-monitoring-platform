import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/api_sentinel',
  jwtSecret: process.env.JWT_SECRET || 'api-sentinel-jwt-super-secret-key-production-strength-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Master key must be 32 bytes (256 bits) for AES-256-GCM
  encryptionKey: process.env.ENCRYPTION_MASTER_KEY || '12345678901234567890123456789012',
  securityEngineUrl: process.env.SECURITY_ENGINE_URL || 'http://localhost:8000',
  vulnerableLabUrl: process.env.VULNERABLE_LAB_URL || 'http://localhost:5050',
  ssrfStrict: process.env.SSRF_STRICT !== 'false',
  allowedHosts: (process.env.ALLOWED_HOSTS || 'localhost,127.0.0.1,host.docker.internal,vulnerable-lab').split(','),
  monitoringIntervalDefault: 5 // minutes
};
