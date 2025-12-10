import { Application, Assets, Sprite, Container, Graphics } from 'pixi.js';
import {
    HEADER_SIZE, FRAME_SIZE, MAX_ENTITIES,
    OFFSET_IDS, OFFSET_TYPES, OFFSET_POS, OFFSET_ROT, OFFSET_MAP,
    HDR_SIM_IDX, HDR_RENDER_IDX, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, TileType, EntityType
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
        map: Uint16Array;
    }[];

    private sprites: Sprite[];
    private container: Container;
    private mapGraphics: Graphics;

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
                rot: new Uint8Array(buffer, base + OFFSET_ROT, MAX_ENTITIES),
                map: new Uint16Array(buffer, base + OFFSET_MAP, MAP_WIDTH * MAP_HEIGHT)
            });
        }

        this.app = new Application();
        this.sprites = [];
        this.container = new Container();
        this.mapGraphics = new Graphics();

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

        this.app.stage.addChild(this.mapGraphics);
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

        // Render Map
        this.mapGraphics.clear();

        // Draw Grid Floor (Gray)
        this.mapGraphics.rect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
        this.mapGraphics.fill(0x222222);

        // Draw Walls
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const idx = y * MAP_WIDTH + x;
                const tile = frame.map[idx];

                if (tile !== TileType.EMPTY) {
                    const px = x * TILE_SIZE;
                    const py = y * TILE_SIZE;

                    if (tile === TileType.WALL_COPPER) {
                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(0xd99d73); // Copper color
                        this.mapGraphics.stroke({ width: 1, color: 0x000000 });
                    } else if (tile >= TileType.CONVEYOR_UP && tile <= TileType.CONVEYOR_RIGHT) {
                        // Conveyor Base
                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(0x555555); // Dark Gray

                        // Direction Indicator (Small line/triangle)
                        this.mapGraphics.beginPath();
                        const cx = px + TILE_SIZE / 2;
                        const cy = py + TILE_SIZE / 2;
                        const offset = TILE_SIZE / 4;

                        this.mapGraphics.moveTo(cx, cy);
                        if (tile === TileType.CONVEYOR_UP) this.mapGraphics.lineTo(cx, cy - offset);
                        if (tile === TileType.CONVEYOR_DOWN) this.mapGraphics.lineTo(cx, cy + offset);
                        if (tile === TileType.CONVEYOR_LEFT) this.mapGraphics.lineTo(cx - offset, cy);
                        if (tile === TileType.CONVEYOR_RIGHT) this.mapGraphics.lineTo(cx + offset, cy);

                        this.mapGraphics.stroke({ width: 2, color: 0xcccccc });
                    } else if (tile === TileType.DRILL_MECHANICAL) {
                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(0x88ff88); // Greenish
                        this.mapGraphics.stroke({ width: 1, color: 0x000000 });

                        // Drill details
                        this.mapGraphics.rect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                        this.mapGraphics.fill(0x55aa55);
                    } else if (tile === TileType.CORE_SHARD) {
                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(0xff5555); // Red
                        this.mapGraphics.stroke({ width: 1, color: 0xffffff });
                    } else if (tile === TileType.TURRET_DUO) {
                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(0x888888); // Gray Base
                        this.mapGraphics.stroke({ width: 1, color: 0x000000 });

                        // Gun (Simplified visual: just a line pointing somewhat)
                        // In reality, we'd need rotation data. For now, static or point to mouse?
                        // Let's just draw a circle for "Duo".
                        this.mapGraphics.circle(px + TILE_SIZE/2, py + TILE_SIZE/2, 2);
                        this.mapGraphics.fill(0xffaa00);
                    }
                }
            }
        }

        // Render entities
        for (let i = 0; i < MAX_ENTITIES; i++) {
            const id = frame.ids[i];
            const type = frame.types[i];
            const sprite = this.sprites[i];

            if (id > 0) {
                sprite.visible = true;
                // Scale Sim Coords (Tiles) to Render Coords (Pixels)
                sprite.x = frame.pos[i * 2] * TILE_SIZE;
                sprite.y = frame.pos[i * 2 + 1] * TILE_SIZE;

                // Color/Texture based on Type
                if (type === EntityType.ITEM_COPPER) {
                    sprite.tint = 0xffff00; // Yellow
                    sprite.scale.set(0.5); // Smaller
                } else if (type === EntityType.UNIT_FLARE) {
                    sprite.tint = 0xff0000; // Red Unit
                    sprite.scale.set(0.8);
                } else if (type === EntityType.PROJECTILE_STANDARD) {
                    sprite.tint = 0xffffaa; // Light Yellow Projectile
                    sprite.scale.set(0.3);
                } else {
                    sprite.tint = 0xffffff;
                    sprite.scale.set(1);
                }
            } else {
                sprite.visible = false;
            }
        }
    }

    destroy() {
        this.app.destroy(true, { children: true, texture: true });
    }
}
