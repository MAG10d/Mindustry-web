import React, { useEffect, useRef } from 'react';
import { GameRenderer } from './renderer/GameRenderer';
import { TILE_SIZE, TileType } from '@mindustry/shared';
import { ResourcesDisplay } from './components/ui/ResourcesDisplay';
import { BuildMenu } from './components/ui/BuildMenu';

function App() {
  const rendererRef = useRef<GameRenderer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [buffer, setBuffer] = React.useState<SharedArrayBuffer | null>(null);

  useEffect(() => {
    // Spawn Worker
    const worker = new Worker(new URL('./worker/simulation.worker.ts', import.meta.url), {
      type: 'module'
    });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === 'INIT') {
        const buf = e.data.buffer as SharedArrayBuffer;
        setBuffer(buf);
        console.log("Client received SharedArrayBuffer:", buf);

        const canvas = document.getElementById('pixi-canvas') as HTMLCanvasElement;
        if (canvas) {
          rendererRef.current = new GameRenderer(canvas, buf);
        }
      } else if (e.data.type === 'SAVE_DATA') {
          const blob = new Blob([JSON.stringify(e.data.data)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'mindustry-save.json';
          a.click();
          URL.revokeObjectURL(url);
      }
    };

    return () => {
      worker.terminate();
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
    };
  }, []);

  const [selectedType, setSelectedType] = React.useState<TileType>(TileType.WALL_COPPER);
  const [rotation, setRotation] = React.useState(0); // 0=Right, 1=Up, 2=Left, 3=Down

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'r') setRotation(r => (r + 1) % 4);
      // Keep number keys as shortcuts
      if (e.key === '1') setSelectedType(TileType.WALL_COPPER);
      if (e.key === '2') setSelectedType(TileType.CONVEYOR_RIGHT); // Base conveyor
      if (e.key === '3') console.log('Item Mode removed from UI, use debug commands if needed');
      if (e.key === '4') setSelectedType(TileType.DRILL_MECHANICAL);
      if (e.key === '5') setSelectedType(TileType.CORE_SHARD);
      if (e.key === '6') setSelectedType(TileType.TURRET_DUO);
      if (e.key === '7') setSelectedType(TileType.SOLAR_PANEL);
      if (e.key === '8') setSelectedType(TileType.POWER_NODE);
      if (e.key === '9') setSelectedType(TileType.BATTERY);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!workerRef.current || !buffer) return;

    // Prevent building if clicking on UI
    if ((e.target as HTMLElement).tagName !== 'CANVAS') return;

    const x = Math.floor(e.clientX / TILE_SIZE);
    const y = Math.floor(e.clientY / TILE_SIZE);

    let block = selectedType;

    // Handle Rotation for Conveyors
    if (block === TileType.CONVEYOR_RIGHT || block === TileType.CONVEYOR_UP ||
        block === TileType.CONVEYOR_LEFT || block === TileType.CONVEYOR_DOWN) {
        if (rotation === 0) block = TileType.CONVEYOR_RIGHT;
        if (rotation === 1) block = TileType.CONVEYOR_UP;
        if (rotation === 2) block = TileType.CONVEYOR_LEFT;
        if (rotation === 3) block = TileType.CONVEYOR_DOWN;
    }

    console.log(`Building ${TileType[block]} at (${x}, ${y})`);

    workerRef.current.postMessage({
      type: 'BUILD',
      x,
      y,
      block
    });
  };

  return (
    <div className="w-full h-full relative bg-gray-900" onMouseDown={handleMouseDown}>
      <canvas id="pixi-canvas" className="block w-full h-full" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-2 flex justify-between items-start pointer-events-none">
          <div className="pointer-events-auto">
             <ResourcesDisplay buffer={buffer} />
          </div>

          <div className="flex gap-2 pointer-events-auto bg-black/50 p-2 rounded backdrop-blur-sm">
              <button
                  className="bg-red-700/80 hover:bg-red-600 px-3 py-1 rounded text-white text-xs font-bold transition-colors"
                  onClick={() => workerRef.current?.postMessage({ type: 'SPAWN_ENEMY', x: 0, y: 0 })}
              >
                  Spawn Enemy
              </button>
              <button
                  className="bg-blue-600/80 hover:bg-blue-500 px-3 py-1 rounded text-white text-xs font-bold transition-colors"
                  onClick={() => workerRef.current?.postMessage({ type: 'SAVE' })}
              >
                  Save
              </button>
              <label className="bg-blue-600/80 hover:bg-blue-500 px-3 py-1 rounded text-white text-xs font-bold cursor-pointer transition-colors">
                  Load
                  <input
                      type="file"
                      className="hidden"
                      accept=".json"
                      onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                  const text = ev.target?.result as string;
                                  if (text) {
                                      const data = JSON.parse(text);
                                      workerRef.current?.postMessage({ type: 'LOAD', data });
                                  }
                              };
                              reader.readAsText(file);
                          }
                      }}
                  />
              </label>
          </div>
      </div>

      {/* Rotation Indicator (Bottom Right) */}
      <div className="absolute bottom-20 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded pointer-events-none">
        Rotation: <span className="font-bold text-yellow-400">{['Right', 'Up', 'Left', 'Down'][rotation]} [R]</span>
      </div>

      {/* Bottom Build Menu */}
      <div className="absolute bottom-0 left-0 w-full flex justify-center pb-4 pointer-events-none">
          <div className="pointer-events-auto">
             <BuildMenu
                onSelect={(type) => {
                    // Reset to base types if conveyor selected, rotation handled in click
                    if (type >= TileType.CONVEYOR_UP && type <= TileType.CONVEYOR_RIGHT) {
                         setSelectedType(TileType.CONVEYOR_RIGHT);
                    } else {
                         setSelectedType(type);
                    }
                }}
                selectedType={selectedType}
             />
          </div>
      </div>
    </div>
  );
}

export default App;
