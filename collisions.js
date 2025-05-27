// collisions.js - Handles all collision logic for blocks, floor, wall, ramp, ladder, and ceiling

export function checkFloorCollision(playerAABB, objects) {
    // Implement floor collision logic
}

export function checkWallCollision(playerAABB, objects) {
    // Implement wall collision logic
}

export function checkRampCollision(playerAABB, objects) {
    // Implement ramp collision logic
}

export function checkLadderCollision(playerAABB, objects) {
    // Implement ladder collision logic
}

export function checkCeilingCollision(playerAABB, objects) {
    // Implement ceiling collision logic
}

// Utility for block damage and color lerp
export function damageBlock(block, damage) {
    // Block health and maxHealth are stored in userData
    // You can adjust these defaults as needed
    const DEFAULT_BLOCK_HEALTH = 125;
    const DEFAULT_BLOCK_MAX_HEALTH = 200;
    if (!block || !block.userData) return;
    if (typeof block.userData.health !== 'number') block.userData.health = DEFAULT_BLOCK_HEALTH;
    if (typeof block.userData.maxHealth !== 'number') block.userData.maxHealth = DEFAULT_BLOCK_MAX_HEALTH;
    block.userData.health -= damage;
    // Color lerp to red as health decreases
    if (block.material && block.userData.originalColor && typeof block.userData.maxHealth === 'number') {
        const healthPercent = Math.max(0, block.userData.health / block.userData.maxHealth);
        block.material.color.copy(block.userData.originalColor).lerp(new THREE.Color(1, 0, 0), 1 - healthPercent);
    }
    if (block.userData.health <= 0) {
        if (block.parent) block.parent.remove(block);
        if (block.geometry) block.geometry.dispose();
        if (block.material) block.material.dispose();
    }
}

// Add more collision types as needed
