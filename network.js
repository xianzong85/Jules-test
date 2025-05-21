// network.js

// Global variables for player and game state
let localPlayerId = null;
let gameState = { // This is the network.js internal game state, separate from game.js's snookerGameState
    currentPlayer: null, 
    gameStarted: false 
};

// 1. Establish Connection
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
    console.log('Connected to WebSocket server');
    // UI event listeners (like for 'start-game-btn') should be in game.js or index.html
    // and call appropriate functions like:
    // if (localPlayerId === 'player1' && !gameState.gameStarted) {
    //     socket.send(JSON.stringify({ type: 'startGameRequest' }));
    // }
};

socket.onerror = (error) => {
    console.error('WebSocket Error:', error);
    alert(_('connectionError') + ' See console for details.'); // Keep details in English for console
    const playerIdDisplay = document.getElementById('player-id-display');
    if (playerIdDisplay) playerIdDisplay.textContent = _('connectionError');
    const turnIndicator = document.getElementById('turn-indicator');
    if (turnIndicator) turnIndicator.textContent = _('connectionError');
};

socket.onclose = () => {
    console.log('Disconnected from WebSocket server');
    alert(_('disconnectedFromServer'));
    localPlayerId = null;
    gameState.gameStarted = false;
    gameState.currentPlayer = null;
    // Reset UI elements
    const playerIdDisplay = document.getElementById('player-id-display');
    if (playerIdDisplay) playerIdDisplay.textContent = _('disconnected');
    const gameStatusDisplay = document.getElementById('game-status-display');
    if (gameStatusDisplay) gameStatusDisplay.textContent = _('disconnectedFromServer');
    const turnIndicator = document.getElementById('turn-indicator');
    if (turnIndicator) turnIndicator.textContent = ""; // Or _('notConnected')
    if (window.snookerGameState) { // Reset game.js's snooker state if it exists
        window.snookerGameState.targetBallState = 'MUST_HIT_RED';
        window.snookerGameState.redsRemaining = 15;
        window.snookerGameState.gameStarted = false; // Also mirror gameStarted state
    }
};

// 2. Send Full Ball State (Replaces sendCueBallState)
function sendFullBallState(ballsArray) {
    if (socket.readyState === WebSocket.OPEN) {
        const serializedBalls = ballsArray.map(ball => ({
            id: ball.id,
            position: { x: ball.mesh.position.x, y: ball.mesh.position.y, z: ball.mesh.position.z },
            velocity: { x: ball.velocity.x, y: ball.velocity.y, z: ball.velocity.z },
            isPocketed: ball.isPocketed,
            points: ball.points, // Included for completeness
            isColorToRespot: ball.isColorToRespot,
            defaultSpotPosition: ball.defaultSpotPosition ? {x: ball.defaultSpotPosition.x, y: ball.defaultSpotPosition.y, z: ball.defaultSpotPosition.z} : null
        }));
        const message = {
            type: 'fullBallStateUpdate',
            payload: {
                balls: serializedBalls
            }
        };
        socket.send(JSON.stringify(message));
        // console.log('Sent fullBallStateUpdate'); // Can be verbose
    } else {
        console.warn('WebSocket connection not open. Full ball state not sent.');
    }
}
window.sendFullBallState = sendFullBallState;
// window.sendCueBallState = undefined; // Mark old function as removed

// Function to send endTurn message (Modified to include payload)
function sendEndTurn(payload) { // payload = { redsRemaining: X, nextTargetForOpponent: Y }
    if (socket.readyState === WebSocket.OPEN && gameState.gameStarted && localPlayerId === gameState.currentPlayer) {
        console.log("Sending endTurn message to server with payload:", payload);
        socket.send(JSON.stringify({ type: 'endTurn', payload: payload }));
    } else {
        console.warn("Cannot send endTurn: Socket not open, game not started, or not current player's turn.");
    }
}
window.sendEndTurn = sendEndTurn;


