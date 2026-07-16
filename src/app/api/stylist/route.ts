import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { createServiceClient } from '@/lib/supabase/service';

export const maxDuration = 30;

// Fast multimodal Claude model — vision-capable and cheap, right fit for
// per-request garment analysis. Called via raw fetch (no SDK dependency).
const CLAUDE_MODEL = 'claude-haiku-4-5';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// data:image/jpeg;base64,<...> or data:image/png;base64,<...>
const DATA_URI_RE = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/;

// Strict JSON schema for structured output — guarantees a parseable response.
// (Structured outputs require additionalProperties:false + required on objects.)
const STYLIST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['garmentAnalysis', 'suggestions'],
  properties: {
    garmentAnalysis: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'colors', 'style'],
      properties: {
        type: { type: 'string', description: 'Garment type, e.g. "denim jacket"' },
        colors: { type: 'array', items: { type: 'string' } },
        style: { type: 'string', description: 'Overall style + formality, e.g. "casual streetwear"' },
      },
    },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'occasion', 'pairing'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          occasion: { type: 'string' },
          pairing: { type: 'string' },
        },
      },
    },
  },
} as const;

interface StylistResult {
  garmentAnalysis: { type: string; colors: string[]; style: string };
  suggestions: Array<{ title: string; description: string; occasion: string; pairing: string }>;
}

/**
 * A2 — Real AI Stylist. Analyzes a garment photo with a vision LLM and
 * returns 3 personalized outfit suggestions as strict JSON.
 * Quota: 10/day free (check_and_increment_stylist RPC), unlimited for premium.
 */
export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'stylist_unavailable' }, { status: 503 });
    }

    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { garmentImage, category } = body ?? {};

    if (!garmentImage || typeof garmentImage !== 'string') {
      return NextResponse.json({ error: 'garmentImage (data URI) is required' }, { status: 400 });
    }

    const match = garmentImage.match(DATA_URI_RE);
    if (!match) {
      return NextResponse.json(
        { error: 'garmentImage must be a base64 data URI (image/jpeg or image/png)' },
        { status: 400 },
      );
    }
    const mediaType = `image/${match[1]}`;
    const base64Data = match[2];

    // Daily quota — 10/day free, unlimited for premium (handled inside the RPC)
    const supabase = createServiceClient();
    const { data: allowed, error: quotaError } = await supabase.rpc(
      'check_and_increment_stylist',
      { p_user_id: user.id },
    );
    if (quotaError) {
      console.error('[Stylist] Quota RPC failed:', quotaError.message);
      return NextResponse.json({ error: 'stylist_unavailable' }, { status: 503 });
    }
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'stylist_limit_reached',
          message: 'You have used your 10 free stylist requests today. Upgrade to Premium for unlimited styling.',
        },
        { status: 429 },
      );
    }

    const categoryHint = typeof category === 'string' && category
      ? ` The user has tagged this garment as category "${category}".`
      : '';

    const prompt =
      `Analyze the garment in this photo.${categoryHint} ` +
      'Identify its type, main colors, and overall style/formality. ' +
      'Then produce exactly 3 distinct outfit suggestions built around this garment. ' +
      'Each suggestion needs: a short catchy title, a 1-2 sentence description of the full look, ' +
      'the occasion it suits, and the specific pairing items (shoes, bottoms/tops, accessories). ' +
      'Be concrete and fashion-forward. Respond only with JSON matching the required schema.';

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system:
          'You are an expert fashion stylist. You analyze garments from photos and give ' +
          'specific, wearable outfit advice. You always respond with valid JSON only.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
        // Structured output: constrains the response to STYLIST_SCHEMA
        output_config: {
          format: { type: 'json_schema', schema: STYLIST_SCHEMA },
        },
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('[Stylist] Anthropic API error:', anthropicRes.status, errText);
      return NextResponse.json(
        { success: false, error: 'stylist_failed' },
        { status: 502 },
      );
    }

    const message = await anthropicRes.json();

    if (message.stop_reason === 'refusal') {
      return NextResponse.json(
        { success: false, error: 'stylist_refused', message: 'The image could not be analyzed.' },
        { status: 422 },
      );
    }

    const text: string | undefined = message.content?.find(
      (b: { type: string }) => b.type === 'text',
    )?.text;

    const parsed = robustJsonParse(text);
    if (!parsed || !parsed.garmentAnalysis || !Array.isArray(parsed.suggestions)) {
      console.error('[Stylist] Unparseable model output:', text?.slice(0, 500));
      return NextResponse.json(
        { success: false, error: 'stylist_failed' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        garmentAnalysis: parsed.garmentAnalysis,
        suggestions: parsed.suggestions.slice(0, 3),
      },
    });

  } catch (error: any) {
    console.error('Stylist error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Stylist request failed.' },
      { status: 500 },
    );
  }
}

/** Parse model output as JSON; fall back to extracting the outermost {...}. */
function robustJsonParse(text: string | undefined): StylistResult | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
