// player.js - Handles player state, controls, movement, and input

// --- PLAYER CONSTANTS ---
const PLAYER_COLLIDER_HEIGHT = 1.8;
const PLAYER_WIDTH = 0.6;
const PLAYER_DEPTH = 0.6;
const PLAYER_SPEED = 8.0;
const SPRINT_MULTIPLIER = 3; // Player moves 29 times faster when sprinting
const PLAYER_JUMP_VELOCITY = 7.0;
const GRAVITY = -19.6;
const SHOOT_DAMAGE = 25;
window.GRAVITY = GRAVITY;
window.SHOOT_DAMAGE = SHOOT_DAMAGE;

// --- PLAYER STATE ---
let playerVelocity = new THREE.Vector3();
let playerOnGround = false;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = true;
let eKeyPressed = false;
let rightMouseDown = false;
window.rightMouseDown = rightMouseDown;
let isSprinting = false; // New variable for sprint mechanic

let playerInventory = { wood: 0, stone: 0 };
window.playerInventory = playerInventory;

// --- CORE COMPONENTS ---
let camera;
let controls;
let scene;
let objects;
let debugControlsLockElement;
let raycaster;

function inRange(object3d, range) {
    if (window.InteractionModal && window.InteractionModal.isWithinRange) {
        return window.InteractionModal.isWithinRange(object3d, range);
    }
    if (!controls || !object3d) return false;
    return controls.getObject().position.distanceTo(object3d.position) <= range;
}

function getGatherRange() {
    return window.GATHER_RANGE || 6;
}

function getInteractionRange() {
    return window.INTERACTION_RANGE || 5;
}

function resolveTargetFromHit(hitObject) {
    if (window.InteractionModal && window.InteractionModal.resolveInteractable) {
        return window.InteractionModal.resolveInteractable(hitObject);
    }
    return null;
}

function pickupResource(resourceMesh) {
    if (!resourceMesh.userData.isResource) return;
    if (!inRange(resourceMesh, getInteractionRange())) return;

    const resourceType = resourceMesh.userData.type;
    const resourceValue = resourceMesh.userData.value || 1;

    if (window.playerInventory[resourceType] !== undefined) {
        window.playerInventory[resourceType] += resourceValue;
        console.log(`Picked up ${resourceValue} ${resourceType}. Total: ${window.playerInventory[resourceType]}`);
        if (typeof window.updateHUD === 'function') {
            window.updateHUD(null, null, window.playerInventory.wood, window.playerInventory.stone, null);
        }
    } else {
        console.warn(`Unknown resource type: ${resourceType}`);
    }

    scene.remove(resourceMesh);
    const index = objects.indexOf(resourceMesh);
    if (index > -1) objects.splice(index, 1);
    if (resourceMesh.geometry) resourceMesh.geometry.dispose();
    if (resourceMesh.material) resourceMesh.material.dispose();
}

function performPrimaryActionOnTarget(resolved) {
    if (!resolved) return false;

    switch (resolved.kind) {
        case 'wood':
            if (inRange(resolved.object, getInteractionRange())) {
                pickupResource(resolved.object);
                return true;
            }
            return false;
        case 'boulder':
            if (inRange(resolved.object, getGatherRange()) && window.Boulders) {
                window.Boulders.damageBoulder(resolved.object);
                return true;
            }
            return false;
        case 'tree':
            if (inRange(resolved.object, getGatherRange()) && window.Trees) {
                window.Trees.damageTree(resolved.object, window.SHOOT_DAMAGE || 25);
                return true;
            }
            return false;
        default:
            return false;
    }
}

