// The-Gray enemy logic module

// Constants for The-Gray
const THE_GRAY_HEALTH = 100;
const THE_GRAY_SPEED = 2.0;
const HIT_POINT_HEALTH = 75;
const THE_GRAY_TURN_DELAY = 3.0;
const AVOIDANCE_RADIUS = 3.5;
const AVOIDANCE_STRENGTH = 3.0;
const SEPARATION_RADIUS = 2.5;
const SEPARATION_STRENGTH = 2.5;
const ATTENTION_RANGE = 25.0;
const ALERT_DURATION = 7.0;
const IDLE_SPEED_MULTIPLIER = 0.3;
const IDLE_WANDER_RADIUS = 15.0;
const IDLE_TARGET_TIMER = 6.0;

function createTheGray(position) {
    // Ensure global dependencies are available
    if (typeof window.debugLog !== 'function' || typeof THREE === 'undefined' || !window.scene || !window.objects) {
        console.error("createTheGray: Missing global dependencies (debugLog, THREE, scene, or objects array)!");
        return null;
    }
    window.debugLog("Creating The-Gray at", position);
    const grayGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 16);
    const grayMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 });
    const theGray = new THREE.Mesh(grayGeometry, grayMaterial);
    theGray.position.copy(position);
    theGray.position.y = 0.9;
    theGray.castShadow = true;
    theGray.receiveShadow = true;
    theGray.name = "TheGray_" + Math.random().toString(36).substr(2, 5);
    theGray.userData = {
        health: THE_GRAY_HEALTH,
        maxHealth: THE_GRAY_HEALTH,
        isDestructible: true,
        originalColor: grayMaterial.color.clone(),
        isTheGray: true,
        speed: THE_GRAY_SPEED * (0.8 + Math.random() * 0.4),
        isStunned: false,
        stunTimer: 0,
        hitPoints: [],
        stunCounterMesh: null,
        turnTimer: Math.random() * THE_GRAY_TURN_DELAY,
        isSubdued: false,       // True when patch is successfully placed & minigame would start
        isBeingSubdued: false,  // True during the 'E' hold for patch placement
        isPatchPlaced: false,   // True when patch is visually on the Gray
        subdueRectangle: null
    };

    const hitPointGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const hitPointMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    const numPoints = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < numPoints; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.45 + Math.random() * 0.1;
        const y = 0.3 + Math.random() * 1.2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const hitPoint = new THREE.Mesh(hitPointGeometry, hitPointMaterial.clone());
        hitPoint.position.set(x, y, z);
        hitPoint.name = `${theGray.name}_HitPoint_${i}`;
        hitPoint.userData = { isHitPoint: true, parentGray: theGray, health: HIT_POINT_HEALTH };
        theGray.add(hitPoint);
        theGray.userData.hitPoints.push(hitPoint);
    }

    window.scene.add(theGray);
    window.objects.push(theGray);
    return theGray;
}

function pickNewIdleTarget(object) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * IDLE_WANDER_RADIUS;
    const newX = object.position.x + Math.cos(angle) * radius;
    const newZ = object.position.z + Math.sin(angle) * radius;
    object.userData.idleTarget = new THREE.Vector3(newX, object.position.y, newZ);
    object.userData.idleMoveTimer = IDLE_TARGET_TIMER * (0.8 + Math.random() * 0.4);
    if (typeof window.debugLog === 'function') window.debugLog(object.name, "picking new idle target:", object.userData.idleTarget);
}

function addRandomHitPoint(theGray) {
    if (!theGray || !theGray.userData || theGray.userData.isSubdued || theGray.userData.isPatchPlaced) return;
    if (typeof window.debugLog === 'function') window.debugLog("Adding new hitpoint to", theGray.name);

    const hitPointGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const hitPointMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.45 + Math.random() * 0.1;
    const y = 0.3 + Math.random() * 1.2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const hitPoint = new THREE.Mesh(hitPointGeometry, hitPointMaterial.clone());
    hitPoint.position.set(x, y, z);
    hitPoint.name = `${theGray.name}_HitPoint_${Date.now()}`;
    hitPoint.userData = { isHitPoint: true, parentGray: theGray, health: HIT_POINT_HEALTH };
    theGray.add(hitPoint);
    theGray.userData.hitPoints.push(hitPoint);
}

// --- DAMAGE AND STUN LOGIC ---
function stunTheGray(theGray) {
    if (!theGray || !theGray.userData) return;
    if (theGray.userData.isStunned) return; // Already stunned
    theGray.userData.isStunned = true;
    theGray.userData.stunTimer = (typeof window.STUN_DURATION === 'number') ? window.STUN_DURATION : 11.0;
    theGray.material.color.setHex(0x00FFFF); // Cyan for stunned
    if (typeof window.debugLog === 'function') window.debugLog(theGray.name, 'is STUNNED!');
    updateStunCounterMesh(theGray);
}

