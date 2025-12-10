import { SimulationEngine } from '@mindustry/simulation';

console.log('Worker: Initializing Simulation...');

const engine = new SimulationEngine();

// Post the buffer to the main thread
postMessage({ type: 'INIT', buffer: engine.buffer });

engine.start();