function performShootOnReticle() {
    if (!window.controls || !window.camera || !window.objects || !raycaster) return;

    raycaster.setFromCamera(new THREE.Vector2(0, 0), window.camera);
    const intersects = raycaster.intersectObjects(window.objects, true);

    for (const hit of intersects) {
        const resolved = resolveTargetFromHit(hit.object);
        if (resolved) {
            if (!inRange(resolved.object, resolved.range)) continue;
            if (resolved.kind === 'blueprint' || resolved.kind === 'building') return;
            if (performPrimaryActionOnTarget(resolved)) return;
        }

        const hitObject = hit.object;
        if (hitObject.userData && hitObject.userData.isDarkGrey) {
            if (!inRange(hitObject, getGatherRange())) return;
            if (window.darkGreyTakeDamage) window.darkGreyTakeDamage(hitObject, window.SHOOT_DAMAGE || 25);
            return;
        }
        if (hitObject.userData && hitObject.userData.isBoulder) {
            if (!inRange(hitObject, getGatherRange())) return;
            if (window.Boulders) window.Boulders.damageBoulder(hitObject);
            return;
        }
        if (hitObject.userData && hitObject.userData.isResource) {
            if (inRange(hitObject, getInteractionRange())) {
                pickupResource(hitObject);
            }
            return;
        }

        if (!inRange(hitObject, getGatherRange())) continue;

        if (typeof hitObject.takeDamage === 'function') {
            hitObject.takeDamage(window.SHOOT_DAMAGE || 25, 'player');
            return;
        }
        if (hitObject.parent && typeof hitObject.parent.takeDamage === 'function') {
            if (!inRange(hitObject.parent, getGatherRange())) return;
            hitObject.parent.takeDamage(window.SHOOT_DAMAGE || 25, 'player');
            return;
        }
        if (hitObject.userData && typeof hitObject.userData.health === 'number') {
            if (window.Collisions && window.Collisions.damageBlock) {
                window.Collisions.damageBlock(hitObject, window.SHOOT_DAMAGE || 25);
            } else {
                hitObject.userData.health -= (window.SHOOT_DAMAGE || 25);
                if (hitObject.material && hitObject.userData.originalColor) {
                    const healthPercent = Math.max(0, hitObject.userData.health / hitObject.userData.maxHealth);
                    hitObject.material.color.copy(hitObject.userData.originalColor).lerp(new THREE.Color(1, 0, 0), 1 - healthPercent);
                }
            }
            return;
        }
    }
}

