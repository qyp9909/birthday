

import React, { useRef, useMemo, useLayoutEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { 
  InstancedMesh, 
  Group, 
  MeshStandardMaterial, 
  CanvasTexture, 
  RepeatWrapping, 
  Object3D, 
  Color, 
  Vector3, 
  Quaternion, 
  Euler,
  DoubleSide,
  MathUtils,
  AdditiveBlending,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Matrix4
} from 'three';
import { CAKE_TIERS, BODY_PARTICLE_COUNT, GIFT_COUNT, ORB_COUNT, CONFETTI_COUNT, SPARKLE_COUNT } from '../constants';
import gsap from 'gsap';
import { Candle } from './Candle';
// FIX: Use a side-effect only import to ensure the type declarations from `../types` are loaded.
import '../types';

// Constants for visual positioning
const SCATTER_RADIUS = 12; // Tighter radius to keep items on screen
const SCATTER_HEIGHT_CENTER = 3; // Center vertically in camera view

// --- Perlin Noise Implementation for Procedural Frosting ---
const perm = new Uint8Array([151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180]);
const p = new Uint8Array(512);
for (let i=0; i<512; i++) p[i] = perm[i & 255];

function fade(t: number) { return t*t*t*(t*(t*6-15)+10); }
function lerp(t: number, a: number, b: number) { return a + t * (b - a); }

function grad(hash: number, x: number, y: number, z: number) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function perlin(x: number, y: number, z: number) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  
  const A = p[X]+Y, AA = p[A]+Z, AB = p[A+1]+Z;
  const B = p[X+1]+Y, BA = p[B]+Z, BB = p[B+1]+Z;

  return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x-1, y, z)),
                         lerp(u, grad(p[AB], x, y-1, z), grad(p[BB], x-1, y-1, z))),
                 lerp(v, lerp(u, grad(p[AA+1], x, y, z-1), grad(p[BA+1], x-1, y, z-1)),
                         lerp(u, grad(p[AB+1], x, y-1, z-1), grad(p[BB+1], x-1, y-1, z-1))));
}

// Fractal Brownian Motion for rich detail (Swirls and Pores)
function fbm(x: number, y: number, z: number, octaves = 4) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;  
  for(let i=0;i<octaves;i++) {
    total += perlin(x * frequency, y * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / maxValue;
}

// --- 1. Procedural Texture Generation Helper ---
const createProceduralTexture = (type: 'ribbon' | 'dots' | 'stripes', bgColor: string, patternColor: string) => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new CanvasTexture(canvas); 

    // Fill Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Draw Pattern
    ctx.fillStyle = patternColor;
    ctx.strokeStyle = patternColor;

    if (type === 'ribbon') {
        const width = 100;
        const center = size / 2;
        ctx.fillRect(center - width / 2, 0, width, size); // Vertical
        ctx.fillRect(0, center - width / 2, size, width); // Horizontal
    } 
    else if (type === 'dots') {
        const spacing = 100;
        const radius = 25; 
        for (let x = spacing / 2; x < size; x += spacing) {
            for (let y = spacing / 2; y < size; y += spacing) {
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } 
    else if (type === 'stripes') {
        ctx.lineWidth = 80; 
        const spacing = 160;
        for (let i = -size; i < size * 2; i += spacing) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + size, size);
            ctx.stroke();
        }
    }

    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
};

// --- Generate Frosting Textures (Bump + Color) ---
const generateFrostingTextures = () => {
    const size = 512; // 512x512 is sufficient for procedural noise
    const canvasColor = document.createElement('canvas');
    const canvasBump = document.createElement('canvas');
    canvasColor.width = size; canvasColor.height = size;
    canvasBump.width = size; canvasBump.height = size;
    
    const ctxColor = canvasColor.getContext('2d');
    const ctxBump = canvasBump.getContext('2d');
    
    if (!ctxColor || !ctxBump) return null;
    
    const imgDataColor = ctxColor.createImageData(size, size);
    const imgDataBump = ctxBump.createImageData(size, size);
    
    const baseColor = new Color('#FFC1E3'); // Deep Pink Base
    const highlightColor = new Color('#FFF0F5'); // Creamy Highlight
    
    // Iterate pixels
    for(let y=0; y<size; y++) {
        for(let x=0; x<size; x++) {
             // Normalized coords
             const nx = x / size * 5.0; 
             const ny = y / size * 5.0; 
             
             // Domain warping for "buttercream swirl" effect
             // p = fbm(x)
             const qx = fbm(nx, ny, 0.0);
             const qy = fbm(nx + 5.2, ny + 1.3, 0.0);
             
             // r = fbm(x + 4*p)
             const rx = fbm(nx + 4.0 * qx + 1.7, ny + 4.0 * qy + 9.2, 0.0);
             const ry = fbm(nx + 4.0 * qx + 8.3, ny + 4.0 * qy + 2.8, 0.0);
             
             // final = fbm(x + 4*r)
             let f = fbm(nx + 4.0 * rx, ny + 4.0 * ry, 0.0);
             
             // Add high frequency grain (sugar/air pockets)
             const grain = fbm(x * 0.1, y * 0.1, 10.0, 2);
             
             // Combine: Mostly swirl, some grain
             const height = f * 0.85 + grain * 0.15;
             const normalizedHeight = Math.max(0, Math.min(1, 0.5 + height * 0.5));

             const idx = (y * size + x) * 4;
             
             // Bump Map (Grayscale)
             const g = Math.floor(normalizedHeight * 255);
             imgDataBump.data[idx] = g;
             imgDataBump.data[idx+1] = g;
             imgDataBump.data[idx+2] = g;
             imgDataBump.data[idx+3] = 255;
             
             // Color Map (Mix colors based on height - peaks are lighter)
             // Use a power curve to emphasize highlights on peaks
             const mixFactor = Math.pow(normalizedHeight, 2.0);
             
             const r = lerp(mixFactor, baseColor.r, highlightColor.r);
             const gC = lerp(mixFactor, baseColor.g, highlightColor.g);
             const b = lerp(mixFactor, baseColor.b, highlightColor.b);
             
             imgDataColor.data[idx] = r * 255;
             imgDataColor.data[idx+1] = gC * 255;
             imgDataColor.data[idx+2] = b * 255;
             imgDataColor.data[idx+3] = 255;
        }
    }
    
    ctxColor.putImageData(imgDataColor, 0, 0);
    ctxBump.putImageData(imgDataBump, 0, 0);
    
    const colorTex = new CanvasTexture(canvasColor);
    const bumpTex = new CanvasTexture(canvasBump);
    
    colorTex.wrapS = RepeatWrapping; colorTex.wrapT = RepeatWrapping;
    bumpTex.wrapS = RepeatWrapping; bumpTex.wrapT = RepeatWrapping;
    
    return { colorMap: colorTex, bumpMap: bumpTex };
};

