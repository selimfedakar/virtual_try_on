"use client";

import { Download, Share, RefreshCcw, Sparkles, Loader2 } from "lucide-react";
import Image from "next/image";
import type { Garment } from "@/app/page";

interface ResultsViewProps {
    garments: Garment[];
    generatedImage: string | null;
    isGenerating: boolean;
    canGenerate: boolean;
    onGenerate: () => void;
}

export default function ResultsView({ garments, generatedImage, isGenerating, canGenerate, onGenerate }: ResultsViewProps) {
    const handleDownload = async () => {
        if (!generatedImage) return;
        try {
            // Fetch the image as a blob to avoid cross-origin download issues if it's a remote URL
            const response = await fetch(generatedImage);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `try-on-${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            console.error("Failed to download image", e);
        }
    };

    const handleShare = async () => {
        if (!generatedImage) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'My Virtual Try-On',
                    url: generatedImage
                });
            } catch (err) {
                console.error("Error sharing:", err);
            }
        } else {
            navigator.clipboard.writeText(generatedImage);
            alert("Image link copied to clipboard!");
        }
    };
    return (
        <div className="w-full max-w-6xl mx-auto pb-32">
            <div className="flex items-center justify-between gap-3 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
                        <span className="text-sm font-semibold">3</span>
                    </div>
                    <h2 className="text-2xl font-light tracking-tight text-zinc-800">Your Virtual Look</h2>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 bg-white rounded-[2rem] border border-zinc-100 shadow-sm p-4 sm:p-8">

                {/* Left Column: Clothing Items */}
                <div className="w-full lg:w-1/3 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-100 pb-8 lg:pb-0 lg:pr-8">
                    <h3 className="text-sm font-medium tracking-wide uppercase text-zinc-400 mb-6 font-sans">
                        Styling Items
                    </h3>

                    <div className="space-y-6 flex-1">
                        {garments.map((garment, idx) => (
                            <div key={idx} className="flex gap-4">
                                <div className="w-20 h-24 rounded-xl bg-zinc-100/80 border border-zinc-100 flex-shrink-0 flex items-center justify-center text-zinc-300 relative overflow-hidden">
                                    {garment.image ? (
                                        <Image src={garment.image} alt={garment.title} fill className="object-cover" />
                                    ) : (
                                        <span className="text-[10px] uppercase font-bold text-zinc-400">No Img</span>
                                    )}
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Item {idx + 1}</span>
                                    <h4 className="text-base font-medium text-zinc-800 leading-snug mb-1 truncate">{garment.title}</h4>
                                    <p className="text-sm font-normal text-zinc-500">{garment.price}</p>
                                </div>
                            </div>
                        ))}

                        {garments.length === 0 && (
                            <div className="text-sm text-zinc-400 font-light italic">
                                Add garments above to style your look.
                            </div>
                        )}
                    </div>

                    <div className="mt-8">
                        <button
                            onClick={onGenerate}
                            disabled={!canGenerate || isGenerating}
                            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium tracking-wide text-sm hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-all shadow-md flex justify-center items-center gap-2 group"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating Magic...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors" />
                                    Generate Magic
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Column: Generated Image */}
                <div className="w-full lg:w-2/3 flex flex-col items-center justify-center">
                    <div className="relative w-full max-w-md aspect-[3/4] bg-zinc-50 rounded-3xl border border-zinc-100 overflow-hidden shadow-inner flex flex-col items-center justify-center">

                        {generatedImage && !isGenerating ? (
                            <>
                                <Image src={generatedImage} alt="Generated Try-On" fill className="object-cover" />
                                {/* Toolbar that appears when image is generated */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-black/5">
                                    <button onClick={handleDownload} className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-600 transition-colors" aria-label="Download">
                                        <Download className="w-5 h-5" />
                                    </button>
                                    <button onClick={handleShare} className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-600 transition-colors" aria-label="Share">
                                        <Share className="w-5 h-5" />
                                    </button>
                                    <div className="w-px h-6 bg-zinc-200 mx-1"></div>
                                    <button onClick={onGenerate} className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-600 transition-colors" aria-label="Regenerate">
                                        <RefreshCcw className="w-5 h-5" />
                                    </button>
                                </div>
                            </>
                        ) : isGenerating ? (
                            <div className="z-10 flex flex-col items-center text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-6">
                                    <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
                                </div>
                                <p className="text-zinc-500 font-light text-lg">Styling your outfit...</p>
                                <p className="text-zinc-400 text-sm mt-2 max-w-xs">This usually takes 10-20 seconds.</p>
                            </div>
                        ) : (
                            // Default Placeholder
                            <div className="z-10 flex flex-col items-center text-center p-8">
                                <div className="absolute inset-0 bg-gradient-to-tr from-zinc-100/50 to-white/10 z-0 pointer-events-none"></div>
                                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-6 z-10">
                                    <Sparkles className="w-8 h-8 text-zinc-300" />
                                </div>
                                <p className="text-zinc-500 font-light text-lg z-10">Your generated look will appear here.</p>
                                <p className="text-zinc-400 text-sm mt-2 max-w-xs z-10">Upload your base photo and select clothes to begin the try-on process.</p>
                            </div>
                        )}

                    </div>
                </div>

            </div>
        </div>
    );
}
