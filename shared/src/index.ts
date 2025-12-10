// Shared types and constants
export const PROTOCOL_VERSION = 1;

export * from './constants.js';
export * from './layout.js';

export interface Entity {
    id: number;
    type: number;
    x: number;
    y: number;
}
