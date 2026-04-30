import { Sparkles } from "lucide-react";

export default function HeroSection() {
    return (
        <div className="w-full flex flex-col items-center justify-center pt-24 pb-12 text-center px-4">
            <div className="inline-flex items-center justify-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-black/5 border border-black/10">
                <Sparkles className="w-4 h-4 text-zinc-600" />
                <span className="text-xs font-medium tracking-wide uppercase text-zinc-600">AI-Powered Styling</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extralight tracking-tight text-zinc-900 mb-6 font-serif">
                Virtual Try-On
            </h1>
            <p className="max-w-xl text-lg text-zinc-500 font-light leading-relaxed">
                Upload a photo and any clothing item to instantly see how it fits. Experience high-fidelity fashion generation in seconds.
            </p>
        </div>
    );
}
