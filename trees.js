// trees.js

let scene;
let objects;

let TREE_COUNT = 50;
let CLUSTER_SIZE = 5;
let CLUSTER_RADIUS = 10;
let MAP_SIZE = 500;

export function initTrees(_scene, _objects) {
    scene = _scene;
    objects = _objects;
    if (window.levelConfig) {
        TREE_COUNT = window.levelConfig.treeClusters;
        CLUSTER_SIZE = window.levelConfig.treesPerCluster;
        CLUSTER_RADIUS = window.levelConfig.clusterRadius;
        MAP_SIZE = window.levelConfig.mapSize;
    }
    generateTrees();
}

function generateTrees() {
    for (let i = 0; i < TREE_COUNT; i++) {
        const clusterCenterX = (Math.random() - 0.5) * MAP_SIZE;
        const clusterCenterZ = (Math.random() - 0.5) * MAP_SIZE;

        for (let j = 0; j < CLUSTER_SIZE; j++) {
            const offsetX = (Math.random() - 0.5) * CLUSTER_RADIUS;
            const offsetZ = (Math.random() - 0.5) * CLUSTER_RADIUS;

            const treePosition = new THREE.Vector3(
                clusterCenterX + offsetX,
                0, // Will adjust Y after creating tree parts
                clusterCenterZ + offsetZ
            );
            createTree(treePosition);
        }
    }
}

function createTree(position) {
    // Tree Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 5, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(position.x, position.y + 2.5, position.z); // Half height
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    trunk.name = "TreeTrunk";
    trunk.userData = {
        isTree: true,
        health: 125,
        maxHealth: 125,
        estimatedWoodYield: Math.floor(Math.random() * 5) + 3,
        originalColor: trunkMaterial.color.clone()
    };
    scene.add(trunk);
    objects.push(trunk);

    // Tree Leaves (simple sphere for now)
    const leavesGeometry = new THREE.SphereGeometry(2, 8, 8);
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest Green
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.set(position.x, position.y + 6, position.z);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    leaves.name = "TreeLeaves";
    leaves.userData = { isTree: true }; // Leaves are part of the tree, but don't have health
    scene.add(leaves);
    // objects.push(leaves); // Don't add leaves to objects array for collision, only trunk

    // Link trunk and leaves for easier management if needed later
    trunk.userData.leaves = leaves;
}

// Export a function to handle tree damage (called from player.js)
export function damageTree(treeMesh, damageAmount) {
    if (!treeMesh.userData.isTree || !treeMesh.userData.health) return;

    treeMesh.userData.health -= damageAmount;
    console.log(`Tree ${treeMesh.name} hit! Damage: ${damageAmount}, Current Health: ${treeMesh.userData.health}`);

    // Shrink the tree by 15%
    const shrinkFactor = 0.85;
    treeMesh.scale.multiplyScalar(shrinkFactor);
    if (treeMesh.userData.leaves) {
        treeMesh.userData.leaves.scale.multiplyScalar(shrinkFactor);
    }

    // Adjust position to keep base on the ground after shrinking
    // Assuming initial height of trunk is 5 and leaves are at 6 (relative to trunk base at 0)
    // Trunk's current height is 5 * treeMesh.scale.y
    // Trunk's half height is (5 * treeMesh.scale.y) / 2
    treeMesh.position.y = (5 * treeMesh.scale.y) / 2;
    if (treeMesh.userData.leaves) {
        // Leaves position needs to be relative to the new trunk top
        // Initial leaves position was 6 (relative to trunk base at 0)
        // New leaves position will be new trunk top + (initial leaves height - initial trunk top) * scale
        const initialTrunkHalfHeight = 2.5; // 5 / 2
        const initialLeavesHeightRelativeToTrunkBase = 6;
        const initialLeavesHeightRelativeToTrunkTop = initialLeavesHeightRelativeToTrunkBase - initialTrunkHalfHeight;

        treeMesh.userData.leaves.position.y = treeMesh.position.y + (initialLeavesHeightRelativeToTrunkTop * treeMesh.scale.y);
    }

    // Visual feedback for damage (e.g., color change)
    const healthPercent = Math.max(0, treeMesh.userData.health / treeMesh.userData.maxHealth);
    treeMesh.material.color.copy(treeMesh.userData.originalColor).lerp(new THREE.Color(1, 0, 0), 1 - healthPercent);

    if (treeMesh.userData.health <= 0) {
        console.log(`Tree ${treeMesh.name} destroyed!`);
        // Remove tree and spawn wood resource with random value
        window.Trees.removeTree(treeMesh);
        const woodValue = Math.floor(Math.random() * (7 - 3 + 1)) + 3; // Random between 3 and 7
        window.Trees.spawnWoodResource(treeMesh.position, woodValue);
    }
}

export function removeTree(treeMesh) {
    // Remove trunk
    scene.remove(treeMesh);
    const index = objects.indexOf(treeMesh);
    if (index > -1) objects.splice(index, 1);
    if (treeMesh.geometry) treeMesh.geometry.dispose();
    if (treeMesh.material) treeMesh.material.dispose();

    // Remove leaves
    if (treeMesh.userData.leaves) {
        const leaves = treeMesh.userData.leaves;
        scene.remove(leaves);
        if (leaves.geometry) leaves.geometry.dispose();
        if (leaves.material) leaves.material.dispose();
    }
}

export function spawnWoodResource(position, value) {
    const woodGeometry = new THREE.BoxGeometry(1, 1, 1);
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0xA0522D }); // Sienna
    const wood = new THREE.Mesh(woodGeometry, woodMaterial);
    wood.position.set(position.x, 0.5, position.z); // Waist-height pile — easier to aim after chopping
    wood.name = "WoodResource";
    wood.userData = { isResource: true, type: 'wood', value: value };
    scene.add(wood);
    objects.push(wood);
    console.log("Wood resource spawned at", wood.position, "with value", value);
}

export function getTreeInfo(treeMesh) {
    if (!treeMesh || !treeMesh.userData || !treeMesh.userData.isTree || typeof treeMesh.userData.health !== 'number') {
        return null;
    }
    const ud = treeMesh.userData;
    const pct = Math.max(0, ud.health / ud.maxHealth);
    const yieldTotal = ud.estimatedWoodYield || 5;
    const woodLeft = Math.max(0, Math.ceil(pct * yieldTotal));
    return {
        health: ud.health,
        maxHealth: ud.maxHealth,
        woodLeft,
        yieldTotal
    };
}
