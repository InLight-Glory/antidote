// Antidote - main.js - Orchestrator
console.log("main.js: Script started");

// --- CONFIGURABLE VARIABLES (Game-Wide) ---
const CAMERA_FOV = 75;
const CAMERA_NEAR_PLANE = 0.1;
const CAMERA_FAR_PLANE = 1000;
const CUBE_HEALTH = 100;
const SHOOT_DAMAGE = 25;
const PARTICLE_COUNT = 15;
const PARTICLE_LIFETIME = 1.5;
const STUN_DURATION = 11.0;
const DEV_SPAWN_DISTANCE = 20.0;
const MAP_CAMERA_HEIGHT = 150; // NEW: Height for map camera
const MAP_VIEW_SIZE = 100; // NEW: How much area map camera sees

// --- CORE THREE.JS COMPONENTS ---
let scene, camera, renderer;
let mapCamera; // NEW: Map camera
let activeCamera; // NEW: Track the currently active camera
let clock;

// --- GAME OBJECTS ---
let ground;
const objects = [];
const particles = [];

// --- UI ELEMENTS ---
let debugPositionElement;
let debugControlsLockElement;
let debugPanel;

// --- GAME STATE ---
let isMapViewActive = false; // NEW: Track map view state
window.isMapViewActive = isMapViewActive; // NEW: Export for player.js

// --- LOGGING TOGGLE ---
let enableDebugLogs = true;
function debugLog(...args) {
    if (enableDebugLogs) console.log(...args);
}
window.debugLog = debugLog;
window.enableDebugLogs = enableDebugLogs;

document.addEventListener('keydown', (event) => {
    if (event.code === 'Backquote') {
        enableDebugLogs = !enableDebugLogs;
        window.enableDebugLogs = enableDebugLogs;
        console.log('Debug logs ' + (enableDebugLogs ? 'ENABLED' : 'DISABLED'));
        if (debugPanel) debugPanel.style.display = enableDebugLogs ? 'block' : 'none';
    }
});

// --- MODULE IMPORTS/WIRING ---
import * as Collisions from './collisions.js';
window.Collisions = Collisions;
import * as Level1 from './Level1.js';
window.Level1 = Level1;

// --- INITIALIZATION ---
function init() {
    debugLog("main.js: init() - Initializing Antidote...");
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, 500);
    window.scene = scene;

    // --- FPS Camera ---
    camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR_PLANE, CAMERA_FAR_PLANE);
    window.camera = camera;

    // --- Map Camera (Orthographic) --- // NEW
    const aspect = window.innerWidth / window.innerHeight;
    mapCamera = new THREE.OrthographicCamera(
        -MAP_VIEW_SIZE * aspect / 2, MAP_VIEW_SIZE * aspect / 2,
        MAP_VIEW_SIZE / 2, -MAP_VIEW_SIZE / 2,
        1, MAP_CAMERA_HEIGHT + 100 // Near, Far
    );
    mapCamera.position.y = MAP_CAMERA_HEIGHT;
    mapCamera.lookAt(0, 0, 0); // Initially look at origin, will follow player
    scene.add(mapCamera); // Add to scene so it's part of the graph

    activeCamera = camera; // Start with FPS camera

    try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(renderer.domElement);
    } catch (e) { console.error("main.js: Failed to initialize WebGLRenderer.", e); return; }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 75); directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const groundGeometry = new THREE.PlaneGeometry(1000, 1000, 100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.9, metalness: 0.1 });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = "GroundPlane";
    scene.add(ground);

    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xffA500 });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(5, 1, -10); cube.castShadow = true; cube.receiveShadow = true;
    cube.name = "TestCubeOrange";
    cube.userData = { health: CUBE_HEALTH, maxHealth: CUBE_HEALTH, isDestructible: true, originalColor: cubeMaterial.color.clone() };
    scene.add(cube); objects.push(cube);

    const cube2 = new THREE.Mesh(cubeGeometry, cubeMaterial.clone());
    cube2.material.color.setHex(0x0000ff);
    cube2.position.set(-5, 1, -12); cube2.castShadow = true; cube2.receiveShadow = true;
    cube2.name = "TestCubeBlue";
    cube2.userData = { health: CUBE_HEALTH, maxHealth: CUBE_HEALTH, isDestructible: true, originalColor: cube2.material.color.clone() };
    scene.add(cube2); objects.push(cube2);
    window.objects = objects;

    debugPositionElement = document.getElementById('debug-position');
    debugControlsLockElement = document.getElementById('debug-controls-locked');
    debugPanel = document.getElementById('debug-panel');

    if (typeof window.initPlayer === 'function') {
        window.initPlayer(camera, scene);
    } else { console.error("Player module (initPlayer) not found!"); }

    if (typeof window.initCuringMechanic === 'function') {
        window.initCuringMechanic();
    } else { console.error("Curing Mechanic module (initCuringMechanic) not found!"); }

    if (window.Level1 && typeof window.Level1.setupLevel1 === 'function') {
        window.Level1.setupLevel1(scene, window.objects);
    }

    if (typeof window.startTestSpawn === 'function') {
        window.startTestSpawn();
    } else { console.warn("Spawner test function (startTestSpawn) not found."); }

    window.addEventListener('resize', onWindowResize);

    if (debugPanel) debugPanel.style.display = enableDebugLogs ? 'block' : 'none';
    animate();
}

