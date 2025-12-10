import React, { useEffect, useState, useRef } from 'react';
import { HEADER_SIZE, HDR_RES_COPPER } from '@mindustry/shared';

export const ResourcesDisplay = ({ buffer }: { buffer: SharedArrayBuffer | null }) => {
    const [copper, setCopper] = useState(0);
    const frameRef = useRef<number>();

    useEffect(() => {
        if (!buffer) return;
        const header = new Int32Array(buffer, 0, HEADER_SIZE / 4);

        const loop = () => {
            const count = Atomics.load(header, HDR_RES_COPPER);
            setCopper(count);
            frameRef.current = requestAnimationFrame(loop);
        };

        loop();

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [buffer]);

    if (!buffer) return null;

    return (
        <div className="absolute top-4 right-4 bg-black/70 p-4 rounded text-white font-mono pointer-events-auto">
            <h3 className="text-sm font-bold border-b border-gray-500 mb-2">Core Resources</h3>
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-600 rounded-full"></div>
                <span>Copper: {copper}</span>
            </div>
        </div>
    );
};