// --- Style Palette ---
const GIFT_STYLES = [
  { type: 'ribbon', bg: '#D32F2F', pattern: '#FFD700' }, // Red Box with Gold Ribbon
  { type: 'dots',   bg: '#1976D2', pattern: '#E0E0E0' }, // Blue Box with Silver Dots
  { type: 'stripes', bg: '#FFC107', pattern: '#D32F2F' }, // Gold Box with Red Stripes
  { type: 'ribbon', bg: '#388E3C', pattern: '#FFD700' }, // Green Box with Gold Ribbon
] as const;

const ORB_STYLES = [
  { type: 'dots',   bg: '#AB47BC', pattern: '#E1BEE7' }, // Purple/Light Purple
  { type: 'stripes', bg: '#FF7043', pattern: '#FFCCBC' }, // Orange/Pale Orange
  { type: 'ribbon', bg: '#26C6DA', pattern: '#E0F7FA' }, // Cyan/Ice
  { type: 'dots', bg: '#FFCA28', pattern: '#FFF8E1' },   // Amber/Cream
] as const;

// --- 2. GPU Shader Injection Logic for Enhanced Cake Material ---
const flashMaterialBeforeCompile = (shader: any) => {
  shader.uniforms.uTime = { value: 0 };
  shader.uniforms.uAudioSpectrum = { value: new Vector3(0, 0, 0) }; // x:Bass, y:Mid, z:High
  
  // 1. VERTEX SHADER INJECTION
  shader.vertexShader = `
    attribute float aTimeOffset;
    attribute float aFlashFactor;
    attribute float aEdgeFactor; // Identifies particles on the outer shell
    
    varying float vTimeOffset;
    varying float vFlashFactor;
    varying float vEdgeFactor;
    varying vec3 vInstanceWorldPos; // Position of the particle instance in world space
    
    attribute vec2 aInstanceUV;
    varying vec3 vPos; // World/Local pos for noise
    ${shader.vertexShader}
  `;

  shader.vertexShader = shader.vertexShader.replace(
    '#include <uv_vertex>',
    `
    #include <uv_vertex>
    vTimeOffset = aTimeOffset;
    vFlashFactor = aFlashFactor;
    vEdgeFactor = aEdgeFactor;
    vPos = position; // Pass local position to fragment
    #ifdef USE_MAP
      vMapUv = aInstanceUV; 
    #endif

    // Calculate World Position of the Instance Center
    // Helper to get the world position so we can calculate proper Fresnel
    #ifdef USE_INSTANCING
      vInstanceWorldPos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #else
      vInstanceWorldPos = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #endif
    `
  );

  // 2. FRAGMENT SHADER INJECTION
  shader.fragmentShader = `
    uniform float uTime;
    uniform vec3 uAudioSpectrum; // x:Bass, y:Mids, z:Highs
    varying float vTimeOffset;
    varying float vFlashFactor;
    varying float vEdgeFactor;
    varying vec3 vInstanceWorldPos;
    varying vec3 vPos;
    
    ${shader.fragmentShader}
  `;

  // Inject Emissive (Audio Reactive Halo)
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `
    #include <emissivemap_fragment>
    
    // --- AUDIO FREQUENCY MAPPING ---
    // User Request: "Only high tone part glows"
    // Use uAudioSpectrum.z (Highs)
    // Apply power curve to create a "Noise Gate" effect
    float rawHighs = uAudioSpectrum.z;
    float bandIntensity = pow(rawHighs, 2.5); 
    
    // --- DYNAMIC SELECTION LOGIC (2-Second Interval) ---
    // Update interval: Every 2.0 seconds
    float scaledTime = uTime * 0.5;
    
    float t1 = floor(scaledTime);
    float t2 = floor(scaledTime) + 1.0;
    
    // Random values for both time steps based on particle ID
    float r1 = fract(sin(dot(vec2(vTimeOffset, t1), vec2(12.9898, 78.233))) * 43758.5453);
    float r2 = fract(sin(dot(vec2(vTimeOffset, t2), vec2(12.9898, 78.233))) * 43758.5453);
    
    // Eligibility Thresholds
    // Surface Particles (Edge > 0.5): 30% chance -> threshold 0.7
    // Inner Particles (Edge <= 0.5): 10% chance -> threshold 0.9
    float threshold = (vEdgeFactor > 0.5) ? 0.7 : 0.9;
    
    float e1 = step(threshold, r1);
    float e2 = step(threshold, r2);
    
    // Smooth fade: Interpolate between current state and next state over the 2s period
    float fadeProgress = smoothstep(0.0, 1.0, fract(scaledTime));
    float isEligible = mix(e1, e2, fadeProgress);

    // --- HALO GLOW EFFECT LOGIC ---
    
    // 1. Reactivity
    float reactivity = bandIntensity * 15.0; 

    // 2. Pulse: Natural shimmer (Slow)
    float phase = uTime * 3.0 + vTimeOffset * 20.0;
    float pulse = 0.5 + 0.5 * sin(phase);
    
    // 3. ORGANIC FLICKER (Fast)
    // High-frequency noise independent of audio, adds "twinkle"
    float flicker = 0.7 + 0.3 * sin(uTime * 45.0 + vTimeOffset * 137.0);

    // 4. Selective Intensity 
    float intensityMult = 0.0;
    
    if (isEligible > 0.001) {
        // Apply different brightness levels for depth
        // Surface: Bright (8.0)
        // Inner: Dimmer (4.0) to prevent washing out the shape
        float baseIntensity = (vEdgeFactor > 0.5) ? 8.0 : 4.0;
        
        intensityMult = baseIntensity * isEligible; 
    }
    
    // 5. Glow Color - Warm Color Tone (Gold/Orange)
    vec3 glowColor = vec3(1.0, 0.6, 0.2); 
    
    // 6. Final Calculation
    // Combine all factors
    float finalStrength = reactivity * pulse * flicker * intensityMult;
    
    totalEmissiveRadiance += glowColor * finalStrength;
    
    // --- EDGE HIGHLIGHT (FRESNEL) ---
    // Subtle rim light, non-blooming (0.2 intensity)
    if (vEdgeFactor > 0.5) {
        vec3 cakeNormal = normalize(vec3(vInstanceWorldPos.x, 0.0, vInstanceWorldPos.z));
        vec3 viewDir = normalize(cameraPosition - vInstanceWorldPos);
        float fresnel = pow(1.0 - abs(dot(viewDir, cakeNormal)), 3.0); 
        
        totalEmissiveRadiance += vec3(0.2) * fresnel;
    }
    `
  );
};

