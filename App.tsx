import React, { useState, Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Stars, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { AmbientLight, PointLight } from 'three';
import { Cake } from './components/Cake';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { ALL_PHOTOS } from './images';
import { HandController } from './components/HandController';
import { SettingsPanel } from './components/SettingsPanel';
// FIX: Use a side-effect only import to ensure the type declarations from `./types` are loaded.
import './types';

// --- Real-time Audio Analyzer Component ---
interface RealTimeAudioAnalyzerProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  audioDataRef: React.MutableRefObject<{ frequencyData: Uint8Array; averageFrequency: number }>;
}

function RealTimeAudioAnalyzer({ analyserRef, audioDataRef }: RealTimeAudioAnalyzerProps) {
  useFrame(() => {
    if (analyserRef.current) {
      const data = audioDataRef.current.frequencyData;
      analyserRef.current.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      audioDataRef.current.averageFrequency = sum / data.length;
    } else {
       const time = Date.now() / 1000;
       audioDataRef.current.averageFrequency = 20 + Math.sin(time) * 10;
    }
  });
  return null;
}

function Scene({ assembled, audioDataRef, analyserRef, onGestureInteract, handCursor, onGiftClick }: { 
  assembled: boolean, 
  audioDataRef: React.MutableRefObject<{ frequencyData: Uint8Array; averageFrequency: number }>,
  analyserRef: React.MutableRefObject<AnalyserNode | null>,
  onGestureInteract: (active: boolean) => void,
  handCursor: { x: number, y: number, isPinching: boolean, isDetected: boolean },
  onGiftClick: () => void
}) {
  const [isMobile, setIsMobile] = useState(false);
  const ambientRef = useRef<AmbientLight>(null);
  const mainLightRef = useRef<PointLight>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useFrame(() => {
    const intensityFactor = audioDataRef.current.averageFrequency / 255;
    if (ambientRef.current) ambientRef.current.intensity = 0.2 + intensityFactor * 0.15;
    if (mainLightRef.current) mainLightRef.current.intensity = 1.0 + intensityFactor * 0.5;
  });

  const targetPosition: [number, number, number] = isMobile ? [0, 8, 32] : [0, 4, 14];
  const cakeScale = isMobile ? 2.1 : 1.5;
  const cakeY = isMobile ? -4.5 : -3.2;

  return (
    <>
      <PerspectiveCamera makeDefault position={targetPosition} fov={45} />
      <OrbitControls 
        makeDefault
        maxPolarAngle={Math.PI / 2}
        enablePan={false}
        enableZoom={true}
        minDistance={5}
        maxDistance={isMobile ? 50 : 25}
        autoRotate={assembled}
        autoRotateSpeed={0.5}
      />
      <RealTimeAudioAnalyzer analyserRef={analyserRef} audioDataRef={audioDataRef} />
      <ambientLight ref={ambientRef} intensity={0.2} />
      <pointLight ref={mainLightRef} position={[10, 10, 10]} intensity={1.0} color="#FFD700" />
      <pointLight position={[-10, 5, -10]} intensity={0.8} color="#FF69B4" />
      <pointLight position={[0, 5, 5]} intensity={0.5} color="#FFFFFF" />
      <spotLight position={[0, 15, 0]} angle={0.5} penumbra={1} intensity={1} castShadow />
      <fogExp2 attach="fog" args={['#050505', 0.02]} />
      <Stars radius={100} depth={50} count={7000} factor={4} saturation={0} fade speed={1} />
      <Environment preset="city" blur={0.8} background={false} />
      <group position={[0, cakeY, 0]} scale={cakeScale}>
        <Cake 
            assembled={assembled} 
            audioDataRef={audioDataRef} 
            onGestureInteract={onGestureInteract} 
            handCursor={handCursor}
            onGiftClick={onGiftClick}
        />
      </group>
      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={1.0} mipmapBlur intensity={1.5} radius={0.8} />
        <Vignette
          offset={0.5}
          darkness={0.75}
        />
      </EffectComposer>
    </>
  );
}

