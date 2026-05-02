import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60; // Allow up to 60 seconds for Vercel Serverless execution

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { baseImage, garments, clothesMask } = body;

        if (!baseImage) {
            return NextResponse.json(
                { error: 'A base image is required.' },
                { status: 400 }
            );
        }

        if (!garments || garments.length === 0 || !garments[0].image) {
            return NextResponse.json(
                { error: 'At least one valid garment image is required.' },
                { status: 400 }
            );
        }
        
        // If no mask is provided (like from the mobile app), we let IDM-VTON try to auto-mask it
        // Note: For best results, client-side mask is still preferred when possible
        // if (!clothesMask) {
        //     return NextResponse.json(
        //         { error: 'A clothes mask is required for IDM-VTON.' },
        //         { status: 400 }
        //     );
        // }

        // Verify Authentication
        // TEMPORARILY DISABLED for mobile app development (since RN doesn't send cookies easily)
        // const supabase = await createClient();
        // const { data: { user } } = await supabase.auth.getUser();

        // if (!user) {
        //     return NextResponse.json(
        //         { error: 'You must be logged in to generate images.' },
        //         { status: 401 }
        //     );
        // }

        // Initialize the Replicate client
        const replicate = new Replicate({
            auth: process.env.REPLICATE_API_TOKEN,
        });

        console.log("Starting Replicate prediction creation using IDM-VTON...");
        
        const inputPayload: any = {
            human_img: baseImage,
            garm_img: garments[0].image,
            garment_des: garments[0].title || "A shirt",
            category: "upper_body",
            crop: false,
            steps: 30
        };

        if (clothesMask) {
            inputPayload.mask_img = clothesMask;
        }

        const prediction = await replicate.predictions.create({
          version: "0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985", // cuuupid/idm-vton
          input: inputPayload
        });

        // We return immediately with the prediction ID. The frontend will poll for completion.
        return NextResponse.json({
            success: true,
            data: {
                predictionId: prediction.id
            }
        });

    } catch (error: any) {
        console.error('Generation Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to generate image.',
            },
            { status: 500 }
        );
    }
}
