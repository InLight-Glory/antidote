// Level1.js - Seeded procedural map configuration

let mapSeed = Date.now();
let levelConfig = null;

function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function generateLevelConfig(seed) {
    const rand = seededRandom(seed);
    return {
        seed,
        mapSize: 500,
        treeClusters: Math.floor(35 + rand() * 25),
        treesPerCluster: Math.floor(4 + rand() * 4),
        clusterRadius: 8 + rand() * 6,
        boulderCount: Math.floor(15 + rand() * 15),
        playerStartX: (rand() - 0.5) * 40,
        playerStartZ: (rand() - 0.5) * 40
    };
}

export function setupLevel1(scene, objects) {
    mapSeed = Date.now();
    levelConfig = generateLevelConfig(mapSeed);
    window.mapSeed = mapSeed;
    window.levelConfig = levelConfig;

    if (window.controls && window.controls.getObject()) {
        const obj = window.controls.getObject();
        obj.position.set(levelConfig.playerStartX, obj.position.y, levelConfig.playerStartZ);
    }

    console.log('[Level1] Procedural map seed:', mapSeed, levelConfig);
}

export function getLevelConfig() {
    return levelConfig;
}

export function getMapSeed() {
    return mapSeed;
}