function hitPointTakeDamage(damage) {
    if (typeof this.userData.health !== 'number') return;
    this.userData.health -= damage;
    if (this.material && this.userData.health >= 0) {
        const percent = Math.max(0, this.userData.health / 3);
        this.material.color.setRGB(1, percent, 1);
    }
    if (this.userData.health <= 0) {
        const parentGray = this.userData.parentGray;
        if (parentGray && parentGray.userData && Array.isArray(parentGray.userData.hitPoints)) {
            // Remove from hitPoints array
            parentGray.userData.hitPoints = parentGray.userData.hitPoints.filter(hp => hp !== this);
        }
        if (this.parent) this.parent.remove(this);
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
        // Check if all hit points are gone
        if (parentGray && parentGray.userData.hitPoints.length === 0) {
            stunTheGray(parentGray);
        }
    }
}

function theGrayTakeDamage(damage, source) {
    // Optionally allow direct damage to The-Gray body (not used for stun mechanic)
    if (typeof this.userData.health !== 'number') return;
    this.userData.health -= damage;
    if (this.material && this.userData.originalColor) {
        const percent = Math.max(0, this.userData.health / this.userData.maxHealth);
        this.material.color.copy(this.userData.originalColor).lerp(new THREE.Color(1, 0, 0), 1 - percent);
    }
    if (this.userData.health <= 0) {
        if (this.parent) this.parent.remove(this);
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
    }
}

// Attach takeDamage to The-Gray and hit points after creation
function attachDamageHandlers(theGray) {
    if (!theGray || !theGray.userData) return;
    theGray.takeDamage = theGrayTakeDamage;
    if (Array.isArray(theGray.userData.hitPoints)) {
        theGray.userData.hitPoints.forEach(hp => {
            hp.takeDamage = hitPointTakeDamage;
        });
    }
}

// Patch createTheGray to attach takeDamage handlers
const _originalCreateTheGray = createTheGray;
createTheGray = function(position) {
    const theGray = _originalCreateTheGray(position);
    attachDamageHandlers(theGray);
    return theGray;
}

// Also patch addRandomHitPoint to attach takeDamage
const _originalAddRandomHitPoint = addRandomHitPoint;
addRandomHitPoint = function(theGray) {
    _originalAddRandomHitPoint(theGray);
    if (theGray && Array.isArray(theGray.userData.hitPoints)) {
        const last = theGray.userData.hitPoints[theGray.userData.hitPoints.length - 1];
        if (last) last.takeDamage = hitPointTakeDamage;
    }
}

function updateStunCounterMesh(theGray) {
    if (typeof THREE === 'undefined') { console.error("THREE is not defined for stun counter."); return; }

    // Remove existing mesh first
    if (theGray.userData.stunCounterMesh) {
        if(theGray.userData.stunCounterMesh.material.map) theGray.userData.stunCounterMesh.material.map.dispose();
        if(theGray.userData.stunCounterMesh.material) theGray.userData.stunCounterMesh.material.dispose();
        theGray.remove(theGray.userData.stunCounterMesh);
        theGray.userData.stunCounterMesh = null;
    }

    // Only show if stunned AND NOT subdued/patchPlaced AND NOT being subdued by E-hold
    if (!theGray.userData.isStunned || theGray.userData.stunTimer <= 0 ||
        theGray.userData.isSubdued || theGray.userData.isPatchPlaced || theGray.userData.isBeingSubdued ) {
        return;
    }

    const timeLeft = Math.max(0, theGray.userData.stunTimer).toFixed(1);
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ffff00';
    ctx.textAlign = 'center';
    ctx.fillText(timeLeft, 64, 48);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1, 0.5, 1);
    sprite.position.set(0, 2.2, 0);
    theGray.add(sprite);
    theGray.userData.stunCounterMesh = sprite;
}

