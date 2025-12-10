const fs = require('fs');
const path = require('path');

const ASSET_BASE_URL = 'https://raw.githubusercontent.com/Anuken/Mindustry/master/core/assets/sprites/';
const TARGET_DIR = path.join(__dirname, '../client/public/assets/sprites');

// Map sprites to fallback config (color, text)
const SPRITES = {
    'copper-wall.png': { color: 'd99d73', text: 'Wall' },
    'duo.png': { color: 'ffb380', text: 'Duo' },
    'conveyor-0-0.png': { color: '444444', text: '>' },
    'router.png': { color: '666666', text: 'O' },
    'mechanical-drill.png': { color: 'b8b8b8', text: 'Drill' },
    'core-shard.png': { color: 'e65555', text: 'Core' },
    'junction.png': { color: '5e5e5e', text: '+' },
    'sorter.png': { color: '5e5e5e', text: 'S' },
    'power-node.png': { color: 'eec456', text: 'Pow' },
    'battery.png': { color: 'a2c644', text: 'Bat' },
    'item-copper.png': { color: 'd99d73', text: 'Cu' },
    'copper.png': { color: 'd99d73', text: 'Cu' }
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
        const primaryUrl = `${ASSET_BASE_URL}${filename}`;

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
            }
        } catch (e) {
            // Ignore fetch errors
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
