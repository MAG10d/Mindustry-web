import { MAX_ENTITIES, MAP_WIDTH, MAP_HEIGHT } from './constants.js';

export const HEADER_SIZE = 64; // Bytes

export enum TileType {
    EMPTY = 0,
    WALL_COPPER = 1,
    CONVEYOR = 2
}

// Entity SoA Sizes (in Bytes)
export const ENTITY_ID_SIZE = MAX_ENTITIES * 2;       // Uint16
export const ENTITY_TYPE_SIZE = MAX_ENTITIES * 1;     // Uint8
export const ENTITY_POS_SIZE = MAX_ENTITIES * 4 * 2;  // Float32 * 2 (X, Y)
export const ENTITY_ROT_SIZE = MAX_ENTITIES * 1;      // Uint8

// Alignments (4-byte alignment for Float32 safety)
const pad = (n: number) => (n + 3) & ~3;

export const OFFSET_IDS = 0;
export const OFFSET_TYPES = pad(OFFSET_IDS + ENTITY_ID_SIZE);
export const OFFSET_POS = pad(OFFSET_TYPES + ENTITY_TYPE_SIZE);
export const OFFSET_ROT = pad(OFFSET_POS + ENTITY_POS_SIZE);

// Map Data
export const MAP_SIZE = MAP_WIDTH * MAP_HEIGHT * 2; // Uint16
export const OFFSET_MAP = pad(OFFSET_ROT + ENTITY_ROT_SIZE);

export const FRAME_SIZE = pad(OFFSET_MAP + MAP_SIZE);

export const TOTAL_MEMORY = HEADER_SIZE + (FRAME_SIZE * 3);

// Header Offsets (Int32 Indices)
export const HDR_TICK = 0;
export const HDR_RENDER_IDX = 1; // Index of buffer currently being read by Renderer
export const HDR_SIM_IDX = 2;    // Index of buffer currently being written by Sim
export const HDR_LOCKED = 3;     // Spinlock
