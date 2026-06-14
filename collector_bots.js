// collector_bots.js - Programmatic wood/stone collector units

const BOT_SPEED = 4;
const BOT_COLLECT_RANGE = 2;
const BOT_DEPOSIT_RANGE = 3;
const BOT_CARRY_CAPACITY = 10;
const BOT_SEARCH_RADIUS = 120;

const bots = [];

function createCollectorBot(position, type) {
    if (typeof THREE === 'undefined' || !window.scene || !window.objects) return null;

    const color = type === 'wood' ? 0x8B6914 : 0x708090;
    const geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color });
    const bot = new THREE.Mesh(geo, mat);
    bot.position.copy(position);
    bot.position.y = 0.6;
    bot.castShadow = true;
    bot.name = `CollectorBot_${type}_${Math.random().toString(36).substr(2, 4)}`;
    bot.userData = {
        isCollectorBot: true,
        isControllableUnit: true,
        collectorType: type,
        state: 'idle',
        cargo: 0,
        targetPos: null,
        targetResource: null,
        homeBuilding: null,
        moveCommand: null
    };

    window.scene.add(bot);
    window.objects.push(bot);
    bots.push(bot);

    if (typeof window.UnitControl !== 'undefined' && window.UnitControl.registerUnit) {
        window.UnitControl.registerUnit(bot);
    }
    return bot;
}

function _findNearestResource(bot, type) {
    let best = null;
    let bestDist = BOT_SEARCH_RADIUS * BOT_SEARCH_RADIUS;
    const pos = bot.position;

    window.objects.forEach(obj => {
        if (!obj.userData) return;
        if (type === 'wood' && obj.userData.isResource && obj.userData.type === 'wood') {
            const d = pos.distanceToSquared(obj.position);
            if (d < bestDist) { bestDist = d; best = obj; }
        }
        if (type === 'stone' && obj.userData.isBoulder && obj.userData.health > 0) {
            const d = pos.distanceToSquared(obj.position);
            if (d < bestDist) { bestDist = d; best = obj; }
        }
        if (type === 'wood' && obj.userData.isTree && obj.userData.health > 0) {
            const d = pos.distanceToSquared(obj.position);
            if (d < bestDist) { bestDist = d; best = obj; }
        }
    });
    return best;
}

function _findHomeBuilding(type) {
    const want = type === 'wood' ? 'wood_collector' : 'stone_collector';
    let best = null;
    window.objects.forEach(obj => {
        if (obj.userData && obj.userData.isComplete && obj.userData.blueprintType === want) {
            best = obj;
        }
    });
    return best;
}

function _moveToward(bot, target, delta, speed) {
    const dir = new THREE.Vector3().subVectors(target, bot.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.3) return true;
    dir.normalize();
    bot.position.x += dir.x * speed * delta;
    bot.position.z += dir.z * speed * delta;
    bot.lookAt(target.x, bot.position.y, target.z);
    return false;
}

function updateCollectorBots(delta) {
    bots.forEach(bot => {
        if (!bot.parent || !bot.userData.isCollectorBot) return;
        const ud = bot.userData;
        const type = ud.collectorType;

        if (ud.moveCommand) {
            if (_moveToward(bot, ud.moveCommand, delta, BOT_SPEED)) {
                ud.moveCommand = null;
                ud.state = 'idle';
            }
            return;
        }

        if (!ud.homeBuilding || !ud.homeBuilding.parent) {
            ud.homeBuilding = _findHomeBuilding(type);
        }

        switch (ud.state) {
            case 'idle':
                ud.targetResource = _findNearestResource(bot, type);
                if (ud.targetResource) ud.state = 'collecting';
                break;

            case 'collecting':
                if (!ud.targetResource || !ud.targetResource.parent) {
                    ud.state = 'idle';
                    break;
                }
                if (_moveToward(bot, ud.targetResource.position, delta, BOT_SPEED)) {
                    if (type === 'wood') {
                        if (ud.targetResource.userData.isResource) {
                            ud.cargo += ud.targetResource.userData.value || 1;
                            window.scene.remove(ud.targetResource);
                            const idx = window.objects.indexOf(ud.targetResource);
                            if (idx > -1) window.objects.splice(idx, 1);
                        } else if (ud.targetResource.userData.isTree && window.Trees) {
                            window.Trees.damageTree(ud.targetResource, 999);
                            ud.cargo += 5;
                        }
                    } else if (type === 'stone' && ud.targetResource.userData.isBoulder && window.Boulders) {
                        window.Boulders.damageBoulder(ud.targetResource);
                        ud.cargo += 5;
                    }
                    ud.targetResource = null;
                    if (ud.cargo >= BOT_CARRY_CAPACITY) ud.state = 'returning';
                    else ud.state = 'idle';
                }
                break;

            case 'returning':
                if (!ud.homeBuilding) { ud.state = 'idle'; break; }
                if (_moveToward(bot, ud.homeBuilding.position, delta, BOT_SPEED)) {
                    if (window.playerInventory) {
                        if (type === 'wood') {
                            window.playerInventory.wood += ud.cargo;
                        } else {
                            window.playerInventory.stone += ud.cargo;
                        }
                        if (typeof window.updateHUD === 'function') {
                            window.updateHUD(null, null, window.playerInventory.wood, window.playerInventory.stone, null);
                        }
                    }
                    ud.cargo = 0;
                    ud.state = 'idle';
                }
                break;
        }
    });
}

function getCollectorBots() {
    return bots;
}

window.createCollectorBot = createCollectorBot;
window.updateCollectorBots = updateCollectorBots;
window.getCollectorBots = getCollectorBots;