function initPlayer(_camera, _scene) {
    if (typeof window.debugLog === 'function') window.debugLog("Initializing Player...");
    else console.log("Initializing Player (debugLog not found)....");

    camera = _camera;
    scene = _scene;
    objects = window.objects;
    raycaster = new THREE.Raycaster();

    if (!camera) { console.error("Player Init: Camera is undefined!"); return; }
    if (!scene) { console.error("Player Init: Scene is undefined!"); return; }
    if (!objects) { console.error("Player Init: Global objects array is undefined!"); return; }

    camera.position.y = PLAYER_COLLIDER_HEIGHT;

    if (typeof THREE.PointerLockControls !== 'function') {
        console.error("THREE.PointerLockControls is not loaded!"); return;
    }
    controls = new THREE.PointerLockControls(camera, document.body);
    scene.add(controls.getObject());
    window.controls = controls;

    debugControlsLockElement = document.getElementById('debug-controls-locked');

    document.addEventListener('click', () => {
        // Only lock if not in map view
        if (controls && !controls.isLocked && !window.isMapViewActive) {
             controls.lock();
        }
    });

    if (controls) {
        controls.addEventListener('lock', () => {
            if (typeof window.debugLog === 'function') window.debugLog('Controls Locked');
            // Only add class if not in map view (though lock shouldn't happen then)
            if (!window.isMapViewActive) {
                document.body.classList.add('pointer-lock-active');
            }
            if (debugControlsLockElement) debugControlsLockElement.textContent = 'true';
        });
        controls.addEventListener('unlock', () => {
            if (typeof window.debugLog === 'function') window.debugLog('Controls Unlocked');
            document.body.classList.remove('pointer-lock-active'); // Always remove on unlock
            if (debugControlsLockElement) debugControlsLockElement.textContent = 'false';
            if (rightMouseDown) {
                console.log("[PLAYER.JS] Controls unlocked, forcing right mouse UP.");
                rightMouseDown = false;
                window.rightMouseDown = false;
                if (typeof window.requestAntidoteStop === 'function') {
                    window.requestAntidoteStop();
                }
            }
        });
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    document.addEventListener('mousedown', (event) => {
        // Ensure not in map view before handling game clicks
        if (controls && controls.isLocked && !window.isMapViewActive) {
            if (event.button === 0) {
                raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                const intersects = raycaster.intersectObjects(window.objects, true);

                for (const hit of intersects) {
                    const resolved = resolveTargetFromHit(hit.object);
                    if (resolved && inRange(resolved.object, resolved.range)) {
                        if (performPrimaryActionOnTarget(resolved)) return;
                        if (resolved.kind === 'blueprint') return;
                    }
                    if (resolved && !inRange(resolved.object, resolved.range)) continue;
                }

                performShootOnReticle();
            } else if (event.button === 2) {
                event.preventDefault();
                console.log("[PLAYER.JS] Right MOUSE DOWN detected.");
                rightMouseDown = true;
                window.rightMouseDown = true;
                raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                const intersects = raycaster.intersectObjects(window.objects, true);
                for (const intersect of intersects) {
                    const hitObject = intersect.object;
                    if (hitObject.userData && hitObject.userData.isSubdueRect &&
                        hitObject.userData.parentGray && hitObject.userData.parentGray.userData &&
                        hitObject.userData.parentGray.userData.isPatchPlaced)
                    {
                        console.log("[PLAYER.JS] Raycast HIT patch. Calling applyAntidotePulse.");
                        if (typeof window.applyAntidotePulse === 'function') {
                            window.applyAntidotePulse(hitObject.userData.parentGray);
                        }
                        break;
                    }
                }
            }
        } else if (window.isMapViewActive) {
             console.log("[PLAYER.JS] Click in Map View (TODO: Handle Map Clicks)");
             // TODO: Add map interaction logic here (raycasting from map camera)
        }
    });

     document.addEventListener('mouseup', (event) => {
        // Handle mouse up regardless of map view to ensure flags are reset
        if (event.button === 2) {
            event.preventDefault();
            console.log("[PLAYER.JS] Right MOUSE UP detected.");
            if (rightMouseDown) {
                 rightMouseDown = false;
                 window.rightMouseDown = false;
                 if (typeof window.requestAntidoteStop === 'function') {
                     window.requestAntidoteStop();
                 }
            }
        }
    });

    document.addEventListener('contextmenu', function(e) {
        // Prevent context menu only if controls are locked (FPS mode)
        if (controls && controls.isLocked && !window.isMapViewActive) {
            e.preventDefault();
        }
    });
}

function findBlueprintUnderReticle() {
    const target = window.InteractionModal && window.InteractionModal.findTargetUnderReticle
        ? window.InteractionModal.findTargetUnderReticle()
        : null;
    return target && target.kind === 'blueprint' ? target.object : null;
}

function onKeyDown(event) {
    if (window.isPlayerDead) return;

    // NEW: Check for Map Toggle Key 'M'
    if (event.code === 'KeyM') {
        if (typeof window.toggleMapView === 'function') {
            window.toggleMapView();
        }
        return; // Don't process other keys if toggling map
    }

    // NEW: If map is active, ignore movement keys
    if (window.isMapViewActive) {
        switch (event.code) {
            case 'KeyB':
                if (typeof window.RadialMenu.showRadialMenu === 'function') {
                    // Show the radial menu in the center of the screen
                    const centerX = window.innerWidth / 2;
                    const centerY = window.innerHeight / 2;
                    window.RadialMenu.showRadialMenu(centerX, centerY, (blueprintType) => {
                        window.BuildManager.setSelectedBlueprintType(blueprintType);
                    });
                }
                break;
            // Add other map-view-only keys here in the future
        }
        return; // Ignore movement keys
    }

    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveRight = true; break;
        case 'ShiftLeft': isSprinting = true; break; // Sprint
        case 'Space':
            if (canJump && playerOnGround) {
                playerVelocity.y = PLAYER_JUMP_VELOCITY;
                playerOnGround = false;
            }
            break;
        case 'KeyE':
            const blueprint = findBlueprintUnderReticle();
            if (blueprint && typeof window.BaseBuilding.depositResources === 'function') {
                let depositedWood = 0;
                let depositedStone = 0;

                // Deposit wood
                if (window.playerInventory.wood > 0) {
                    const amountToDeposit = Math.min(window.playerInventory.wood, blueprint.userData.requiredWood - blueprint.userData.woodDeposited);
                    if (amountToDeposit > 0) {
                        depositedWood = window.BaseBuilding.depositResources(blueprint, 'wood', amountToDeposit);
                        window.playerInventory.wood -= depositedWood;
                    }
                }

                // Deposit stone
                if (window.playerInventory.stone > 0) {
                    const amountToDeposit = Math.min(window.playerInventory.stone, blueprint.userData.requiredStone - blueprint.userData.stoneDeposited);
                    if (amountToDeposit > 0) {
                        depositedStone = window.BaseBuilding.depositResources(blueprint, 'stone', amountToDeposit);
                        window.playerInventory.stone -= depositedStone;
                    }
                }

                if (depositedWood > 0 || depositedStone > 0) {
                    console.log(`Deposited ${depositedWood} wood and ${depositedStone} stone into blueprint.`);
                    if (typeof window.updateHUD === 'function') {
                        window.updateHUD(null, null, window.playerInventory.wood, window.playerInventory.stone, null);
                    }
                } else {
                    console.log("No resources to deposit or blueprint already complete.");
                }
            } else if (!eKeyPressed && typeof window.requestPatchApplicationStart === 'function') {
                // Existing E key logic (for curing mechanic)
                window.requestPatchApplicationStart();
            }
            eKeyPressed = true;
            break;
        case 'Digit9': // Dev spawn key
            if (window.enableDebugLogs && typeof window.devSpawnTheGrayNearPlayer === 'function') {
                window.devSpawnTheGrayNearPlayer();
            }
            break;
    }
}

