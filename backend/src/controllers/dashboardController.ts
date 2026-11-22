import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { Api } from '../models/Api';
import { Scan } from '../models/Scan';
import { Finding } from '../models/Finding';
import { MonitoringConfig } from '../models/Monitoring';

export async function getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!._id;

    // Fetch counts in parallel from real MongoDB database
    const [
      totalApis,
      totalScans,
      totalFindings,
      findingsBySeverity,
      findingsByOwasp,
      monitoringConfigs,
      recentScans,
      recentFindings
    ] = await Promise.all([
      Api.countDocuments({ createdBy: userId }),
      Scan.countDocuments({ createdBy: userId }),
      Finding.countDocuments({ createdBy: userId, isSimulation: false }),
      Finding.aggregate([
        { $match: { createdBy: userId, isSimulation: false } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      Finding.aggregate([
        { $match: { createdBy: userId, isSimulation: false } },
        { $group: { _id: '$owaspCategory', count: { $sum: 1 } } }
      ]),
      MonitoringConfig.find({ createdBy: userId }),
      Scan.find({ createdBy: userId }).sort({ createdAt: -1 }).limit(5).populate('apiId', 'name baseUrl'),
      Finding.find({ createdBy: userId, isSimulation: false }).sort({ createdAt: -1 }).limit(5).populate('apiId', 'name')
    ]);

    // Format severity breakdown
    const severityMap: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0
    };
    for (const item of findingsBySeverity) {
      if (item._id && severityMap[item._id] !== undefined) {
        severityMap[item._id] = item.count;
      }
    }

    // Format OWASP category breakdown
    const owaspBreakdown: Record<string, number> = {};
    for (const item of findingsByOwasp) {
      if (item._id) {
        owaspBreakdown[item._id] = item.count;
      }
    }

    // Calculate Health & Monitoring statistics
    let healthyCount = 0;
    let degradedCount = 0;
    let downCount = 0;
    let unmonitoredCount = 0;
    let totalUptime = 0;
    let totalLatency = 0;
    let countWithUptime = 0;

    for (const m of monitoringConfigs) {
      if (m.currentStatus === 'healthy') healthyCount++;
      else if (m.currentStatus === 'degraded') degradedCount++;
      else if (m.currentStatus === 'down') downCount++;
      else unmonitoredCount++;

      if (m.history && m.history.length > 0) {
        totalUptime += m.uptimePercentage;
        totalLatency += m.averageResponseTimeMs;
        countWithUptime++;
      }
    }

    const avgUptime = countWithUptime > 0 ? Math.round((totalUptime / countWithUptime) * 10) / 10 : 100;
    const avgLatency = countWithUptime > 0 ? Math.round(totalLatency / countWithUptime) : 0;

    res.json({
      success: true,
      data: {
        totalApis,
        totalScans,
        totalFindings,
        severityBreakdown: severityMap,
        owaspBreakdown,
        healthDistribution: {
          healthy: healthyCount,
          degraded: degradedCount,
          down: downCount,
          unmonitored: unmonitoredCount
        },
        averageUptime: avgUptime,
        averageResponseTimeMs: avgLatency,
        recentScans,
        recentFindings
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch dashboard metrics' });
  }
}