// 3. Receive and Handle Server Messages
socket.onmessage = (event) => {
    console.log('Received message from server:', event.data);
    let message;
    try {
        message = JSON.parse(event.data);
    } catch (e) {
        console.error('Failed to parse message from server:', e);
        return;
    }

    if (message.type === 'playerAssignment') {
        localPlayerId = message.playerId;
        console.log('Assigned as:', localPlayerId);
        const playerIdDisplay = document.getElementById('player-id-display');
        if (playerIdDisplay) {
            playerIdDisplay.textContent = `${_('youAre')}: ${localPlayerId}`;
        }
    } else if (message.type === 'serverFull') {
        console.log('Server is full. Cannot join.');
        alert(_('serverFull'));
        socket.close();
    } else if (message.type === 'gameStart') {
        gameState.gameStarted = true; // Network.js internal state
        gameState.currentPlayer = message.startingPlayer;
        
        if (window.snookerGameState) { // Update game.js's snooker state
            window.snookerGameState.targetBallState = message.initialTarget;
            window.snookerGameState.redsRemaining = message.initialReds;
            window.snookerGameState.gameStarted = true; // Mirror to game.js state
            console.log('Snooker game state initialized by server:', window.snookerGameState);
        } else {
            console.warn('window.snookerGameState not found in game.js to initialize.');
        }

        console.log('Game started! Starting player:', gameState.currentPlayer);
        const gameStatusDisplay = document.getElementById('game-status-display');
        if (gameStatusDisplay) {
            gameStatusDisplay.textContent = `${_('gameStarted')} ${_('firstTurn')}: ${gameState.currentPlayer}. ${_('target')}: ${_(message.initialTarget)}`;
        }
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
            turnIndicator.textContent = `${gameState.currentPlayer}'s Turn (${_('target')}: ${_(message.initialTarget)})`;
        }
        updateControlsForTurn();
    } else if (message.type === 'turnUpdate') {
        gameState.currentPlayer = message.currentPlayer; // Network.js internal state
        
        if (window.snookerGameState) { // Update game.js's snooker state
            window.snookerGameState.targetBallState = message.targetBallState;
            window.snookerGameState.redsRemaining = message.redsRemaining;
            console.log('Snooker game state updated by server for turn:', window.snookerGameState);
        } else {
            console.warn('window.snookerGameState not found in game.js to update.');
        }

        console.log("It's now turn for:", gameState.currentPlayer, "Target:", message.targetBallState);
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) {
             turnIndicator.textContent = `${gameState.currentPlayer}'s Turn (${_('target')}: ${_(message.targetBallState)}, ${_('reds')}: ${message.redsRemaining})`;
        }
        updateControlsForTurn();
    } else if (message.type === 'opponentDisconnected') {
        gameState.gameStarted = false;
        gameState.currentPlayer = null;
        if (window.snookerGameState) { // Reset game.js's snooker state
            window.snookerGameState.targetBallState = 'MUST_HIT_RED';
            window.snookerGameState.redsRemaining = 15;
            window.snookerGameState.gameStarted = false;
        }
        console.log('Opponent disconnected:', message.disconnectedPlayer);
        alert(_('opponentDisconnected'));
        // Update UI elements
        const gameStatusDisplay = document.getElementById('game-status-display');
        if (gameStatusDisplay) gameStatusDisplay.textContent = _('opponentDisconnected');
        const turnIndicator = document.getElementById('turn-indicator');
        if (turnIndicator) turnIndicator.textContent = _('waitingForPlayers');
        if (window.resetGameControls) window.resetGameControls();

    } else if (message.type === 'error') {
        console.error('Server error:', message.message);
        alert(`${_('serverError')}: ${message.message}`); // Keep server's error message in English or as is
    } else if (message.type === 'fullBallStateUpdate' && message.payload && message.payload.balls) {
        console.log('Received fullBallStateUpdate from server.');
        if (window.balls && Array.isArray(window.balls) && typeof Ball !== 'undefined') { // Ball class from game.js
            const receivedBalls = message.payload.balls;
            receivedBalls.forEach(rb => {
                const localBall = window.balls.find(b => b.id === rb.id);
                if (localBall) {
                    localBall.mesh.position.set(rb.position.x, rb.position.y, rb.position.z);
                    localBall.velocity.set(rb.velocity.x, rb.velocity.y, rb.velocity.z);
                    localBall.isPocketed = rb.isPocketed;
                    localBall.mesh.visible = !rb.isPocketed;
                    
                    // Update other properties if necessary, though these are mainly for initialization
                    // localBall.points = rb.points;
                    // localBall.isColorToRespot = rb.isColorToRespot;
                    // if (rb.defaultSpotPosition) {
                    //     localBall.defaultSpotPosition = new THREE.Vector3(rb.defaultSpotPosition.x, rb.defaultSpotPosition.y, rb.defaultSpotPosition.z);
                    // } else {
                    //     localBall.defaultSpotPosition = null;
                    // }
                } else {
                    console.warn(`Received state for unknown ball ID: ${rb.id}`);
                }
            });
            // Potentially trigger a re-render or UI update in game.js if needed
            // e.g., if game.js has a function like window.updateScoreDisplay();
        } else {
            console.warn('Local balls array or Ball class not available to process fullBallStateUpdate.');
        }
    }
    // Old cueBallUpdate handler is effectively removed by not being handled.
};

