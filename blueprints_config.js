// blueprints_config.js - Central configuration for all buildable items

export const BLUEPRINT_CONFIG = {
    'base': {
        name: 'Base',
        requiredWood: 25,
        requiredStone: 10, // Updated to 10 as requested
        width: 10,
        height: 5,
        depth: 10,
    },
    'wood_collector': {
        name: 'Wood Collector',
        requiredWood: 50,
        requiredStone: 25,
        width: 2,
        height: 3,
        depth: 2,
    },
    'stone_collector': {
        name: 'Stone Collector',
        requiredWood: 25,
        requiredStone: 50,
        width: 2,
        height: 3,
        depth: 2,
    },
    'explore_inspector': {
        name: 'Explore Inspector',
        requiredWood: 30,
        requiredStone: 15,
        width: 1.5,
        height: 2.5,
        depth: 1.5,
    },
    'alert_inspector': {
        name: 'Alert Inspector',
        requiredWood: 20,
        requiredStone: 40,
        width: 2,
        height: 4,
        depth: 2,
    },
    'light_protector': {
        name: 'Light Protector',
        requiredWood: 40,
        requiredStone: 40,
        width: 2,
        height: 2.5,
        depth: 2,
    },
    'medium_protector': {
        name: 'Medium Protector',
        requiredWood: 80,
        requiredStone: 80,
        width: 2.5,
        height: 3.5,
        depth: 2.5,
    },
    'heavy_protector': {
        name: 'Heavy Protector',
        requiredWood: 150,
        requiredStone: 150,
        width: 3,
        height: 4.5,
        depth: 3,
    },
    // Add other blueprint configs here as they are created
};