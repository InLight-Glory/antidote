// interaction_modal.js — context info when aiming at nearby interactables
(function () {
'use strict';

const INTERACTION_RANGE = 5;
const GATHER_RANGE = 6;

let modalEl;
let titleEl;
let bodyEl;
let actionEl;
let modalRaycaster;

window.INTERACTION_RANGE = INTERACTION_RANGE;
window.GATHER_RANGE = GATHER_RANGE;

function initInteractionModal() {
    modalEl = document.getElementById('interaction-info-modal');
    titleEl = document.getElementById('interaction-info-title');
    bodyEl = document.getElementById('interaction-info-body');
    actionEl = document.getElementById('interaction-info-action');
    modalRaycaster = new THREE.Raycaster();
}

function horizontalDistanceTo(object3d) {
    if (!window.controls || !object3d) return Infinity;
    const playerPos = window.controls.getObject().position;
    const targetPos = new THREE.Vector3();
    object3d.getWorldPosition(targetPos);
    return Math.hypot(playerPos.x - targetPos.x, playerPos.z - targetPos.z);
}

function isWithinRange(object3d, range) {
    return horizontalDistanceTo(object3d) <= range;
}

function resolveInteractable(hitObject) {
    if (!hitObject || !hitObject.userData) return null;
    const ud = hitObject.userData;

    if (ud.isBlueprint && !ud.isComplete) {
        return { kind: 'blueprint', object: hitObject, range: INTERACTION_RANGE };
    }
    if (ud.isTree && typeof ud.health === 'number' && ud.health > 0) {
        return { kind: 'tree', object: hitObject, range: GATHER_RANGE };
    }
    if (ud.isBoulder && typeof ud.health === 'number' && ud.health > 0) {
        return { kind: 'boulder', object: hitObject, range: GATHER_RANGE };
    }
    if (ud.isResource && ud.type === 'wood') {
        return { kind: 'wood', object: hitObject, range: INTERACTION_RANGE };
    }
    if (ud.isComplete && ud.blueprintType && window.BaseBuilding) {
        const config = window.BaseBuilding.getConfig(ud.blueprintType);
        return { kind: 'building', object: hitObject, range: INTERACTION_RANGE, name: config ? config.name : 'Building' };
    }
    return null;
}

function findNearestWoodInRange() {
    if (!window.objects || !window.controls) return null;

    let best = null;
    let bestDist = INTERACTION_RANGE;
    for (const obj of window.objects) {
        const ud = obj.userData;
        if (!ud || !ud.isResource || ud.type !== 'wood') continue;
        const dist = horizontalDistanceTo(obj);
        if (dist <= INTERACTION_RANGE && dist < bestDist) {
            bestDist = dist;
            best = { kind: 'wood', object: obj, range: INTERACTION_RANGE, distance: dist };
        }
    }
    return best;
}

function findTargetUnderReticle() {
    if (!modalRaycaster || !window.camera || !window.objects || !window.controls) return null;

    modalRaycaster.setFromCamera(new THREE.Vector2(0, 0), window.camera);
    const hits = modalRaycaster.intersectObjects(window.objects, true);

    for (const hit of hits) {
        const resolved = resolveInteractable(hit.object);
        if (!resolved) continue;
        if (!isWithinRange(resolved.object, resolved.range)) continue;
        resolved.distance = horizontalDistanceTo(resolved.object);
        return resolved;
    }
    return findNearestWoodInRange();
}

function findFirstHitInRange() {
    if (!modalRaycaster || !window.camera || !window.objects) return null;

    modalRaycaster.setFromCamera(new THREE.Vector2(0, 0), window.camera);
    const hits = modalRaycaster.intersectObjects(window.objects, true);

    for (const hit of hits) {
        const resolved = resolveInteractable(hit.object);
        if (resolved && isWithinRange(resolved.object, resolved.range)) {
            return { hit: hit.object, resolved };
        }
        if (resolved && !isWithinRange(resolved.object, resolved.range)) {
            return { hit: hit.object, resolved, outOfRange: true };
        }
    }
    return null;
}

function buildModalContent(target) {
    if (!target) return null;

    switch (target.kind) {
        case 'blueprint': {
            const ud = target.object.userData;
            const config = window.BaseBuilding && window.BaseBuilding.getConfig
                ? window.BaseBuilding.getConfig(ud.blueprintType)
                : null;
            const title = config ? config.name : 'Blueprint';
            const woodNeed = Math.max(0, ud.requiredWood - ud.woodDeposited);
            const stoneNeed = Math.max(0, ud.requiredStone - ud.stoneDeposited);
            const woodHave = window.playerInventory ? window.playerInventory.wood : 0;
            const stoneHave = window.playerInventory ? window.playerInventory.stone : 0;
            const parts = [];
            if (woodNeed > 0) parts.push(`Wood ${woodNeed} needed (have ${woodHave})`);
            if (stoneNeed > 0) parts.push(`Stone ${stoneNeed} needed (have ${stoneHave})`);
            const body = parts.length ? parts.join(' · ') : 'All resources deposited';
            const canDeposit = (woodNeed > 0 && woodHave > 0) || (stoneNeed > 0 && stoneHave > 0);
            return {
                title,
                body,
                action: canDeposit ? '[E] Deposit resources' : (parts.length ? 'Gather more resources' : 'Almost complete')
            };
        }
        case 'tree': {
            let woodLeft = '?';
            if (window.Trees && typeof window.Trees.getTreeInfo === 'function') {
                const info = window.Trees.getTreeInfo(target.object);
                if (info) woodLeft = info.woodLeft;
            }
            return {
                title: 'Tree',
                body: `~${woodLeft} wood remaining`,
                action: '[Click] Chop for wood'
            };
        }
        case 'boulder': {
            let stoneLeft = '?';
            if (window.Boulders && typeof window.Boulders.getBoulderInfo === 'function') {
                const info = window.Boulders.getBoulderInfo(target.object);
                if (info) stoneLeft = info.stoneLeft;
            }
            return {
                title: 'Boulder',
                body: `~${stoneLeft} stone remaining`,
                action: '[Click] Mine stone'
            };
        }
        case 'wood': {
            const amount = target.object.userData.value || 1;
            return {
                title: 'Wood pile',
                body: `${amount} wood`,
                action: '[Click] Collect'
            };
        }
        case 'building': {
            return {
                title: target.name,
                body: 'Construction complete',
                action: 'Healing & storage available'
            };
        }
        default:
            return null;
    }
}

function isCureUiActive() {
    const prompt = document.getElementById('interaction-prompt');
    const minigame = document.getElementById('antidote-minigame');
    const subdue = document.getElementById('subdue-progress');
    return (prompt && prompt.style.display !== 'none')
        || (minigame && minigame.style.display !== 'none')
        || (subdue && subdue.style.display !== 'none')
        || window.isApplyingAntidote;
}

function hideInteractionModal() {
    if (modalEl) modalEl.style.display = 'none';
}

function showInteractionModal(content) {
    if (!modalEl || !content) return;
    if (titleEl) titleEl.textContent = content.title;
    if (bodyEl) bodyEl.textContent = content.body;
    if (actionEl) actionEl.textContent = content.action;
    modalEl.style.display = 'block';
}

function updateInteractionModal() {
    if (!modalEl) return;

    if (window.isMapViewActive || window.isPlayerDead || !window.controls || !window.controls.isLocked || isCureUiActive()) {
        hideInteractionModal();
        return;
    }

    const target = findTargetUnderReticle();
    if (!target) {
        hideInteractionModal();
        return;
    }

    const content = buildModalContent(target);
    if (content) showInteractionModal(content);
    else hideInteractionModal();
}

window.InteractionModal = {
    initInteractionModal,
    updateInteractionModal,
    findTargetUnderReticle,
    findFirstHitInRange,
    resolveInteractable,
    isWithinRange,
    horizontalDistanceTo,
    hideInteractionModal
};

window.initInteractionModal = initInteractionModal;
window.updateInteractionModal = updateInteractionModal;

})();
