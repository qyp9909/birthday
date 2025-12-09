import 'react';

export interface AudioData {
  frequencyData: Uint8Array;
  averageFrequency: number;
}

export interface CakeTier {
  id: number;
  radius: number;
  height: number;
  y: number;
  color: string;
  flavor: string;
}

export interface Particle {
  id: number;
  targetPos: [number, number, number]; // [x, y, z]
  startPos: [number, number, number];  // [x, y, z]
  color: string;
  scale: number;
}

// FIX: Switched from `declare global` to `declare module 'react'` to correctly augment the JSX namespace.
// Shim for JSX Intrinsic Elements to fix missing type errors
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // Three.js elements
      group: any;
      mesh: any;
      cylinderGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      shaderMaterial: any;
      pointLight: any;
      instancedMesh: any;
      boxGeometry: any;
      instancedBufferAttribute: any;
      sphereGeometry: any;
      planeGeometry: any;
      meshPhysicalMaterial: any;
      perspectiveCamera: any;
      ambientLight: any;
      spotLight: any;
      torusGeometry: any;
      circleGeometry: any;
      octahedronGeometry: any;
      fogExp2: any;
    }
  }
}