function updateTheGray(delta) {
    if (typeof window.controls === 'undefined' || typeof window.objects === 'undefined' || typeof THREE === 'undefined') return;

    const playerPosition = window.controls.getObject().position;
    const AVOIDANCE_RADIUS_SQ = AVOIDANCE_RADIUS * AVOIDANCE_RADIUS;
    const SEPARATION_RADIUS_SQ = SEPARATION_RADIUS * SEPARATION_RADIUS;
    const ATTENTION_RANGE_SQ = ATTENTION_RANGE * ATTENTION_RANGE;

    window.objects.forEach(object => {
        if (object.userData && object.userData.isTheGray && object.userData.health > 0) {

            if (object.userData.isSubdued || object.userData.isPatchPlaced) {
                if (object.userData.isSubdued) object.material.color.setHex(0x556B2F); // Dark Olive - fully subdued for next game step
                else if (object.userData.isPatchPlaced) object.material.color.setHex(0xFFFF00); // Yellow - patch on, ready for minigame
                // Make sure stun counter is hidden if patch is placed or subdued
                if (object.userData.stunCounterMesh) updateStunCounterMesh(object);
                return; // Immobile
            }

            if (object.userData.isStunned) {
                if (!object.userData.isBeingSubdued) { // Stun timer pauses if being subdued by E-hold
                    object.userData.stunTimer -= delta;
                }
                updateStunCounterMesh(object); // This will show/update the counter
                if (object.userData.stunTimer <= 0 && !object.userData.isBeingSubdued) {
                    if (typeof window.debugLog === 'function') window.debugLog(object.name, "is no longer stunned.");
                    object.userData.isStunned = false;
                    object.material.color.copy(object.userData.originalColor);
                    updateStunCounterMesh(object); // This will remove the counter
                    setTimeout(() => { addRandomHitPoint(object); }, 100); // Respawn hit point
                }
                return; // Skip AI movement/turning if stunned
            }

            const grayPosition = object.position;
            const distanceToPlayerSq = grayPosition.distanceToSquared(playerPosition);

            if (distanceToPlayerSq < ATTENTION_RANGE_SQ) {
                if (object.userData.aiState === 'idle' && typeof window.debugLog === 'function') {
                    window.debugLog(object.name, "sees player! Switching to ALERT.");
                }
                object.userData.aiState = 'alert';
                object.userData.alertTimer = ALERT_DURATION;
            } else {
                if (object.userData.aiState === 'alert') {
                    object.userData.alertTimer -= delta;
                    if (object.userData.alertTimer <= 0) {
                        if (typeof window.debugLog === 'function') window.debugLog(object.name, "lost player. Switching to IDLE.");
                        object.userData.aiState = 'idle';
                        object.userData.idleTarget = null;
                    }
                }
            }

            let targetPosition;
            let currentSpeed = object.userData.speed;
            let seekTarget = null;

            if (object.userData.aiState === 'alert') {
                targetPosition = playerPosition;
                currentSpeed = object.userData.speed;
                if (distanceToPlayerSq > 2 * 2) seekTarget = playerPosition;
            } else { // 'idle' state
                object.userData.idleMoveTimer -= delta;
                if (object.userData.idleTarget === null || object.userData.idleMoveTimer <= 0) {
                    pickNewIdleTarget(object);
                }
                targetPosition = object.userData.idleTarget;
                currentSpeed = object.userData.speed * IDLE_SPEED_MULTIPLIER;
                if (object.userData.idleTarget && grayPosition.distanceToSquared(object.userData.idleTarget) > 1 * 1) {
                    seekTarget = object.userData.idleTarget;
                } else {
                     object.userData.idleTarget = null; // Reached target
                }
            }

            const seekForce = new THREE.Vector3(0, 0, 0);
            if (seekTarget) {
                 seekForce.subVectors(seekTarget, grayPosition).normalize();
            }

            const avoidanceForce = new THREE.Vector3(0, 0, 0);
            const separationForce = new THREE.Vector3(0, 0, 0);

            window.objects.forEach(otherObject => {
                if (object !== otherObject) {
                    const distSq = grayPosition.distanceToSquared(otherObject.position);
                    const vecFromOther = new THREE.Vector3().subVectors(grayPosition, otherObject.position);
                    vecFromOther.y = 0;
                    if (otherObject.userData && otherObject.userData.isTheGray && otherObject.userData.health > 0 && !otherObject.userData.isStunned && !otherObject.userData.isSubdued && !otherObject.userData.isPatchPlaced) {
                        if (distSq < SEPARATION_RADIUS_SQ && distSq > 0.01) {
                            const distance = Math.sqrt(distSq);
                            const strength = (SEPARATION_RADIUS - distance) / SEPARATION_RADIUS;
                            separationForce.add(vecFromOther.normalize().multiplyScalar(strength * SEPARATION_STRENGTH));
                        }
                    } else if (!(otherObject.userData && otherObject.userData.isTheGray) && otherObject.name !== "GroundPlane" && !(otherObject.userData && otherObject.userData.isHitPoint) && !(otherObject.userData && otherObject.userData.isSubdueRect)) {
                         if (distSq < AVOIDANCE_RADIUS_SQ && distSq > 0.01) {
                            const distance = Math.sqrt(distSq);
                            const strength = (AVOIDANCE_RADIUS - distance) / AVOIDANCE_RADIUS;
                            avoidanceForce.add(vecFromOther.normalize().multiplyScalar(strength * AVOIDANCE_STRENGTH));
                        }
                    }
                }
            });

            const totalForce = new THREE.Vector3().add(seekForce).add(avoidanceForce).add(separationForce);
            totalForce.y = 0;

            if (totalForce.lengthSq() > 0.001) {
                totalForce.normalize();
                const moveAmount = currentSpeed * delta;
                object.position.x += totalForce.x * moveAmount;
                object.position.z += totalForce.z * moveAmount;
            }

            if (object.userData.aiState === 'alert') {
                 object.userData.turnTimer -= delta;
                 if (object.userData.turnTimer <= 0) {
                    object.lookAt(playerPosition.x, object.position.y, playerPosition.z);
                    object.userData.turnTimer = THE_GRAY_TURN_DELAY * (0.8 + Math.random() * 0.4);
                 }
            } else { // Idle turning
                 if (totalForce.lengthSq() > 0.001) { // Look where it's going
                     const lookTarget = new THREE.Vector3().addVectors(object.position, totalForce);
                     object.lookAt(lookTarget.x, object.position.y, lookTarget.z);
                 }
            }
        }
    });
}

window.createTheGray = createTheGray;
window.updateTheGray = updateTheGray;
window.updateStunCounterMesh = updateStunCounterMesh;