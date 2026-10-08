// game_state.js - Sandbox stats, player health, death, cure attempt tracking

const PLAYER_MAX_HEALTH = 100;
const BASE_HEAL_RADIUS = 12;
const BASE_HEAL_RATE = 12;

let playerHealth = PLAYER_MAX_HEALTH;
let isPlayerDead = false;
let hostsHealed = 0;
let buildingsCompleted = 0;
let failedCureAttempts = 0;

// Expose early so classic scripts / animate loop never read undefined before initGameState().
window.playerHealth = playerHealth;
window.isPlayerDead = isPlayerDead;

function initGameState() {
    playerHealth = PLAYER_MAX_HEALTH;
    isPlayerDead = false;
    hostsHealed = 0;
    buildingsCompleted = 0;
    failedCureAttempts = 0;
    window.playerHealth = playerHealth;
    window.isPlayerDead = isPlayerDead;
    syncHUD();
}

function syncHUD() {
    if (typeof window.updateHUD === 'function') {
        window.updateHUD(
            playerHealth,
            hostsHealed,
            window.playerInventory ? window.playerInventory.wood : 0,
            window.playerInventory ? window.playerInventory.stone : 0,
            buildingsCompleted
        );
    }
}

function damagePlayer(amount, source) {
    if (isPlayerDead || amount <= 0) return;
    playerHealth = Math.max(0, playerHealth - amount);
    window.playerHealth = playerHealth;
    syncHUD();
    if (playerHealth <= 0) {
        onPlayerDeath(source || 'unknown');
    }
}

function healPlayer(amount) {
    if (isPlayerDead || amount <= 0) return;
    playerHealth = Math.min(PLAYER_MAX_HEALTH, playerHealth + amount);
    window.playerHealth = playerHealth;
    syncHUD();
}

function registerBuildingCompleted(type) {
    buildingsCompleted += 1;
    syncHUD();
    if (typeof window.onBuildingCompleted === 'function') {
        window.onBuildingCompleted(type);
    }
}

function registerHostHealed() {
    hostsHealed += 1;
    syncHUD();
    if (typeof window.debugLog === 'function') {
        window.debugLog('Host fully recovered at base. Total healed:', hostsHealed);
    }
}

function registerCureFailure() {
    failedCureAttempts += 1;
    syncHUD();
}

function onPlayerDeath(source) {
    isPlayerDead = true;
    window.isPlayerDead = true;
    if (window.controls) window.controls.unlock();
    document.body.classList.remove('pointer-lock-active');
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
        deathScreen.style.display = 'flex';
        const statsEl = document.getElementById('death-stats');
        if (statsEl) {
            statsEl.textContent = `Hosts healed: ${hostsHealed} | Buildings: ${buildingsCompleted} | Failed cures: ${failedCureAttempts}`;
        }
    }
}

function restartGame() {
    window.location.reload();
}

function updateBaseHealing(delta) {
    if (isPlayerDead || !window.controls || typeof window.BaseBuilding === 'undefined') return;
    const mainBase = window.BaseBuilding.getMainBase ? window.BaseBuilding.getMainBase() : null;
    if (!mainBase) return;

    const playerPos = window.controls.getObject().position;
    const dist = playerPos.distanceTo(mainBase.position);
    if (dist <= BASE_HEAL_RADIUS) {
        healPlayer(BASE_HEAL_RATE * delta);
    }
}

function getSandboxStats() {
    return { hostsHealed, buildingsCompleted, failedCureAttempts, playerHealth };
}

window.initGameState = initGameState;
window.damagePlayer = damagePlayer;
window.healPlayer = healPlayer;
window.registerBuildingCompleted = registerBuildingCompleted;
window.registerHostHealed = registerHostHealed;
window.registerCureFailure = registerCureFailure;
window.updateBaseHealing = updateBaseHealing;
window.getSandboxStats = getSandboxStats;
window.restartGame = restartGame;
window.PLAYER_MAX_HEALTH = PLAYER_MAX_HEALTH;
