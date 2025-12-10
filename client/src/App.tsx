import React, { useEffect, useRef } from 'react';
import { GameRenderer } from './renderer/GameRenderer';
import { TILE_SIZE, TileType } from '@mindustry/shared';

function App() {
  const rendererRef = useRef<GameRenderer | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Spawn Worker
    const worker = new Worker(new URL('./worker/simulation.worker.ts', import.meta.url), {
      type: 'module'
    });
    workerRef.current = worker;

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!workerRef.current) return;

    // Assuming canvas is full screen and (0,0) is top-left
    const x = Math.floor(e.clientX / TILE_SIZE);
    const y = Math.floor(e.clientY / TILE_SIZE);

    console.log(`Building Wall at (${x}, ${y})`);

    workerRef.current.postMessage({
      type: 'BUILD',
      x,
      y,
      block: TileType.WALL_COPPER
    });
  };

  return (
    <div className="pointer-events-auto w-full h-full" onMouseDown={handleMouseDown}>
      <div className="pointer-events-none p-4 text-white absolute top-0 left-0">
        <h1 className="text-2xl font-bold">Mindustry Web Engine</h1>
        <p>UI Overlay</p>
        <p className="text-sm text-gray-400">Click to build Wall</p>
      </div>
    </div>
  );
}

export default App;
