
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial, PointLight, AdditiveBlending, Vector3, Color } from 'three';
// FIX: Use a side-effect only import to ensure the type declarations from `../types` are loaded.
import '../types';

interface CandleProps {
  position: [number, number, number];
  intensity?: number;
  progress?: number; // 0 = Scattered/Exploded, 1 = Assembled
}

// --- SHADERS ---

const FLAME_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uProgress; // 0.0 to 1.0 (Physical scattering)
  
  attribute float aSize;
  attribute float aOffset;
  attribute float aSpeed;
  attribute vec3 aColor; 
  
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vColor;

  void main() {
    vUv = uv;
    vColor = aColor;
    vec3 pos = position;

    // --- DECOMPOSITION LOGIC ---
    // When uProgress < 1.0, particles scatter
    float explosionFactor = 1.0 - uProgress;
    
    // Create a random scatter direction based on offset
    vec3 scatterDir = vec3(
        sin(aOffset * 13.0),
        cos(aOffset * 17.0),
        sin(aOffset * 19.0)
    );
    
    // Apply scatter
    pos += scatterDir * explosionFactor * 3.0; 
    
    // --- FLAME ANIMATION (Only active when assembled) ---
    // Damping animation when exploding so they don't wiggle while flying
    float animStrength = smoothstep(0.0, 0.5, uProgress);

    // 1. Vertical Flow (Heat Rising)
    float flowSpeed = 2.5;
    float rise = uTime * flowSpeed + aOffset;
    
    // 2. Organic Sway (Wind)
    // Simulating the way flame tips flicker more than the base
    float yFactor = pow(pos.y * 10.0, 1.2); // Non-linear increase up the flame
    
    float sway = sin(uTime * 2.0 + pos.y * 4.0) * 0.005 * yFactor * animStrength;
    pos.x += sway;
    pos.z += cos(uTime * 1.5 + pos.y * 5.0) * 0.003 * yFactor * animStrength;

    // 3. Shape Distortion (Breathing/Pinching)
    // This helps break the perfect symmetry
    float breath = sin(uTime * 4.0 - pos.y * 10.0) * 0.02 * animStrength;
    float pinch = 1.0 - (pos.y * 2.0); // Narrower at top naturally
    
    pos.x *= 1.0 + breath; 
    pos.z *= 1.0 + breath;

    vElevation = pos.y;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    // Pulse size slightly for flicker effect
    float pulse = 1.0 + sin(uTime * 10.0 + aOffset) * 0.1 * animStrength;
    
    // Base scale constant
    gl_PointSize = aSize * pulse * (40.0 / -mvPosition.z);
    
    // Fade out particles during explosion
    gl_PointSize *= uProgress; 
  }