// --- MAP TOGGLE FUNCTION --- // NEW
function toggleMapView() {
    isMapViewActive = !isMapViewActive;
    window.isMapViewActive = isMapViewActive; // Update global flag
    debugLog("Map View Toggled:", isMapViewActive);

    if (isMapViewActive) {
        // Switch to Map View
        activeCamera = mapCamera;
        if(window.controls) window.controls.unlock(); // Ensure controls are unlocked
        document.body.classList.remove('pointer-lock-active'); // Ensure cursor is visible
        // We will update map camera position in animate loop
    } else {
        // Switch to FPS View
        activeCamera = camera;
        if(window.controls) window.controls.lock(); // Try to lock controls
        // Note: PointerLockControls.lock() requires user interaction,
        // it might not lock immediately, but player.js handles clicks.
    }
}
window.toggleMapView = toggleMapView; // Export for player.js


// --- DEV TOOL ---
// ... (No changes here)
function devSpawnTheGrayNearPlayer() {
    if (!window.controls || !window.createTheGray) {
        debugLog("Dev Spawn: Controls or createTheGray not ready."); return;
    }
    const playerPosition = window.controls.getObject().position;
    const randomAngle = Math.random() * Math.PI * 2;
    const spawnX = playerPosition.x + Math.cos(randomAngle) * DEV_SPAWN_DISTANCE;
    const spawnZ = playerPosition.z + Math.sin(randomAngle) * DEV_SPAWN_DISTANCE;
    const spawnPosition = new THREE.Vector3(spawnX, 0.9, spawnZ);
    debugLog("Dev Spawn: Attempting to spawn The-Gray at", spawnPosition);
    window.createTheGray(spawnPosition);
}
window.devSpawnTheGrayNearPlayer = devSpawnTheGrayNearPlayer;

// --- THE-GRAY REMOVAL UTILITY ---
// ... (No changes here)
function removeTheGray(theGrayInstance) {
    if (!theGrayInstance || !theGrayInstance.userData || !theGrayInstance.userData.isTheGray) {
        debugLog("Attempted to remove an invalid The-Gray instance."); return;
    }
    debugLog("Removing The-Gray:", theGrayInstance.name);
    if (theGrayInstance.userData.hitPoints && Array.isArray(theGrayInstance.userData.hitPoints)) {
        [...theGrayInstance.userData.hitPoints].forEach(hp => {
            if (hp.geometry) hp.geometry.dispose();
            if (hp.material) hp.material.dispose();
            theGrayInstance.remove(hp);
        });
        theGrayInstance.userData.hitPoints = [];
    }
    if (theGrayInstance.userData.stunCounterMesh) {
        const scm = theGrayInstance.userData.stunCounterMesh;
        if (scm.material && scm.material.map) scm.material.map.dispose();
        if (scm.material) scm.material.dispose();
        theGrayInstance.remove(scm);
        theGrayInstance.userData.stunCounterMesh = null;
    }
    if (theGrayInstance.userData.subdueRectangle) { // Patch mesh
        const sr = theGrayInstance.userData.subdueRectangle;
        if (sr.geometry) sr.geometry.dispose();
        if (sr.material) sr.material.dispose();
        theGrayInstance.remove(sr);
        theGrayInstance.userData.subdueRectangle = null;
    }

    if (theGrayInstance.geometry) theGrayInstance.geometry.dispose();
    if (theGrayInstance.material) theGrayInstance.material.dispose();
    scene.remove(theGrayInstance);
    const index = objects.indexOf(theGrayInstance);
    if (index > -1) objects.splice(index, 1);
}
window.removeTheGray = removeTheGray;


