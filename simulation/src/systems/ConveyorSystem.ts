import {
    TileType, EntityType, MAP_WIDTH, MAP_HEIGHT, MAX_ENTITIES
} from '@mindustry/shared';

const SPEED = 0.05;

export function updateConveyors(
    frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array; rot: Uint8Array },
    map: Uint16Array
) {
    for (let i = 0; i < MAX_ENTITIES; i++) {
        if (frame.ids[i] === 0) continue;
        if (frame.types[i] !== EntityType.ITEM_COPPER) continue;

        const x = frame.pos[i * 2];
        const y = frame.pos[i * 2 + 1];

        // Get tile coordinates
        const tx = Math.floor(x);
        const ty = Math.floor(y);

        if (tx < 0 || tx >= MAP_WIDTH || ty < 0 || ty >= MAP_HEIGHT) continue;

        const tileIdx = ty * MAP_WIDTH + tx;
        const tile = map[tileIdx];

        let dx = 0;
        let dy = 0;

        // Determine direction based on conveyor type
        switch (tile) {
            case TileType.CONVEYOR_UP:    dy = -1; break;
            case TileType.CONVEYOR_DOWN:  dy = 1; break;
            case TileType.CONVEYOR_LEFT:  dx = -1; break;
            case TileType.CONVEYOR_RIGHT: dx = 1; break;
            default: continue; // Not on a conveyor
        }

        // Check ahead for blockage (Wall/Empty)
        // Simple logic: If moving into a non-conveyor tile, check if we are at the edge.
        // If dist to center > 0.5 (meaning moving out), and next tile is blocked, stop.

        // Next Tile
        const nx = tx + dx;
        const ny = ty + dy;
        let blocked = false;

        if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) {
            blocked = true;
        } else {
            const nextTile = map[ny * MAP_WIDTH + nx];
            // Treat anything not a Conveyor as "Blocked" for now (Simple Congestion)
            // In reality, it could move into a Router, Drill, etc.
            if (nextTile < TileType.CONVEYOR_UP || nextTile > TileType.CONVEYOR_RIGHT) {
                blocked = true;
            }
        }

        // Current relative position to center (0.5, 0.5)
        // If blocked, clamp movement to edge.
        // Example: Moving Right (dx=1). Center is x.5. Edge is x+1.
        // We want to stop at x + 0.9?

        if (blocked) {
            // Check if we are past the "stop point"
            // For simplicity, stop at center of current tile if blocked ahead?
            // No, items usually pile up at the edge.
            // Let's say stop at 0.5 offset from center.

            const localX = x - tx;
            const localY = y - ty;

            // Allow movement only if not past threshold
            const threshold = 0.9;

            if (dx > 0 && localX > threshold) dx = 0;
            if (dx < 0 && localX < 1 - threshold) dx = 0;
            if (dy > 0 && localY > threshold) dy = 0;
            if (dy < 0 && localY < 1 - threshold) dy = 0;
        }

        // Move
        frame.pos[i * 2] += dx * SPEED;
        frame.pos[i * 2 + 1] += dy * SPEED;

        // Center Snapping (Align to middle of tile on cross-axis)
        const centerX = tx + 0.5;
        const centerY = ty + 0.5;
        const SNAP_STRENGTH = 0.1;

        if (dx !== 0) { // Moving Horizontally -> Snap Y
            const diffY = centerY - frame.pos[i * 2 + 1];
            frame.pos[i * 2 + 1] += diffY * SNAP_STRENGTH;
        } else { // Moving Vertically -> Snap X
            const diffX = centerX - frame.pos[i * 2];
            frame.pos[i * 2] += diffX * SNAP_STRENGTH;
        }
    }
}
