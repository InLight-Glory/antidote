// boulders.js

let scene;
let objects;

let BOULDER_COUNT = 20;
const MIN_DISTANCE_BETWEEN_BOULDERS = 10;
let MAP_SIZE = 500;
const INITIAL_BOULDER_HEALTH = 100; // 100 clicks to deplete
const CLICKS_PER_SHRINK = 7; // Shrink every 7 clicks
const SHRINK_FACTOR = 0.9; // Shrink by 10% (0.9 of current size)
const STONE_PER_CLICK = 5; // Stone yielded per click

export function initBoulders(_scene, _objects) {
    scene = _scene;
    objects = _objects;
    if (window.levelConfig) {
        BOULDER_COUNT = window.levelConfig.boulderCount;
        MAP_SIZE = window.levelConfig.mapSize;
    }
    generateBoulders();
}

function generateBoulders() {
    let attempts = 0;
    let bouldersGenerated = 0;
    const maxAttempts = BOULDER_COUNT * 10; // Prevent infinite loops

    while (bouldersGenerated < BOULDER_COUNT && attempts < maxAttempts) {
        const x = (Math.random() - 0.5) * MAP_SIZE;
        const z = (Math.random() - 0.5) * MAP_SIZE;
        const position = new THREE.Vector3(x, 0, z);

        let tooClose = false;
        for (const obj of objects) {
            if (obj.userData && obj.userData.isBoulder) {
                const distance = position.distanceTo(obj.position);
                if (distance < MIN_DISTANCE_BETWEEN_BOULDERS) {
                    tooClose = true;
                    break;
                }
            }
        }

        if (!tooClose) {
            createBoulder(position);
            bouldersGenerated++;
        }
        attempts++;
    }
    console.log(`Generated ${bouldersGenerated} boulders.`);
}

function createBoulder(position) {
    const radius = Math.random() * 2 + 1; // Random radius between 1 and 3
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Gray
    const boulder = new THREE.Mesh(geometry, material);

    boulder.position.set(position.x, radius / 2, position.z); // Position 50% out of ground
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    boulder.name = "Boulder";
    boulder.userData = {
        isBoulder: true,
        health: INITIAL_BOULDER_HEALTH, // Total clicks to deplete
        clicksSinceLastShrink: 0,
        originalColor: material.color.clone(),
        initialRadius: radius
    };
    scene.add(boulder);
    objects.push(boulder);
}

export function damageBoulder(boulderMesh) {
    if (!boulderMesh.userData.isBoulder) return;

    boulderMesh.userData.health -= 1; // Each click reduces health by 1
    boulderMesh.userData.clicksSinceLastShrink += 1;

    console.log(`Boulder hit! Health: ${boulderMesh.userData.health}, Clicks since last shrink: ${boulderMesh.userData.clicksSinceLastShrink}`);

    // Visual feedback for damage (e.g., color change)
    const healthPercent = Math.max(0, boulderMesh.userData.health / INITIAL_BOULDER_HEALTH);
    boulderMesh.material.color.copy(boulderMesh.userData.originalColor).lerp(new THREE.Color(0x404040), 1 - healthPercent); // Darken as health decreases

    // Shrink logic
    if (boulderMesh.userData.clicksSinceLastShrink >= CLICKS_PER_SHRINK) {
        boulderMesh.scale.multiplyScalar(SHRINK_FACTOR);
        // Adjust position to keep base on the ground after shrinking
        boulderMesh.position.y = (boulderMesh.userData.initialRadius * boulderMesh.scale.y) / 2;
        boulderMesh.userData.clicksSinceLastShrink = 0; // Reset counter
        console.log("Boulder shrunk!");

        // Give stone when shrunk
        if (typeof window.playerInventory !== 'undefined') {
            window.playerInventory.stone = (window.playerInventory.stone || 0) + STONE_PER_CLICK;
            if (typeof window.updateHUD === 'function') {
                window.updateHUD(null, null, null, window.playerInventory.stone); // Update stone count on HUD
            }
            console.log(`Gained ${STONE_PER_CLICK} stone. Total: ${window.playerInventory.stone}`);
        }
    }

    // Depletion logic
    if (boulderMesh.userData.health <= 0) {
        console.log("Boulder depleted!");
        removeBoulder(boulderMesh);
    }
}

function removeBoulder(boulderMesh) {
    scene.remove(boulderMesh);
    const index = objects.indexOf(boulderMesh);
    if (index > -1) objects.splice(index, 1);
    if (boulderMesh.geometry) boulderMesh.geometry.dispose();
    if (boulderMesh.material) boulderMesh.material.dispose();
}

export function getBoulderInfo(boulderMesh) {
    if (!boulderMesh || !boulderMesh.userData || !boulderMesh.userData.isBoulder) return null;
    const health = boulderMesh.userData.health;
    const remainingCycles = Math.max(0, Math.ceil(health / CLICKS_PER_SHRINK));
    const stoneLeft = remainingCycles * STONE_PER_CLICK;
    return { health, stoneLeft, maxHealth: INITIAL_BOULDER_HEALTH };
}
