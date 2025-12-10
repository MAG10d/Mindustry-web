import {
    EntityType, TileType, MAP_WIDTH, MAP_HEIGHT, MAX_ENTITIES
} from '@mindustry/shared';

const SPEED = 0.03; // Tiles per tick

export class UnitSystem {
    private coreLocation: { x: number, y: number } | null = null;

    update(frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }, map: Uint16Array) {
        // Cache Core Location (Naive: Re-scan every 60 ticks or if null)
        // For prototype, scan every frame if null.
        if (!this.coreLocation) {
            for (let i = 0; i < map.length; i++) {
                if (map[i] === TileType.CORE_SHARD) {
                    this.coreLocation = {
                        x: (i % MAP_WIDTH) + 0.5,
                        y: Math.floor(i / MAP_WIDTH) + 0.5
                    };
                    break;
                }
            }
        }

        if (!this.coreLocation) return;

        for (let i = 0; i < MAX_ENTITIES; i++) {
            if (frame.ids[i] === 0) continue;
            if (frame.types[i] !== EntityType.UNIT_FLARE) continue;

            const x = frame.pos[i * 2];
            const y = frame.pos[i * 2 + 1];

            // Move towards Core
            const dx = this.coreLocation.x - x;
            const dy = this.coreLocation.y - y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist > 0.1) {
                frame.pos[i * 2] += (dx / dist) * SPEED;
                frame.pos[i * 2 + 1] += (dy / dist) * SPEED;
            }
        }
    }
}
