import { useRef } from 'react';

// Returns a Ref that will hold our simulated audio data
// We don't use state here to avoid re-renders. 
// The data will be mutated directly in the animation loop.
export const useAudioAnalyzer = () => {
  const audioDataRef = useRef({
    frequencyData: new Uint8Array(64),
    averageFrequency: 0
  });

  return audioDataRef;
};