function onKeyUp(event) {
    // No need to check for map view here, setting false is always safe
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
        case 'ShiftLeft': isSprinting = false; break; // Stop Sprint
        case 'KeyE':
            if (typeof window.requestPatchApplicationCancel === 'function') {
                window.requestPatchApplicationCancel();
            }
            eKeyPressed = false;
            break;
    }
}

// ... (getPlayerAABB, updatePlayer, handleShoot - NO CHANGES)
function getPlayerAABB(position) {
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number' ||
        isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
        console.error("getPlayerAABB received invalid position:", position);
        return new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0));
    }
    if (typeof THREE === 'undefined' || typeof THREE.Box3 !== 'function' || typeof THREE.Vector3 !== 'function') {
        console.error("THREE.Box3 or THREE.Vector3 is not available in getPlayerAABB!");
        return new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0));
    }
    return new THREE.Box3(
        new THREE.Vector3(position.x - PLAYER_WIDTH / 2, position.y - PLAYER_COLLIDER_HEIGHT, position.z - PLAYER_DEPTH / 2),
        new THREE.Vector3(position.x + PLAYER_WIDTH / 2, position.y, position.z + PLAYER_DEPTH / 2)
    );
}

function isSolidForPlayer(object) {
    if (!object) return false;
    const ud = object.userData;
    if (!ud) return true;
    if (ud.isTheGray || ud.isResource || ud.isDarkGrey || ud.isSubdueRect) return false;
    return true;
}

