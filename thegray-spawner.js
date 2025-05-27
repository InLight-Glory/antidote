// thegray-spawner.js
// Handles spawning and despawning of The-Gray enemies

// --- CONFIGURABLE SPAWNER CONSTANTS ---
const THE_GRAY_SPAWN_INTERVAL = 15 * 60; // 15 minutes in seconds
// const THE_GRAY_SPAWN_INTERVAL = 20; // FOR TESTING: Spawn every 20 seconds
const THE_GRAY_MAX_COUNT = 5;
const THE_GRAY_SPAWN_DISTANCE = 200.0;
const THE_GRAY_SPAWN_HEIGHT = 0.9;

let theGraySpawnTimer = THE_GRAY_SPAWN_INTERVAL;

function countActiveTheGray() {
    return window.objects ? window.objects.filter(obj => obj.userData && obj.userData.isTheGray).length : 0;
}

function spawnOneTheGray() {
    if (!window.controls || !window.createTheGray || !window.debugLog) {
         console.error("Spawner: Missing required global objects (controls, createTheGray, debugLog). Cannot spawn.");
         return;
    }

    const playerPosition = window.controls.getObject().position;
    const randomAngle = Math.random() * Math.PI * 2;
    const spawnX = playerPosition.x + Math.cos(randomAngle) * THE_GRAY_SPAWN_DISTANCE;
    const spawnZ = playerPosition.z + Math.sin(randomAngle) * THE_GRAY_SPAWN_DISTANCE;
    const spawnPosition = new THREE.Vector3(spawnX, THE_GRAY_SPAWN_HEIGHT, spawnZ);

    window.debugLog("Spawner: Attempting to spawn The-Gray at", spawnPosition);
    window.createTheGray(spawnPosition);

    if (window.showTheGraySpawnNotification) {
        window.showTheGraySpawnNotification();
    }
}

function despawnFarthestTheGray() {
    if (!window.controls || !window.objects || !window.removeTheGray || !window.debugLog) {
        console.error("Spawner: Missing required global objects for despawning. Cannot despawn.");
        return;
    }

    const playerPosition = window.controls.getObject().position;
    let farthestGray = null;
    let maxDistanceSq = -1;

    window.objects.forEach(obj => {
        if (obj.userData && obj.userData.isTheGray) {
            const distanceSq = obj.position.distanceToSquared(playerPosition);
            if (distanceSq > maxDistanceSq) {
                maxDistanceSq = distanceSq;
                farthestGray = obj;
            }
        }
    });

    if (farthestGray) {
        window.debugLog("Spawner: Max count reached. Despawning farthest The-Gray:", farthestGray.name);
        window.removeTheGray(farthestGray);
    }
}

function updateSpawner(delta) {
    theGraySpawnTimer -= delta;
    if (theGraySpawnTimer <= 0) {
        theGraySpawnTimer = THE_GRAY_SPAWN_INTERVAL;
        const currentGrayCount = countActiveTheGray();
        if (window.debugLog) window.debugLog("Spawner: Timer up! Current The-Gray count:", currentGrayCount);

        if (currentGrayCount < THE_GRAY_MAX_COUNT) {
            spawnOneTheGray();
        } else {
            despawnFarthestTheGray();
            spawnOneTheGray();
        }
    }
}

function startTestSpawn() {
    setTimeout(() => {
        spawnOneTheGray();
        if (window.debugLog) window.debugLog('Spawned a The-Gray after 5 seconds for testing.');
    }, 5000);
}

window.updateSpawner = updateSpawner;
window.spawnOneTheGray = spawnOneTheGray; // Keep for potential manual calls or if other modules need it
window.startTestSpawn = startTestSpawn;