// --- SPAWN NOTIFICATION ---
function showTheGraySpawnNotification() { /* ... */ }
window.showTheGraySpawnNotification = showTheGraySpawnNotification;

// --- PARTICLES ---
// ... (No changes here)
function updateParticles(delta) {
    const grav = (typeof window.GRAVITY !== 'undefined') ? window.GRAVITY : -19.6; // Get from player.js
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= delta;
        if (p.userData.life <= 0) {
            if(p.geometry) p.geometry.dispose();
            if(p.material) p.material.dispose();
            scene.remove(p);
            particles.splice(i, 1);
        } else {
            p.userData.velocity.y += grav * 0.5 * delta;
            p.position.addScaledVector(p.userData.velocity, delta);
            if(p.material && typeof p.material.opacity !== 'undefined') {
                p.material.opacity = Math.max(0, p.userData.life / PARTICLE_LIFETIME);
            }
        }
    }
}

// --- WINDOW ---
function onWindowResize() {
    if (!camera || !mapCamera || !renderer) return; // UPDATED Check both cameras
    const aspect = window.innerWidth / window.innerHeight;

    // Update FPS Camera
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    // Update Map Camera
    mapCamera.left = -MAP_VIEW_SIZE * aspect / 2;
    mapCamera.right = MAP_VIEW_SIZE * aspect / 2;
    mapCamera.top = MAP_VIEW_SIZE / 2;
    mapCamera.bottom = -MAP_VIEW_SIZE / 2;
    mapCamera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- ANIMATE ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    const canUpdatePlayer = window.controls && window.controls.isLocked && !isMapViewActive;

    if (canUpdatePlayer) {
        if (typeof window.updatePlayer === 'function') window.updatePlayer(delta);
    }

    // Update these even if map is open or controls unlocked, but maybe not if paused (future)
    if (typeof window.updateTheGray === 'function') window.updateTheGray(delta);
    if (typeof window.updateCuringMechanic === 'function') window.updateCuringMechanic(delta);
    if (typeof window.updateSpawner === 'function') window.updateSpawner(delta);

    updateParticles(delta);

    // Update map camera position if active
    if (isMapViewActive && window.controls) {
        const playerPos = window.controls.getObject().position;
        mapCamera.position.x = playerPos.x;
        mapCamera.position.z = playerPos.z;
        mapCamera.lookAt(playerPos.x, 0, playerPos.z);
        mapCamera.updateProjectionMatrix(); // Might be needed if changing lookAt/pos often
    }


    if (scene && activeCamera && renderer) renderer.render(scene, activeCamera); // UPDATED use activeCamera

    // Update Debug Info
    if (debugPositionElement && window.controls) { // Show position even if locked/map
        const pos = window.controls.getObject().position;
        debugPositionElement.textContent = `X:${pos.x.toFixed(2)}, Y:${pos.y.toFixed(2)}, Z:${pos.z.toFixed(2)}`;
    }
    if (debugControlsLockElement && window.controls) {
         debugControlsLockElement.textContent = window.controls.isLocked ? 'true' : 'false';
    }
}

// --- START ---
document.addEventListener('DOMContentLoaded', init);