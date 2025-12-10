# Mindustry Web Recreation - Technical Master Plan

**Project**: Mindustry Web Engine  
**Version**: 3.0 (Production Ready Architecture)  
**Target Platform**: Web (Desktop & Mobile) via Docker/VPS  
**Performance Goal**: 60 FPS @ 10,000 Entities  
**Core Strategy**: Dual-Threaded (Worker/Main) + Data-Oriented Design + Zero-Copy Shared Memory

---

## 1. Executive Summary

This project is a high-fidelity web port of [Mindustry](https://github.com/Anuken/Mindustry). Due to the requirements of simulating thousands of items on conveyor belts, fluid dynamics, and logic VMs, a standard Object-Oriented JS approach is insufficient.

We utilize a **SharedArrayBuffer** architecture where the **Simulation** runs in a Web Worker, and the **Main Thread** handles Rendering (Pixi.js) and UI (React). This separation ensures UI responsiveness even under heavy calculation loads.

---

## 2. Technology Stack

### 2.1 Core Runtime
*   **Language**: TypeScript 5.x (Strict Mode)
*   **Build Tool**: Vite 5.x (SPA Mode - No SSR)
*   **Memory**: `SharedArrayBuffer` + `Atomics`
*   **Math**: `gl-matrix` (Allocation-free linear algebra)

### 2.2 Frontend (Client)
*   **Framework**: React 18 (UI Overlay Only) + Zustand (UI State)
*   **Rendering**: Pixi.js v8 (WebGL 2)
*   **Styling**: Tailwind CSS (Industrial Dark Theme)
*   **Router**: React Router v6
*   **No Next.js**: To avoid SSR overhead and simplify security/headers management.

### 2.3 Backend (Server)
*   **Runtime**: Node.js 20+ LTS
*   **Network**: `uWebSockets.js` (High-performance WebSocket)
*   **Protocol**: Binary (Protobuf or custom Byte packing)
*   **Logic**: Runs the exact same `simulation/` code as the client (Headless).

### 2.4 Infrastructure
*   **Container**: Docker + Docker Compose
*   **Gateway**: Nginx (Must handle COOP/COEP headers)
*   **CI/CD**: GitHub Actions + GHCR

---

## 3. Architecture: The "Dual-Loop" System

### 3.1 Memory Layout (The "Database")
The Game State is a flat binary block, not a tree of objects.

```typescript
// Shared Memory Schema Concept
[ Header (64 bytes) ]
   - TickCounter (Uint32)
   - AtomicLocks (Int32)
[ Entity Block (Struct of Arrays) ]
   - IDs: Uint16Array[MAX_ENTITIES]
   - Types: Uint8Array[MAX_ENTITIES]
   - Positions: Float32Array[MAX_ENTITIES * 2] (Interleaved X,Y)
   - Rotations: Uint8Array[MAX_ENTITIES] (Quantized 0-255)
[ Map Grid Block ]
   - Tiles: Uint16Array[WIDTH * HEIGHT]
```

### 3.2 Thread Responsibilities

| Thread | Responsibilities | Access to Memory |
| :--- | :--- | :--- |
| **Main (UI/Render)** | Input Capture, React UI, Interpolation, Pixi Draw Calls | Read-Only (Buffer A/C) |
| **Worker (Sim)** | Physics, Pathfinding, Conveyor Logic, mlog VM | Read/Write (Buffer B) |

### 3.3 Triple Buffering
To avoid race conditions:
1.  **Buffer A**: Currently displayed frame.
2.  **Buffer B**: Worker writing next frame.
3.  **Buffer C**: Completed frame waiting for swap.
*   *Sync*: `Atomics.exchange` handles the pointer swap at the end of a tick.

---

## 4. Frontend Implementation Pattern

### 4.1 The "Overlay" Pattern
React is strictly for UI. Pixi is strictly for the Game World.

```html
<body>
  <!-- Layer 0: The Game World -->
  <canvas id="pixi-canvas" style="z-index: 0"></canvas>
  
  <!-- Layer 1: The UI Overlay -->
  <div id="react-root" style="z-index: 10; pointer-events: none">
    <!-- HUD Elements enable pointer-events: auto -->
    <HUD />
    <BuildMenu />
  </div>
</body>
```

### 4.2 Security & Updates
*   **Dependency Locking**: Use exact versions in `package.json` (remove `^`) to prevent auto-upgrades to vulnerable versions.
*   **Audit**: Run `npm audit` in CI pipeline.

---

## 5. Simulation Mechanics (The Hard Parts)

### 5.1 Conveyor Belts (Graph Optimization)
*   **Problem**: 5000 items as individual physics bodies = Lag.
*   **Solution**: "Conveyor Segments".
    *   A line of connected conveyors is 1 Segment.
    *   Items are just integer offsets in a Queue.
    *   Logic runs on Segments (O(N)), not Items (O(N*M)).

### 5.2 Logic VM (mlog)
*   **Execution**: Runs in Worker.
*   **Sandbox**: Custom bytecode interpreter. No `eval()`.
*   **Instruction Limit**: 1000 ops/tick per processor.

---

## 6. Networking & Multiplayer

### 6.1 Protocol
*   **Transport**: WebSocket (Binary).
*   **Serialization**: Zero-copy from SharedBuffer where possible.
*   **Delta Compression**: Only send `XOR` differences between frames.

### 6.2 Strategy
*   **Server Authoritative**: Server holds the "True" state.
*   **Client Prediction**: Client simulates inputs immediately.
*   **Snapshot Interpolation**: Client renders other players ~50ms in the past for smoothness.

---

## 7. DevOps & Deployment

**Critical**: `SharedArrayBuffer` requires specific HTTP Response Headers.

### 7.1 Nginx Config (`nginx/conf.d/default.conf`)
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # REQUIRED for SharedArrayBuffer / High-Perf Multithreading
    add_header Cross-Origin-Opener-Policy "same-origin";
    add_header Cross-Origin-Embedder-Policy "require-corp";

    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /ws/ {
        proxy_pass http://server:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### 7.2 Docker Structure
*   `client`: Multi-stage build (Node Build -> Nginx Alpine).
*   `server`: Node Alpine.

---

## 8. Directory Structure

```
root/
├── client/                 # Vite + React + Pixi
│   ├── src/
│   │   ├── components/     # React UI
│   │   ├── renderer/       # Pixi.js Systems
│   │   ├── worker/         # Simulation Worker Entry
│   │   └── App.tsx
│   ├── public/             # Static Assets
│   └── vite.config.ts
│
├── simulation/             # CORE LOGIC (Shared)
│   ├── src/
│   │   ├── memory/         # SharedArrayBuffer Managers
│   │   ├── world/          # Map & Tiles
│   │   ├── systems/        # Conveyor, Liquid, Power
│   │   └── GameLoop.ts     # Fixed Time Step Loop
│
├── server/                 # Node.js Backend
│   ├── src/
│   │   ├── net/            # WebSocket
│   │   └── index.ts
│
├── scripts/                # Asset Pipeline
│   └── fetch-assets.js     # Downloads Mindustry sprites
│
└── docker/                 # Deployment
    ├── client.Dockerfile
    ├── server.Dockerfile
    └── compose.yml
```

---

## 9. Development Roadmap

### Phase 1: Foundation (Current Focus)
1.  **Project Scaffolding**: Setup Monorepo (Workspaces), Vite, TypeScript.
2.  **Asset Pipeline**: Script to fetch/pack Mindustry assets.
3.  **Memory Architecture**: Implement `SharedMemoryManager` and the Triple Buffer loop.
4.  **Render Test**: Render 5000 static sprites using the SharedBuffer.

### Phase 2: Logistics Core
1.  **Grid System**: Tilemap data structure.
2.  **Conveyor Logic**: Segment-based flow algorithm.
3.  **Building Placement**: UI <-> Worker interaction.

### Phase 3: Gameplay
1.  **Resource Mining**: Drill logic.
2.  **Power System**: Graph network propagation.
3.  **Unit Pathfinding**: Flow fields.

### Phase 4: Multiplayer & Release
1.  **Headless Server**: Port simulation to Node.js.
2.  **Snapshot Sync**: Binary delta compression.
3.  **Docker Deployment**: Nginx setup and VPS rollout.

---

## 10. Rules for AI Agents

1.  **Read Before Write**: Always check `AGENTS.md` before creating new files to ensure architecture consistency.
2.  **Strict Typing**: No `any`. Use `shared/types` for data structures.
3.  **Performance First**: 
    *   No object allocation in `update()` loops.
    *   Use `for` loops instead of `.forEach` in critical paths.
4.  **Isolation**: React code must NOT import Simulation code directly. Use the MessageBridge or SharedMemory.

---
