import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60; // Allow up to 60 seconds for Vercel Serverless execution

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Verify Authentication
        // TEMPORARILY DISABLED for mobile app testing
        // const supabase = await createClient();
        // const { data: { user } } = await supabase.auth.getUser();

        // if (!user) {
        //     return NextResponse.json(
        //         { error: 'You must be logged in to check generation status.' },
        //         { status: 401 }
        //     );
        // }

        // Initialize the Replicate client
        const replicate = new Replicate({
            auth: process.env.REPLICATE_API_TOKEN,
        });

        // Get the prediction status from Replicate
        const prediction = await replicate.predictions.get(id);

        if (prediction?.error) {
            return NextResponse.json(
                { success: false, error: prediction.error },
                { status: 500 }
            );
        }

        let generatedImageUrl = null;

        // If the prediction is successful, extract the URL
        if (prediction.status === "succeeded" && prediction.output) {
            generatedImageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

            // Handle Replicate SDK's FileOutput stream
            if (generatedImageUrl && typeof generatedImageUrl.url === 'function') {
                generatedImageUrl = generatedImageUrl.url().toString();
            } else if (typeof generatedImageUrl !== 'string') {
                console.error("Invalid output from Replicate:", prediction.output);
                return NextResponse.json(
                    { success: false, error: "Replicate returned an invalid or empty output." },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            status: prediction.status,
            data: {
                generatedImage: generatedImageUrl
            }
        });

    } catch (error: any) {
        console.error('Prediction Check Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to check prediction status.',
            },
            { status: 500 }
        );
    }
}