function PhotoOverlay({ src, isPreview = false, onClose }: { src: string, isPreview?: boolean, onClose?: () => void }) {
    if (!src) return null;
    return (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isPreview ? '' : 'bg-black/80 backdrop-blur-sm animate-in fade-in duration-300'}`}
            onClick={onClose}
        >
            <div className={`relative flex flex-col items-center transition-all duration-300 ${isPreview ? 'scale-100' : 'max-w-4xl w-full max-h-[80vh]'}`}>
                 <img 
                    src={src} 
                    alt="Surprise" 
                    className={`rounded-xl shadow-[0_0_50px_rgba(255,215,0,0.5)] border-4 border-yellow-500/50 object-contain ${isPreview ? 'max-h-[50vh] max-w-[80vw]' : 'max-h-[70vh] transform hover:scale-[1.02]'}`} 
                 />
                 {!isPreview && (
                     <p className="text-white mt-8 text-lg font-serif tracking-widest animate-pulse drop-shadow-lg">
                        Tap anywhere to close
                     </p>
                 )}
            </div>
        </div>
    )
}

export default function App() {
  const [assembled, setAssembled] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [buttonAssembledState, setButtonAssembledState] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [isGesturePreview, setIsGesturePreview] = useState(false);
  const [canTrackHands, setCanTrackHands] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [mainTitle, setMainTitle] = useState("蒋悦悦生日快乐!");
  const [customSubtitle, setCustomSubtitle] = useState("- By Dr.瓶");
  
  const audioDataRef = useAudioAnalyzer();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const mountTimeRef = useRef<number>(0);
  
  const [handCursor, setHandCursor] = useState({ x: 0, y: 0, isPinching: false, isDetected: false });

  const startPlayback = () => {
    if (!audioContextRef.current || !audioBufferRef.current || sourceRef.current) return;
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
    if (!analyserRef.current) {
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 128;
        analyserRef.current = analyser;
    }
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.loop = true;
    source.connect(analyserRef.current!);
    analyserRef.current!.connect(audioContextRef.current.destination);
    source.start(0);
    sourceRef.current = source;
    setIsMusicPlaying(true);
  };

  const handleToggleMusic = () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    if (isMusicPlaying) {
        if (audioContextRef.current.state === 'running') {
            audioContextRef.current.suspend().then(() => setIsMusicPlaying(false));
        }
    } else {
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().then(() => setIsMusicPlaying(true));
        } else if (!sourceRef.current) {
            // If music hasn't started at all yet
            startPlayback();
        }
    }
  };

  useEffect(() => {
    mountTimeRef.current = Date.now();
    const timer = setTimeout(() => setAssembled(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const textTimer = setTimeout(() => {
      setButtonAssembledState(assembled);
    }, 2500);

    if (!assembled) {
        const trackingTimer = setTimeout(() => setCanTrackHands(true), 3000);
        return () => { clearTimeout(textTimer); clearTimeout(trackingTimer); };
    } else {
        setCanTrackHands(false);
        setActivePhoto(null);
    }
    return () => clearTimeout(textTimer);
  }, [assembled]);

  useEffect(() => {
    const loadDefaultBGM = async () => {
      let audioData: ArrayBuffer | null = null;
      try {
        const response = await fetch('/Music/bgm.mp3');
        if (response.ok) audioData = await response.arrayBuffer();
      } catch (error) { /* Silently fail */ }
      
      if (!audioData) {
        try {
          const fallbackUrl = 'https://cdn.pixabay.com/audio/2022/05/27/audio_15837638d9.mp3';
          const response = await fetch(fallbackUrl);
          if (response.ok) audioData = await response.arrayBuffer();
        } catch (error) { console.error("Could not load fallback BGM.", error); return; }
      }

      if (audioData) {
        try {
          if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContext();
          }
          audioBufferRef.current = await audioContextRef.current.decodeAudioData(audioData);
        } catch (e) { console.error("Error decoding audio data:", e); }
      }
    };
    loadDefaultBGM();
  }, []);
  
  const unlockAndPlayAudio = () => {
    if (audioUnlocked) return;
    setAudioUnlocked(true);

    if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
    }
    
    const elapsed = Date.now() - mountTimeRef.current;
    const assemblyAnimationDuration = 3100;
    const remainingTime = Math.max(0, assemblyAnimationDuration - elapsed);

    setTimeout(() => {
        if (audioBufferRef.current) startPlayback();
    }, remainingTime);
  };

  const handleGestureInteract = (active: boolean) => {
    // Only act when a pinch starts (active: true) and no photo is currently shown
    if (active && !activePhoto) {
        const randomPhoto = ALL_PHOTOS[Math.floor(Math.random() * ALL_PHOTOS.length)];
        setActivePhoto(randomPhoto);
        setIsGesturePreview(false); // Show full overlay, not preview
    }
    // Do nothing on pinch release (active: false), the user will click the overlay to close.
  };
  
  const handleGiftClick = () => {
    if (assembled) return; // Prevent interaction when cake is formed
    if (!activePhoto) {
        const randomPhoto = ALL_PHOTOS[Math.floor(Math.random() * ALL_PHOTOS.length)];
        setActivePhoto(randomPhoto);
        setIsGesturePreview(false);
    }
  };

  const handleAssembleClick = () => {
    if (!audioUnlocked) unlockAndPlayAudio();
    setAssembled(!assembled);
  };

  const displayedSubtitle = customSubtitle || (sourceRef.current ? "Audio Playing" : "Make a wish");

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden" onClick={!audioUnlocked ? unlockAndPlayAudio : undefined}>
      
      {!assembled && canTrackHands && <HandController onHandUpdate={setHandCursor} />}

      {(!assembled && canTrackHands && handCursor.isDetected) && (
          <div 
              className="absolute w-8 h-8 pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform duration-75 ease-out"
              style={{ left: `${handCursor.x * 100}%`, top: `${handCursor.y * 100}%` }}
          >
              <div className={`w-full h-full rounded-full border-2 ${handCursor.isPinching ? 'bg-yellow-400 border-yellow-200 scale-75' : 'border-yellow-400/80 scale-100'} shadow-[0_0_15px_rgba(255,215,0,0.8)] transition-all duration-200`}></div>
              <div className="absolute w-1 h-1 bg-white rounded-full"></div>
          </div>
      )}

      {activePhoto && (
          <PhotoOverlay src={activePhoto} isPreview={isGesturePreview} onClose={() => { if (!isGesturePreview) setActivePhoto(null); }} />
      )}
      
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isMusicPlaying={isMusicPlaying}
        onToggleMusic={handleToggleMusic}
        mainTitle={mainTitle}
        onMainTitleChange={setMainTitle}
        subtitle={customSubtitle}
        onSubtitleChange={setCustomSubtitle}
        isMusicLoaded={!!audioBufferRef.current}
      />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 p-8 z-10 flex flex-col items-center pointer-events-none">
          <h1 className="title-shimmer text-3xl sm:text-4xl md:text-6xl text-yellow-400 font-serif tracking-widest opacity-90 drop-shadow-[0_0_15px_rgba(255,215,0,0.6)] whitespace-nowrap">
              {mainTitle}
          </h1>
          <p className="text-gray-300 mt-2 text-[10px] sm:text-xs md:text-sm tracking-[0.2em] md:tracking-[0.3em] font-light uppercase whitespace-nowrap text-center">
              {displayedSubtitle}
          </p>
      </div>

      <div className="absolute bottom-12 left-0 w-full z-10 flex justify-center items-center gap-6 pointer-events-none">
          <button 
              onClick={handleAssembleClick}
              className="pointer-events-auto bg-gradient-to-r from-yellow-600/30 to-yellow-800/30 hover:from-yellow-600/50 hover:to-yellow-800/50 text-yellow-100 border border-yellow-500/30 backdrop-blur-md px-10 py-4 rounded-full uppercase tracking-widest text-xs transition-all duration-500 hover:scale-105 shadow-[0_0_30px_rgba(255,215,0,0.2)]"
          >
              {buttonAssembledState ? "生日快乐!" : "恰赛博蛋糕"}
          </button>
      </div>
      
      <div className="absolute bottom-12 right-12 z-10">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="pointer-events-auto text-yellow-100/50 hover:text-yellow-100/90 transition-all duration-300 ease-in-out hover:rotate-45"
          aria-label="Open Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <Canvas shadows dpr={[1, 2]}>
          <Suspense fallback={null}>
              <Scene 
                  assembled={assembled} 
                  audioDataRef={audioDataRef} 
                  analyserRef={analyserRef}
                  onGestureInteract={handleGestureInteract}
                  handCursor={handCursor}
                  onGiftClick={handleGiftClick}
              />
          </Suspense>
      </Canvas>
    </div>
  );
}