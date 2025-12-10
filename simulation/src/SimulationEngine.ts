import { SharedMemoryManager } from './memory/SharedMemoryManager.js';
import { TICK_RATE, MAP_WIDTH, MAP_HEIGHT, TileType } from '@mindustry/shared';

export class SimulationEngine {
    private memory: SharedMemoryManager;
    private interval: any;
    private masterMap: Uint16Array;
    private commandQueue: any[] = [];

    constructor() {
        console.log("Simulation Engine Initializing...");
        this.memory = new SharedMemoryManager();
        this.masterMap = new Uint16Array(MAP_WIDTH * MAP_HEIGHT);
        this.initializeWorld();
    }

    initializeWorld() {
        // Spawn 1 dummy entity
        const buffer = this.memory.writeFrame;
        buffer.ids[0] = 1;
        buffer.types[0] = 1; // Unit
        buffer.pos[0] = 0;   // X
        buffer.pos[1] = 0;   // Y
        buffer.rot[0] = 0;
        console.log("World Initialized. Dummy Entity at (0,0)");
    }

    get buffer() {
        return this.memory.sharedBuffer;
    }

    handleMessage(data: any) {
        this.commandQueue.push(data);
    }

    start() {
        const msPerTick = 1000 / TICK_RATE;
        this.interval = setInterval(() => this.tick(), msPerTick);
        console.log(`Simulation Loop Started @ ${TICK_RATE} TPS`);
    }

    tick() {
        // Process Commands
        while (this.commandQueue.length > 0) {
            const cmd = this.commandQueue.shift();
            if (cmd.type === 'BUILD') {
                const { x, y, block } = cmd;
                if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                    const idx = y * MAP_WIDTH + x;
                    this.masterMap[idx] = block;
                    console.log(`[Sim] Built block ${block} at (${x}, ${y})`);

                    // Spawn Static Entity for Visual/Collision if needed
                    // For now, map update is enough for visual if renderer reads map.
                }
            }
        }

        const buffer = this.memory.writeFrame;

        // Copy Master Map to Current Buffer
        buffer.map.set(this.masterMap);

        // Move entity 0 by +1 X
        this.dummyX = (this.dummyX || 0) + 1;

        buffer.ids[0] = 1; // Ensure ID is set in current buffer
        buffer.types[0] = 1;
        buffer.pos[0] = this.dummyX;
        buffer.pos[1] = 0;

        // Log every 60 ticks
        if (this.dummyX % 60 === 0) {
            // console.log(`[Sim] Tick ${this.dummyX}`);
        }

        this.memory.swap();
    }

    private dummyX = 0;
}
