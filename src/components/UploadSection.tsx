"use client";

import { UploadCloud, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

interface UploadSectionProps {
    baseImage: string | null;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function UploadSection({ baseImage, onUpload }: UploadSectionProps) {
    return (
        <div className="w-full max-w-2xl mx-auto mb-16">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
                    <span className="text-sm font-semibold">1</span>
                </div>
                <h2 className="text-2xl font-light tracking-tight text-zinc-800">Your Base Photo</h2>
            </div>

            <label className="relative group cursor-pointer border-2 border-dashed border-zinc-200 hover:border-zinc-400 rounded-3xl p-12 transition-all duration-300 bg-white/50 hover:bg-white flex flex-col items-center justify-center text-center overflow-hidden min-h-[300px]">
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onUpload}
                />

                {baseImage ? (
                    <Image
                        src={baseImage}
                        alt="Base photo"
                        fill
                        className="object-contain p-4"
                    />
                ) : (
                    <>
                        <div className="w-16 h-16 mb-6 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                            <UploadCloud className="w-8 h-8 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                        </div>
                        <h3 className="text-xl font-medium text-zinc-800 mb-2">Upload a clear photo</h3>
                        <p className="text-sm text-zinc-500 max-w-sm mb-2">
                            Drag and drop an image of yourself, or click to browse. For best results, use a well-lit, full-body photo against a neutral background.
                        </p>
                        <p className="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg inline-block">
                            💡 Please ensure you are alone in the photo.
                        </p>

                        {/* Decorative static element to represent state */}
                        <div className="absolute bottom-4 right-4 flex gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 text-xs font-medium text-zinc-500">
                                <ImageIcon className="w-3.5 h-3.5" />
                                Max 5MB
                            </div>
                        </div>
                    </>
                )}
            </label>
        </div>
    );
}
