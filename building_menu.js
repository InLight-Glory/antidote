// building_menu.js

let buildingMenuElement;
let selectedBlueprintType = null;

export function initBuildingMenu() {
    buildingMenuElement = document.getElementById('building-menu');

    // Add event listeners to all menu buttons
    const menuButtons = buildingMenuElement.querySelectorAll('.menu-button');
    menuButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Clear previous selection
            menuButtons.forEach(btn => btn.classList.remove('selected'));
            // Set new selection
            button.classList.add('selected');
            selectedBlueprintType = button.dataset.blueprintType;
            console.log("Selected blueprint type:", selectedBlueprintType);
            // Optionally, hide menu after selection, or let user close it
            // hideMenu();
        });
    });

    // Close button
    document.getElementById('close-build-menu').addEventListener('click', hideMenu);
}

export function showMenu() {
    if (buildingMenuElement) {
        buildingMenuElement.classList.add('active');
        // Clear any previous selection when showing the menu
        clearSelectedBlueprintType();
        const menuButtons = buildingMenuElement.querySelectorAll('.menu-button');
        menuButtons.forEach(btn => btn.classList.remove('selected'));
    }
}

export function hideMenu() {
    if (buildingMenuElement) {
        buildingMenuElement.classList.remove('active');
    }
}

export function getSelectedBlueprintType() {
    return selectedBlueprintType;
}

export function clearSelectedBlueprintType() {
    selectedBlueprintType = null;
}
