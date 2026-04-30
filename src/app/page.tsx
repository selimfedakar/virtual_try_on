"use client";

import { useState, useEffect } from "react";
import HeroSection from "@/components/HeroSection";
import UploadSection from "@/components/UploadSection";
import GarmentInput from "@/components/GarmentInput";
import ResultsView from "@/components/ResultsView";
import AuthModal from "@/components/AuthModal";
import HistoryView from "@/components/HistoryView";
import { createClient } from "@/lib/supabase/client";
import { extractClothesMask } from "@/lib/mediapipe";

export type Garment = {
  url: string;
  title: string;
  image: string | null;
  price: string;
};

export default function Home() {
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clothesMask, setClothesMask] = useState<string | null>(null);
  
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    // Check active sessions and sets the user
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      // Listen for changes on auth state (sign in, sign out, etc.)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    };
    checkUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  const handleUploadBaseImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageUri = reader.result as string;
        setBaseImage(imageUri);
        
        // Extract the user's clothes mask silently in the background
        const mask = await extractClothesMask(imageUri);
        setClothesMask(mask);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!baseImage || garments.length === 0) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!clothesMask) {
      alert("Still processing your image (extracting clothes mask). Please wait a few seconds and try again.");
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      // 1. Kick off the generation with IDM-VTON payload
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            baseImage, 
            garments,
            clothesMask
        })
      });

      const data = await response.json();

      if (!data.success || !data.data.predictionId) {
        throw new Error(data.error || "Failed to start generation");
      }

      const predictionId = data.data.predictionId;
      
      // 2. Poll for the result
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      
      while (true) {
        await sleep(3000); // Wait 3 seconds
        
        const statusRes = await fetch(`/api/predictions/${predictionId}`);
        const statusData = await statusRes.json();
        
        if (!statusData.success) {
            throw new Error(statusData.error || "Failed to check status");
        }
        
        if (statusData.status === "succeeded") {
            const finalImage = statusData.data.generatedImage;
            
            setGeneratedImage(finalImage);
            
            // 3. Save successful generation to Supabase database directly from client
            const supabase = createClient();
            await supabase.from('generations').insert({
                user_id: user.id,
                base_image_url: baseImage.length > 500 ? "data_uri_omitted" : baseImage, 
                garment_image_url: (garments[0].image && garments[0].image.length > 500) ? "data_uri_omitted" : garments[0].image, 
                garment_title: garments[0].title,
                generated_image_url: finalImage
            });
            break;
            
        } else if (statusData.status === "failed" || statusData.status === "canceled") {
            throw new Error(`Generation ${statusData.status}: ${statusData.error || 'Unknown error'}`);
        }
        
        // If status is "starting" or "processing", the loop continues
      }

    } catch (err: any) {
      console.error(err);
      alert("An error occurred: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-zinc-200">
      <main className="mx-auto flex flex-col items-center justify-start w-full transition-all">
        {user ? (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-4">
            <span className="text-sm text-zinc-500">{user.email}</span>
            <button onClick={handleLogout} className="text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors">Log out</button>
          </div>
        ) : (
          <div className="absolute top-4 right-4 z-10">
            <button onClick={() => setIsAuthModalOpen(true)} className="px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-all shadow-sm">Log in</button>
          </div>
        )}
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
          onSuccess={() => setIsAuthModalOpen(false)} 
        />
        <HeroSection />

        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center">
          <UploadSection baseImage={baseImage} onUpload={handleUploadBaseImage} />
          <GarmentInput garments={garments} setGarments={setGarments} />
        </div>

        <div className="w-full bg-zinc-50 border-t border-zinc-100 mt-12 py-20 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <ResultsView
            garments={garments}
            generatedImage={generatedImage}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            canGenerate={!!baseImage && garments.length > 0}
          />
          {user && <HistoryView />}
        </div>
      </main>
    </div>
  );
}
