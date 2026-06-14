// darkgrey.js - Parasite swarms spawned during Protect phase (antidote spreading)

const DARK_GREY_SPEED = 4.5;
const DARK_GREY_HEALTH = 30;
const DARK_GREY_DAMAGE = 6;
const DARK_GREY_CONTACT_RANGE = 1.2;
const SWARM_WAVE_COUNT = 3;
const SWARM_PER_WAVE = 12;
const SWARM_SPAWN_RADIUS = 35;

const activeSwarms = [];

function createDarkGrey(position) {
    if (typeof THREE === 'undefined' || !window.scene || !window.objects) return null;

    const geo = new THREE.SphereGeometry(0.25, 6, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const dg = new THREE.Mesh(geo, mat);
    dg.position.copy(position);
    dg.position.y = 0.5;
    dg.castShadow = true;
    dg.name = 'DarkGrey_' + Math.random().toString(36).substr(2, 5);
    dg.userData = {
        isDarkGrey: true,
        health: DARK_GREY_HEALTH,
        maxHealth: DARK_GREY_HEALTH,
        speed: DARK_GREY_SPEED * (0.85 + Math.random() * 0.3),
        targetGray: null,
        damageCooldown: 0
    };

    window.scene.add(dg);
    window.objects.push(dg);
    return dg;
}

function removeDarkGrey(dg) {
    if (!dg) return;
    const idx = window.objects.indexOf(dg);
    if (idx > -1) window.objects.splice(idx, 1);
    if (dg.geometry) dg.geometry.dispose();
    if (dg.material) dg.material.dispose();
    window.scene.remove(dg);
}

function spawnProtectSwarm(protectCenter, targetGray) {
    if (!protectCenter || !window.createDarkGrey) return;
    if (typeof window.debugLog === 'function') {
        window.debugLog('Dark-Grey SOS swarm triggered at', protectCenter);
    }

    const swarm = { wavesSpawned: 0, timer: 0, interval: 4.0, center: protectCenter.clone(), targetGray, done: false };
    activeSwarms.push(swarm);
    _spawnWave(swarm);
}

function _spawnWave(swarm) {
    if (!swarm.targetGray || !swarm.targetGray.parent) return;

    for (let i = 0; i < SWARM_PER_WAVE; i++) {
        const angle = (Math.PI * 2 * i) / SWARM_PER_WAVE + Math.random() * 0.3;
        const r = SWARM_SPAWN_RADIUS + Math.random() * 10;
        const pos = new THREE.Vector3(
            swarm.center.x + Math.cos(angle) * r,
            0.5,
            swarm.center.z + Math.sin(angle) * r
        );
        const dg = createDarkGrey(pos);
        if (dg) dg.userData.targetGray = swarm.targetGray;
    }
    swarm.wavesSpawned += 1;
}

function darkGreyTakeDamage(dg, damage) {
    if (!dg || !dg.userData) return;
    dg.userData.health -= damage;
    if (dg.material) {
        const pct = Math.max(0, dg.userData.health / dg.userData.maxHealth);
        dg.material.color.setRGB(pct * 0.1, pct * 0.1, pct * 0.1);
    }
    if (dg.userData.health <= 0) removeDarkGrey(dg);
}

function updateDarkGrey(delta) {
    if (!window.controls || !window.objects) return;

    const playerPos = window.controls.getObject().position;

    for (let s = activeSwarms.length - 1; s >= 0; s--) {
        const swarm = activeSwarms[s];
        if (swarm.done) {
            activeSwarms.splice(s, 1);
            continue;
        }
        if (!swarm.targetGray || !swarm.targetGray.parent || !swarm.targetGray.userData.isProtecting) {
            swarm.done = true;
            continue;
        }
        swarm.timer += delta;
        if (swarm.wavesSpawned < SWARM_WAVE_COUNT && swarm.timer >= swarm.interval) {
            swarm.timer = 0;
            _spawnWave(swarm);
            if (swarm.wavesSpawned >= SWARM_WAVE_COUNT) swarm.done = true;
        }
    }

    window.objects.forEach(obj => {
        if (!obj.userData || !obj.userData.isDarkGrey) return;

        obj.userData.damageCooldown = Math.max(0, obj.userData.damageCooldown - delta);

        let target = playerPos;
        if (obj.userData.targetGray && obj.userData.targetGray.parent) {
            target = obj.userData.targetGray.position;
        }

        const dir = new THREE.Vector3().subVectors(target, obj.position);
        dir.y = 0;
        if (dir.lengthSq() > 0.01) {
            dir.normalize();
            obj.position.x += dir.x * obj.userData.speed * delta;
            obj.position.z += dir.z * obj.userData.speed * delta;
        }

        if (obj.userData.damageCooldown <= 0) {
            const distPlayer = obj.position.distanceTo(playerPos);
            if (distPlayer < DARK_GREY_CONTACT_RANGE && typeof window.damagePlayer === 'function') {
                window.damagePlayer(DARK_GREY_DAMAGE, 'dark-grey');
                obj.userData.damageCooldown = 0.5;
            }
        }
    });
}

function clearSwarmsForGray(gray) {
    for (let i = activeSwarms.length - 1; i >= 0; i--) {
        if (activeSwarms[i].targetGray === gray) activeSwarms[i].done = true;
    }
}

window.createDarkGrey = createDarkGrey;
window.updateDarkGrey = updateDarkGrey;
window.spawnProtectSwarm = spawnProtectSwarm;
window.darkGreyTakeDamage = darkGreyTakeDamage;
window.clearSwarmsForGray = clearSwarmsForGray;
