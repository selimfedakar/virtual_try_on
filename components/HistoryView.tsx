"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function HistoryView() {
    const [generations, setGenerations] = useState<any[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            const supabase = createClient();
            const { data } = await supabase.from('generations').select('*').order('created_at', { ascending: false });
            if (data) setGenerations(data);
        };
        fetchHistory();
    }, []);

    if (generations.length === 0) return null;

    return (
        <div className="w-full mt-12 mb-12">
            <h3 className="text-xl font-light tracking-tight text-zinc-800 mb-6">Your Past Try-Ons</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {generations
                    .filter(gen => typeof gen.generated_image_url === 'string' && (gen.generated_image_url.startsWith('http') || gen.generated_image_url.startsWith('data:')))
                    .map((gen) => (
                    <div key={gen.id} className="relative aspect-[3/4] bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200">
                        <Image src={gen.generated_image_url} alt="Generated" fill className="object-cover" />
                    </div>
                ))}
            </div>
        </div>
    );
}
