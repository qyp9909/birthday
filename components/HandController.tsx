
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface HandControllerProps {
  onHandUpdate: (data: { x: number; y: number; isPinching: boolean; isDetected: boolean }) => void;
}

const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

export const HandController: React.FC<HandControllerProps> = ({ onHandUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  
  // Refs for smoothing
  const smoothX = useRef(0.5);
  const smoothY = useRef(0.5);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        
        if (!active) return;

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        if (!active) return;
        
        handLandmarkerRef.current = handLandmarker;
        await startWebcam();
      } catch (error) {
        console.error("Error initializing hand tracking:", error);
      }
    };

    init();

    return () => {
      active = false;
      stopWebcam();
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640,
          height: 480,
          facingMode: "user" 
        } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
      }
      setIsLoaded(true);
    } catch (err) {
      console.error("Error accessing webcam:", err);
    }
  };

  const stopWebcam = () => {
    if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
     if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  };

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current) return;

    let startTimeMs = performance.now();
    
    if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
        const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // Index finger tip is landmark 8
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];

            // Calculate pinch distance (simple Euclidean distance)
            const dx = indexTip.x - thumbTip.x;
            const dy = indexTip.y - thumbTip.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Threshold for pinch (approximate)
            const isPinching = distance < 0.05;

            // Target coordinates (Mirror mode: 1.0 - x)
            const targetX = 1.0 - indexTip.x;
            const targetY = indexTip.y;

            // Apply smoothing
            smoothX.current = lerp(smoothX.current, targetX, 0.2);
            smoothY.current = lerp(smoothY.current, targetY, 0.2);

            onHandUpdate({ 
                x: smoothX.current, 
                y: smoothY.current, 
                isPinching, 
                isDetected: true 
            });
        } else {
            onHandUpdate({ x: smoothX.current, y: smoothY.current, isPinching: false, isDetected: false });
        }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="fixed top-4 right-4 z-40 opacity-80 pointer-events-none">
       {/* Hidden video element for processing */}
       <video 
         ref={videoRef} 
         autoPlay 
         playsInline 
         className="hidden"
       />
       {isLoaded && (
         <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-yellow-500/30">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-[10px] text-yellow-100 uppercase tracking-widest">Gesture Active</span>
         </div>
       )}
    </div>
  );
};
