import { Application, Assets, Sprite, Container, Graphics } from 'pixi.js';
import {
    HEADER_SIZE, FRAME_SIZE, MAX_ENTITIES,
    OFFSET_IDS, OFFSET_TYPES, OFFSET_POS, OFFSET_ROT, OFFSET_MAP,
    HDR_SIM_IDX, HDR_RENDER_IDX, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, TileType, EntityType,
    OFFSET_MAP_STATE
} from '@mindustry/shared';

const POWER_RANGE = 6;

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
        mapState: Uint8Array;
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
                map: new Uint16Array(buffer, base + OFFSET_MAP, MAP_WIDTH * MAP_HEIGHT),
                mapState: new Uint8Array(buffer, base + OFFSET_MAP_STATE, MAP_WIDTH * MAP_HEIGHT)
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

        // Signal that we are reading this frame
        Atomics.store(this.header, HDR_RENDER_IDX, simIdx);

        const frame = this.frames[simIdx];

        // Render Map
        this.mapGraphics.clear();

        // Draw Grid Floor (Gray)
        this.mapGraphics.rect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
        this.mapGraphics.fill(0x222222);

        // Draw Power Lines first (Background)
        this.mapGraphics.beginPath();
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const idx = y * MAP_WIDTH + x;
                if (frame.map[idx] === TileType.POWER_NODE) {
                    // Connect to nearby nodes/power blocks
                    // Simple logic: Scan range, draw line if power block.
                    // To avoid double drawing, only draw to right/down? Or just draw all.
                    const px = x * TILE_SIZE + TILE_SIZE/2;
                    const py = y * TILE_SIZE + TILE_SIZE/2;

                    // Small scan range for visuals
                    const range = POWER_RANGE;
                    const minX = Math.max(0, x - range);
                    const maxX = Math.min(MAP_WIDTH - 1, x + range);
                    const minY = Math.max(0, y - range);
                    const maxY = Math.min(MAP_HEIGHT - 1, y + range);

                    for (let ny = minY; ny <= maxY; ny++) {
                        for (let nx = minX; nx <= maxX; nx++) {
                            if (nx === x && ny === y) continue;
                            const nIdx = ny * MAP_WIDTH + nx;
                            const nTile = frame.map[nIdx];

                            if (nTile === TileType.POWER_NODE || nTile === TileType.SOLAR_PANEL ||
                                nTile === TileType.BATTERY || nTile === TileType.DRILL_MECHANICAL ||
                                nTile === TileType.TURRET_DUO) {

                                const distSq = (nx-x)*(nx-x) + (ny-y)*(ny-y);
                                if (distSq <= range * range) {
                                    // Draw Line
                                    const npx = nx * TILE_SIZE + TILE_SIZE/2;
                                    const npy = ny * TILE_SIZE + TILE_SIZE/2;

                                    this.mapGraphics.moveTo(px, py);
                                    this.mapGraphics.lineTo(npx, npy);
                                }
                            }
                        }
                    }
                }
            }
        }
        this.mapGraphics.stroke({ width: 1, color: 0xffff00, alpha: 0.3 }); // Faint yellow lines

        // Draw Walls
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const idx = y * MAP_WIDTH + x;
                const tile = frame.map[idx];
                const efficiency = frame.mapState[idx] / 100.0;

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
                        // Tint darker if no power
                        const color = efficiency > 0.1 ? 0x88ff88 : 0x448844;

                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(color);
                        this.mapGraphics.stroke({ width: 1, color: 0x000000 });

                        // Drill details
                        this.mapGraphics.rect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                        this.mapGraphics.fill(0x55aa55);
                    } else if (tile === TileType.CORE_SHARD) {
                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(0xff5555); // Red
                        this.mapGraphics.stroke({ width: 1, color: 0xffffff });
                    } else if (tile === TileType.TURRET_DUO) {
                        const color = efficiency > 0.1 ? 0x888888 : 0x444444;

                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(color);
                        this.mapGraphics.stroke({ width: 1, color: 0x000000 });

                        this.mapGraphics.circle(px + TILE_SIZE/2, py + TILE_SIZE/2, 2);
                        this.mapGraphics.fill(0xffaa00);
                    } else if (tile === TileType.SOLAR_PANEL) {
                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(0x4444ff); // Blue
                        this.mapGraphics.stroke({ width: 1, color: 0x8888ff });
                    } else if (tile === TileType.BATTERY) {
                        this.mapGraphics.rect(px, py, TILE_SIZE, TILE_SIZE);
                        this.mapGraphics.fill(0x44aa44); // Dark Green
                        this.mapGraphics.stroke({ width: 1, color: 0x88ff88 });
                    } else if (tile === TileType.POWER_NODE) {
                        this.mapGraphics.rect(px + 2, py + 2, 4, 4);
                        this.mapGraphics.fill(0xffff00); // Yellow
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
