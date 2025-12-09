import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Object3D, Color } from 'three';
import { VIZ_BAR_COUNT, VIZ_RADIUS } from '../constants';
// FIX: Use a side-effect only import to ensure the type declarations from `../types` are loaded.
import '../types';

interface AudioVisualizerProps {
  audioDataRef: React.MutableRefObject<{ frequencyData: Uint8Array; averageFrequency: number }>;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioDataRef }) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  
  // Create a gradient of colors for the bars
  const colors = useMemo(() => {
    const c = new Float32Array(VIZ_BAR_COUNT * 3);
    const color = new Color();
    for (let i = 0; i < VIZ_BAR_COUNT; i++) {
      // Golden/Warm hues
      color.setHSL(0.1 + (i / VIZ_BAR_COUNT) * 0.1, 0.8, 0.5);
      c.set([color.r, color.g, color.b], i * 3);
    }
    return c;
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;

    const data = audioDataRef.current.frequencyData;

    for (let i = 0; i < VIZ_BAR_COUNT; i++) {
      const angle = (i / VIZ_BAR_COUNT) * Math.PI * 2;
      const x = Math.cos(angle) * VIZ_RADIUS;
      const z = Math.sin(angle) * VIZ_RADIUS;

      dummy.position.set(x, 0, z);
      dummy.rotation.y = -angle;
      
      // Scale based on simulated audio data
      let scaleY = 0.1;
      
      // Map FFT data to bars
      const dataIndex = Math.floor((i / VIZ_BAR_COUNT) * (data.length));
      const value = data[dataIndex] || 0;
      scaleY = 0.1 + (value / 255) * 3.0; // Max height 3.0
      
      dummy.scale.set(1, scaleY, 1);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, VIZ_BAR_COUNT]}>
      <boxGeometry args={[0.2, 1, 0.2]} >
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </boxGeometry>
      <meshStandardMaterial vertexColors toneMapped={false} emissive="#FFD700" emissiveIntensity={0.5} roughness={0.2} metalness={0.8} />
    </instancedMesh>
  );
};