import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'A valid URL is required.' },
                { status: 400 }
            );
        }

        // Attempt to fetch the URL
        // Use a basic User-Agent to avoid immediate bot blocking from some sites
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            // Adding a reasonable timeout by AbortController if necessary, but standard fetch implies no timeout unless set natively.
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 1. Extract Title
        let title = $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text() ||
            $('h1').first().text();

        // Clean up title whitespace
        title = title ? title.trim() : 'Unknown Product';

        // 2. Extract Image
        let image = $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            $('link[rel="image_src"]').attr('href');

        // Fallback: finding the first reasonably large image inside a main container
        if (!image) {
            const firstLargeImg = $('main img, #main img, .product-image img, .gallery img').first().attr('src');
            if (firstLargeImg) image = firstLargeImg;
        }

        // Ensure absolute URL if image is a relative path
        if (image && !image.startsWith('http')) {
            try {
                const baseUrl = new URL(url).origin;
                image = new URL(image, baseUrl).href;
            } catch (e) {
                // invalid URL handling
            }
        }

        // 3. Extract Price (Best Effort)
        // Common price selectors in e-commerce
        let price: string | undefined = undefined;
        const priceSelectors = [
            'meta[property="product:price:amount"]',
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
                if (selector.startsWith('meta')) continue; // already checked

                const elPrice = $(selector).first().text().trim();
                // Basic regex to see if it looks like a price (contains numbers and maybe currency symbols)
                if (elPrice && /[\d]+/.test(elPrice) && (elPrice.includes('$') || elPrice.includes('€') || elPrice.includes('£') || elPrice.includes('₺'))) {
                    price = elPrice;
                    break;
                }
            }
        }

        // Clean up price string (remove huge whitespace gaps)
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
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to scrape the provided URL.',
            },
            { status: 500 }
        );
    }
}
