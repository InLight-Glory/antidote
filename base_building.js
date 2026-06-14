// base_building.js
import { BLUEPRINT_CONFIG } from './blueprints_config.js';

let scene;
let objects;
let mainBase = null;
let previewGroup = null;
let previewType = null;

const MAP_LAYER = typeof window !== 'undefined' && window.MAP_OBJECT_LAYER != null
    ? window.MAP_OBJECT_LAYER
    : 1;

export function initBaseBuilding(_scene, _objects) {
    scene = _scene;
    objects = _objects;
}

export function getConfig(type) {
    return BLUEPRINT_CONFIG[type] || null;
}

export function canPlaceAt(position, type, hasBaseAlready) {
    if (!BLUEPRINT_CONFIG[type]) return false;
    if (type === 'base' && hasBaseAlready) return false;
    if (typeof window.isPositionRevealed === 'function' &&
        !window.isPositionRevealed(position.x, position.z)) {
        return false;
    }
    return true;
}

function _applyPreviewColor(isValid) {
    if (!previewGroup) return;
    const color = isValid ? 0x00ffcc : 0xff4444;
    previewGroup.userData.isValid = isValid;

    previewGroup.children.forEach(child => {
        if (child.userData && child.userData.isPreviewFill && child.material) {
            child.material.color.setHex(color);
            child.material.opacity = isValid ? 0.35 : 0.45;
        }
        if (child.userData && child.userData.isPreviewWire && child.material) {
            child.material.color.setHex(isValid ? 0xffffff : 0xff8888);
        }
        if (child.userData && child.userData.isPreviewFootprint && child.material) {
            child.material.color.setHex(color);
            child.material.opacity = isValid ? 0.55 : 0.65;
        }
    });
}

export function setPreviewType(type) {
    if (previewType === type && previewGroup) return;

    destroyPreview();
    previewType = type;
    const config = BLUEPRINT_CONFIG[type];
    if (!config || !scene) return;

    previewGroup = new THREE.Group();
    previewGroup.name = 'BlueprintPreview';
    previewGroup.userData = { isBlueprintPreview: true };
    previewGroup.visible = false;

    const fillMat = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
    });
    const fill = new THREE.Mesh(
        new THREE.BoxGeometry(config.width, config.height, config.depth),
        fillMat
    );
    fill.position.y = config.height / 2;
    fill.userData = { isPreviewFill: true };
    previewGroup.add(fill);

    const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(config.width, config.height, config.depth)),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false })
    );
    wire.position.y = config.height / 2;
    wire.userData = { isPreviewWire: true };
    wire.renderOrder = 10;
    previewGroup.add(wire);

    const footprintMat = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const footprint = new THREE.Mesh(
        new THREE.PlaneGeometry(config.width, config.depth),
        footprintMat
    );
    footprint.rotation.x = -Math.PI / 2;
    footprint.position.y = 0.2;
    footprint.userData = { isPreviewFootprint: true };
    footprint.renderOrder = 9;
    previewGroup.add(footprint);

    previewGroup.traverse(obj => {
        obj.layers.enable(0);
        obj.layers.enable(MAP_LAYER);
    });

    scene.add(previewGroup);
}

export function updatePreview(worldPosition, isValid) {
    if (!previewGroup || !previewType) return;
    const config = BLUEPRINT_CONFIG[previewType];
    if (!config) return;

    previewGroup.position.set(worldPosition.x, 0, worldPosition.z);
    previewGroup.visible = true;
    _applyPreviewColor(isValid);
}

export function hidePreview() {
    if (previewGroup) previewGroup.visible = false;
}

export function destroyPreview() {
    if (previewGroup && scene) {
        previewGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
        scene.remove(previewGroup);
    }
    previewGroup = null;
    previewType = null;
}

