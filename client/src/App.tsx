import React, { useEffect, useRef } from 'react';
import { GameRenderer } from './renderer/GameRenderer';
import { TILE_SIZE, TileType } from '@mindustry/shared';
import { ResourcesDisplay } from './components/ui/ResourcesDisplay';

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

  const [mode, setMode] = React.useState<'WALL' | 'CONVEYOR' | 'ITEM' | 'DRILL' | 'CORE' | 'TURRET' | 'SOLAR' | 'NODE' | 'BATTERY'>('WALL');
  const [rotation, setRotation] = React.useState(0); // 0=Right, 1=Up, 2=Left, 3=Down

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'r') setRotation(r => (r + 1) % 4);
      if (e.key === '1') setMode('WALL');
      if (e.key === '2') setMode('CONVEYOR');
      if (e.key === '3') setMode('ITEM');
      if (e.key === '4') setMode('DRILL');
      if (e.key === '5') setMode('CORE');
      if (e.key === '6') setMode('TURRET');
      if (e.key === '7') setMode('SOLAR');
      if (e.key === '8') setMode('NODE');
      if (e.key === '9') setMode('BATTERY');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!workerRef.current) return;

    const x = Math.floor(e.clientX / TILE_SIZE);
    const y = Math.floor(e.clientY / TILE_SIZE);

    if (mode === 'ITEM') {
      console.log(`Spawning Item at (${x}, ${y})`);
      workerRef.current.postMessage({
        type: 'SPAWN_ITEM',
        x: x + 0.5, // Center of tile
        y: y + 0.5
      });
      return;
    }

    let block = TileType.EMPTY;
    if (mode === 'WALL') block = TileType.WALL_COPPER;
    if (mode === 'DRILL') block = TileType.DRILL_MECHANICAL;
    if (mode === 'CORE') block = TileType.CORE_SHARD;
    if (mode === 'TURRET') block = TileType.TURRET_DUO;
    if (mode === 'SOLAR') block = TileType.SOLAR_PANEL;
    if (mode === 'NODE') block = TileType.POWER_NODE;
    if (mode === 'BATTERY') block = TileType.BATTERY;
    if (mode === 'CONVEYOR') {
        // Map rotation to TileType
        // 0=Right -> CONVEYOR_RIGHT
        // 1=Up -> CONVEYOR_UP
        // 2=Left -> CONVEYOR_LEFT
        // 3=Down -> CONVEYOR_DOWN
        // Helper: CONVEYOR_UP=2, DOWN=3, LEFT=4, RIGHT=5
        // My rotation logic: 0=Right.
        // Let's explicitly map.
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
    <div className="pointer-events-auto w-full h-full" onMouseDown={handleMouseDown}>
      <div className="pointer-events-none p-4 text-white absolute top-0 left-0 bg-black/50">
        <h1 className="text-2xl font-bold">Mindustry Web Engine</h1>
        <div className="mt-2 text-sm">
            <p>Mode: <span className="font-bold text-yellow-400">{mode}</span></p>
            {mode === 'CONVEYOR' && <p>Rotation: {['Right', 'Up', 'Left', 'Down'][rotation]}</p>}
            <div className="mt-2 flex gap-2 flex-wrap">
                <span className="bg-gray-700 px-2 rounded">[1] Wall</span>
                <span className="bg-gray-700 px-2 rounded">[2] Conveyor (R)</span>
                <span className="bg-gray-700 px-2 rounded">[3] Item</span>
                <span className="bg-gray-700 px-2 rounded">[4] Drill</span>
                <span className="bg-gray-700 px-2 rounded">[5] Core</span>
                <span className="bg-gray-700 px-2 rounded">[6] Turret</span>
                <span className="bg-gray-700 px-2 rounded">[7] Solar</span>
                <span className="bg-gray-700 px-2 rounded">[8] Node</span>
                <button
                    className="bg-red-700 px-2 rounded pointer-events-auto"
                    onClick={() => workerRef.current?.postMessage({ type: 'SPAWN_ENEMY', x: 0, y: 0 })}
                >
                    Spawn Enemy
                </button>
                <div className="flex gap-2 ml-4">
                    <button
                        className="bg-blue-600 px-2 rounded pointer-events-auto"
                        onClick={() => workerRef.current?.postMessage({ type: 'SAVE' })}
                    >
                        Save
                    </button>
                    <label className="bg-blue-600 px-2 rounded pointer-events-auto cursor-pointer">
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
        </div>
      </div>
      <ResourcesDisplay buffer={buffer} />
    </div>
  );
}

export default App;
