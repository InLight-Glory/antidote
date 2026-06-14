// curing_mechanic.js
// Handles the multi-step curing process for The-Gray enemies.
// Step 1: Impede (hit points - thegray.js)
// Step 2: Subdue (Patch Placement by holding 'E')
// Step 3: Administer (Antidote Minigame with Right-Click/Tap on Patch)
// Step 4: Protect (stay near host while antidote spreads; Dark-Grey swarms)
// Step 5: Evac (lead host to main base for full recovery)

// --- CONSTANTS ---
const SUBDUE_DISTANCE = 2.5;
const SUBDUE_HOLD_TIME = 2.3;
const ANTIDOTE_DISTANCE = 2.5;
const ANTIDOTE_FILL_RATE = 15.0;
const ANTIDOTE_DECAY_RATE = 20.0;
const ANTIDOTE_CLICK_PULSE = 7.0;
const ANTIDOTE_SWEET_SPOT_MIN = 70.0;
const ANTIDOTE_SWEET_SPOT_MAX = 85.0;
const ANTIDOTE_REQUIRED_TIME = 8.0;
const ANTIDOTE_OVERFILL_LIMIT = 98.0;
const ANTIDOTE_FAIL_PENALTY_TIME = 5.0;

const PROTECT_RADIUS = 8;
const PROTECT_DURATION = 45.0;
const PROTECT_OUTSIDE_GRACE = 4.0;
const HOST_HEALTH_AFTER_SPREAD = 50;
const EVAC_FOLLOW_RANGE = 14;
const EVAC_BASE_RADIUS = 14;
const HOST_FOLLOW_SPEED = 2.5;
const HOST_CRAWL_SPEED = 1.2;
const MAX_CURE_ATTEMPTS = 2;

// --- MODULE STATE ---
let closestPatchTarget = null;
let isApplyingPatch = false;
let patchApplyTimer = 0;
let currentPatchTarget = null;
let isApplyingAntidote = false;
let currentAntidoteTarget = null;
let antidotePressure = 0;
let timeInSweetSpot = 0;
let minigameFailTimer = 0;
let isAimingAtPatch = false;

// Step 4 & 5 state
let protectTarget = null;
let protectTimer = 0;
let protectOutsideTimer = 0;
let protectRingMesh = null;
let evacTarget = null;

// --- UI ELEMENT REFERENCES ---
let interactionPromptElement;
let subdueProgressElement;
let subdueBarElement;
let antidoteMinigameElement;
let antidotePressureBarElement;
let antidoteSweetSpotElement;
let antidoteTimerBarElement;
let antidoteFeedbackElement;
let antidoteOverfillWarningElement;
let antidoteOverfillZoneElement;
let protectProgressElement;
let protectBarElement;
let curePhaseElement;


function initCuringMechanic() {
    console.log("[CURE.JS] Initializing Curing Mechanic.");
    interactionPromptElement = document.getElementById('interaction-prompt');
    subdueProgressElement = document.getElementById('subdue-progress');
    subdueBarElement = document.getElementById('subdue-bar');
    antidoteMinigameElement = document.getElementById('antidote-minigame');
    antidotePressureBarElement = document.getElementById('antidote-pressure-bar');
    antidoteSweetSpotElement = document.getElementById('antidote-sweet-spot');
    antidoteTimerBarElement = document.getElementById('antidote-timer-bar');
    antidoteFeedbackElement = document.getElementById('antidote-feedback');
    antidoteOverfillWarningElement = document.getElementById('antidote-overfill-warning');
    antidoteOverfillZoneElement = document.getElementById('antidote-overfill-zone');
    protectProgressElement = document.getElementById('protect-progress');
    protectBarElement = document.getElementById('protect-bar');
    curePhaseElement = document.getElementById('cure-phase');

    if (!interactionPromptElement || !subdueProgressElement || !subdueBarElement ||
        !antidoteMinigameElement || !antidotePressureBarElement || !antidoteTimerBarElement ||
        !antidoteFeedbackElement || !antidoteOverfillWarningElement || !antidoteOverfillZoneElement) {
        console.error("[CURE.JS] Missing required UI elements!");
    } else {
        console.log("[CURE.JS] All UI elements found.");
        antidoteSweetSpotElement.style.left = `${ANTIDOTE_SWEET_SPOT_MIN}%`;
        antidoteSweetSpotElement.style.width = `${ANTIDOTE_SWEET_SPOT_MAX - ANTIDOTE_SWEET_SPOT_MIN}%`;
        antidoteOverfillZoneElement.style.left = `${ANTIDOTE_OVERFILL_LIMIT}%`;
        antidoteOverfillZoneElement.style.width = `${100 - ANTIDOTE_OVERFILL_LIMIT}%`;
    }
}

