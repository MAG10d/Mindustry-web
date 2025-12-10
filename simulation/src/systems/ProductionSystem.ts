import {
    TileType, EntityType, MAP_WIDTH, MAP_HEIGHT, MAX_ENTITIES
} from '@mindustry/shared';

export class ProductionSystem {
    private cooldowns: Uint8Array;

    constructor() {
        this.cooldowns = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
    }

    update(map: Uint16Array, frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const idx = y * MAP_WIDTH + x;
                const tile = map[idx];

                if (tile === TileType.DRILL_MECHANICAL) {
                    this.cooldowns[idx]++;

                    // Drill Rate: Every 60 ticks (1 sec)
                    if (this.cooldowns[idx] >= 60) {
                        if (this.tryOutputItem(x, y, map, frame)) {
                            this.cooldowns[idx] = 0;
                        } else {
                            // If blocked, just keep cooldown at max?
                            this.cooldowns[idx] = 60;
                        }
                    }
                }
            }
        }
    }

    private tryOutputItem(x: number, y: number, map: Uint16Array, frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }): boolean {
        // Check 4 neighbors
        const neighbors = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
        ];

        for (const { dx, dy } of neighbors) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
                const nIdx = ny * MAP_WIDTH + nx;
                const nTile = map[nIdx];

                // Output to Conveyor or Core
                if ((nTile >= TileType.CONVEYOR_UP && nTile <= TileType.CONVEYOR_RIGHT) || nTile === TileType.CORE_SHARD) {
                    // Spawn Item
                    return this.spawnItem(nx, ny, frame);
                }
            }
        }
        return false;
    }

    private spawnItem(x: number, y: number, frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }): boolean {
        // Find free ID
        // Note: Simple linear scan. Optimization: Keep a "nextFreeId" hint.
        for (let i = 10; i < MAX_ENTITIES; i++) {
            if (frame.ids[i] === 0) {
                frame.ids[i] = i;
                frame.types[i] = EntityType.ITEM_COPPER;
                frame.pos[i * 2] = x + 0.5;
                frame.pos[i * 2 + 1] = y + 0.5;
                // console.log(`Drill spawned item at ${x},${y}`);
                return true;
            }
        }
        return false;
    }
}
