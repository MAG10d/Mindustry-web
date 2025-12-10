import { SharedMemoryManager } from './memory/SharedMemoryManager.js';
import { TICK_RATE } from '@mindustry/shared';

export class SimulationEngine {
    private memory: SharedMemoryManager;
    private interval: any;

    constructor() {
        console.log("Simulation Engine Initializing...");
        this.memory = new SharedMemoryManager();
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

    start() {
        const msPerTick = 1000 / TICK_RATE;
        this.interval = setInterval(() => this.tick(), msPerTick);
        console.log(`Simulation Loop Started @ ${TICK_RATE} TPS`);
    }

    tick() {
        const buffer = this.memory.writeFrame;

        // Move entity 0 by +1 X
        // Note: In a real sim we'd copy from previous frame or state.
        // Here we just increment what's in the *current write buffer*.
        // But wait, triple buffering means 'writeFrame' might be 'garbage' or 'old data' from 3 frames ago.
        // We strictly need to copy state from 'previous' frame to 'next' frame or keep state separate.
        // For this test, I will assume we maintain state in the buffer (which is wrong for triple buffer without copy).
        // Or I'll just write `tickCount` to X position to prove it updates.

        // Let's rely on a persistent local state for the dummy entity to ensure continuity.
        this.dummyX = (this.dummyX || 0) + 1;

        buffer.pos[0] = this.dummyX;
        buffer.pos[1] = 0;

        // Log every 60 ticks
        if (this.dummyX % 60 === 0) {
            console.log(`[Sim] Tick ${this.dummyX} - BufferIdx: ${this.memory['writeIndex']} - Entity X: ${buffer.pos[0]}`);
        }

        this.memory.swap();
    }

    private dummyX = 0;
}
