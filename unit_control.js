// unit_control.js - Map-mode selection and move commands (requires fog cleared)

const MAP_LAYER = 1;
const units = [];
let selectedUnit = null;
const unitMarkers = new Map();

function initUnitControl(scene) {
    window.unitControlScene = scene;
}

function registerUnit(unit) {
    if (!units.includes(unit)) units.push(unit);
    _ensureMarker(unit);
}

function _ensureMarker(unit) {
    if (unitMarkers.has(unit) || typeof THREE === 'undefined' || !window.unitControlScene) return;
    const size = 3;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
        color: unit.userData.isCollectorBot ? 0xffaa00 : 0x44ff88,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    });
    const marker = new THREE.Mesh(geo, mat);
    marker.rotation.x = -Math.PI / 2;
    marker.layers.set(MAP_LAYER);
    marker.visible = false;
    marker.userData = { unitMarker: true, linkedUnit: unit };
    window.unitControlScene.add(marker);
    unitMarkers.set(unit, marker);
}

function selectUnit(unit) {
    selectedUnit = unit;
    unitMarkers.forEach((marker, u) => {
        if (marker.material) {
            marker.material.opacity = u === unit ? 1.0 : 0.85;
            marker.material.color.setHex(u === unit ? 0xffffff : (u.userData.isCollectorBot ? 0xffaa00 : 0x44ff88));
        }
    });
    const hint = document.getElementById('map-hint');
    if (hint) hint.textContent = unit ? `Selected: ${unit.name} — click cleared ground to move` : 'Map mode — click a unit, then cleared ground';
}

function issueMoveCommand(worldX, worldZ) {
    if (!selectedUnit || !selectedUnit.userData) return false;
    if (typeof window.isPositionRevealed === 'function' && !window.isPositionRevealed(worldX, worldZ)) {
        console.log('Cannot move unit into unrevealed fog.');
        return false;
    }
    selectedUnit.userData.moveCommand = new THREE.Vector3(worldX, 0, worldZ);
    selectedUnit.userData.state = 'idle';
    return true;
}

function trySelectUnitAt(worldX, worldZ) {
    let best = null;
    let bestDist = 8 * 8;
    units.forEach(u => {
        if (!u.parent) return;
        const d = u.position.distanceToSquared(new THREE.Vector3(worldX, 0, worldZ));
        if (d < bestDist) { bestDist = d; best = u; }
    });
    if (best) selectUnit(best);
    return best;
}

function updateUnitControl() {
    units.forEach(u => {
        if (!u.parent) return;
        _ensureMarker(u);
        const marker = unitMarkers.get(u);
        if (marker) {
            marker.position.copy(u.position);
            marker.position.y = 0.2;
            marker.visible = !!window.isMapViewActive;
        }
    });
    unitMarkers.forEach((marker, u) => {
        if (!u.parent) {
            window.unitControlScene.remove(marker);
            unitMarkers.delete(u);
        }
    });
}

function handleMapClick(intersectPoint, isRightClick) {
    if (isRightClick) {
        selectUnit(null);
        return;
    }
    const picked = trySelectUnitAt(intersectPoint.x, intersectPoint.z);
    if (!picked && selectedUnit) {
        issueMoveCommand(intersectPoint.x, intersectPoint.z);
    }
}

window.UnitControl = {
    initUnitControl,
    registerUnit,
    selectUnit,
    issueMoveCommand,
    trySelectUnitAt,
    updateUnitControl,
    handleMapClick,
    getSelectedUnit: () => selectedUnit
};
