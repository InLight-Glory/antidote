<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Antidote</title>
    <link rel="stylesheet" href="style.css?v=<?php echo time(); ?>">
    </head>
<body>
    <div id="game-container"></div>

    <div id="ui-overlay">
        <div id="crosshair" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background-color: rgba(255,255,255,0.5); border-radius: 50%;"></div>

        <div id="interaction-prompt" style="position: absolute; bottom: 20%; left: 50%; transform: translateX(-50%); color: white; font-size: 24px; text-shadow: 2px 2px 4px #000; display: none;">
            {interaction_text}
        </div>

        <div id="subdue-progress" style="position: absolute; top: 55%; left: 50%; transform: translateX(-50%); width: 200px; height: 20px; background-color: rgba(0,0,0,0.5); border: 1px solid white; display: none;">
            <div id="subdue-bar" style="width: 0%; height: 100%; background-color: #006400;"></div>
        </div>

        <div id="antidote-minigame" style="position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%); width: 300px; height: 80px; background-color: rgba(0,0,0,0.6); border: 2px solid #00FFFF; border-radius: 5px; display: none; padding: 5px;">
            <div style="text-align: center; color: #00FFFF; margin-bottom: 5px; font-size: 14px;">Administer Antidote</div>
            <div id="antidote-gauge-container" style="width: 100%; height: 20px; background-color: #333; border: 1px solid #555; position: relative; margin-bottom: 5px;">
                <div id="antidote-sweet-spot" style="position: absolute; top: 0; height: 100%; background-color: rgba(0, 255, 0, 0.3);"></div>
                <div id="antidote-overfill-zone" style="position: absolute; top: 0; height: 100%; background-color: rgba(255, 0, 0, 0.3);"></div> <div id="antidote-pressure-bar" style="position: absolute; top: 0; left: 0; width: 0%; height: 100%; background-color: #00FF00;"></div>
                <div id="antidote-overfill-warning" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255, 0, 0, 0.5); display: none;"></div>
            </div>
            <div id="antidote-timer-container" style="width: 100%; height: 15px; background-color: #222; border: 1px solid #444;">
                <div id="antidote-timer-bar" style="width: 0%; height: 100%; background-color: #00FFFF;"></div>
            </div>
             <div id="antidote-feedback" style="text-align: center; color: #FFFF00; margin-top: 5px; font-size: 12px;">Aim & [Hold Right-Click] - Keep pressure in the green zone!</div>
        </div>
        <div id="debug-panel" style="position: absolute; top: 10px; left: 10px; background-color: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px; display: none;">
            <p>Position: <span id="debug-position">X:0, Y:0, Z:0</span></p>
            <p>Controls Locked: <span id="debug-controls-locked">false</span></p>
            </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/PointerLockControls.js"></script>

    <script src="thegray.js?v=<?php echo time(); ?>"></script>
    <script src="thegray-spawner.js?v=<?php echo time(); ?>"></script>
    <script src="player.js?v=<?php echo time(); ?>"></script>
    <script src="curing_mechanic.js?v=<?php echo time(); ?>"></script>
    <script type="module" src="main.js?v=<?php echo time(); ?>"></script>

</body>
</html>