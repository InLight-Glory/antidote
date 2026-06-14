// radial_menu.js

let radialMenuContainer;
let currentMenu = null; // Tracks the currently displayed menu (main or submenu)
let selectedCallback = null; // Callback function to return the selected item

const MENU_RADIUS = 100; // Radius for main menu items
const SUBMENU_RADIUS = 75; // Radius for submenu items

const menuStructure = {
    "General": {
        "Base": "base"
    },
    "Bots": {
        "Collectors": {
            "Wood Collector": "wood_collector",
            "Stone Collector": "stone_collector"
        },
        "Protectors": {
            "Light Protector": "light_protector",
            "Medium Protector": "medium_protector",
            "Heavy Protector": "heavy_protector"
        },
        "Inspectors": {
            "Explore Inspector": "explore_inspector",
            "Alert Inspector": "alert_inspector"
        }
    }
};

export function initRadialMenu() {
    radialMenuContainer = document.createElement('div');
    radialMenuContainer.id = 'radial-menu-container';
    document.body.appendChild(radialMenuContainer);

    // Close menu if clicking outside
    radialMenuContainer.addEventListener('click', (event) => {
        if (event.target === radialMenuContainer) {
            hideRadialMenu();
        }
    });
}

export function showRadialMenu(x, y, callback) {
    if (!radialMenuContainer) initRadialMenu(); // Ensure initialized

    selectedCallback = callback;
    radialMenuContainer.classList.add('active');

    createMenu(menuStructure, MENU_RADIUS, radialMenuContainer, 'radial-menu', x, y);
}

export function hideRadialMenu() {
    if (radialMenuContainer) {
        radialMenuContainer.classList.remove('active');
        radialMenuContainer.innerHTML = ''; // Clear menu items
        currentMenu = null;
        selectedCallback = null;
    }
}

function createMenu(data, radius, parentElement, className, x, y) {
    parentElement.innerHTML = ''; // Clear existing items
    const menuDiv = document.createElement('div');
    menuDiv.className = className;
    menuDiv.classList.add('open');
    if (x !== undefined && y !== undefined) {
        menuDiv.style.left = `${x}px`;
        menuDiv.style.top = `${y}px`;
        menuDiv.style.transform = 'translate(-50%, -50%)'; // Center the menu on the coordinates
    }
    parentElement.appendChild(menuDiv);
    currentMenu = menuDiv;

    const items = Object.keys(data);
    const angleStep = (Math.PI * 2) / items.length;

    items.forEach((key, index) => {
        const angle = index * angleStep;
        const itemX = radius * Math.cos(angle);
        const itemY = radius * Math.sin(angle);

        const itemDiv = document.createElement('div');
        itemDiv.className = `${className}-item`;
        itemDiv.textContent = key;
        // Position items within the circular menu div
        itemDiv.style.left = `calc(50% + ${itemX}px)`;
        itemDiv.style.top = `calc(50% + ${itemY}px)`;
        itemDiv.style.transform = `translate(-50%, -50%)`; // Center the item

        itemDiv.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from closing menu
            handleMenuItemClick(key, data[key]);
        });
        menuDiv.appendChild(itemDiv);
    });
}

function handleMenuItemClick(key, value) {
    if (typeof value === 'string') { // It's a blueprint type
        if (selectedCallback) {
            selectedCallback(value);
        }
        hideRadialMenu();
    } else { // It's a submenu
        // Clear current menu and create submenu
        currentMenu.innerHTML = '';
        // Re-use the same div for the submenu, it's already positioned.
        createMenu(value, SUBMENU_RADIUS, currentMenu, 'radial-submenu');
    }
}
