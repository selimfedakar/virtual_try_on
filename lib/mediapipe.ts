import { ImageSegmenter, FilesetResolver } from "@mediapipe/tasks-vision";

let segmenter: ImageSegmenter | null = null;

export const initSegmenter = async () => {
  if (segmenter) return segmenter;
  
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  segmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
      delegate: "GPU"
    },
    runningMode: "IMAGE",
    outputCategoryMask: true,
    outputConfidenceMasks: false
  });

  return segmenter;
};

// Extracts pixels where the category is skin (2) or face (3)
export const extractSkinMask = async (imageUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
            try {
                const seg = await initSegmenter();
                const segmentationResult = seg.segment(img);
                
                if (!segmentationResult.categoryMask) return resolve(null);

                const maskWidth = segmentationResult.categoryMask.width;
                const maskHeight = segmentationResult.categoryMask.height;
                const maskData = segmentationResult.categoryMask.getAsUint8Array();

                // Create a canvas for the low-res mask
                const maskCanvas = document.createElement("canvas");
                maskCanvas.width = maskWidth;
                maskCanvas.height = maskHeight;
                const maskCtx = maskCanvas.getContext("2d")!;
                
                const newImageData = new ImageData(maskWidth, maskHeight);
                let hasSkin = false;
                
                for (let i = 0; i < maskData.length; i++) {
                    const category = maskData[i];
                    // 2: body-skin (arms/chest/legs), 3: face-skin
                    if (category === 2 || category === 3) {
                        newImageData.data[i * 4] = 0;       
                        newImageData.data[i * 4 + 1] = 0; 
                        newImageData.data[i * 4 + 2] = 0; 
                        newImageData.data[i * 4 + 3] = 255; // Opaque black
                        hasSkin = true;
                    } else {
                        newImageData.data[i * 4 + 3] = 0; // Transparent
                    }
                }
                
                if (!hasSkin) return resolve(null);
                maskCtx.putImageData(newImageData, 0, 0);

                // Create the final high-res canvas
                const finalCanvas = document.createElement("canvas");
                finalCanvas.width = img.naturalWidth;
                finalCanvas.height = img.naturalHeight;
                const finalCtx = finalCanvas.getContext("2d")!;

                // Draw the scaled-up mask silhouette
                finalCtx.drawImage(maskCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
                
                // Composite the original image ON TOP of the silhouette
                finalCtx.globalCompositeOperation = 'source-in';
                finalCtx.drawImage(img, 0, 0);
                
                // Reset composite mode
                finalCtx.globalCompositeOperation = 'source-over';
                resolve(finalCanvas.toDataURL("image/png"));
            } catch (err) {
                console.error("Segmentation failed:", err);
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = imageUrl;
    });
};

// Extracts pixels where the category is clothes (4) for IDM-VTON
export const extractClothesMask = async (imageUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
            try {
                const seg = await initSegmenter();
                const segmentationResult = seg.segment(img);
                
                if (!segmentationResult.categoryMask) return resolve(null);

                const maskWidth = segmentationResult.categoryMask.width;
                const maskHeight = segmentationResult.categoryMask.height;
                const maskData = segmentationResult.categoryMask.getAsUint8Array();

                // Create a canvas for the low-res mask
                const maskCanvas = document.createElement("canvas");
                maskCanvas.width = maskWidth;
                maskCanvas.height = maskHeight;
                const maskCtx = maskCanvas.getContext("2d")!;
                
                const newImageData = new ImageData(maskWidth, maskHeight);
                let hasClothes = false;
                
                for (let i = 0; i < maskData.length; i++) {
                    const category = maskData[i];
                    // 4: clothes
                    if (category === 4) {
                        newImageData.data[i * 4] = 255;       
                        newImageData.data[i * 4 + 1] = 255; 
                        newImageData.data[i * 4 + 2] = 255; 
                        newImageData.data[i * 4 + 3] = 255; // Opaque white
                        hasClothes = true;
                    } else {
                        newImageData.data[i * 4 + 3] = 0; // Transparent
                    }
                }
                
                if (!hasClothes) return resolve(null);
                maskCtx.putImageData(newImageData, 0, 0);

                // Create the final high-res canvas
                const finalCanvas = document.createElement("canvas");
                finalCanvas.width = img.naturalWidth;
                finalCanvas.height = img.naturalHeight;
                const finalCtx = finalCanvas.getContext("2d")!;

                // Draw the scaled-up mask silhouette (this will be our white inpainting mask)
                finalCtx.drawImage(maskCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
                
                // IDM-VTON expects a mask where the target area is white (or 1) and background is black (or 0)
                finalCtx.globalCompositeOperation = 'destination-over';
                finalCtx.fillStyle = 'black';
                finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
                
                finalCtx.globalCompositeOperation = 'source-over';
                resolve(finalCanvas.toDataURL("image/png"));
            } catch (err) {
                console.error("Segmentation failed:", err);
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = imageUrl;
    });
};

// Overlays the extracted mask on top of the generated image
export const compositeImages = async (baseLayerUrl: string, topLayerUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const baseImg = new Image();
        baseImg.crossOrigin = "anonymous";
        baseImg.onload = () => {
            const topImg = new Image();
            topImg.crossOrigin = "anonymous";
            topImg.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = baseImg.naturalWidth;
                canvas.height = baseImg.naturalHeight;
                const ctx = canvas.getContext("2d")!;
                
                ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
                ctx.drawImage(topImg, 0, 0, canvas.width, canvas.height);
                
                resolve(canvas.toDataURL("image/jpeg", 0.95));
            };
            topImg.onerror = reject;
            topImg.src = topLayerUrl;
        };
        baseImg.onerror = reject;
        baseImg.src = baseLayerUrl;
    });
};
