import {
    MAP_WIDTH, MAP_HEIGHT, MAX_ENTITIES, TileType
} from '@mindustry/shared';

export interface SaveData {
    tiles: { idx: number; type: number }[];
    entities: { id: number; type: number; x: number; y: number }[];
}

export class SaveManager {
    static exportState(
        map: Uint16Array,
        frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array }
    ): SaveData {
        const data: SaveData = { tiles: [], entities: [] };

        // Save Map (Sparse)
        for (let i = 0; i < map.length; i++) {
            if (map[i] !== TileType.EMPTY) {
                data.tiles.push({ idx: i, type: map[i] });
            }
        }

        // Save Entities
        for (let i = 0; i < MAX_ENTITIES; i++) {
            if (frame.ids[i] > 0) {
                data.entities.push({
                    id: frame.ids[i],
                    type: frame.types[i],
                    x: frame.pos[i * 2],
                    y: frame.pos[i * 2 + 1]
                });
            }
        }

        return data;
    }

    static importState(
        map: Uint16Array,
        frame: { ids: Uint16Array; types: Uint8Array; pos: Float32Array },
        data: SaveData
    ) {
        // Clear Map
        map.fill(TileType.EMPTY);

        // Clear Entities
        frame.ids.fill(0);
        frame.types.fill(0);
        frame.pos.fill(0);

        // Load Map
        for (const tile of data.tiles) {
            if (tile.idx >= 0 && tile.idx < map.length) {
                map[tile.idx] = tile.type;
            }
        }

        // Load Entities
        for (const ent of data.entities) {
            if (ent.id > 0 && ent.id < MAX_ENTITIES) {
                frame.ids[ent.id] = ent.id; // Or ent.id if persisted
                frame.types[ent.id] = ent.type;
                frame.pos[ent.id * 2] = ent.x;
                frame.pos[ent.id * 2 + 1] = ent.y;
            }
        }
    }
}
