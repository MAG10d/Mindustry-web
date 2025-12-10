import {
    TileType, EntityType, MAP_WIDTH, MAP_HEIGHT, MAX_ENTITIES, HDR_RES_COPPER
} from '@mindustry/shared';

export function updateInventory(
    frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array },
    map: Uint16Array,
    header: Int32Array
) {
    for (let i = 0; i < MAX_ENTITIES; i++) {
        if (frame.ids[i] === 0) continue;
        if (frame.types[i] !== EntityType.ITEM_COPPER) continue;

        const x = frame.pos[i * 2];
        const y = frame.pos[i * 2 + 1];

        const tx = Math.floor(x);
        const ty = Math.floor(y);

        if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
            const tile = map[ty * MAP_WIDTH + tx];
            if (tile === TileType.CORE_SHARD) {
                // Consume Item
                frame.ids[i] = 0;

                // Add to Global Inventory
                Atomics.add(header, HDR_RES_COPPER, 1);
                // console.log("Item entered Core!");
            }
        }
    }
}
