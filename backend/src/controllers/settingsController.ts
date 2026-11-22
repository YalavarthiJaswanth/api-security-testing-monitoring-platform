import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { config } from '../config/env';

export async function getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const maskedKey = config.encryptionKey.slice(0, 4) + '****************' + config.encryptionKey.slice(-4);

    res.json({
      success: true,
      settings: {
        environment: config.nodeEnv,
        ssrfProtection: {
          strictMode: config.ssrfStrict,
          allowedHosts: config.allowedHosts,
          blockedRanges: ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.169.254']
        },
        encryption: {
          algorithm: 'AES-256-GCM',
          keyStatus: 'Active and Validated',
          keyPreview: maskedKey
        },
        integrations: {
          securityEngineUrl: config.securityEngineUrl,
          vulnerableLabUrl: config.vulnerableLabUrl,
          kubernetesTarget: 'Kind Local Cluster (api-sentinel namespace)'
        },
        user: {
          id: req.user!._id,
          username: req.user!.username,
          email: req.user!.email,
          role: req.user!.role
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to get settings' });
  }
}
