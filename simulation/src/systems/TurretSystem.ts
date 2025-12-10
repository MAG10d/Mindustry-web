import {
    TileType, EntityType, MAP_WIDTH, MAP_HEIGHT, MAX_ENTITIES
} from '@mindustry/shared';
import { ProjectileSystem } from './ProjectileSystem.js';

const RANGE = 8;
const RELOAD = 30; // Ticks
const PROJ_SPEED = 0.2;
const PROJ_LIFETIME = 60;

export class TurretSystem {
    private cooldowns: Uint8Array;
    private projectileSystem: ProjectileSystem;

    constructor(projectileSystem: ProjectileSystem) {
        this.cooldowns = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
        this.projectileSystem = projectileSystem;
    }

    update(map: Uint16Array, frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const idx = y * MAP_WIDTH + x;
                if (map[idx] === TileType.TURRET_DUO) {
                    if (this.cooldowns[idx] > 0) this.cooldowns[idx]--;

                    if (this.cooldowns[idx] === 0) {
                        const target = this.findTarget(x + 0.5, y + 0.5, frame);
                        if (target !== null) {
                            this.fire(x + 0.5, y + 0.5, target, frame);
                            this.cooldowns[idx] = RELOAD;
                        }
                    }
                }
            }
        }
    }

    private findTarget(tx: number, ty: number, frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }): { x: number, y: number } | null {
        let minDist = RANGE * RANGE;
        let target = null;

        for (let i = 0; i < MAX_ENTITIES; i++) {
            if (frame.ids[i] === 0) continue;
            if (frame.types[i] !== EntityType.UNIT_FLARE) continue;

            const ex = frame.pos[i * 2];
            const ey = frame.pos[i * 2 + 1];
            const distSq = (ex-tx)*(ex-tx) + (ey-ty)*(ey-ty);

            if (distSq < minDist) {
                minDist = distSq;
                target = { x: ex, y: ey };
            }
        }
        return target;
    }

    private fire(x: number, y: number, target: { x: number, y: number }, frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }) {
        // Find ID
        for (let i = 1000; i < MAX_ENTITIES; i++) { // Reserve lower IDs
            if (frame.ids[i] === 0) {
                frame.ids[i] = i;
                frame.types[i] = EntityType.PROJECTILE_STANDARD;
                frame.pos[i * 2] = x;
                frame.pos[i * 2 + 1] = y;

                const dx = target.x - x;
                const dy = target.y - y;
                const len = Math.sqrt(dx*dx + dy*dy);

                const vx = (dx / len) * PROJ_SPEED;
                const vy = (dy / len) * PROJ_SPEED;

                this.projectileSystem.spawn(i, vx, vy, PROJ_LIFETIME);
                // console.log(`Turret fired projectile ${i}`);
                break;
            }
        }
    }
}