function _setCurePhase(text) {
    if (curePhaseElement) curePhaseElement.textContent = text ? `Cure: ${text}` : '';
}

function _incrementCureAttempt(gray, reason) {
    if (!gray || !gray.userData) return;
    gray.userData.cureAttemptCount = (gray.userData.cureAttemptCount || 0) + 1;
    if (typeof window.registerCureFailure === 'function') window.registerCureFailure();
    if (typeof window.debugLog === 'function') {
        window.debugLog(gray.name, 'cure attempt failed:', reason, 'count:', gray.userData.cureAttemptCount);
    }
    if (gray.userData.cureAttemptCount >= MAX_CURE_ATTEMPTS) {
        _killHostOnFailedCure(gray, reason);
    } else {
        _resetGrayForRetry(gray);
    }
}

function _killHostOnFailedCure(gray, reason) {
    if (typeof window.debugLog === 'function') window.debugLog(gray.name, 'host died after failed cure:', reason);
    _cleanupProtectVisuals();
    protectTarget = null;
    evacTarget = null;
    if (typeof window.clearSwarmsForGray === 'function') window.clearSwarmsForGray(gray);
    if (typeof window.removeTheGray === 'function') window.removeTheGray(gray);
    _setCurePhase('');
    if (interactionPromptElement) {
        interactionPromptElement.textContent = 'Host lost. Parasite won.';
        interactionPromptElement.style.display = 'block';
        setTimeout(() => { if (interactionPromptElement) interactionPromptElement.style.display = 'none'; }, 3000);
    }
}

function _resetGrayForRetry(gray) {
    if (!gray || !gray.userData) return;
    gray.userData.isProtecting = false;
    gray.userData.isCuredHost = false;
    gray.userData.isSubdued = false;
    gray.userData.isPatchPlaced = false;
    gray.userData.isStunned = false;
    gray.userData.isBeingSubdued = false;
    _removePatchMesh(gray);
    if (gray.material && gray.userData.originalColor) gray.material.color.copy(gray.userData.originalColor);
    if (typeof window.addRandomHitPoint === 'function') window.addRandomHitPoint(gray);
    _setCurePhase('Retry — impede again');
}

