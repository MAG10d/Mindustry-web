import React, { useState } from 'react';
import { TileType } from '@mindustry/shared';

const CATEGORIES = {
    'Defense': [
        { type: TileType.WALL_COPPER, name: 'Wall', icon: '/assets/sprites/copper-wall.png' },
        { type: TileType.TURRET_DUO, name: 'Duo', icon: '/assets/sprites/duo.png' },
    ],
    'Production': [
        { type: TileType.DRILL_MECHANICAL, name: 'Drill', icon: '/assets/sprites/mechanical-drill.png' },
    ],
    'Distribution': [
        { type: TileType.CONVEYOR_RIGHT, name: 'Conveyor', icon: '/assets/sprites/conveyor-0-0.png' },
    ],
    'Power': [
        { type: TileType.POWER_NODE, name: 'Node', icon: '/assets/sprites/power-node.png' },
        { type: TileType.BATTERY, name: 'Battery', icon: '/assets/sprites/battery.png' },
        { type: TileType.SOLAR_PANEL, name: 'Solar', icon: '', fallbackColor: '#4444ff' },
    ],
};

interface BuildMenuProps {
    onSelect: (type: TileType) => void;
    selectedType: TileType | null;
}

export function BuildMenu({ onSelect, selectedType }: BuildMenuProps) {
    const [activeCategory, setActiveCategory] = useState<string>('Distribution');

    return (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900/90 p-2 rounded-lg border border-gray-600 text-white flex flex-col gap-2 shadow-xl backdrop-blur-sm pointer-events-auto select-none">
            {/* Category Tabs */}
            <div className="flex gap-1 justify-center border-b border-gray-700 pb-2 mb-1">
                {Object.keys(CATEGORIES).map(cat => (
                    <button
                        key={cat}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors
                            ${activeCategory === cat
                                ? 'bg-yellow-600 text-white shadow-md'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        onClick={() => setActiveCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Block Grid */}
            <div className="flex gap-2 flex-wrap justify-center min-w-[200px]">
                {/* @ts-ignore */}
                {CATEGORIES[activeCategory].map((block) => (
                    <button
                        key={block.name}
                        className={`w-12 h-12 border-2 rounded flex flex-col items-center justify-center bg-gray-800 relative group transition-all
                            ${selectedType === block.type
                                ? 'border-yellow-400 ring-2 ring-yellow-400/50 scale-105 z-10'
                                : 'border-gray-600 hover:border-gray-400 hover:scale-105 hover:bg-gray-700'}`}
                        onClick={() => onSelect(block.type)}
                        title={block.name}
                    >
                        {block.icon ? (
                            <img src={block.icon} className="w-8 h-8 rendering-pixelated object-contain" alt={block.name} />
                        ) : (
                             <div className="w-8 h-8 rounded-sm" style={{ backgroundColor: block.fallbackColor || '#fff' }}></div>
                        )}
                        <span className="absolute -bottom-6 bg-black/80 px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                            {block.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