`;

const FLAME_FRAGMENT_SHADER = `
  uniform float uFlameOpacity; 
  varying float vElevation;
  varying vec3 vColor;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft circle glow with sharper core
    float glow = 1.0 - (dist * 2.0);
    glow = pow(glow, 2.5); 

    // Reduced opacity multiplier to soften the flame (0.6 -> 0.4)
    float alpha = glow * 0.4 * uFlameOpacity; 
    
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export const Candle: React.FC<CandleProps> = ({ position, progress = 1.0 }) => {
  const materialRef = useRef<ShaderMaterial>(null);
  const lightRef = useRef<PointLight>(null);
  const emberRef = useRef<any>(null);

  // Memoize uniforms
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 1.0 },
    uFlameOpacity: { value: 1.0 }
  }), []);

  // Define light color range for flicker (Temperature shift)
  const lightColors = useMemo(() => ({
    low: new Color('#FF2200'), // Deep Red/Orange (Low Temp)
    mid: new Color('#FFAA00'), // Standard Orange/Gold
    high: new Color('#FFEFD5') // PapayaWhip/White (High Temp)
  }), []);

  // Generate Volumetric Flame Particles
  const particleData = useMemo(() => {
    const count = 350; 
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const offsets = new Float32Array(count);
    const speeds = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const cBlue = new Color('#002288'); // Darker blue base    
    const cCyan = new Color('#4488ff'); // Transition cyan
    const cWhite = new Color('#ffffee');    
    const cGold = new Color('#ffaa00');     
    const cOrange = new Color('#ff4400');   
    const cSmoke = new Color('#220000');    

    const tempColor = new Color();

    for (let i = 0; i < count; i++) {
      // Shape Generation: TEARDROP / CONICAL
      
      // We use a power function for Y to concentrate more particles at the bottom/middle
      const rH = Math.pow(Math.random(), 0.7); 
      
      // Height: Slightly taller to be less round (0.11 vs 0.08)
      const maxY = 0.11; 
      const y = rH * maxY; 
      const normalizedY = y / maxY;
      
      // ENVELOPE FUNCTION (The key to shape)
      // 1. Math.pow(normalizedY, 0.4) -> Round bottom/base
      // 2. Math.pow(1.0 - normalizedY, 2.0) -> Sharp, concave taper to top
      const envelope = 2.5 * Math.pow(normalizedY, 0.4) * Math.pow(1.0 - normalizedY, 2.0);
      
      const maxRadius = 0.012; 
      const rR = Math.sqrt(Math.random()); 
      const radius = rR * maxRadius * envelope;

      const theta = Math.random() * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color Gradient Logic (Visual shaping)
      // Blue base makes it look "detached" from wick (floating)
      if (normalizedY < 0.1) {
        tempColor.lerpColors(cBlue, cCyan, normalizedY / 0.1);
      } else if (normalizedY < 0.25) {
        tempColor.lerpColors(cCyan, cWhite, (normalizedY - 0.1) / 0.15);
      } else if (normalizedY < 0.5) {
        tempColor.lerpColors(cWhite, cGold, (normalizedY - 0.25) / 0.25);
      } else if (normalizedY < 0.8) {
        tempColor.lerpColors(cGold, cOrange, (normalizedY - 0.5) / 0.3);
      } else {
        tempColor.lerpColors(cOrange, cSmoke, (normalizedY - 0.8) / 0.2);
      }
      
      // Add slight noise
      tempColor.r += (Math.random() - 0.5) * 0.02;

      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;

      // Size variation
      // Smaller at top to sharpen the tip
      let baseSize = 5.0;
      if (normalizedY < 0.1) baseSize = 3.0; 
      else if (normalizedY > 0.6) baseSize = 5.0 * (1.0 - normalizedY); // Taper size at top
      
      sizes[i] = baseSize * (0.8 + Math.random() * 0.5);
      offsets[i] = Math.random() * 100.0;
      speeds[i] = 1.0 + Math.random();
    }

    return { positions, sizes, offsets, speeds, colors };
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Timing Logic (Same as before)
    const threshold = 0.96;
    const physicsProgress = Math.min(progress / threshold, 1.0);
    
    let flameProgress = 0.0;
    if (progress > threshold) {
        flameProgress = (progress - threshold) / (1.0 - threshold);
    }
    
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uProgress.value = physicsProgress; 
      materialRef.current.uniforms.uFlameOpacity.value = flameProgress; 
    }
    
    if (emberRef.current) {
        const pulse = Math.sin(time * 12.0) * 0.2 + 0.8; 
        const emberVisibility = Math.max(flameProgress, physicsProgress > 0.99 ? 0.3 : 0.0);
        emberRef.current.scale.setScalar(pulse * emberVisibility); 
        
        const emberMat = emberRef.current.material;
        if (emberMat) {
           emberMat.color.setHSL(0.05 + flameProgress * 0.05, 1.0, 0.5);
        }
    }

    if (lightRef.current) {
        // --- REALISTIC FLICKER SIMULATION ---
        const t = time;
        
        // 1. Noise Layers
        // Base turbulence (Drafts)
        const lowFreq = Math.sin(t * 2.5) * 0.1 + Math.cos(t * 1.3) * 0.1;
        
        // Rapid flicker (Combustion instability)
        const highFreq = (Math.random() - 0.5) * 0.15;
        
        // Occasional Gusts (Sharp dips)
        const gustChance = Math.random();
        let gust = 0;
        if (gustChance > 0.98) gust = -0.4; // Deep dip
        
        // Combined Noise
        const noise = lowFreq + highFreq + gust;
        
        // 2. Target Intensity
        const baseIntensity = 1.2; 
        let targetIntensity = baseIntensity + noise;
        
        // Clamp to safe ranges (Never fully off, max limit)
        targetIntensity = Math.max(0.3, Math.min(2.0, targetIntensity));
        targetIntensity *= flameProgress; 

        // 3. Smooth Interpolation with asymmetry
        // Flickers down fast, recovers slightly slower
        const lerpFactor = targetIntensity < lightRef.current.intensity ? 0.4 : 0.2;
        lightRef.current.intensity += (targetIntensity - lightRef.current.intensity) * lerpFactor;
        
        // 4. Dynamic Shadow Radius (Breathing)
        lightRef.current.distance = (1.5 + noise * 0.4) * flameProgress;

        // 5. Color Temperature Shift
        // Dim -> Redder/Deep Orange | Bright -> Whiter/Yellow
        const currentInt = lightRef.current.intensity;
        let mixVal = (currentInt - 0.5) / 1.0; // Map 0.5->1.5 intensity to 0->1
        mixVal = Math.max(0, Math.min(1, mixVal));
        
        if (mixVal < 0.5) {
             // Low to Mid
             lightRef.current.color.lerpColors(lightColors.low, lightColors.mid, mixVal * 2.0);
        } else {
             // Mid to High
             lightRef.current.color.lerpColors(lightColors.mid, lightColors.high, (mixVal - 0.5) * 2.0);
        }
        
        // 6. Positional Jitter (Shadow movement)
        // Move the light source slightly to create dancing shadows
        lightRef.current.position.x = Math.sin(t * 15.0) * 0.02 * flameProgress;
        lightRef.current.position.z = Math.cos(t * 11.0) * 0.02 * flameProgress;
        lightRef.current.position.y = 0.55 + noise * 0.03; 
    }
  });

  return (
    <group position={position}>
      {/* --- 1. THE CANDLE BODY (WAX) --- */}
      <group>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.4, 32]} />
            <meshPhysicalMaterial 
                color="#FDF5E6"         
                roughness={0.3} 
                metalness={0.0}
                transmission={0.4}    
                thickness={1.5}         
                clearcoat={0.1}         
                sheen={0.4}             
                sheenColor="#FFF"
            />
        </mesh>
        
        {/* Melted Wax Pool */}
        <mesh position={[0, 0.4, 0]} rotation={[Math.PI/2, 0, 0]}>
             <torusGeometry args={[0.045, 0.015, 16, 32]} />
             <meshPhysicalMaterial 
                color="#FFF8E7" 
                roughness={0.15}        
                metalness={0.05}
                transmission={0.3}
             />
        </mesh>
        
        {/* Melted Center */}
        <mesh position={[0, 0.39, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <circleGeometry args={[0.045, 32]} />
             <meshPhysicalMaterial 
                color="#FFFDE7" 
                roughness={0.05}        
                metalness={0.1}
             />
        </mesh>
      </group>

      {/* --- 2. THE WICK --- */}
      <group>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
          <meshStandardMaterial color="#111111" roughness={0.9} />
        </mesh>
        
        {/* Glowing Ember */}
        <mesh ref={emberRef} position={[0, 0.51, 0]}>
          <sphereGeometry args={[0.01, 8, 8]} />
          <meshBasicMaterial color="#ff4400" toneMapped={false} />
        </mesh>
      </group>

      {/* --- 3. THE FLAME (Volumetric Particles) --- */}
      <points position={[0, 0.52, 0]}>
        <bufferGeometry>
          <bufferAttribute 
            attach="attributes-position" 
            count={particleData.positions.length / 3} 
            array={particleData.positions} 
            itemSize={3} 
          />
           <bufferAttribute 
            attach="attributes-aSize" 
            count={particleData.sizes.length} 
            array={particleData.sizes} 
            itemSize={1} 
          />
           <bufferAttribute 
            attach="attributes-aOffset" 
            count={particleData.offsets.length} 
            array={particleData.offsets} 
            itemSize={1} 
          />
          <bufferAttribute 
            attach="attributes-aSpeed" 
            count={particleData.speeds.length} 
            array={particleData.speeds} 
            itemSize={1} 
          />
          <bufferAttribute 
            attach="attributes-aColor" 
            count={particleData.colors.length} 
            array={particleData.colors} 
            itemSize={3} 
          />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          vertexShader={FLAME_VERTEX_SHADER}
          fragmentShader={FLAME_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent={true}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>

      {/* --- 4. LIGHTING --- */}
      <pointLight 
        ref={lightRef} 
        position={[0, 0.55, 0]} 
        color="#FFAA00" 
        distance={1.2} 
        decay={2.2}
        castShadow 
        shadow-bias={-0.001}
        shadow-mapSize={[512, 512]} 
      />
      <pointLight 
        position={[0, 0.53, 0]} 
        intensity={0.2 * progress}
        color="#88AAFF" 
        distance={0.4} 
        decay={2} 
      />
    </group>
  );
};