function _createProtectRing(gray) {
    if (!gray || typeof THREE === 'undefined' || !window.scene) return;
    _cleanupProtectVisuals();
    const ringGeo = new THREE.RingGeometry(PROTECT_RADIUS - 0.2, PROTECT_RADIUS, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    protectRingMesh = new THREE.Mesh(ringGeo, ringMat);
    protectRingMesh.rotation.x = -Math.PI / 2;
    protectRingMesh.position.set(gray.position.x, 0.08, gray.position.z);
    window.scene.add(protectRingMesh);
}

function _cleanupProtectVisuals() {
    if (protectRingMesh && window.scene) {
        window.scene.remove(protectRingMesh);
        if (protectRingMesh.geometry) protectRingMesh.geometry.dispose();
        if (protectRingMesh.material) protectRingMesh.material.dispose();
        protectRingMesh = null;
    }
    if (protectProgressElement) protectProgressElement.style.display = 'none';
}

function _startProtectPhase(gray) {
    if (!gray || !gray.userData) return;
    gray.userData.isSubdued = false;
    gray.userData.isProtecting = true;
    gray.userData.protectTimer = 0;
    protectTarget = gray;
    protectTimer = 0;
    protectOutsideTimer = 0;
    _createProtectRing(gray);
    _setCurePhase('Protect — stay near host');
    if (protectProgressElement) protectProgressElement.style.display = 'block';
    if (protectBarElement) protectBarElement.style.width = '0%';
    if (typeof window.spawnProtectSwarm === 'function') {
        window.spawnProtectSwarm(gray.position.clone(), gray);
    }
}

function _completeProtectPhase(gray) {
    if (!gray || !gray.userData) return;
    gray.userData.isProtecting = false;
    gray.userData.isCuredHost = true;
    gray.userData.isControllableUnit = true;
    gray.userData.health = HOST_HEALTH_AFTER_SPREAD;
    gray.userData.maxHealth = 100;
    gray.material.color.setHex(0x88cc88);
    _cleanupProtectVisuals();
    if (typeof window.clearSwarmsForGray === 'function') window.clearSwarmsForGray(gray);
    protectTarget = null;
    evacTarget = gray;
    _setCurePhase('Evac — lead host to base');
    if (interactionPromptElement) {
        interactionPromptElement.textContent = 'Lead the host to your main base [M for map]';
        interactionPromptElement.style.display = 'block';
    }
    if (typeof window.UnitControl !== 'undefined' && window.UnitControl.registerUnit) {
        window.UnitControl.registerUnit(gray);
    }
}

function _updateProtectPhase(delta) {
    if (!protectTarget || !protectTarget.userData || !window.controls) return true;

    if (!protectTarget.parent || protectTarget.userData.health <= 0) {
        _incrementCureAttempt(protectTarget, 'host died during protect');
        protectTarget = null;
        return true;
    }

    if (protectRingMesh) {
        protectRingMesh.position.set(protectTarget.position.x, 0.08, protectTarget.position.z);
    }

    const playerPos = window.controls.getObject().position;
    const dist = playerPos.distanceTo(protectTarget.position);

    if (dist <= PROTECT_RADIUS) {
        protectOutsideTimer = 0;
        protectTimer += delta;
        protectTarget.userData.protectTimer = protectTimer;
    } else {
        protectOutsideTimer += delta;
        if (interactionPromptElement) {
            interactionPromptElement.textContent = `Return to host! (${(PROTECT_OUTSIDE_GRACE - protectOutsideTimer).toFixed(1)}s)`;
            interactionPromptElement.style.display = 'block';
        }
        if (protectOutsideTimer >= PROTECT_OUTSIDE_GRACE) {
            const gray = protectTarget;
            _cleanupProtectVisuals();
            protectTarget = null;
            if (typeof window.clearSwarmsForGray === 'function') window.clearSwarmsForGray(gray);
            _incrementCureAttempt(gray, 'left protect zone');
            return true;
        }
    }

    const pct = Math.min(100, (protectTimer / PROTECT_DURATION) * 100);
    if (protectBarElement) protectBarElement.style.width = `${pct}%`;

    if (protectTimer >= PROTECT_DURATION) {
        const gray = protectTarget;
        protectTarget = null;
        _completeProtectPhase(gray);
        return true;
    }
    return false;
}

function _updateEvacPhase(delta) {
    if (!evacTarget || !evacTarget.userData || !evacTarget.parent) {
        evacTarget = null;
        return;
    }

    const ud = evacTarget.userData;
    if (!ud.isCuredHost) { evacTarget = null; return; }

    if (ud.moveCommand) {
        const dir = new THREE.Vector3().subVectors(ud.moveCommand, evacTarget.position);
        dir.y = 0;
        if (dir.lengthSq() < 1) {
            ud.moveCommand = null;
        } else {
            dir.normalize();
            evacTarget.position.x += dir.x * HOST_FOLLOW_SPEED * delta;
            evacTarget.position.z += dir.z * HOST_FOLLOW_SPEED * delta;
            evacTarget.lookAt(ud.moveCommand.x, evacTarget.position.y, ud.moveCommand.z);
        }
        return;
    }

    const playerPos = window.controls.getObject().position;
    const distPlayer = evacTarget.position.distanceTo(playerPos);
    let moveTarget = null;
    let speed = HOST_CRAWL_SPEED;

    if (distPlayer <= EVAC_FOLLOW_RANGE) {
        moveTarget = playerPos.clone();
        moveTarget.y = evacTarget.position.y;
        speed = HOST_FOLLOW_SPEED;
    } else if (window.BaseBuilding && window.BaseBuilding.getMainBase) {
        const base = window.BaseBuilding.getMainBase();
        if (base) moveTarget = base.position.clone();
    }

    if (moveTarget) {
        const dir = new THREE.Vector3().subVectors(moveTarget, evacTarget.position);
        dir.y = 0;
        if (dir.lengthSq() > 1) {
            dir.normalize();
            evacTarget.position.x += dir.x * speed * delta;
            evacTarget.position.z += dir.z * speed * delta;
            evacTarget.lookAt(moveTarget.x, evacTarget.position.y, moveTarget.z);
        }
    }

    if (window.BaseBuilding && window.BaseBuilding.isNearMainBase) {
        if (window.BaseBuilding.isNearMainBase(evacTarget.position, EVAC_BASE_RADIUS)) {
            ud.health = 100;
            ud.isCuredHost = false;
            ud.isWorker = true;
            evacTarget.material.color.setHex(0x44aa44);
            if (typeof window.registerHostHealed === 'function') window.registerHostHealed();
            _setCurePhase('');
            if (interactionPromptElement) {
                interactionPromptElement.textContent = 'Host recovered at base!';
                setTimeout(() => { if (interactionPromptElement) interactionPromptElement.style.display = 'none'; }, 2500);
            }
            evacTarget = null;
        }
    }
}

// --- PATCH PLACEMENT (Step 2) ---
// ... (No changes here)
function _createPatchMesh(target) {
    if (!target || !target.userData || target.userData.subdueRectangle || !window.controls || typeof THREE === 'undefined') return;
    if (typeof window.debugLog === 'function') window.debugLog("Creating subdue patch for", target.name);

    const rectGeo = new THREE.PlaneGeometry(0.3, 0.8);
    const rectMat = new THREE.MeshBasicMaterial({ color: 0x005000, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const patchMesh = new THREE.Mesh(rectGeo, rectMat);

    patchMesh.position.set(0, 1.0, 0.45);
    target.add(patchMesh);
    target.userData.subdueRectangle = patchMesh;
    patchMesh.userData = { isSubdueRect: true, parentGray: target };
    return patchMesh;
}
function _removePatchMesh(targetGray) {
     if (targetGray && targetGray.userData && targetGray.userData.subdueRectangle) {
        if (typeof window.debugLog === 'function') window.debugLog("Removing subdue patch from", targetGray.name);
        const rect = targetGray.userData.subdueRectangle;
        if (rect.geometry) rect.geometry.dispose();
        if (rect.material) rect.material.dispose();
        targetGray.remove(rect);
        targetGray.userData.subdueRectangle = null;
    }
}
function requestPatchApplicationStart() {
    console.log("[CURE.JS] requestPatchApplicationStart called.");
    if (isApplyingPatch || isApplyingAntidote || !closestPatchTarget || !closestPatchTarget.userData ||
        !closestPatchTarget.userData.isStunned || closestPatchTarget.userData.isPatchPlaced) {
         console.log("[CURE.JS] requestPatchApplicationStart: Conditions failed or busy.");
        return;
    }
    console.log("[CURE.JS] Starting patch placement on", closestPatchTarget.name);
    isApplyingPatch = true;
    currentPatchTarget = closestPatchTarget;
    patchApplyTimer = 0;
    currentPatchTarget.userData.isBeingSubdued = true;
    _createPatchMesh(currentPatchTarget);
    if (subdueProgressElement) subdueProgressElement.style.display = 'block';
    if (subdueBarElement) subdueBarElement.style.width = '0%';
    if (interactionPromptElement) interactionPromptElement.textContent = "Placing Patch... [Hold E]";
}
function _updatePatchApplicationHold(delta) {
    if (!isApplyingPatch || !currentPatchTarget || !currentPatchTarget.userData || !window.controls) {
        if (isApplyingPatch) _cancelPatchApplication(); return;
    }
    if (!currentPatchTarget.parent || !currentPatchTarget.userData.isTheGray || currentPatchTarget.userData.health <= 0) {
        _cancelPatchApplication(); return;
    }
    const playerPosition = window.controls.getObject().position;
    const distanceSq = playerPosition.distanceToSquared(currentPatchTarget.position);
    if (distanceSq > SUBDUE_DISTANCE * SUBDUE_DISTANCE ||
        !currentPatchTarget.userData.isStunned ||
        currentPatchTarget.userData.isPatchPlaced) {
        _cancelPatchApplication(); return;
    }
    patchApplyTimer += delta;
    const progress = Math.min((patchApplyTimer / SUBDUE_HOLD_TIME) * 100, 100);
    if (subdueBarElement) subdueBarElement.style.width = `${progress}%`;
    if (currentPatchTarget.userData.subdueRectangle) {
        currentPatchTarget.userData.subdueRectangle.lookAt(playerPosition);
    }
    if (patchApplyTimer >= SUBDUE_HOLD_TIME) {
        _completePatchApplication();
    }
}
function requestPatchApplicationCancel() {
    if (isApplyingPatch) { _cancelPatchApplication(); }
}
function _cancelPatchApplication() {
    console.log("[CURE.JS] Cancelling patch placement.");
    if (currentPatchTarget && currentPatchTarget.userData) {
        currentPatchTarget.userData.isBeingSubdued = false;
        _removePatchMesh(currentPatchTarget);
    }
    isApplyingPatch = false;
    patchApplyTimer = 0;
    currentPatchTarget = null;
    if (subdueProgressElement) subdueProgressElement.style.display = 'none';
}
function _completePatchApplication() {
    if (!currentPatchTarget || !currentPatchTarget.userData) {
        _cancelPatchApplication(); return;
    }
    console.log("[CURE.JS] Patch placement COMPLETE on", currentPatchTarget.name);
    currentPatchTarget.userData.isBeingSubdued = false;
    currentPatchTarget.userData.isPatchPlaced = true;
    currentPatchTarget.userData.isStunned = true;
    currentPatchTarget.userData.stunTimer = 9999;
    currentPatchTarget.material.color.setHex(0xFFFF00);
    isApplyingPatch = false;
    patchApplyTimer = 0;
    if (subdueProgressElement) subdueProgressElement.style.display = 'none';
}

// --- ANTIDOTE MINIGAME (Step 3) ---

// NEW: Called by player.js on each successful click on a patch
function applyAntidotePulse(target) {
    console.log("[CURE.JS] applyAntidotePulse called.");
    // If minigame isn't running yet, try to start it.
    if (!isApplyingAntidote) {
        if (!requestAntidoteStart(target)) {
            return; // Don't apply pulse if we can't even start
        }
    }

    // Only apply pulse if we are currently applying to the *correct* target.
    if (isApplyingAntidote && currentAntidoteTarget === target) {
        console.log("[CURE.JS] Applying pressure pulse!");
        antidotePressure += ANTIDOTE_CLICK_PULSE;
        antidotePressure = Math.min(100, antidotePressure); // Clamp
        _updateAntidoteUI(); // Update UI immediately on pulse
    }
}

function requestAntidoteStart(target) {
    console.log("[CURE.JS] requestAntidoteStart called internally for", target ? target.name : "null target");
    if (isApplyingPatch || isApplyingAntidote || !target || !target.userData ||
        !target.userData.isPatchPlaced) {
        console.log("[CURE.JS] requestAntidoteStart: Conditions FAILED.");
        return false;
    }

    console.log("[CURE.JS] Starting Antidote Minigame for", target.name);
    isApplyingAntidote = true;
    window.isApplyingAntidote = true;
    currentAntidoteTarget = target;
    antidotePressure = 0; // Start at 0, pulse will be added immediately after
    timeInSweetSpot = 0;
    minigameFailTimer = 0;
    isAimingAtPatch = true;

    currentAntidoteTarget.userData.isBeingSubdued = true;

    if (antidoteMinigameElement) antidoteMinigameElement.style.display = 'block';
    if (antidoteOverfillWarningElement) antidoteOverfillWarningElement.style.display = 'none';
    _updateAntidoteUI();
    return true;
}

function requestAntidoteStop() {
     console.log("[CURE.JS] requestAntidoteStop received (mouse is up).");
     // We don't need to do anything, _updateAntidoteApplication handles the 'window.rightMouseDown = false' state.
}


function _cancelAntidoteApplication(reason = "Cancelled") {
    // ... (No changes here)
    console.log(`[CURE.JS] Antidote Minigame ${reason}`);
    if (currentAntidoteTarget && currentAntidoteTarget.userData) {
         currentAntidoteTarget.userData.isBeingSubdued = false;
    }
    isApplyingAntidote = false;
    window.isApplyingAntidote = false;
    currentAntidoteTarget = null;
    antidotePressure = 0;
    timeInSweetSpot = 0;
    isAimingAtPatch = false;
    if (antidoteMinigameElement) antidoteMinigameElement.style.display = 'none';
}

function _failAntidoteApplication() {
     if (!currentAntidoteTarget) return;
    console.log("[CURE.JS] Minigame FAILED!", currentAntidoteTarget.name);
    const target = currentAntidoteTarget;
    _cancelAntidoteApplication("FAILED");
    _incrementCureAttempt(target, 'antidote overload');
}

function _completeAntidoteApplication() {
    if (!currentAntidoteTarget) return;
    console.log("[CURE.JS] Antidote injection COMPLETE — starting Protect phase for", currentAntidoteTarget.name);
    const target = currentAntidoteTarget;
    target.userData.isBeingSubdued = false;
    target.userData.isPatchPlaced = false;
    target.userData.isStunned = false;
    target.userData.isSubdued = false;
    _removePatchMesh(target);

    isApplyingAntidote = false;
    window.isApplyingAntidote = false;
    currentAntidoteTarget = null;
    antidotePressure = 0;
    timeInSweetSpot = 0;
    isAimingAtPatch = false;
    if (antidoteMinigameElement) antidoteMinigameElement.style.display = 'none';

    _startProtectPhase(target);
}

function _updateAntidoteUI() {
    // ... (No changes here)
    if (!antidotePressureBarElement || !antidoteTimerBarElement || !antidoteFeedbackElement || !antidoteOverfillWarningElement) return;

    antidotePressureBarElement.style.width = `${antidotePressure}%`;
    antidoteTimerBarElement.style.width = `${(timeInSweetSpot / ANTIDOTE_REQUIRED_TIME) * 100}%`;

    if (antidotePressure >= ANTIDOTE_OVERFILL_LIMIT) {
        antidoteOverfillWarningElement.style.display = 'block';
        antidoteFeedbackElement.textContent = "OVERLOAD! RELEASE!";
        antidotePressureBarElement.style.backgroundColor = '#FF0000';
    } else if (antidotePressure >= ANTIDOTE_SWEET_SPOT_MIN && antidotePressure <= ANTIDOTE_SWEET_SPOT_MAX) {
         antidoteOverfillWarningElement.style.display = 'none';
         antidoteFeedbackElement.textContent = "KEEP IT HERE!";
         antidotePressureBarElement.style.backgroundColor = '#00FF00';
    } else {
         antidoteOverfillWarningElement.style.display = 'none';
         antidoteFeedbackElement.textContent = isAimingAtPatch ? "Adjust Pressure..." : "AIM AT PATCH!";
         antidotePressureBarElement.style.backgroundColor = '#FFFF00';
    }
}


function _updateAntidoteApplication(delta) {
    if (!isApplyingAntidote || !currentAntidoteTarget || !window.controls) {
        if (isApplyingAntidote) _cancelAntidoteApplication("Interrupted");
        return;
    }

    if (!currentAntidoteTarget.parent || !currentAntidoteTarget.userData.isTheGray || currentAntidoteTarget.userData.health <= 0) {
        _cancelAntidoteApplication("Target Invalid"); return;
    }

    // Aiming Check
    isAimingAtPatch = false;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), window.camera);
    const intersects = raycaster.intersectObject(currentAntidoteTarget, true);
    for (const intersect of intersects) {
        if (intersect.object.userData.isSubdueRect && intersect.object.userData.parentGray === currentAntidoteTarget) {
             isAimingAtPatch = true;
             break;
        }
    }

    // Pressure Update
    let pressureChange = 0;
    // Add pressure IF holding AND aiming
    if (window.rightMouseDown && isAimingAtPatch) {
        pressureChange += ANTIDOTE_FILL_RATE * delta;
    }
    // ALWAYS decay pressure
    pressureChange -= ANTIDOTE_DECAY_RATE * delta;

    antidotePressure += pressureChange;
    antidotePressure = Math.max(0, Math.min(100, antidotePressure)); // Clamp

    // Check for Overfill Failure
    if (antidotePressure >= ANTIDOTE_OVERFILL_LIMIT) {
        _failAntidoteApplication();
        return;
    }

    // Check if aim is lost while holding -> this effectively cancels the "hold" part
    if (window.rightMouseDown && !isAimingAtPatch) {
        // Don't add fill rate, just decay.
        // If pressure drops to 0, it might cancel below.
    }

    // Check if mouse is released and pressure is 0 -> cancel
    if (!window.rightMouseDown && antidotePressure <= 0) {
        _cancelAntidoteApplication("Released / Dropped");
        return;
    }

    // Check if in Sweet Spot and update timer (ONLY if aiming and holding)
    if (window.rightMouseDown && isAimingAtPatch &&
        antidotePressure >= ANTIDOTE_SWEET_SPOT_MIN &&
        antidotePressure <= ANTIDOTE_SWEET_SPOT_MAX) {
        timeInSweetSpot += delta;
    }

    _updateAntidoteUI();

    // Check for Success
    if (timeInSweetSpot >= ANTIDOTE_REQUIRED_TIME) {
        _completeAntidoteApplication();
    }
}


// --- MAIN UPDATE FUNCTION ---
// ... (No changes here)
function updateCuringMechanic(delta) {
    if (!interactionPromptElement || !window.controls || !window.objects) return;

    if (protectTarget) {
        _updateProtectPhase(delta);
        return;
    }

    if (evacTarget) {
        _updateEvacPhase(delta);
    }

    if (isApplyingPatch) {
        _updatePatchApplicationHold(delta);
        window.closestStunnedGray = currentPatchTarget;
        return;
    }
    if (isApplyingAntidote) {
        _updateAntidoteApplication(delta);
         window.closestStunnedGray = currentAntidoteTarget;
        interactionPromptElement.style.display = 'none';
        return;
    }

    const playerPosition = window.controls.getObject().position;
    let foundInteractTarget = null;
    let minDistanceSq = ANTIDOTE_DISTANCE * ANTIDOTE_DISTANCE;

    window.objects.forEach(object => {
        if (object.userData && object.userData.isTheGray && object.userData.health > 0) {
            const distanceSq = playerPosition.distanceToSquared(object.position);
            if (distanceSq < minDistanceSq) {
                if (object.userData.isPatchPlaced && object.userData.isStunned) {
                    minDistanceSq = distanceSq;
                    foundInteractTarget = object;
                } else if (object.userData.isStunned && !object.userData.isPatchPlaced && !object.userData.isSubdued) {
                    minDistanceSq = distanceSq;
                    foundInteractTarget = object;
                }
            }
        }
    });

    closestPatchTarget = foundInteractTarget;
    window.closestStunnedGray = closestPatchTarget;

    if (closestPatchTarget) {
        if (closestPatchTarget.userData.isPatchPlaced) {
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(0, 0), window.camera);
            const intersects = raycaster.intersectObject(closestPatchTarget, true);
            let lookingAtPatch = false;
            for(const intersect of intersects) {
                if (intersect.object.userData.isSubdueRect) {
                    lookingAtPatch = true;
                    break;
                }
            }
            interactionPromptElement.textContent = lookingAtPatch ? "Aim & [Hold/Tap Right-Click]" : "Aim at Patch";
            interactionPromptElement.style.display = 'block';

        } else if (closestPatchTarget.userData.isStunned) {
            interactionPromptElement.textContent = "Press & Hold [E] to Place Patch";
            interactionPromptElement.style.display = 'block';
        } else {
            interactionPromptElement.style.display = 'none';
        }
    } else {
        interactionPromptElement.style.display = 'none';
    }
}


window.initCuringMechanic = initCuringMechanic;
window.updateCuringMechanic = updateCuringMechanic;
window.requestPatchApplicationStart = requestPatchApplicationStart;
window.requestPatchApplicationCancel = requestPatchApplicationCancel;
window.requestAntidoteStart = requestAntidoteStart; // Still useful internally
window.applyAntidotePulse = applyAntidotePulse; // NEW Export
window.requestAntidoteStop = requestAntidoteStop;
window.isApplyingAntidote = isApplyingAntidote;