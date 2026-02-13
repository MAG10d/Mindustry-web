const fs = require('fs');
const path = require('path');

const ASSET_BASE_URL = 'https://raw.githubusercontent.com/Anuken/Mindustry/master/core/assets-raw/sprites/';
const TARGET_DIR = path.join(__dirname, '../client/public/assets/sprites');

// Map sprites to fallback config (color, text) and correct relative path in Mindustry repo
const SPRITES = {
    'copper-wall.png': { path: 'blocks/walls/copper-wall.png', color: 'd99d73', text: 'Wall' },
    'duo.png': { path: 'blocks/turrets/duo/duo.png', color: 'ffb380', text: 'Duo' },
    'conveyor-0-0.png': { path: 'blocks/distribution/conveyors/conveyor-0-0.png', color: '444444', text: '>' },
    'router.png': { path: 'blocks/distribution/router.png', color: '666666', text: 'O' },
    'mechanical-drill.png': { path: 'blocks/drills/mechanical-drill.png', color: 'b8b8b8', text: 'Drill' },
    'core-shard.png': { path: 'blocks/storage/core-shard.png', color: 'e65555', text: 'Core' },
    'junction.png': { path: 'blocks/distribution/junction.png', color: '5e5e5e', text: '+' },
    'sorter.png': { path: 'blocks/distribution/sorter.png', color: '5e5e5e', text: 'S' },
    'power-node.png': { path: 'blocks/power/power-node.png', color: 'eec456', text: 'Pow' },
    'battery.png': { path: 'blocks/power/battery.png', color: 'a2c644', text: 'Bat' },
    'item-copper.png': { path: 'items/item-copper.png', color: 'd99d73', text: 'Cu' },
    'copper.png': { path: 'items/item-copper.png', color: 'd99d73', text: 'Cu' }
};

async function fetchAssets() {
    // Ensure target directory exists
    if (!fs.existsSync(TARGET_DIR)) {
        console.log(`Creating directory: ${TARGET_DIR}`);
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    console.log(`Fetching ${Object.keys(SPRITES).length} assets...`);

    let successCount = 0;
    let fallbackCount = 0;
    let failCount = 0;

    for (const [filename, config] of Object.entries(SPRITES)) {
        const filePath = path.join(TARGET_DIR, filename);
        // Use mapped path or fallback to filename if not specified (though all should be specified now)
        const relativePath = config.path || filename;
        const primaryUrl = `${ASSET_BASE_URL}${relativePath}`;

        let worked = false;

        // Try Primary
        try {
            // console.log(`Attempting fetch: ${primaryUrl}`);
            const response = await fetch(primaryUrl);
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                fs.writeFileSync(filePath, Buffer.from(buffer));
                console.log(`✓ Fetched ${filename} (Original)`);
                worked = true;
                successCount++;
            } else {
                console.warn(`! Fetch failed for ${primaryUrl} (${response.status})`);
            }
        } catch (e) {
            console.error(`! Fetch error for ${primaryUrl}:`, e.message);
        }

        // Try Fallback
        if (!worked) {
            const fallbackUrl = `https://dummyimage.com/32x32/${config.color}/000000.png&text=${config.text}`;
            try {
                // console.log(`Fallback fetch: ${fallbackUrl}`);
                const response = await fetch(fallbackUrl);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    fs.writeFileSync(filePath, Buffer.from(buffer));
                    console.log(`⚠ Generated ${filename} (Placeholder)`);
                    worked = true;
                    fallbackCount++;
                } else {
                    console.error(`Failed fallback for ${filename}: ${response.status}`);
                }
            } catch (e) {
                console.error(`Error fetching fallback for ${filename}:`, e.message);
            }
        }

        if (!worked) failCount++;
    }

    console.log(`\nDone. Original: ${successCount}, Placeholders: ${fallbackCount}, Failed: ${failCount}`);
}

fetchAssets().catch(console.error);
