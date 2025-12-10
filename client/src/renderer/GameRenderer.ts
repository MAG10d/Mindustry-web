import { Application, Assets, Sprite, Container } from 'pixi.js';
import {
    HEADER_SIZE, FRAME_SIZE, MAX_ENTITIES,
    OFFSET_IDS, OFFSET_TYPES, OFFSET_POS, OFFSET_ROT,
    HDR_SIM_IDX
} from '@mindustry/shared';

export class GameRenderer {
    private app: Application;
    private buffer: SharedArrayBuffer;
    private header: Int32Array;
    private frames: {
        ids: Uint16Array;
        types: Uint8Array;
        pos: Float32Array;
        rot: Uint8Array;
    }[];

    private sprites: Sprite[];
    private container: Container;

    constructor(canvas: HTMLCanvasElement, buffer: SharedArrayBuffer) {
        this.buffer = buffer;
        this.header = new Int32Array(buffer, 0, HEADER_SIZE / 4);

        // Create views for all 3 buffers
        this.frames = [];
        for (let i = 0; i < 3; i++) {
            const base = HEADER_SIZE + (i * FRAME_SIZE);
            this.frames.push({
                ids: new Uint16Array(buffer, base + OFFSET_IDS, MAX_ENTITIES),
                types: new Uint8Array(buffer, base + OFFSET_TYPES, MAX_ENTITIES),
                pos: new Float32Array(buffer, base + OFFSET_POS, MAX_ENTITIES * 2),
                rot: new Uint8Array(buffer, base + OFFSET_ROT, MAX_ENTITIES)
            });
        }

        this.app = new Application();
        this.sprites = [];
        this.container = new Container();

        this.init(canvas);
    }

    async init(canvas: HTMLCanvasElement) {
        await this.app.init({
            canvas: canvas,
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x000000,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        this.app.stage.addChild(this.container);

        // Load Asset
        const texture = await Assets.load('/assets/sprites/duo.png'); // Placeholder or real

        // Create Sprite Pool
        for (let i = 0; i < MAX_ENTITIES; i++) {
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.visible = false;
            this.container.addChild(sprite);
            this.sprites.push(sprite);
        }

        this.app.ticker.add(this.update.bind(this));

        // Resize handler
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
        });
    }

    update() {
        // Read latest committed frame from Simulation
        // Note: In real logic we'd smooth between frames.
        // For "Basic Rendering", we just snap to the latest frame.

        const simIdx = Atomics.load(this.header, HDR_SIM_IDX);
        const frame = this.frames[simIdx];

        // Render entities
        for (let i = 0; i < MAX_ENTITIES; i++) {
            const id = frame.ids[i];
            const sprite = this.sprites[i];

            if (id > 0) {
                sprite.visible = true;
                sprite.x = frame.pos[i * 2];
                sprite.y = frame.pos[i * 2 + 1];
                // Sim Y is usually Up? Pixi Y is Down.
                // Assuming standard screen coords for now.
                // sprite.rotation = frame.rot[i]... (need conversion 0-255 -> rads)
            } else {
                sprite.visible = false;
            }
        }
    }

    destroy() {
        this.app.destroy(true, { children: true, texture: true });
    }
}
