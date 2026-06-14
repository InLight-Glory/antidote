// fog_of_war.js - Grid-based fog; map unit control requires cleared cells

const CELL_SIZE = 25;
const GRID_HALF = 20;
const VISION_RADIUS = 35;
const BUILDING_REVEAL_RADIUS = 25;

let revealed = null;
let fogMesh = null;

function initFogOfWar(scene) {
    revealed = new Array(GRID_HALF * 2);
    for (let i = 0; i < GRID_HALF * 2; i++) {
        revealed[i] = new Array(GRID_HALF * 2).fill(false);
    }

    const fogGeo = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE);
    const fogMat = new THREE.MeshBasicMaterial({
        color: 0x111122,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
    });

    fogMesh = new THREE.Group();
    fogMesh.name = 'FogOfWarGroup';

    for (let gx = 0; gx < GRID_HALF * 2; gx++) {
        for (let gz = 0; gz < GRID_HALF * 2; gz++) {
            const tile = new THREE.Mesh(fogGeo, fogMat.clone());
            const wx = (gx - GRID_HALF) * CELL_SIZE + CELL_SIZE / 2;
            const wz = (gz - GRID_HALF) * CELL_SIZE + CELL_SIZE / 2;
            tile.position.set(wx, 0.15, wz);
            tile.rotation.x = -Math.PI / 2;
            tile.userData = { fogTile: true, gridX: gx, gridZ: gz };
            tile.layers.set(window.MAP_OBJECT_LAYER || 1);
            fogMesh.add(tile);
        }
    }

    scene.add(fogMesh);
    window.fogOfWarGroup = fogMesh;
}

function worldToGrid(x, z) {
    const gx = Math.floor(x / CELL_SIZE + GRID_HALF);
    const gz = Math.floor(z / CELL_SIZE + GRID_HALF);
    return { gx, gz };
}

function isInGrid(gx, gz) {
    return gx >= 0 && gx < GRID_HALF * 2 && gz >= 0 && gz < GRID_HALF * 2;
}

function revealAt(worldX, worldZ, radius) {
    if (!revealed) return;
    const rCells = Math.ceil(radius / CELL_SIZE);
    const center = worldToGrid(worldX, worldZ);
    for (let dx = -rCells; dx <= rCells; dx++) {
        for (let dz = -rCells; dz <= rCells; dz++) {
            const gx = center.gx + dx;
            const gz = center.gz + dz;
            if (!isInGrid(gx, gz)) continue;
            const wx = (gx - GRID_HALF) * CELL_SIZE + CELL_SIZE / 2;
            const wz = (gz - GRID_HALF) * CELL_SIZE + CELL_SIZE / 2;
            const dist = Math.hypot(wx - worldX, wz - worldZ);
            if (dist <= radius) revealed[gx][gz] = true;
        }
    }
    _refreshFogVisuals();
}

function isPositionRevealed(x, z) {
    if (!revealed) return true;
    const { gx, gz } = worldToGrid(x, z);
    if (!isInGrid(gx, gz)) return false;
    return revealed[gx][gz];
}

function _refreshFogVisuals() {
    if (!fogMesh) return;
    fogMesh.children.forEach(tile => {
        const { gridX, gridZ } = tile.userData;
        if (revealed[gridX][gridZ]) {
            tile.visible = false;
        } else {
            tile.visible = true;
            tile.material.opacity = 0.75;
        }
    });
}

function updateFogOfWar() {
    if (!revealed || !window.controls) return;
    const pos = window.controls.getObject().position;
    revealAt(pos.x, pos.z, VISION_RADIUS);

    if (window.objects) {
        window.objects.forEach(obj => {
            if (obj.userData && obj.userData.isComplete && obj.userData.blueprintType) {
                revealAt(obj.position.x, obj.position.z, BUILDING_REVEAL_RADIUS);
            }
        });
    }
}

window.initFogOfWar = initFogOfWar;
window.updateFogOfWar = updateFogOfWar;
window.isPositionRevealed = isPositionRevealed;
window.revealAt = revealAt;
