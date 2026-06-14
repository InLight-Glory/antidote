document.addEventListener('DOMContentLoaded', () => {
    const uiOverlay = document.getElementById('ui-overlay');

    const hudContainer = document.createElement('div');
    hudContainer.id = 'hud-container';
    hudContainer.style.position = 'absolute';
    hudContainer.style.top = '20px';
    hudContainer.style.right = '20px';
    hudContainer.style.background = 'rgba(0,0,0,0.6)';
    hudContainer.style.color = '#fff';
    hudContainer.style.padding = '12px 24px';
    hudContainer.style.borderRadius = '8px';
    hudContainer.style.fontSize = '1rem';
    hudContainer.style.zIndex = '1000';
    hudContainer.style.lineHeight = '1.6';
    hudContainer.style.textAlign = 'right';

    const healthDiv = document.createElement('div');
    healthDiv.id = 'hud-health';
    healthDiv.textContent = 'Health: 100';

    const hostsDiv = document.createElement('div');
    hostsDiv.id = 'hud-hosts';
    hostsDiv.textContent = 'Hosts healed: 0';

    const buildingsDiv = document.createElement('div');
    buildingsDiv.id = 'hud-buildings';
    buildingsDiv.textContent = 'Buildings: 0';

    const woodDiv = document.createElement('div');
    woodDiv.id = 'hud-wood';
    woodDiv.textContent = 'Wood: 0';

    const stoneDiv = document.createElement('div');
    stoneDiv.id = 'hud-stone';
    stoneDiv.textContent = 'Stone: 0';

    hudContainer.appendChild(healthDiv);
    hudContainer.appendChild(hostsDiv);
    hudContainer.appendChild(buildingsDiv);
    hudContainer.appendChild(woodDiv);
    hudContainer.appendChild(stoneDiv);
    uiOverlay.appendChild(hudContainer);

    window.updateHUD = (health, hostsHealed, wood, stone, buildings) => {
        if (health !== null && health !== undefined) healthDiv.textContent = `Health: ${Math.ceil(health)}`;
        if (hostsHealed !== null && hostsHealed !== undefined) hostsDiv.textContent = `Hosts healed: ${hostsHealed}`;
        if (buildings !== null && buildings !== undefined) buildingsDiv.textContent = `Buildings: ${buildings}`;
        if (wood !== null && wood !== undefined) woodDiv.textContent = `Wood: ${wood}`;
        if (stone !== null && stone !== undefined) stoneDiv.textContent = `Stone: ${stone}`;
    };
});
