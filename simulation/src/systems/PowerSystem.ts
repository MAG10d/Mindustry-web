import {
    TileType, MAP_WIDTH, MAP_HEIGHT
} from '@mindustry/shared';

const POWER_RANGE = 6;

// Power Stats
const PROD_SOLAR = 10;
const CONS_DRILL = 5;
const CONS_TURRET = 5;

export class PowerSystem {
    private needsRebuild: boolean = false;
    private graphs: PowerGraph[] = [];

    // Map Tile Index -> Graph Index (in this.graphs)
    // -1 means no graph.
    private tileGraphIndex: Int32Array;

    constructor() {
        this.tileGraphIndex = new Int32Array(MAP_WIDTH * MAP_HEIGHT).fill(-1);
    }

    triggerRebuild() {
        this.needsRebuild = true;
    }

    update(map: Uint16Array, mapState: Uint8Array) {
        if (this.needsRebuild) {
            this.rebuild(map);
            this.needsRebuild = false;
        }

        // Calculate Balance per Graph
        for (const graph of this.graphs) {
            graph.produced = graph.producers * PROD_SOLAR;
            graph.consumed = graph.consumers * CONS_DRILL + graph.turrets * CONS_TURRET; // Simplified

            if (graph.consumed > 0) {
                graph.efficiency = Math.min(1.0, graph.produced / graph.consumed);
            } else {
                graph.efficiency = 1.0;
            }
        }

        // Write Efficiency to MapState
        // Only write for tiles that are part of a graph
        // Optimize: Only write if changed? Or simpler: write all every frame.
        // Iterate all tiles is expensive.
        // Better: Iterate tiles in graphs.

        for (let i = 0; i < this.graphs.length; i++) {
            const graph = this.graphs[i];
            const effByte = Math.floor(graph.efficiency * 100);

            for (const idx of graph.tiles) {
                mapState[idx] = effByte;
            }
        }
    }

    private rebuild(map: Uint16Array) {
        this.graphs = [];
        this.tileGraphIndex.fill(-1);

        // Find all Power Nodes (roots of graphs)
        // Also include producers/consumers if they aren't connected to nodes?
        // In Mindustry, blocks only connect via Nodes (mostly).
        // Let's assume ANY power block can start a graph, but usually Nodes merge them.

        // Scan map
        for (let idx = 0; idx < map.length; idx++) {
            const tile = map[idx];
            if (this.isPowerBlock(tile) && this.tileGraphIndex[idx] === -1) {
                // New Graph
                const graph = new PowerGraph();
                this.graphs.push(graph);
                const graphId = this.graphs.length - 1;

                // BFS
                const queue: number[] = [idx];
                this.tileGraphIndex[idx] = graphId;
                graph.addTile(idx, tile);

                while (queue.length > 0) {
                    const current = queue.shift()!;
                    const cx = current % MAP_WIDTH;
                    const cy = Math.floor(current / MAP_WIDTH);

                    // Find neighbors
                    // If Node: Check Range.
                    // If Block: Check Adjacent (or Range? Mindustry blocks don't extend range).
                    // Let's simplified: Only NODES extend range.

                    const isNode = map[current] === TileType.POWER_NODE;
                    const range = isNode ? POWER_RANGE : 1; // Blocks connect to adjacent nodes

                    // Optimization: Scan square area
                    const minX = Math.max(0, cx - range);
                    const maxX = Math.min(MAP_WIDTH - 1, cx + range);
                    const minY = Math.max(0, cy - range);
                    const maxY = Math.min(MAP_HEIGHT - 1, cy + range);

                    for (let y = minY; y <= maxY; y++) {
                        for (let x = minX; x <= maxX; x++) {
                            const nIdx = y * MAP_WIDTH + x;
                            if (this.tileGraphIndex[nIdx] !== -1) continue; // Already visited

                            const nTile = map[nIdx];
                            if (this.isPowerBlock(nTile)) {
                                // Check Distance (Euclidean)
                                const distSq = (x-cx)*(x-cx) + (y-cy)*(y-cy);
                                if (distSq <= range * range) {
                                    // Connected
                                    this.tileGraphIndex[nIdx] = graphId;
                                    graph.addTile(nIdx, nTile);
                                    queue.push(nIdx);
                                }
                            }
                        }
                    }
                }
            }
        }
        // console.log(`PowerSystem: Rebuilt ${this.graphs.length} graphs`);
    }

    private isPowerBlock(tile: number): boolean {
        return tile === TileType.SOLAR_PANEL ||
               tile === TileType.BATTERY ||
               tile === TileType.POWER_NODE ||
               tile === TileType.DRILL_MECHANICAL ||
               tile === TileType.TURRET_DUO;
    }
}

class PowerGraph {
    tiles: number[] = [];
    producers = 0; // Solar
    consumers = 0; // Drill
    turrets = 0;   // Turret

    produced = 0;
    consumed = 0;
    efficiency = 1.0;

    addTile(idx: number, tile: number) {
        this.tiles.push(idx);
        if (tile === TileType.SOLAR_PANEL) this.producers++;
        if (tile === TileType.DRILL_MECHANICAL) this.consumers++;
        if (tile === TileType.TURRET_DUO) this.turrets++;
    }
}