// Helper to respawn a sparkle particle
const respawnSparkle = (p: any) => {
    const tier = CAKE_TIERS[Math.floor(Math.random() * CAKE_TIERS.length)];
    const angle = Math.random() * Math.PI * 2;
    // Radius: Just outside the cake surface
    const r = tier.radius + 0.1 + Math.random() * 0.8;
    const y = tier.y + (Math.random() - 0.5) * tier.height;
    
    p.pos.set(Math.cos(angle)*r, y, Math.sin(angle)*r);
    
    // Chance to be near the top candle for extra magic
    if (Math.random() < 0.25) { 
        const top = CAKE_TIERS[CAKE_TIERS.length-1];
        p.pos.y = top.y + top.height/2 + 0.2 + Math.random() * 0.8;
        p.pos.x = (Math.random()-0.5) * 1.5;
        p.pos.z = (Math.random()-0.5) * 1.5;
    }
    
    // Start slightly faded in/out based on phase to avoid pop-in
    // but the sin wave handles the visual entry.
    p.phase = Math.random() * Math.PI * 2;
};

interface CakeProps {
  assembled: boolean;
  audioDataRef: React.MutableRefObject<{ frequencyData: Uint8Array; averageFrequency: number }>;
  onGestureInteract?: (active: boolean) => void;
  handCursor?: { x: number, y: number, isPinching: boolean, isDetected: boolean };
  onGiftClick?: () => void;
}

