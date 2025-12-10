import {
    TOTAL_MEMORY, HEADER_SIZE, FRAME_SIZE,
    OFFSET_IDS, OFFSET_TYPES, OFFSET_POS, OFFSET_ROT,
    MAX_ENTITIES,
    HDR_TICK, HDR_RENDER_IDX, HDR_SIM_IDX
} from '@mindustry/shared';

export class SharedMemoryManager {
    public buffer: SharedArrayBuffer;
    public header: Int32Array;

    // Triple Buffer Views
    private frames: {
        ids: Uint16Array;
        types: Uint8Array;
        pos: Float32Array;
        rot: Uint8Array;
    }[];

    private writeIndex: number = 0;

    constructor() {
        this.buffer = new SharedArrayBuffer(TOTAL_MEMORY);
        this.header = new Int32Array(this.buffer, 0, HEADER_SIZE / 4);

        // Initialize Header
        Atomics.store(this.header, HDR_TICK, 0);
        Atomics.store(this.header, HDR_RENDER_IDX, 0);
        Atomics.store(this.header, HDR_SIM_IDX, 1);

        this.writeIndex = 1; // Start writing to buffer 1

        this.frames = [];
        for (let i = 0; i < 3; i++) {
            const base = HEADER_SIZE + (i * FRAME_SIZE);
            this.frames.push({
                ids: new Uint16Array(this.buffer, base + OFFSET_IDS, MAX_ENTITIES),
                types: new Uint8Array(this.buffer, base + OFFSET_TYPES, MAX_ENTITIES),
                pos: new Float32Array(this.buffer, base + OFFSET_POS, MAX_ENTITIES * 2),
                rot: new Uint8Array(this.buffer, base + OFFSET_ROT, MAX_ENTITIES)
            });
        }
    }

    get sharedBuffer() {
        return this.buffer;
    }

    get writeFrame() {
        return this.frames[this.writeIndex];
    }

    swap() {
        const currentTick = Atomics.load(this.header, HDR_TICK);
        Atomics.store(this.header, HDR_TICK, currentTick + 1);

        // Simple Triple Buffer Logic:
        // We just finished writing 'writeIndex'.
        // We want to make it available to render.
        // We need to pick a new 'writeIndex' that is NOT the one currently being read.

        const renderIdx = Atomics.load(this.header, HDR_RENDER_IDX);

        // The buffer we just finished
        const finishedBuffer = this.writeIndex;

        // Find next free buffer (0, 1, 2) that is != renderIdx and != finishedBuffer
        // Actually, we just swap.
        // The renderer reads 'HDR_RENDER_IDX'.
        // We can update a "Latest Ready" index?
        // Usually:
        // Render reads A.
        // Sim writes B.
        // When Sim finishes B, it wants to swap.
        // If Render is still busy with A, Sim can start writing C.
        // If Render is done with A, it can pick up B.

        // Simplified Logic for now:
        // 1. Mark current write buffer as "Latest" (stored in specific slot? Or just imply it?)
        // Let's rely on atomic exchange.

        // Actually, let's look at AGENTS.md: "Buffer A: Displayed, Buffer B: Writing, Buffer C: Completed".
        // At end of tick:
        // We have a "Completed" buffer (what was writeIndex).
        // We check what the Render is doing.
        // Actually, we can just update a "LatestCommitted" pointer.
        // The Renderer will look at "LatestCommitted" and swap to it when it starts a frame.

        // Let's add HDR_LATEST_IDX to header if needed, or re-use HDR_SIM_IDX?
        // Let's use HDR_SIM_IDX as "The buffer the Sim is currently writing to" (Debugging).
        // And we need HDR_LATEST_READY_IDX.

        // Let's update Layout constants in next step if needed, but for now I'll use a local logic.
        // Let's assume HDR_RENDER_IDX is what Render IS reading.
        // We need to tell Render "Here is the new freshest frame".
        // But we can't force Render to switch. Render switches on its own time.
        // So we write to a "Pending" slot.

        // For this task, I'll implement a simple rotation:
        // Next write index = (writeIndex + 1) % 3.
        // If next == renderIdx, skip to (writeIndex + 2) % 3?
        // Wait, if next == renderIdx, that means Render is reading it. We can't write to it.

        let nextWrite = (this.writeIndex + 1) % 3;
        if (nextWrite === renderIdx) {
            nextWrite = (this.writeIndex + 2) % 3;
        }

        // Now we say: "The buffer I just finished (this.writeIndex) is ready".
        // How do we communicate that?
        // We can exchange HDR_RENDER_IDX? No, render updates that.

        // Let's use a standard "Mailbox" pattern.
        // HDR_LATEST_FRAME = <index of most recent completed frame>.
        // Renderer reads HDR_LATEST_FRAME.

        // I will overload HDR_SIM_IDX to mean "Latest Completed Frame" for now?
        // No, let's use a new slot or just assume HDR_SIM_IDX is "Last Written".

        Atomics.store(this.header, HDR_SIM_IDX, this.writeIndex); // "I just finished this one"

        this.writeIndex = nextWrite;
    }
}