export function formatBlueprintRequirements(blueprint) {
    if (!blueprint || !blueprint.userData || !blueprint.userData.isBlueprint) return '';

    const ud = blueprint.userData;
    const config = BLUEPRINT_CONFIG[ud.blueprintType];
    const name = config ? config.name : 'Building';
    const woodNeed = Math.max(0, ud.requiredWood - ud.woodDeposited);
    const stoneNeed = Math.max(0, ud.requiredStone - ud.stoneDeposited);
    const woodHave = window.playerInventory ? window.playerInventory.wood : 0;
    const stoneHave = window.playerInventory ? window.playerInventory.stone : 0;

    const parts = [];
    if (woodNeed > 0) parts.push(`Wood ${woodNeed} (have ${woodHave})`);
    if (stoneNeed > 0) parts.push(`Stone ${stoneNeed} (have ${stoneHave})`);

    if (ud.isComplete) return `${name} — complete`;
    if (parts.length === 0) return `${name} — ready to finish`;

    const depositHint = (woodNeed > 0 && woodHave > 0) || (stoneNeed > 0 && stoneHave > 0)
        ? ' · [E] deposit'
        : ' · gather more resources';
    return `${name} — ${parts.join(' · ')}${depositHint}`;
}

export function createBlueprint(position, type) {
    const config = BLUEPRINT_CONFIG[type];
    if (!config) {
        console.error(`No blueprint config found for type: ${type}`);
        return null;
    }

    const geometry = new THREE.BoxGeometry(config.width, config.height, config.depth);
    const material = new THREE.MeshBasicMaterial({ color: 0x808080, transparent: true, opacity: 0.50 });
    const blueprint = new THREE.Mesh(geometry, material);

    blueprint.position.set(position.x, config.height / 2, position.z);
    blueprint.name = `${config.name}Blueprint`;
    blueprint.userData = {
        isBlueprint: true,
        blueprintType: type,
        woodDeposited: 0,
        stoneDeposited: 0,
        requiredWood: config.requiredWood,
        requiredStone: config.requiredStone,
        isComplete: false
    };
    scene.add(blueprint);
    objects.push(blueprint);
    console.log(`${config.name} blueprint placed at`, position);
    return blueprint;
}

export function depositResources(blueprintMesh, resourceType, amount) {
    if (!blueprintMesh.userData.isBlueprint || blueprintMesh.userData.isComplete) return 0;

    let deposited = 0;
    if (resourceType === 'wood') {
        const needed = blueprintMesh.userData.requiredWood - blueprintMesh.userData.woodDeposited;
        deposited = Math.min(amount, needed);
        blueprintMesh.userData.woodDeposited += deposited;
    } else if (resourceType === 'stone') {
        const needed = blueprintMesh.userData.requiredStone - blueprintMesh.userData.stoneDeposited;
        deposited = Math.min(amount, needed);
        blueprintMesh.userData.stoneDeposited += deposited;
    }

    if (deposited > 0) {
        updateBlueprintAppearance(blueprintMesh);
        checkCompletion(blueprintMesh);
    }
    return deposited;
}

function updateBlueprintAppearance(blueprintMesh) {
    const totalRequired = blueprintMesh.userData.requiredWood + blueprintMesh.userData.requiredStone;
    const totalDeposited = blueprintMesh.userData.woodDeposited + blueprintMesh.userData.stoneDeposited;
    const progress = totalDeposited / totalRequired;
    blueprintMesh.material.opacity = 0.5 + (0.5 * progress);
}

function checkCompletion(blueprintMesh) {
    if (blueprintMesh.userData.woodDeposited >= blueprintMesh.userData.requiredWood &&
        blueprintMesh.userData.stoneDeposited >= blueprintMesh.userData.requiredStone) {
        blueprintMesh.userData.isComplete = true;
        blueprintMesh.material.opacity = 1.0;
        blueprintMesh.material.color.setHex(0xAAAAAA);

        const type = blueprintMesh.userData.blueprintType;
        if (type === 'base') {
            blueprintMesh.userData.isMainBase = true;
            mainBase = blueprintMesh;
        }

        if (typeof window.registerBuildingCompleted === 'function') {
            window.registerBuildingCompleted(type);
        }

        if (type === 'wood_collector' && typeof window.createCollectorBot === 'function') {
            window.createCollectorBot(blueprintMesh.position.clone(), 'wood');
        }
        if (type === 'stone_collector' && typeof window.createCollectorBot === 'function') {
            window.createCollectorBot(blueprintMesh.position.clone(), 'stone');
        }

        console.log(`${type} completed!`);
    }
}

export function getMainBase() {
    return mainBase;
}

export function isNearMainBase(position, radius) {
    if (!mainBase) return false;
    return position.distanceTo(mainBase.position) <= radius;
}
