import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { lookup } from 'node:dns/promises';
import { getAuthenticatedUser } from '@/lib/apiAuth';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // ~2MB
const MAX_REDIRECTS = 3;

/**
 * SSRF guard: https only, no localhost / *.local / private, loopback,
 * or link-local addresses (both IP-literal hosts and DNS-resolved ones).
 * This blocks the obvious cases; it is not a full DNS-rebinding defense.
 */
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only https URLs are allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Obvious hostname-based blocks
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error('URL host is not allowed.');
  }

  // IP-literal host (IPv4 dotted or bracketed IPv6)
  if (isIpLiteral(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('URL host is not allowed.');
    return parsed;
  }

  // Resolve DNS and reject if any resolved address is private/loopback/link-local
  try {
    const addresses = await lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) throw new Error('URL host is not allowed.');
    }
  } catch (e: any) {
    if (e.message === 'URL host is not allowed.') throw e;
    throw new Error('Could not resolve URL host.');
  }

  return parsed;
}

function isIpLiteral(hostname: string): boolean {
  // IPv6 hostnames in URLs come bracketed; URL.hostname strips brackets in Node? No — it keeps them.
  const bare = hostname.replace(/^\[|\]$/g, '');
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(bare) || bare.includes(':');
}

function isPrivateIp(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '').toLowerCase();

  // IPv6
  if (bare.includes(':')) {
    if (bare === '::' || bare === '::1') return true;                 // loopback / unspecified
    if (bare.startsWith('fc') || bare.startsWith('fd')) return true;  // unique local fc00::/7
    if (bare.startsWith('fe8') || bare.startsWith('fe9') ||
        bare.startsWith('fea') || bare.startsWith('feb')) return true; // link-local fe80::/10
    if (bare.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 — check the embedded IPv4
      return isPrivateIp(bare.slice(7));
    }
    return false;
  }

  // IPv4
  const parts = bare.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed — reject to be safe
  }
  const [a, b] = parts;
  if (a === 0) return true;                       // 0.0.0.0/8
  if (a === 10) return true;                      // 10.0.0.0/8
  if (a === 127) return true;                     // loopback
  if (a === 169 && b === 254) return true;        // link-local (incl. AWS metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;        // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}

/** Fetch with manual redirect handling so every hop is re-validated. */
async function safeFetch(startUrl: URL, signal: AbortSignal): Promise<Response> {
  let currentUrl = startUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const response = await fetch(currentUrl.href, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without location header.');
      // Re-validate the redirect target against the same SSRF rules
      currentUrl = await assertSafeUrl(new URL(location, currentUrl).href);
      continue;
    }

    return response;
  }
  throw new Error('Too many redirects.');
}

/** Read a response body as text, capped at MAX_BODY_BYTES. */
async function readBodyCapped(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error('Response too large.');

  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('Response too large.');
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

export async function POST(req: Request) {
    try {
        // Auth — same Bearer pattern as /api/generate
        const user = await getAuthenticatedUser(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'A valid URL is required.' },
                { status: 400 }
            );
        }

        const safeUrl = await assertSafeUrl(url);

        // 5s hard timeout for the whole fetch (including redirects)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        let html: string;
        try {
            const response = await safeFetch(safeUrl, controller.signal);

            if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
            }

            // Only accept HTML documents
            const contentType = response.headers.get('content-type') ?? '';
            if (!contentType.includes('text/html')) {
                throw new Error('URL did not return an HTML document.');
            }

            html = await readBodyCapped(response);
        } finally {
            clearTimeout(timeout);
        }

        const $ = cheerio.load(html);

        // 1. Extract Title
        let title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text() ||
            $('h1').first().text();

        title = title ? title.trim() : 'Unknown Product';

        // 2. Extract Image
        let image = $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            $('link[rel="image_src"]').attr('href');

        // Fallback: first reasonably large image inside a main container
        if (!image) {
            const firstLargeImg = $('main img, #main img, .product-image img, .gallery img').first().attr('src');
            if (firstLargeImg) image = firstLargeImg;
        }

        // Ensure absolute URL if image is a relative path
        if (image && !image.startsWith('http')) {
            try {
                image = new URL(image, safeUrl.origin).href;
            } catch {
                // invalid URL — drop it
                image = undefined;
            }
        }

        // 3. Extract Price (Best Effort)
        let price: string | undefined = undefined;
        const priceSelectors = [
            '.price',
            '.product-price',
            '[data-price]',
            'span[class*="price"]',
            'div[class*="price"]'
        ];

        // Check meta tags first
        const metaPrice = $('meta[property="product:price:amount"]').attr('content');
        const metaCurrency = $('meta[property="product:price:currency"]').attr('content') || '$';
        if (metaPrice) {
            price = `${metaCurrency}${metaPrice}`;
        }

        // If no meta price, search DOM elements
        if (!price) {
            for (const selector of priceSelectors) {
                const elPrice = $(selector).first().text().trim();
                if (elPrice && /[\d]+/.test(elPrice) && (elPrice.includes('$') || elPrice.includes('€') || elPrice.includes('£') || elPrice.includes('₺'))) {
                    price = elPrice;
                    break;
                }
            }
        }

        if (price) {
            price = price.replace(/\s+/g, ' ').trim();
        }

        return NextResponse.json({
            success: true,
            data: {
                title,
                image: image || null,
                price: price || 'Price unavailable',
                sourceUrl: url
            }
        });

    } catch (error: any) {
        console.error('Scraping Error:', error);
        const message = error.name === 'AbortError'
            ? 'The URL took too long to respond.'
            : error.message || 'Failed to scrape the provided URL.';
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
