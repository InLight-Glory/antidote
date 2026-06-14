// build_menu.js

let buildMenuElement;
let selectedBlueprintType = null;

export function initBuildMenu() {
    buildMenuElement = document.getElementById('build-menu');

    // Add event listeners to all menu buttons
    const menuButtons = buildMenuElement.querySelectorAll('.menu-button');
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
    if (buildMenuElement) {
        buildMenuElement.style.display = 'flex';
        // Clear any previous selection when showing the menu
        clearSelectedBlueprintType();
        const menuButtons = buildMenuElement.querySelectorAll('.menu-button');
        menuButtons.forEach(btn => btn.classList.remove('selected'));
    }
}

export function hideMenu() {
    if (buildMenuElement) {
        buildMenuElement.style.display = 'none';
    }
}

export function toggleMenu() {
    if (buildMenuElement) {
        if (buildMenuElement.style.display === 'flex') {
            hideMenu();
        } else {
            showMenu();
        }
    }
}

export function getSelectedBlueprintType() {
    return selectedBlueprintType;
}

export function clearSelectedBlueprintType() {
    selectedBlueprintType = null;
}