export const Cake: React.FC<CakeProps> = ({ assembled, audioDataRef, onGestureInteract, handCursor, onGiftClick }) => {
  const { camera, scene } = useThree();
  const bodyMeshRef = useRef<InstancedMesh>(null);
  const giftMeshRefs = useRef<InstancedMesh[]>([]);
  const orbMeshRefs = useRef<InstancedMesh[]>([]); // Array of refs for each orb style
  const confettiMeshRef = useRef<InstancedMesh>(null);
  const sparkleMeshRef = useRef<InstancedMesh>(null);
  const candleRef = useRef<Group>(null);
  const bodyMaterialRef = useRef<MeshStandardMaterial>(null);

  // Raycaster for hand interaction
  const raycaster = useMemo(() => new Raycaster(), []);
  const cursorVector = useMemo(() => new Vector2(), []);
  // Track hovered instances manually since we are in a loop
  const hoveredGiftRef = useRef<{ meshIndex: number, instanceId: number } | null>(null);
  const hoveredOrbRef = useRef<{ meshIndex: number, instanceId: number } | null>(null);
  const lastInteractRef = useRef<boolean>(false);
  
  // Colors for interaction feedback
  const glowColor = useMemo(() => new Color('#FFFF99'), []); // Pale yellow for glow tint
  const whiteColor = useMemo(() => new Color('white'), []);


  // Generate Procedural Textures for Gifts
  const giftTextures = useMemo(() => {
      return GIFT_STYLES.map(style => createProceduralTexture(style.type, style.bg, style.pattern));
  }, []);

  // Generate Procedural Textures for Orbs
  const orbTextures = useMemo(() => {
      return ORB_STYLES.map(style => createProceduralTexture(style.type, style.bg, style.pattern));
  }, []);

  // Generate Procedural Frosting Texture using Perlin Noise
  const frostingTextures = useMemo(() => {
    return generateFrostingTextures();
  }, []);

  const progress = useRef({ value: 0 });

  useLayoutEffect(() => {
    gsap.to(progress.current, {
      value: assembled ? 1 : 0,
      duration: 3.0,
      ease: "power3.inOut"
    });
  }, [assembled]);

  const dummy = useMemo(() => new Object3D(), []);

  // --- Data Generation ---
  const bodyData = useMemo(() => {
    const count = BODY_PARTICLE_COUNT;
    const totalArea = CAKE_TIERS.reduce((acc, tier) => acc + (tier.radius * tier.radius), 0);
    
    const startPositions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const instanceUVs = new Float32Array(count * 2); 
    const timeOffsets = new Float32Array(count); 
    const flashFactors = new Float32Array(count); 
    const edgeFactors = new Float32Array(count);

    let index = 0;
    
    // PALE PINK Color Base (#FFC1E3) - used for fallback/tint
    const basePink = new Color('#FFC1E3');

    CAKE_TIERS.forEach((tier, tierIndex) => {
        let tierParticleCount = Math.floor(count * ((tier.radius * tier.radius) / totalArea));
        if (tierIndex === CAKE_TIERS.length - 1) {
            tierParticleCount = count - index;
        }

        for(let i=0; i<tierParticleCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            
            // CONTOUR LOGIC:
            // 35% of particles are forced to be EXACTLY on the edge (Contour)
            // The rest are randomly distributed inside (0% to 90% radius)
            const isEdge = Math.random() < 0.35;
            
            let r;
            if (isEdge) {
                r = tier.radius; // Exact boundary
            } else {
                r = Math.sqrt(Math.random()) * tier.radius * 0.90; // Strictly inner
            }

            const h = (Math.random() - 0.5) * tier.height;
            const tx = Math.cos(theta) * r;
            const ty = tier.y + h;
            const tz = Math.sin(theta) * r;
            const sx = (Math.random() - 0.5) * SCATTER_RADIUS;
            const sy = (Math.random() - 0.5) * SCATTER_RADIUS * 0.5 + SCATTER_HEIGHT_CENTER;
            const sz = (Math.random() - 0.5) * SCATTER_RADIUS;

            targetPositions[index * 3] = tx;
            targetPositions[index * 3 + 1] = ty;
            targetPositions[index * 3 + 2] = tz;
            startPositions[index * 3] = sx;
            startPositions[index * 3 + 1] = sy;
            startPositions[index * 3 + 2] = sz;

            // Uniform Pink Color for all particles
            colors[index * 3] = basePink.r;
            colors[index * 3 + 1] = basePink.g;
            colors[index * 3 + 2] = basePink.b;

            // UV Mapping for texture
            const u = (theta / (Math.PI * 2)) + 0.5;
            const v = (h + tier.height / 2) / tier.height;
            instanceUVs[index * 2] = u;
            instanceUVs[index * 2 + 1] = v;

            timeOffsets[index] = Math.random();
            flashFactors[index] = Math.random(); 
            edgeFactors[index] = isEdge ? 1.0 : 0.0;
            index++;
        }
    });

    return { startPositions, targetPositions, colors, instanceUVs, timeOffsets, flashFactors, edgeFactors, count: index };
  }, []);

  const giftGroups = useMemo(() => {
      const groups = GIFT_STYLES.map(() => []);
      for(let i=0; i<GIFT_COUNT; i++) {
          const tier = CAKE_TIERS[Math.floor(Math.random() * CAKE_TIERS.length)];
          const theta = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * tier.radius * 0.6; 
          let y = tier.y - (tier.height/2) + Math.random() * tier.height * 0.9;
          let targetPos = new Vector3(Math.cos(theta)*r, y, Math.sin(theta)*r);
          let rotation = new Quaternion().setFromEuler(new Euler(Math.random(), Math.random(), Math.random()));
          const startPos = new Vector3(
              (Math.random() - 0.5) * SCATTER_RADIUS,
              (Math.random() - 0.5) * SCATTER_RADIUS * 0.6 + SCATTER_HEIGHT_CENTER,
              (Math.random() - 0.5) * SCATTER_RADIUS
          );
          // Increase gift scale by 30% (multiplier 1.3)
          const scale = (0.08 + Math.random() * 0.12) * 1.3;
          const particleData = { startPos, targetPos, scale, rotation };
          const groupIndex = Math.floor(Math.random() * GIFT_STYLES.length);
          (groups[groupIndex] as any[]).push(particleData);
      }
      return groups;
  }, []);

  const orbGroups = useMemo(() => {
    const groups = ORB_STYLES.map(() => []);
    
    for(let i=0; i<ORB_COUNT; i++) {
        const tier = CAKE_TIERS[Math.floor(Math.random() * CAKE_TIERS.length)];
        const theta = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * tier.radius * 0.65;
        const y = tier.y + (Math.random() - 0.5) * tier.height * 0.8;
        const targetPos = new Vector3(Math.cos(theta)*r, y, Math.sin(theta)*r);
        const startPos = new Vector3(
          (Math.random() - 0.5) * SCATTER_RADIUS,
          (Math.random() - 0.5) * SCATTER_RADIUS * 0.6 + SCATTER_HEIGHT_CENTER,
          (Math.random() - 0.5) * SCATTER_RADIUS
        );
        // Increase orb scale by 30% (multiplier 1.3)
        const scale = (0.08 + Math.random() * 0.12) * 1.3;
        
        // Group assignment
        const groupIndex = Math.floor(Math.random() * ORB_STYLES.length);
        (groups[groupIndex] as any[]).push({
            startPos, targetPos, scale
        });
    }
    return groups;
  }, []);

  const confettiData = useMemo(() => {
    const count = CONFETTI_COUNT;
    const startPositions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count * 3); 
    const palette = [new Color('#FFD700'), new Color('#C0C0C0'), new Color('#FF1493'), new Color('#00FFFF'), new Color('#32CD32')];
    const colorHelper = new Color();
    for(let i=0; i<count; i++) {
        const r = 4.0 + Math.random() * 2.5; 
        const theta = Math.random() * Math.PI * 2;
        const y = Math.random() * 8; 
        const tx = Math.cos(theta) * r; const ty = y; const tz = Math.sin(theta) * r;
        targetPositions[i * 3] = tx; targetPositions[i * 3 + 1] = ty; targetPositions[i * 3 + 2] = tz;
        startPositions[i * 3] = (Math.random() - 0.5) * (SCATTER_RADIUS + 4);
        startPositions[i * 3 + 1] = (Math.random() - 0.5) * SCATTER_RADIUS + SCATTER_HEIGHT_CENTER;
        startPositions[i * 3 + 2] = (Math.random() - 0.5) * (SCATTER_RADIUS + 4);
        const color = palette[Math.floor(Math.random() * palette.length)];
        colorHelper.set(color);
        colorHelper.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
        colors[i * 3] = colorHelper.r; colors[i * 3 + 1] = colorHelper.g; colors[i * 3 + 2] = colorHelper.b;
        speeds[i*3] = Math.random() - 0.5; speeds[i*3+1] = Math.random() - 0.5; speeds[i*3+2] = 0.5 + Math.random(); 
    }
    return { startPositions, targetPositions, colors, speeds, count };
  }, []);

  const candleData = useMemo(() => {
    const topTier = CAKE_TIERS[CAKE_TIERS.length - 1];
    const targetPos = new Vector3(0, topTier.y + topTier.height/2 + 0.1, 0);
    const startPos = new Vector3(
        (Math.random() - 0.5) * SCATTER_RADIUS,
        (Math.random() - 0.5) * SCATTER_RADIUS * 0.5 + SCATTER_HEIGHT_CENTER + 2,
        (Math.random() - 0.5) * SCATTER_RADIUS
    );
    const startRot = new Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    return { startPos, targetPos, startRot };
  }, []);

  // Sparkle Simulation State
  const sparkleState = useMemo(() => {
    return new Array(SPARKLE_COUNT).fill(0).map(() => ({
        pos: new Vector3(),
        phase: Math.random() * Math.PI * 2,
        speed: 1.0 + Math.random() * 2.0,
        baseScale: 0.03 + Math.random() * 0.04
    }));
  }, []);

  // --- Layout Effects for Color ---
  useLayoutEffect(() => {
    if (!bodyMeshRef.current) return;
    const c = new Color();
    for (let i = 0; i < bodyData.count; i++) {
        c.setRGB(bodyData.colors[i*3], bodyData.colors[i*3+1], bodyData.colors[i*3+2]);
        bodyMeshRef.current.setColorAt(i, c);
    }
    bodyMeshRef.current.instanceMatrix.needsUpdate = true;
    if (bodyMeshRef.current.instanceColor) bodyMeshRef.current.instanceColor.needsUpdate = true;
  }, [bodyData]);

  useLayoutEffect(() => {
    if (!confettiMeshRef.current) return;
    const c = new Color();
    for(let i=0; i<confettiData.count; i++) {
        c.setRGB(confettiData.colors[i*3], confettiData.colors[i*3+1], confettiData.colors[i*3+2]);
        confettiMeshRef.current.setColorAt(i, c);
    }
    confettiMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [confettiData]);

  // Init Sparkle Positions & Colors
  useLayoutEffect(() => {
    if (!sparkleMeshRef.current) return;
    
    // Initial Spawn
    sparkleState.forEach(p => respawnSparkle(p));

    // Colors: White, Gold, Light Cyan
    const c = new Color();
    const palette = ['#FFFFFF', '#FFD700', '#E0FFFF', '#FFFACD'];
    for(let i=0; i<SPARKLE_COUNT; i++) {
        c.set(palette[Math.floor(Math.random()*palette.length)]);
        sparkleMeshRef.current.setColorAt(i, c);
    }
    if (sparkleMeshRef.current.instanceColor) sparkleMeshRef.current.instanceColor.needsUpdate = true;
  }, []);


  // --- Animation Loop ---
  useFrame((state) => {
    const t = progress.current.value;
    const time = state.clock.elapsedTime;

    // --- Hand Tracking Raycaster Logic ---
    let handHoverGift = null;
    let handHoverOrb = null;

    if (!assembled && handCursor?.isDetected) {
        // Map 0..1 (from hand tracker) to -1..1 (Three.js NDC)
        // Note: Hand Y is 0 at top, Three Y is 1 at top.
        const ndcX = (handCursor.x * 2) - 1;
        const ndcY = -(handCursor.y * 2) + 1;
        cursorVector.set(ndcX, ndcY);
        
        raycaster.setFromCamera(cursorVector, camera);

        // Check gifts
        let minDist = Infinity;
        
        // This is an approximation. InstancedMesh raycasting can be expensive.
        // We iterate through available meshes.
        for(let i=0; i<giftMeshRefs.current.length; i++) {
            const mesh = giftMeshRefs.current[i];
            if(!mesh) continue;
            
            // intersectObjects returns instanceId
            const intersects = raycaster.intersectObject(mesh);
            if (intersects.length > 0) {
                 if (intersects[0].distance < minDist) {
                     minDist = intersects[0].distance;
                     handHoverGift = { meshIndex: i, instanceId: intersects[0].instanceId! };
                 }
            }
        }
        
        // Check orbs if no gift found (prioritize gifts)
        if (!handHoverGift) {
            for(let i=0; i<orbMeshRefs.current.length; i++) {
                const mesh = orbMeshRefs.current[i];
                if(!mesh) continue;
                const intersects = raycaster.intersectObject(mesh);
                 if (intersects.length > 0) {
                     if (intersects[0].distance < minDist) {
                         minDist = intersects[0].distance;
                         handHoverOrb = { meshIndex: i, instanceId: intersects[0].instanceId! };
                     }
                 }
            }
        }
        
        // Trigger Gesture Interactions
        // If the hand pinches a gift, call the interaction handler.
        if (handHoverGift && handCursor.isPinching) {
            // Only fire once per pinch action to avoid re-triggering.
            if (!lastInteractRef.current) {
                if (onGestureInteract) {
                    onGestureInteract(true);
                }
                lastInteractRef.current = true;
            }
        } else {
            // Reset the interaction lock when the pinch is released.
            // This allows a new pinch action to trigger the event again.
            if (lastInteractRef.current && !handCursor.isPinching) {
                lastInteractRef.current = false;
            }
        }
    } else {
        // If cake is assembled or hand is lost, reset the interaction lock.
        if (lastInteractRef.current) {
            lastInteractRef.current = false;
        }
    }
    
    hoveredGiftRef.current = handHoverGift;
    hoveredOrbRef.current = handHoverOrb;

    // 1. Calculate Audio Frequency Bands (Spectrum Analysis)
    const freqData = audioDataRef.current.frequencyData;
    // freqData is 64 bins (fftSize 128)
    
    // Bass (0-4): ~0-170Hz
    let bassSum = 0;
    for(let i=0; i<5; i++) bassSum += freqData[i];
    const bass = MathUtils.lerp(0, 1, (bassSum / (5 * 255)));
    
    // Mids (5-30): ~170Hz - 2.5kHz
    let midSum = 0;
    for(let i=5; i<30; i++) midSum += freqData[i];
    const mids = MathUtils.lerp(0, 1, (midSum / (25 * 255)));

    // Highs (31-63): ~2.5kHz - 11kHz
    let highSum = 0;
    for(let i=31; i<64; i++) highSum += freqData[i];
    // Boost sensitivity for highs as they typically have lower energy
    const highs = MathUtils.lerp(0, 1, Math.min(1.0, (highSum / (33 * 255)) * 3.0));

    // Update Uniforms with Vector3 Spectrum
    if (bodyMaterialRef.current && bodyMaterialRef.current.userData.shader) {
        bodyMaterialRef.current.userData.shader.uniforms.uTime.value = time;
        bodyMaterialRef.current.userData.shader.uniforms.uAudioSpectrum.value.set(bass, mids, highs);
    }
    
    // 2. Animate Body Particles
    if (bodyMeshRef.current) {
        const { startPositions, targetPositions, count } = bodyData;
        const rotationY = time * 0.2 * t; 
        const cosR = Math.cos(rotationY);
        const sinR = Math.sin(rotationY);
        
        // Use average intensity for physical bounce
        const avgIntensity = (bass + mids + highs) / 3.0;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            let x = startPositions[i3] + (targetPositions[i3] - startPositions[i3]) * t;
            let y = startPositions[i3+1] + (targetPositions[i3+1] - startPositions[i3+1]) * t;
            let z = startPositions[i3+2] + (targetPositions[i3+2] - startPositions[i3+2]) * t;

            if (t > 0.9) {
                const seed = i * 0.1;
                x += Math.sin(time * 0.8 + seed) * 0.05; 
                y += Math.cos(time * 0.5 + seed) * 0.05;
                z += Math.sin(time * 0.6 + seed) * 0.05;
                // Add a little beat bounce to the particles themselves!
                y += Math.sin(time * 3 + y * 2) * 0.03 * (1.0 + avgIntensity);
            } else {
                y += Math.sin(time * 3 + i) * 0.05 * (1 - t);
            }

            const rx = x * cosR - z * sinR;
            const rz = x * sinR + z * cosR;

            dummy.position.set(rx, y, rz);
            // Circles always look at center (or camera) to appear flat
            dummy.lookAt(0, y, 0); 
            // Scale uniform size
            dummy.scale.setScalar(1.0); 
            dummy.updateMatrix();
            bodyMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        bodyMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. Animate Gifts
    giftGroups.forEach((group: any[], groupIndex: number) => {
        const mesh = giftMeshRefs.current[groupIndex];
        if (!mesh) return;
        group.forEach((p: any, i: number) => {
            dummy.position.lerpVectors(p.startPos, p.targetPos, t);
            if (t < 0.2) {
                dummy.position.y += Math.sin(time * 2 + i) * 0.1;
            }
            const rotY = time * 0.2 * t;
            const x = dummy.position.x; const z = dummy.position.z;
            dummy.position.x = x * Math.cos(rotY) - z * Math.sin(rotY);
            dummy.position.z = x * Math.sin(rotY) + z * Math.cos(rotY);
            dummy.rotation.setFromQuaternion(p.rotation);
            dummy.rotation.y += (1-t) * time + rotY; 
            
            // --- Interaction Effects ---
            let scaleMult = 1.0;
            let pulse = 1.0;
            const isHovered = hoveredGiftRef.current?.meshIndex === groupIndex && hoveredGiftRef.current?.instanceId === i;
            const isPinched = isHovered && handCursor?.isPinching;

            if (isHovered) {
                scaleMult = 1.2; // Slightly scale up on hover
                mesh.setColorAt(i, glowColor); // Add glow tint
            } else {
                mesh.setColorAt(i, whiteColor); // Reset to default
            }

            if (isPinched) {
                pulse = 1.0 + Math.sin(time * 15) * 0.2; // Pulse on pinch
            }
            
            dummy.scale.setScalar(p.scale * scaleMult * pulse); 
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    // 4. Animate Orbs
    orbGroups.forEach((group: any[], groupIndex: number) => {
        const mesh = orbMeshRefs.current[groupIndex];
        if (!mesh) return;
        
        group.forEach((p: any, i: number) => {
             dummy.position.lerpVectors(p.startPos, p.targetPos, t);
             
             if (t > 0.9) {
               // Use i + groupIndex * 100 to differentiate seeds across groups so they don't move identically if counts match
               const seed = (i + groupIndex * 100) * 13.0;
               const amp = 0.08 + bass * 0.05; // Orbs vibrate to bass
               dummy.position.x += Math.sin(time * 0.9 + seed) * amp;
               dummy.position.y += Math.cos(time * 0.7 + seed) * amp;
               dummy.position.z += Math.sin(time * 0.8 + seed) * amp;
            }
            else if (t < 0.2) {
                dummy.position.y += Math.sin(time * 1.5 + i) * 0.1;
            }
            
            // Gentle rotation to show off texture
            dummy.rotation.set(time * 0.5, time * 0.3, 0);

            const rotY = time * 0.2 * t;
            const x = dummy.position.x; const z = dummy.position.z;
            dummy.position.x = x * Math.cos(rotY) - z * Math.sin(rotY);
            dummy.position.z = x * Math.sin(rotY) + z * Math.cos(rotY);
            
            // Interaction Scale Logic
            let scaleMult = 1.0;
            if (hoveredOrbRef.current && 
                hoveredOrbRef.current.meshIndex === groupIndex && 
                hoveredOrbRef.current.instanceId === i) {
                scaleMult = 1.4;
            }

            dummy.scale.setScalar(p.scale * scaleMult);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
    });

    // 5. Animate Confetti
    if(confettiMeshRef.current) {
        const { startPositions, targetPositions, speeds, count } = confettiData;
        for(let i=0; i<count; i++) {
            const i3 = i*3;
            let x = startPositions[i3] + (targetPositions[i3] - startPositions[i3]) * t;
            let y = startPositions[i3+1] + (targetPositions[i3+1] - startPositions[i3+1]) * t;
            let z = startPositions[i3+2] + (targetPositions[i3+2] - startPositions[i3+2]) * t;

            if (t > 0.5) {
                const orbitSpeed = speeds[i3+2] * 0.4;
                const angle = time * orbitSpeed;
                const cosA = Math.cos(angle); const sinA = Math.sin(angle);
                const nx = x * cosA - z * sinA; const nz = x * sinA + z * cosA;
                x = nx; z = nz;
                y += Math.sin(time * 1.5 + i) * 0.15;
            } else {
                 x += Math.sin(time * 0.5 + i) * 0.05;
                 y += Math.cos(time * 0.3 + i) * 0.05;
                 z += Math.sin(time * 0.4 + i) * 0.05;
            }
            dummy.position.set(x, y, z);
            dummy.rotation.x = time * speeds[i3] * 3;
            dummy.rotation.y = time * speeds[i3+1] * 3;
            dummy.rotation.z = time * speeds[i3+2] * 3;
            dummy.scale.setScalar(Math.max(0, 1.0 - t));
            dummy.updateMatrix();
            confettiMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        confettiMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 6. Animate Sparkles (New)
    if (sparkleMeshRef.current && t > 0.8) { // Only active when assembled
        // Rotate sparkle field slowly
        const rotY = time * 0.1;
        
        sparkleState.forEach((p, i) => {
            // Highs boost speed & size
            const speedMult = 1.0 + highs * 6.0;
            const sizeMult = 1.0 + highs * 2.5;

            p.phase += p.speed * speedMult * 0.01;
            
            const rawSine = Math.sin(p.phase);
            // Only visible when sine is positive
            let scale = Math.max(0, rawSine);
            
            // If scale is 0, chance to respawn.
            if (rawSine < -0.9) {
                respawnSparkle(p);
            }

            // Apply slight upward drift
            p.pos.y += 0.003;
            
            // Apply group rotation
            const x = p.pos.x * Math.cos(rotY) - p.pos.z * Math.sin(rotY);
            const z = p.pos.x * Math.sin(rotY) + p.pos.z * Math.cos(rotY);
            
            dummy.position.set(x, p.pos.y, z);
            dummy.rotation.set(time, time * 0.5, 0); // Tumble slightly
            
            // Final scale
            dummy.scale.setScalar(scale * p.baseScale * sizeMult);
            dummy.updateMatrix();
            sparkleMeshRef.current.setMatrixAt(i, dummy.matrix);
        });
        sparkleMeshRef.current.instanceMatrix.needsUpdate = true;
    } else if (sparkleMeshRef.current) {
        // Hide sparkles when not assembled
        sparkleMeshRef.current.visible = false;
        // Or scale them to 0 in loop, but visibility toggle is cheaper if all off
        if (t > 0.8) sparkleMeshRef.current.visible = true;
    }

    // 7. Animate Candle
    if (candleRef.current) {
        const threshold = 0.96;
        const physicsProgress = Math.min(t / threshold, 1.0);
        candleRef.current.position.lerpVectors(candleData.startPos, candleData.targetPos, physicsProgress);
        if (physicsProgress < 0.99) {
             const rotX = candleData.startRot.x * (1 - physicsProgress);
             const rotZ = candleData.startRot.z * (1 - physicsProgress);
             const rotY = (time * 0.5) + (candleData.startRot.y * (1 - physicsProgress));
             candleRef.current.rotation.set(rotX, rotY, rotZ);
        } else {
             candleRef.current.rotation.set(0, time * 0.2, 0);
        }
        const scale = 0.5 + 0.5 * physicsProgress; 
        candleRef.current.scale.setScalar(scale);
    }
  });

  const [t, setT] = React.useState(0);
  useFrame(() => {
    setT(progress.current.value);
  });

  const handlePointerOver = (e: any) => {
    if (!assembled) {
        document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = (e: any) => {
    document.body.style.cursor = 'auto';
  };

  const handleObjectClick = (e: any) => {
    // Stop propagation to prevent canvas-wide events
    e.stopPropagation();
    // Trigger photo display only when cake is scattered
    if (!assembled && onGiftClick) {
        onGiftClick();
    }
  };

  return (
    <group>
      {/* 1. Cake Body Particles */}
      <instancedMesh 
        ref={bodyMeshRef} 
        args={[undefined, undefined, BODY_PARTICLE_COUNT]}
        castShadow
        receiveShadow
      >
        {/* Flat Circle Geometry, Size Reduced by 30% (0.02 -> 0.014) */}
        <circleGeometry args={[0.014, 32]}>
            <instancedBufferAttribute attach="attributes-aInstanceUV" args={[bodyData.instanceUVs, 2]} />
            <instancedBufferAttribute attach="attributes-aTimeOffset" args={[bodyData.timeOffsets, 1]} />
            <instancedBufferAttribute attach="attributes-aFlashFactor" args={[bodyData.flashFactors, 1]} />
            <instancedBufferAttribute attach="attributes-aEdgeFactor" args={[bodyData.edgeFactors, 1]} />
        </circleGeometry>
        <meshStandardMaterial 
            ref={bodyMaterialRef}
            map={frostingTextures?.colorMap}
            bumpMap={frostingTextures?.bumpMap}
            bumpScale={0.08}
            color="#FFFFFF" // Base white so the texture color shows through
            roughness={0.45} // Semi-matte buttercream
            metalness={0.0}
            side={DoubleSide} // Visible from both sides
            envMapIntensity={0.8}
            onBeforeCompile={(shader) => {
                flashMaterialBeforeCompile(shader);
                bodyMaterialRef.current!.userData.shader = shader;
            }}
        />
      </instancedMesh>

      {/* 2. Gifts */}
      {giftGroups.map((group, index) => (
        <instancedMesh
          key={`gift-${index}`}
          ref={(el) => { giftMeshRefs.current[index] = el!; }}
          args={[undefined, undefined, (group as any[]).length]}
          castShadow
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleObjectClick}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial 
              map={giftTextures[index]}
              roughness={1.0} 
              metalness={0.0}
              envMapIntensity={0.0} 
              color="#ffffff"
            />
        </instancedMesh>
      ))}

      {/* 3. Ornaments (Textured Spheres) */}
      {orbGroups.map((group, index) => (
        <instancedMesh
          key={`orb-${index}`}
          ref={(el) => { orbMeshRefs.current[index] = el!; }}
          args={[undefined, undefined, (group as any[]).length]}
          castShadow
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleObjectClick}
        >
            {/* Reduced radius to 0.5 (Diameter 1) to match the 1x1x1 box size of the gifts */}
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial 
              map={orbTextures[index]}
              roughness={1.0} 
              metalness={0.0}
              envMapIntensity={0.0}
              color="#ffffff"
            />
        </instancedMesh>
      ))}

      {/* 4. Confetti */}
      <instancedMesh
        ref={confettiMeshRef}
        args={[undefined, undefined, confettiData.count]}
        castShadow
        receiveShadow
      >
          <planeGeometry args={[0.08, 0.2]} />
          <meshStandardMaterial 
            side={DoubleSide} 
            roughness={0.2} 
            metalness={0.8} 
            emissive="#000000" 
            emissiveIntensity={0.0} 
            envMapIntensity={0.0} // Matte, no bloom
          />
      </instancedMesh>
      
      {/* 5. Magical Sparkles (New) */}
      <instancedMesh
        ref={sparkleMeshRef}
        args={[undefined, undefined, SPARKLE_COUNT]}
      >
          {/* Diamond shape (Octahedron detail 0) */}
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial 
            toneMapped={false} // Allow bloom
            transparent
            opacity={0.8}
            blending={AdditiveBlending}
            depthWrite={false}
          />
      </instancedMesh>

      {/* 6. The Candle */}
      <group ref={candleRef}>
          <Candle position={[0, 0, 0]} intensity={1} progress={t} />
      </group>
    </group>
  );
};