function playerIntersectsSolidAt(position) {
    const playerAABB = getPlayerAABB(position);
    for (const object of objects) {
        if (!isSolidForPlayer(object)) continue;
        const objectAABB = new THREE.Box3().setFromObject(object);
        if (playerAABB.intersectsBox(objectAABB)) return true;
    }
    return false;
}

function updatePlayer(delta) {
    if (window.isPlayerDead) return;
    // This function is now only called when controls are locked and map isn't active
    if (!controls || !camera || !objects) return;

    const playerObject = controls.getObject();
    if (!playerObject) { console.error("updatePlayer: playerObject (controls.getObject()) is null."); return;}
    const playerPosition = playerObject.position;
    if (!playerPosition) { console.error("updatePlayer: playerPosition is null."); return;}

    if (!playerOnGround) playerVelocity.y += GRAVITY * delta;

    const cameraForward = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    playerObject.getWorldDirection(cameraForward);
    cameraForward.y = 0; cameraForward.normalize();
    cameraRight.crossVectors(playerObject.up, cameraForward).normalize();

    let inputForward = 0; let inputRight = 0;
    if (moveForward) inputForward += 1; if (moveBackward) inputForward -= 1;
    if (moveLeft) inputRight -= 1; if (moveRight) inputRight += 1;

    const currentSpeed = isSprinting ? PLAYER_SPEED * SPRINT_MULTIPLIER : PLAYER_SPEED;

    const targetDx = (cameraForward.x * inputForward * currentSpeed - cameraRight.x * inputRight * currentSpeed) * delta;
    const targetDz = (cameraForward.z * inputForward * currentSpeed - cameraRight.z * inputRight * currentSpeed) * delta;
    const targetDy = playerVelocity.y * delta;

    const startX = playerPosition.x;
    const startZ = playerPosition.z;

    playerPosition.x += targetDx;
    playerPosition.z += targetDz;
    if (playerIntersectsSolidAt(playerPosition)) {
        playerPosition.x = startX;
        playerPosition.z = startZ;
        playerPosition.x += targetDx;
        if (playerIntersectsSolidAt(playerPosition)) {
            playerPosition.x = startX;
            playerPosition.z += targetDz;
            if (playerIntersectsSolidAt(playerPosition)) {
                playerPosition.x = startX;
                playerPosition.z = startZ;
            }
        }
    }

    playerPosition.y += targetDy;
    let playerAABB = getPlayerAABB(playerPosition);
    if (playerAABB.min.y <= 0 && playerVelocity.y <= 0) {
        playerPosition.y -= playerAABB.min.y;
        playerVelocity.y = 0;
        playerOnGround = true;
    } else if (playerAABB.min.y > 0.05) {
        playerOnGround = false;
    }

    playerAABB = getPlayerAABB(playerPosition);

    for (const object of objects) {
        if (!isSolidForPlayer(object)) continue;
        const objectAABB = new THREE.Box3().setFromObject(object);
        if (playerAABB.intersectsBox(objectAABB)) {
            if (targetDy < 0 && playerAABB.min.y >= objectAABB.max.y - 0.1) {
                playerPosition.y = objectAABB.max.y + PLAYER_COLLIDER_HEIGHT;
                if (playerVelocity.y < 0) playerVelocity.y = 0;
                playerOnGround = true;
            } else if (targetDy > 0 && playerAABB.max.y <= objectAABB.min.y + 0.1) {
                playerPosition.y = objectAABB.min.y - 0.01;
                if (playerVelocity.y > 0) playerVelocity.y = 0;
                playerOnGround = false;
            }
            break;
        }
    }
    canJump = playerOnGround;
}

function handleShoot() {
    performShootOnReticle();
}
window.initPlayer = initPlayer;
window.updatePlayer = updatePlayer;
window.handleShoot = handleShoot;