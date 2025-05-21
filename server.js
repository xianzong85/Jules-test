// server.js
// Reminder: You need to install the 'ws' library using: npm install ws

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// Player and Game State Management
let playerSlots = { 
    'player1': null, // Holds the WebSocket client for player1
    'player2': null  // Holds the WebSocket client for player2
};
let gameState = { 
    currentPlayer: null, 
    gameStarted: false,
    targetBallState: 'MUST_HIT_RED', // Snooker specific
    redsRemaining: 15               // Snooker specific
};

// Helper function to broadcast to all connected players in playerSlots
function broadcastToAllPlayers(message) {
    const messageString = JSON.stringify(message);
    Object.values(playerSlots).forEach(client => {
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

// Helper function to broadcast to a specific player
function sendToPlayer(playerId, message) {
    const client = playerSlots[playerId];
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
    }
}

wss.on('connection', (ws) => {
    let assignedSlot = null;

    if (playerSlots.player1 === null) {
        playerSlots.player1 = ws;
        ws.playerId = 'player1';
        assignedSlot = 'player1';
        sendToPlayer(ws.playerId, { type: 'playerAssignment', playerId: ws.playerId });
        console.log('Client connected and assigned to player1.');
    } else if (playerSlots.player2 === null) {
        playerSlots.player2 = ws;
        ws.playerId = 'player2';
        assignedSlot = 'player2';
        sendToPlayer(ws.playerId, { type: 'playerAssignment', playerId: ws.playerId });
        console.log('Client connected and assigned to player2.');
    } else {
        console.log('Client tried to connect, but server is full.');
        ws.send(JSON.stringify({ type: 'serverFull' }));
        ws.close();
        return;
    }
    console.log('Total active players:', Object.values(playerSlots).filter(p => p !== null).length);


    ws.on('message', (message) => {
        console.log('Received message from %s => %s', ws.playerId, message);
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message.toString());
        } catch (e) {
            console.error('Failed to parse message as JSON from %s:', ws.playerId, e);
            return;
        }

        if (parsedMessage.type === 'startGameRequest') {
            if (ws.playerId === 'player1' && !gameState.gameStarted) {
                // Only player1 can start the game
                if (playerSlots.player1 && playerSlots.player2) { // Check if both players are connected
                    gameState.gameStarted = true;
                    gameState.currentPlayer = 'player1';
                    gameState.targetBallState = 'MUST_HIT_RED'; // Initialize Snooker state
                    gameState.redsRemaining = 15;
                    console.log('Game started by player1. Current turn: player1. Target: MUST_HIT_RED, Reds: 15');
                    broadcastToAllPlayers({ 
                        type: 'gameStart', 
                        startingPlayer: 'player1',
                        initialTarget: gameState.targetBallState, // Snooker specific
                        initialReds: gameState.redsRemaining      // Snooker specific
                    });
                    broadcastToAllPlayers({ 
                        type: 'turnUpdate', 
                        currentPlayer: gameState.currentPlayer,
                        targetBallState: gameState.targetBallState, // Snooker specific
                        redsRemaining: gameState.redsRemaining      // Snooker specific
                    });
                } else {
                    sendToPlayer(ws.playerId, {type: 'error', message: 'Cannot start game. Both players must be connected.'});
                    console.log('Player1 tried to start game, but player2 is not connected.');
                }
            } else if (gameState.gameStarted) {
                sendToPlayer(ws.playerId, {type: 'error', message: 'Game has already started.'});
            } else {
                 sendToPlayer(ws.playerId, {type: 'error', message: 'Only player1 can start the game.'});
            }
        // } else if (parsedMessage.type === 'cueBallUpdate') { // Replaced by fullBallStateUpdate
            // Broadcast cueBallUpdate to the *other* player
            // const otherPlayerId = (ws.playerId === 'player1') ? 'player2' : 'player1';
            // if (playerSlots[otherPlayerId]) {
            //     sendToPlayer(otherPlayerId, parsedMessage); 
            // }
        } else if (parsedMessage.type === 'fullBallStateUpdate' && parsedMessage.payload && parsedMessage.payload.balls) {
            if (gameState.gameStarted && ws.playerId === gameState.currentPlayer) { // Only current player can send this authoritative state
                const otherPlayerId = (ws.playerId === 'player1') ? 'player2' : 'player1';
                if (playerSlots[otherPlayerId]) {
                    // Relay the entire payload to the other player
                    sendToPlayer(otherPlayerId, { type: 'fullBallStateUpdate', payload: parsedMessage.payload });
                    // console.log(`Relayed fullBallStateUpdate from ${ws.playerId} to ${otherPlayerId}`);
                }
            }
        } else if (parsedMessage.type === 'endTurn' && parsedMessage.payload) {
            if (gameState.gameStarted && ws.playerId === gameState.currentPlayer) {
                gameState.currentPlayer = (gameState.currentPlayer === 'player1') ? 'player2' : 'player1';
                gameState.redsRemaining = parsedMessage.payload.redsRemaining;
                gameState.targetBallState = parsedMessage.payload.nextTargetForOpponent; // Trust client's calculation
                
                console.log(`Turn ended by ${ws.playerId}. New turn: ${gameState.currentPlayer}. Target: ${gameState.targetBallState}, Reds: ${gameState.redsRemaining}`);
                
                broadcastToAllPlayers({ 
                    type: 'turnUpdate', 
                    currentPlayer: gameState.currentPlayer,
                    targetBallState: gameState.targetBallState,
                    redsRemaining: gameState.redsRemaining
                });
            }
        }
        // Add more message type handlers here as needed
    });

    ws.on('close', () => {
        if (ws.playerId) {
            console.log(`Player ${ws.playerId} disconnected.`);
            if (playerSlots[ws.playerId] === ws) { // Ensure it's the same client instance
                 playerSlots[ws.playerId] = null;
            }
            
            const otherPlayerId = (ws.playerId === 'player1') ? 'player2' : 'player1';
            if (gameState.gameStarted) {
                broadcastToAllPlayers({ type: 'opponentDisconnected', disconnectedPlayer: ws.playerId });
                console.log(`Game was active. Notified ${otherPlayerId} about ${ws.playerId} disconnection.`);
            }
            // Reset game state if a player disconnects
            gameState.gameStarted = false;
            gameState.currentPlayer = null;
            gameState.redsRemaining = 15;             // Reset Snooker state
            gameState.targetBallState = 'MUST_HIT_RED'; // Reset Snooker state
            console.log('Game state reset due to player disconnection.');
        } else {
            console.log('A client disconnected (was not assigned a player slot).');
        }
        console.log('Total active players:', Object.values(playerSlots).filter(p => p !== null).length);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error on client %s:', ws.playerId || 'unassigned', error);
        // Handle disconnection logic similar to 'close' if the error is fatal
        // The 'close' event will usually fire after an error that closes the socket.
    });
});

console.log('WebSocket server started on port 8080');
