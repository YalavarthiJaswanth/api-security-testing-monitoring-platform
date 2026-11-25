import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { Scan } from '../models/Scan';
import { Finding } from '../models/Finding';
import { Api } from '../models/Api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { postmanService } from '../services/postmanService';
import { swaggerSpec } from '../config/swagger';

export async function exportJsonReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { scanId, apiId } = req.query;
    let query: any = { createdBy: req.user!._id };

    if (scanId && mongoose.Types.ObjectId.isValid(String(scanId))) query.scanId = scanId;
    if (apiId && mongoose.Types.ObjectId.isValid(String(apiId))) query.apiId = apiId;

    const findings = await Finding.find(query).populate('apiId', 'name baseUrl environment');
    const scan = (scanId && mongoose.Types.ObjectId.isValid(String(scanId))) ? await Scan.findById(scanId) : null;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=api-sentinel-report-${Date.now()}.json`);

    res.json({
      exportDate: new Date().toISOString(),
      generatedBy: req.user!.username,
      scanSummary: scan || undefined,
      totalFindings: findings.length,
      findings
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to export JSON report' });
  }
}

export async function exportPdfReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { scanId, apiId } = req.query;
    let query: any = { createdBy: req.user!._id };

    if (scanId && mongoose.Types.ObjectId.isValid(String(scanId))) query.scanId = scanId;
    if (apiId && mongoose.Types.ObjectId.isValid(String(apiId))) query.apiId = apiId;

    const findings = await Finding.find(query).populate('apiId', 'name baseUrl environment');
    const scan = (scanId && mongoose.Types.ObjectId.isValid(String(scanId))) ? await Scan.findById(scanId).populate('apiId', 'name baseUrl') : null;
    const api = (apiId && mongoose.Types.ObjectId.isValid(String(apiId))) ? await Api.findById(apiId) : (scan ? scan.apiId : null);

    const doc = new jsPDF();

    // Document Header
    doc.setFillColor(15, 23, 42); // Navy slate
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('API SENTINEL - SECURITY REPORT', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated on: ${new Date().toUTCString()} | Auditor: ${req.user!.username}`, 14, 28);

    // Target Overview
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.text('Target API Assessment Summary', 14, 46);

    const targetName = (api as any)?.name || 'Multi-API Consolidated Scan';
    const targetUrl = (api as any)?.baseUrl || 'All Configured Endpoints';

    const severitySummary = {
      Critical: findings.filter((f) => f.severity === 'critical').length,
      High: findings.filter((f) => f.severity === 'high').length,
      Medium: findings.filter((f) => f.severity === 'medium').length,
      Low: findings.filter((f) => f.severity === 'low').length,
      Informational: findings.filter((f) => f.severity === 'informational').length
    };

    autoTable(doc, {
      startY: 50,
      head: [['Attribute', 'Details']],
      body: [
        ['Target API Name', targetName],
        ['Base URL', targetUrl],
        ['Total Vulnerabilities Detected', findings.length.toString()],
        ['Critical Severity', severitySummary.Critical.toString()],
        ['High Severity', severitySummary.High.toString()],
        ['Medium Severity', severitySummary.Medium.toString()],
        ['Low & Informational', (severitySummary.Low + severitySummary.Informational).toString()]
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] }
    });

    // Detailed Findings Section
    const nextY = (doc as any).lastAutoTable.finalY + 14;
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Detailed Security Findings', 14, nextY);

    const findingsRows = findings.map((f, idx) => [
      (idx + 1).toString(),
      f.title,
      f.severity.toUpperCase(),
      f.owaspCategory,
      `${f.method} ${f.endpoint}`,
      f.remediation.slice(0, 100) + (f.remediation.length > 100 ? '...' : '')
    ]);

    autoTable(doc, {
      startY: nextY + 4,
      head: [['#', 'Vulnerability', 'Severity', 'OWASP Category', 'Endpoint', 'Remediation']],
      body: findingsRows,
      theme: 'striped',
      headStyles: { fillColor: [2, 132, 199] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 40 },
        4: { cellWidth: 35 },
        5: { cellWidth: 47 }
      }
    });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=api-sentinel-report-${Date.now()}.pdf`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to generate PDF report' });
  }
}

/**
 * Export Platform Postman Collection v2.1.0
 */
export async function exportPostmanReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:5001';
    const baseUrl = `${protocol}://${host}`;

    const collection = postmanService.generatePlatformCollection(baseUrl);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=API_Sentinel.postman_collection.json');
    res.json(collection);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to export Postman collection' });
  }
}

/**
 * Export Platform Postman Environment
 */
export async function exportPostmanEnvironment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:5001';
    const baseUrl = `${protocol}://${host}`;

    const env = postmanService.generatePlatformEnvironment(baseUrl);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=API_Sentinel.postman_environment.json');
    res.json(env);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to export Postman environment' });
  }
}

/**
 * Export Platform OpenAPI 3.0 Specification
 */
export async function exportOpenApiReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=api-sentinel-openapi.json');
    res.json(swaggerSpec);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to export OpenAPI specification' });
  }
}
