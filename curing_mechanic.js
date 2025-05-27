// curing_mechanic.js
// Handles the multi-step curing process for The-Gray enemies.
// Step 2: Subdue (Patch Placement by holding 'E')
// Step 3: Administer (Antidote Minigame with Right-Click/Tap on Patch)

// --- CONSTANTS ---
const SUBDUE_DISTANCE = 2.5;
const SUBDUE_HOLD_TIME = 2.3;
// UPDATED: Antidote Minigame Constants
const ANTIDOTE_DISTANCE = 2.5;
const ANTIDOTE_FILL_RATE = 15.0; // Slower fill rate from HOLDING
const ANTIDOTE_DECAY_RATE = 20.0; // Faster decay rate (requires taps!)
const ANTIDOTE_CLICK_PULSE = 7.0; // Pressure added per click
const ANTIDOTE_SWEET_SPOT_MIN = 70.0;
const ANTIDOTE_SWEET_SPOT_MAX = 85.0;
const ANTIDOTE_REQUIRED_TIME = 8.0;
const ANTIDOTE_OVERFILL_LIMIT = 98.0;
const ANTIDOTE_FAIL_PENALTY_TIME = 5.0;

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
    // ... (No changes here)
     if (!currentAntidoteTarget) return;
    console.log("[CURE.JS] Minigame FAILED!", currentAntidoteTarget.name);
    const target = currentAntidoteTarget;
    _cancelAntidoteApplication("FAILED");
    target.userData.isPatchPlaced = false;
    target.userData.isStunned = true;
    target.userData.stunTimer = ANTIDOTE_FAIL_PENALTY_TIME;
    target.material.color.setHex(0xFF0000);
    _removePatchMesh(target);
}

function _completeAntidoteApplication() {
    // ... (No changes here)
    if (!currentAntidoteTarget) return;
    console.log("[CURE.JS] Antidote Minigame COMPLETE for", currentAntidoteTarget.name);
    currentAntidoteTarget.userData.isBeingSubdued = false;
    currentAntidoteTarget.userData.isPatchPlaced = false;
    currentAntidoteTarget.userData.isStunned = false;
    currentAntidoteTarget.userData.isSubdued = true;
    currentAntidoteTarget.material.color.setHex(0x556B2F);
    _removePatchMesh(currentAntidoteTarget);

    isApplyingAntidote = false;
    window.isApplyingAntidote = false;
    currentAntidoteTarget = null;
    antidotePressure = 0;
    timeInSweetSpot = 0;
    isAimingAtPatch = false;
    if (antidoteMinigameElement) antidoteMinigameElement.style.display = 'none';
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