// 4. Update Controls Based on Turn
function updateControlsForTurn() {
    // This function primarily updates UI and logs. Game.js's cue stick visibility
    // is handled based on cue ball stationarity and localPlayerId === gameState.currentPlayer.
    const turnIndicator = document.getElementById('turn-indicator');
    if (gameState.gameStarted && localPlayerId === gameState.currentPlayer) {
        console.log("It's your turn!");
        if (turnIndicator && window.snookerGameState) { // Check snookerGameState for target info
            turnIndicator.textContent = `${_('yourTurn')} (${_('target')}: ${_(window.snookerGameState.targetBallState)}, ${_('reds')}: ${window.snookerGameState.redsRemaining})`;
        }
        if (window.enableCueControls) window.enableCueControls(true);
    } else if (gameState.gameStarted) {
        console.log("Waiting for opponent...");
        if (turnIndicator && window.snookerGameState) {
             turnIndicator.textContent = `${_('opponentsTurn')} (${_('target')}: ${_(window.snookerGameState.targetBallState)}, ${_('reds')}: ${window.snookerGameState.redsRemaining})`;
        }
        if (window.enableCueControls) window.enableCueControls(false);
    } else {
        if (turnIndicator) turnIndicator.textContent = _('waitingForPlayers'); // Or "Game not started."
        if (window.enableCueControls) window.enableCueControls(false);
    }
}
window.updateControlsForTurn = updateControlsForTurn;

// Notes for game.js integration:
// 1. game.js should call window.sendFullBallState(balls) when the current player's shot sequence
//    is fully resolved (all balls have stopped), BEFORE calling sendEndTurn if the turn ends.
//    This ensures the opponent receives the final state of the table.
// 2. game.js (in evaluateTurnEnd) calls window.sendEndTurn({ redsRemaining: X, nextTargetForOpponent: Y });
// 3. Ensure window.snookerGameState in game.js is accessible for network.js to update.
// 4. Ensure window.balls and the Ball class are accessible for fullBallStateUpdate.
// 5. The functions window.resetGameControls and window.enableCueControls should be robustly defined in game.js.
//    `enableCueControls` in game.js should consider both `isMyTurn` AND `cueBallObj.velocity.lengthSq() < STOP_THRESHOLD_SQ`.
//    The cue stick visibility logic in game.js's animate loop needs to be updated to:
//    `if (localPlayerId === gameState.currentPlayer && cueBallObj.velocity.lengthSq() < STOP_THRESHOLD_SQ)`
//    This requires `localPlayerId` and `gameState` (network.js's gameState) to be accessible or passed to game.js.
//    Alternatively, `enableCueControls(true/false)` can more directly control cue stick logic in game.js.
//    For now, `game.js`'s cue stick visibility is only based on `cueBallObj.velocity`.
//    This needs to be coordinated with `game.js` for proper turn-based control.
//    The `updateControlsForTurn` function now calls `enableCueControls` as a signal.

window.socket = socket; // Expose socket for game.js
```
