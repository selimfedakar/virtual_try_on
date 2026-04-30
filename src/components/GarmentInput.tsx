"use client";

import { useState, useRef } from "react";
import { LinkIcon, Plus, Trash2, Loader2, UploadCloud } from "lucide-react";
import Image from "next/image";
import type { Garment } from "@/app/page";

interface GarmentInputProps {
    garments: Garment[];
    setGarments: (garments: Garment[]) => void;
}

export default function GarmentInput({ garments, setGarments }: GarmentInputProps) {
    const [url, setUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadGarment = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setGarments([...garments, {
                    url: "Local Upload",
                    title: file.name,
                    image: reader.result as string,
                    price: "-"
                }]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddUrl = async () => {
        if (!url) return;

        setIsLoading(true);
        try {
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();

            if (data.success) {
                if (!data.data.image) {
                    alert("We couldn't extract a product image from this link (likely blocked by the site). Please download the photo and use the Upload button instead!");
                    return;
                }
                setGarments([...garments, {
                    url: data.data.sourceUrl,
                    title: data.data.title,
                    image: data.data.image,
                    price: data.data.price
                }]);
                setUrl("");
            } else {
                alert("Could not scrape valid product metadata from this URL.");
            }
        } catch (e) {
            alert("Error adding garment URL.");
        } finally {
            setIsLoading(false);
        }
    };

    const removeGarment = (index: number) => {
        setGarments(garments.filter((_, i) => i !== index));
    };

    return (
        <div className="w-full max-w-2xl mx-auto mb-20">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600">
                    <span className="text-sm font-semibold">2</span>
                </div>
                <h2 className="text-2xl font-light tracking-tight text-zinc-800">Choose Clothes</h2>
            </div>

            <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm p-6 sm:p-8">
                <div className="mb-6">
                    <p className="text-sm text-zinc-500 mb-2">
                        Paste links to products from your favorite stores, or upload an image directly.
                    </p>
                    <p className="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg inline-block">
                        💡 For best results, take a photo of the garment laid out on a flat surface.
                    </p>
                </div>

                <div className="space-y-4 mb-6">
                    {garments.map((garment, idx) => (
                        <div key={idx} className="flex items-center gap-4 bg-zinc-50/50 border border-zinc-100 rounded-xl p-3 pr-4 group transition-colors hover:border-zinc-200 hover:bg-white">
                            <div className="w-12 h-12 rounded-lg bg-zinc-200 flex-shrink-0 relative overflow-hidden">
                                {garment.image && <Image src={garment.image} alt={garment.title} fill className="object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-800 truncate">{garment.title}</p>
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
                                    <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{garment.url}</span>
                                </div>
                            </div>
                            <div className="text-xs font-semibold text-zinc-500 mr-2">{garment.price}</div>
                            <button
                                onClick={() => removeGarment(idx)}
                                className="text-zinc-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                                aria-label="Remove item"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    {garments.length === 0 && (
                        <div className="text-center py-6 border border-dashed border-zinc-200 rounded-xl text-zinc-400 text-sm">
                            No garments added yet.
                        </div>
                    )}
                </div>

                {/* Input Field */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1 flex items-center">
                        <div className="absolute left-4 text-zinc-400">
                            <LinkIcon className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            placeholder="Paste a product URL here..."
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-4 pl-12 pr-16 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition-all font-light disabled:opacity-50"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={isLoading}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddUrl();
                            }}
                        />
                        <button
                            onClick={handleAddUrl}
                            disabled={isLoading || !url.trim()}
                            className="absolute right-2 bg-zinc-900 text-white rounded-xl p-2.5 hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center"
                            aria-label="Add URL"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        </button>
                    </div>
                    
                    <div className="hidden sm:block text-zinc-300 font-medium text-sm px-2">OR</div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadGarment}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="h-[56px] px-6 bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-2xl hover:bg-zinc-100 hover:border-zinc-300 transition-colors shadow-sm flex items-center justify-center gap-2 font-medium"
                    >
                        <UploadCloud className="w-5 h-5 text-zinc-500" />
                        Upload
                    </button>
                </div>
            </div>
        </div>
    );
}
