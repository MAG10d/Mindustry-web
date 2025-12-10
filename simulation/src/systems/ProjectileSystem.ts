import {
    EntityType, MAX_ENTITIES
} from '@mindustry/shared';

export class ProjectileSystem {
    // Parallel array for velocity/lifetime
    // Using a Map is easier for sparse data, but TypedArray is faster.
    // Given MAX_ENTITIES = 10000, Float32Array is fine.
    private velocities: Float32Array; // vx, vy
    private lifetimes: Uint16Array;   // ticks remaining

    constructor() {
        this.velocities = new Float32Array(MAX_ENTITIES * 2);
        this.lifetimes = new Uint16Array(MAX_ENTITIES);
    }

    spawn(id: number, vx: number, vy: number, lifetime: number) {
        this.velocities[id * 2] = vx;
        this.velocities[id * 2 + 1] = vy;
        this.lifetimes[id] = lifetime;
    }

    update(frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }) {
        for (let i = 0; i < MAX_ENTITIES; i++) {
            if (frame.ids[i] === 0) continue;
            if (frame.types[i] !== EntityType.PROJECTILE_STANDARD) continue;

            // Lifetime
            if (this.lifetimes[i] > 0) {
                this.lifetimes[i]--;
            } else {
                frame.ids[i] = 0; // Despawn
                continue;
            }

            // Move
            frame.pos[i * 2] += this.velocities[i * 2];
            frame.pos[i * 2 + 1] += this.velocities[i * 2 + 1];

            // Collision Check (Naive O(N*M))
            // Iterate all units
            // Optimization: Only check every few ticks? Or Grid?
            // For prototype, brute force is fine for small N.
            this.checkCollision(i, frame);
        }
    }

    private checkCollision(projId: number, frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }) {
        const px = frame.pos[projId * 2];
        const py = frame.pos[projId * 2 + 1];
        const HIT_RADIUS = 0.5;

        for (let i = 0; i < MAX_ENTITIES; i++) {
            if (frame.ids[i] === 0 || i === projId) continue;
            if (frame.types[i] !== EntityType.UNIT_FLARE) continue;

            const ux = frame.pos[i * 2];
            const uy = frame.pos[i * 2 + 1];
            const distSq = (px-ux)*(px-ux) + (py-uy)*(py-uy);

            if (distSq < HIT_RADIUS * HIT_RADIUS) {
                // Hit!
                // Destroy Unit (For now)
                frame.ids[i] = 0;
                // Destroy Projectile
                frame.ids[projId] = 0;
                // console.log(`Projectile ${projId} hit Unit ${i}`);
                return;
            }
        }
    }
}
