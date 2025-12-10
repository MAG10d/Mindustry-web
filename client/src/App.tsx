import React, { useEffect, useRef } from 'react';
import { GameRenderer } from './renderer/GameRenderer';

function App() {
  const rendererRef = useRef<GameRenderer | null>(null);

  useEffect(() => {
    // Spawn Worker
    const worker = new Worker(new URL('./worker/simulation.worker.ts', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (e) => {
      if (e.data.type === 'INIT') {
        const buffer = e.data.buffer as SharedArrayBuffer;
        console.log("Client received SharedArrayBuffer:", buffer);

        const canvas = document.getElementById('pixi-canvas') as HTMLCanvasElement;
        if (canvas) {
          rendererRef.current = new GameRenderer(canvas, buffer);
        }
      }
    };

    return () => {
      worker.terminate();
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="pointer-events-auto p-4 text-white">
      <h1 className="text-2xl font-bold">Mindustry Web Engine</h1>
      <p>UI Overlay</p>
      <p className="text-sm text-gray-400">Simulation running in worker...</p>
    </div>
  );
}

export default App;
