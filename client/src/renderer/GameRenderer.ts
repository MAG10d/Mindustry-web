import { Application, Assets, Sprite, Container, Graphics, Texture } from 'pixi.js';
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

    private entitySprites: Sprite[];
    private mapSprites: (Sprite | null)[];
    private container: Container;
    private mapLayer: Container;
    private entityLayer: Container;
    private mapGraphics: Graphics; // For floor and connections

    private textures: Record<string, Texture> = {};

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
        this.entitySprites = [];
        this.mapSprites = new Array(MAP_WIDTH * MAP_HEIGHT).fill(null);

        this.container = new Container();
        this.mapLayer = new Container();
        this.entityLayer = new Container();
        this.mapGraphics = new Graphics();

        this.container.addChild(this.mapGraphics);
        this.container.addChild(this.mapLayer);
        this.container.addChild(this.entityLayer);

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

        // Load Assets
        const assetMap = {
            'copper-wall': '/assets/sprites/copper-wall.png',
            'duo': '/assets/sprites/duo.png',
            'conveyor': '/assets/sprites/conveyor-0-0.png',
            'router': '/assets/sprites/router.png',
            'drill': '/assets/sprites/mechanical-drill.png',
            'core': '/assets/sprites/core-shard.png',
            'junction': '/assets/sprites/junction.png',
            'sorter': '/assets/sprites/sorter.png',
            'power-node': '/assets/sprites/power-node.png',
            'battery': '/assets/sprites/battery.png',
            'item-copper': '/assets/sprites/item-copper.png',
            'flare': '/assets/sprites/flare.png'
        };

        for (const [key, path] of Object.entries(assetMap)) {
            try {
                this.textures[key] = await Assets.load(path);
            } catch (e) {
                console.error(`Failed to load asset ${key}:`, e);
            }
        }

        // Create Entity Sprite Pool
        for (let i = 0; i < MAX_ENTITIES; i++) {
            const sprite = new Sprite(Texture.EMPTY); // Initialize with empty
            sprite.anchor.set(0.5);
            sprite.visible = false;
            this.entityLayer.addChild(sprite);
            this.entitySprites.push(sprite);
        }

        this.app.ticker.add(this.update.bind(this));

        // Resize handler
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
        });
    }

    update() {
        const simIdx = Atomics.load(this.header, HDR_SIM_IDX);
        Atomics.store(this.header, HDR_RENDER_IDX, simIdx);
        const frame = this.frames[simIdx];

        // 1. Render Background & Connections (Graphics)
        this.mapGraphics.clear();
        // Draw Grid Floor (Dark Gray)
        this.mapGraphics.rect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
        this.mapGraphics.fill(0x222222);

        // Draw Power Lines
        this.mapGraphics.beginPath();
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const idx = y * MAP_WIDTH + x;
                if (frame.map[idx] === TileType.POWER_NODE) {
                     const px = x * TILE_SIZE + TILE_SIZE/2;
                     const py = y * TILE_SIZE + TILE_SIZE/2;
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
        this.mapGraphics.stroke({ width: 1, color: 0xffff00, alpha: 0.3 });

        // 2. Render Map Tiles (Sprites)
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const idx = y * MAP_WIDTH + x;
                const tile = frame.map[idx];

                let sprite = this.mapSprites[idx];

                if (tile === TileType.EMPTY) {
                    if (sprite) {
                        sprite.visible = false;
                    }
                    continue;
                }

                if (!sprite) {
                    sprite = new Sprite();
                    sprite.anchor.set(0.5); // Center anchor for rotation
                    sprite.width = TILE_SIZE;
                    sprite.height = TILE_SIZE;
                    sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
                    sprite.y = y * TILE_SIZE + TILE_SIZE / 2;
                    this.mapLayer.addChild(sprite);
                    this.mapSprites[idx] = sprite;
                }

                sprite.visible = true;
                sprite.rotation = 0; // Reset rotation
                sprite.tint = 0xffffff; // Reset tint

                // Map TileType to Texture
                switch (tile) {
                    case TileType.WALL_COPPER:
                        sprite.texture = this.textures['copper-wall'] || Texture.WHITE;
                        break;
                    case TileType.CONVEYOR_UP:
                        sprite.texture = this.textures['conveyor'] || Texture.WHITE;
                        sprite.rotation = -Math.PI / 2;
                        break;
                    case TileType.CONVEYOR_DOWN:
                        sprite.texture = this.textures['conveyor'] || Texture.WHITE;
                        sprite.rotation = Math.PI / 2;
                        break;
                    case TileType.CONVEYOR_LEFT:
                        sprite.texture = this.textures['conveyor'] || Texture.WHITE;
                        sprite.rotation = Math.PI;
                        break;
                    case TileType.CONVEYOR_RIGHT:
                        sprite.texture = this.textures['conveyor'] || Texture.WHITE;
                        break;
                    case TileType.DRILL_MECHANICAL:
                        sprite.texture = this.textures['drill'] || Texture.WHITE;
                        break;
                    case TileType.CORE_SHARD:
                        sprite.texture = this.textures['core'] || Texture.WHITE;
                        break;
                    case TileType.TURRET_DUO:
                        sprite.texture = this.textures['duo'] || Texture.WHITE;
                        break;
                    case TileType.SOLAR_PANEL:
                        // No sprite fetched for solar panel, use fallback
                         sprite.texture = Texture.WHITE;
                         sprite.tint = 0x4444ff;
                        break;
                    case TileType.BATTERY:
                        sprite.texture = this.textures['battery'] || Texture.WHITE;
                        break;
                    case TileType.POWER_NODE:
                         sprite.texture = this.textures['power-node'] || Texture.WHITE;
                        break;
                    default:
                        sprite.visible = false;
                        break;
                }
            }
        }

        // 3. Render Entities (Sprites)
        for (let i = 0; i < MAX_ENTITIES; i++) {
            const id = frame.ids[i];
            const type = frame.types[i];
            const sprite = this.entitySprites[i];

            if (id > 0) {
                sprite.visible = true;
                sprite.x = frame.pos[i * 2] * TILE_SIZE;
                sprite.y = frame.pos[i * 2 + 1] * TILE_SIZE;
                sprite.rotation = 0;
                sprite.tint = 0xffffff;
                sprite.scale.set(1);

                // Map EntityType to Texture
                switch (type) {
                    case EntityType.ITEM_COPPER:
                        sprite.texture = this.textures['item-copper'] || Texture.WHITE;
                        sprite.width = TILE_SIZE * 0.6;
                        sprite.height = TILE_SIZE * 0.6;
                        break;
                    case EntityType.UNIT_FLARE:
                        sprite.texture = this.textures['flare'] || Texture.WHITE;
                        sprite.width = TILE_SIZE * 1.5; // Units are larger
                        sprite.height = TILE_SIZE * 1.5;
                        // Rotation from frame.rot (mapped 0-255 to 0-2PI)
                        sprite.rotation = (frame.rot[i] / 255) * Math.PI * 2;
                        break;
                    case EntityType.PROJECTILE_STANDARD:
                         // Simple circle/texture for projectile
                         sprite.texture = Texture.WHITE;
                         sprite.tint = 0xffffaa;
                         sprite.width = TILE_SIZE * 0.4;
                         sprite.height = TILE_SIZE * 0.4;
                         break;
                    default:
                        sprite.visible = false;
                        break;
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
