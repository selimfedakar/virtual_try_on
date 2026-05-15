import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 30;

// Fallback polling endpoint — used if Realtime webhook hasn't delivered yet
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const res = await fetch(`https://api.fashn.ai/v1/status/${id}`, {
      headers: { 'Authorization': `Bearer ${process.env.FASHN_API_KEY}` },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Failed to check status' }, { status: 500 });
    }

    const data = await res.json();
    console.log('[Fashn.ai] Status response:', JSON.stringify(data));

    const statusMap: Record<string, string> = {
      starting: 'starting',
      in_queue: 'starting',
      processing: 'processing',
      completed: 'succeeded',
      failed: 'failed',
      error: 'failed',
    };

    // Fashn.ai returns output inside outputs or output array
    const generatedImage =
      data.outputs?.[0] ??
      data.output?.[0] ??
      data.outputs?.result ??
      null;

    return NextResponse.json({
      success: true,
      status: statusMap[data.status] ?? data.status,
      data: { generatedImage },
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check prediction status.' },
      { status: 500 },
    );
  }
}
