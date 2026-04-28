import { useState, useRef } from "react";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Camera, Upload, X, Image } from "lucide-react";
import { toast } from "sonner";

const MAX_UPLOAD_SOURCE_SIZE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1280;
const TARGET_IMAGE_SIZE_BYTES = 350 * 1024;
const INITIAL_JPEG_QUALITY = 0.72;
const MIN_JPEG_QUALITY = 0.45;

const loadImageFromUrl = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for compression."));
    image.src = src;
  });
};

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
};

const getScaledDimensions = (width: number, height: number, maxDimension: number) => {
  const longestSide = Math.max(width, height);
  if (longestSide <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const compressCanvasToDataUrl = (canvas: HTMLCanvasElement): string => {
  let quality = INITIAL_JPEG_QUALITY;
  let result = canvas.toDataURL("image/jpeg", quality);

  while (result.length > TARGET_IMAGE_SIZE_BYTES && quality > MIN_JPEG_QUALITY) {
    quality = Math.max(MIN_JPEG_QUALITY, quality - 0.07);
    result = canvas.toDataURL("image/jpeg", quality);
  }

  return result;
};

const optimizeImageToDataUrl = async (
  imageSource: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  workingCanvas: HTMLCanvasElement
): Promise<string> => {
  const { width, height } = getScaledDimensions(sourceWidth, sourceHeight, MAX_IMAGE_DIMENSION);
  workingCanvas.width = width;
  workingCanvas.height = height;

  const context = workingCanvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to prepare image canvas.");
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(imageSource, 0, 0, width, height);
  return compressCanvasToDataUrl(workingCanvas);
};

interface RobotPhotoSectionProps {
  robotPhoto?: string;
  onRobotPhotoChange: (photo: string | undefined) => void;
}

export function RobotPhotoSection({
  robotPhoto,
  onRobotPhotoChange,
}: RobotPhotoSectionProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    // Show the video element first
    setIsCapturing(true);
    setIsStreamReady(false);
    
    try {
      let stream: MediaStream | null = null;
      
      // First, try to get the back camera (environment-facing)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { exact: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
        });
      } catch {
        // If exact back camera fails, try with ideal preference (allows fallback)
        console.log("Back camera not available, trying with ideal preference...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
        });
      }
      
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for the video metadata to load before showing
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setIsStreamReady(true);
            }).catch((err) => {
              console.error("Error playing video:", err);
              toast.error("Failed to start video preview");
              stopCamera();
            });
          }
        };
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Failed to access camera. Please check permissions.");
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCapturing(false);
    setIsStreamReady(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      void optimizeImageToDataUrl(video, video.videoWidth, video.videoHeight, canvas)
        .then((photoDataUrl) => {
          onRobotPhotoChange(photoDataUrl);
          stopCamera();
          toast.success("Photo captured and optimized for transfer.");
        })
        .catch((error) => {
          console.error("Error optimizing captured photo:", error);
          toast.error("Failed to process the captured photo.");
        });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_UPLOAD_SOURCE_SIZE_BYTES) {
        toast.error("File size must be less than 12MB");
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        toast.error("Photo processing is not ready yet.");
        return;
      }

      void readFileAsDataUrl(file)
        .then((dataUrl) => loadImageFromUrl(dataUrl))
        .then((image) => optimizeImageToDataUrl(image, image.naturalWidth, image.naturalHeight, canvas))
        .then((photoDataUrl) => {
          onRobotPhotoChange(photoDataUrl);
          toast.success("Photo uploaded and optimized for transfer.");
        })
        .catch((error) => {
          console.error("Error processing uploaded photo:", error);
          toast.error("Failed to process uploaded photo.");
        });
    }
  };

  const clearPhoto = () => {
    onRobotPhotoChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast.success("Photo removed");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Robot Photo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera view (shown when capturing) */}
        {isCapturing && (
          <div className="space-y-2">
            <div className="relative w-full rounded-lg border bg-black overflow-hidden">
              {!isStreamReady && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ minHeight: '300px' }}>
                  <div className="text-white text-center">
                    <Camera className="h-12 w-12 mx-auto mb-2 animate-pulse" />
                    <p>Loading camera...</p>
                  </div>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg"
                style={{ maxHeight: '60vh', display: isStreamReady ? 'block' : 'none' }}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={capturePhoto} className="flex-1" disabled={!isStreamReady}>
                <Camera className="mr-2 h-4 w-4" />
                Capture
              </Button>
              <Button onClick={stopCamera} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Photo preview (shown when photo exists) */}
        {robotPhoto && !isCapturing && (
          <div className="space-y-2">
            <img
              src={robotPhoto}
              alt="Robot"
              className="w-full rounded-lg border"
            />
            <div className="flex gap-2">
              <Button onClick={startCamera} variant="outline" className="flex-1">
                <Camera className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
              <Button onClick={clearPhoto} variant="destructive" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons (shown when no photo) */}
        {!robotPhoto && !isCapturing && (
          <div className="flex gap-2">
            <Button onClick={startCamera} className="flex-1">
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Optional: Take or upload a photo of the robot. Images are automatically resized and compressed for transfer reliability.
        </p>
      </CardContent>
    </Card>
  );
}
