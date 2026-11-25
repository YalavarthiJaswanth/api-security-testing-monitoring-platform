import { URL } from 'url';
import { config } from '../config/env';

// RFC1918 & Cloud Metadata Ranges
const BLOCKED_IP_PATTERNS = [
  /^127\./,                         // Loopback
  /^10\./,                          // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./,                    // 192.168.0.0/16
  /^169\.254\./,                    // Link-local / Cloud metadata (AWS/GCP/Azure)
  /^0\./,                           // 0.0.0.0/8
  /^::1$/,                          // IPv6 loopback
  /^fc00:/i,                        // IPv6 unique local
  /^fe80:/i                         // IPv6 link-local
];

export interface SSRFValidationResult {
  isValid: boolean;
  reason?: string;
  normalizedUrl?: string;
}

/**
 * Validates a target URL against SSRF vulnerabilities.
 * Blocks private IP ranges, loopback, and cloud metadata unless explicitly allowlisted.
 */
export function validateTargetUrl(
  rawUrl: string, 
  options: { allowLocalLab?: boolean; customAllowedHosts?: string[] } = {}
): SSRFValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, reason: 'URL cannot be empty' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (err) {
    return { isValid: false, reason: 'Invalid URL format' };
  }

  // Only allow http and https protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, reason: `Disallowed protocol: ${parsed.protocol}. Only http and https are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // If local lab testing is permitted or hostname is explicitly in allowlist
  const isLabAllowed = options.allowLocalLab || !config.ssrfStrict;
  const allowedList = options.customAllowedHosts || config.allowedHosts;
  let configuredLabHostname = '';
  try {
    if (config.vulnerableLabUrl) {
      configuredLabHostname = new URL(config.vulnerableLabUrl).hostname.toLowerCase();
    }
  } catch {
    // Ignore malformed optional override URL
  }

  if (
    isLabAllowed &&
    (allowedList.includes(hostname) ||
      hostname.includes('vulnerable-lab') ||
      hostname === 'localhost' ||
      (configuredLabHostname && hostname === configuredLabHostname))
  ) {
    return { isValid: true, normalizedUrl: parsed.toString() };
  }

  // Block obvious localhost / internal hostnames
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1') {
    return { isValid: false, reason: 'Access to localhost/loopback addresses is prohibited for real API scans.' };
  }

  if (hostname.endsWith('.internal') || hostname.endsWith('.local') || hostname.endsWith('.corp')) {
    return { isValid: false, reason: 'Access to private internal domains is prohibited.' };
  }

  // Check IP patterns
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { isValid: false, reason: `Target address ${hostname} falls within protected private/metadata ranges.` };
    }
  }

  return { isValid: true, normalizedUrl: parsed.toString() };
}
