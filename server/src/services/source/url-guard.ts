import { promises as dns } from 'node:dns';
import net from 'node:net';

import { AppError } from '@/errors/AppError.js';

const MAX_URL_LENGTH = 2048;

export function isBlockedAddress(addr: string): boolean {
  const kind = net.isIP(addr);
  if (kind === 4) return isBlockedIPv4(addr);
  if (kind === 6) return isBlockedIPv6(addr);
  return false;
}

function isBlockedIPv4(addr: string): boolean {
  const parts = addr.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIPv6(addr: string): boolean {
  const norm = addr.toLowerCase();
  if (norm === '::' || norm === '::1') return true;
  if (norm.startsWith('fe80:') || norm.startsWith('fec0:')) return true;
  if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
  if (norm.startsWith('ff')) return true;

  const v4 = norm.match(/^::ffff:([\d.]+)$/);
  if (v4?.[1]) return isBlockedIPv4(v4[1]);
  return false;
}

export async function validatePublicHttpUrl(raw: string): Promise<URL> {
  if (raw.length > MAX_URL_LENGTH) {
    throw new AppError('VALIDATION_ERROR', 'URL exceeds maximum length.', {
      exposeDetails: true,
      details: { max: MAX_URL_LENGTH },
    });
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Not a valid URL.', { exposeDetails: false });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('VALIDATION_ERROR', 'Only http(s) URLs are allowed.', {
      exposeDetails: true,
      details: { protocol: url.protocol },
    });
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === 'ip6-localhost') {
    throw new AppError('VALIDATION_ERROR', 'URL points to a private host.', {
      exposeDetails: false,
    });
  }

  if (net.isIP(hostname) && isBlockedAddress(hostname)) {
    throw new AppError('VALIDATION_ERROR', 'URL points to a private address.', {
      exposeDetails: false,
    });
  }

  if (!net.isIP(hostname)) {
    const resolved = await dns.lookup(hostname, { all: true }).catch(() => null);
    if (!resolved || resolved.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'URL hostname did not resolve.', {
        exposeDetails: false,
      });
    }
    for (const entry of resolved) {
      if (isBlockedAddress(entry.address)) {
        throw new AppError('VALIDATION_ERROR', 'URL resolves to a private address.', {
          exposeDetails: false,
        });
      }
    }
  }
  return url;
}
