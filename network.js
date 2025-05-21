// network.js

// 1. Establish Connection
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = () => {
    console.log('Connected to WebSocket server');
};

socket.onerror = (error) => {
    console.error('WebSocket Error:', error);
};

socket.onclose = () => {
    console.log('Disconnected from WebSocket server');
};

// 2. Send Cue Ball State
function sendCueBallState(position, velocity) {
    if (socket.readyState === WebSocket.OPEN) {
        const message = {
            type: 'cueBallUpdate',
            payload: {
                position: { x: position.x, y: position.y, z: position.z },
                velocity: { x: velocity.x, y: velocity.y, z: velocity.z }
            }
        };
        socket.send(JSON.stringify(message));
        console.log('Sent cueBallUpdate:', message);
    } else {
        console.warn('WebSocket connection not open. State not sent.');
    }
}
// Expose for game.js
window.sendCueBallState = sendCueBallState;

// 3. Receive and Handle Cue Ball State
socket.onmessage = (event) => {
    console.log('Received message from server:', event.data);
    try {
        const message = JSON.parse(event.data);

        if (message.type === 'cueBallUpdate' && message.payload) {
            if (window.cueBall && window.cueBall.position && window.cueBall.velocity) {
                // Ensure not to update if the message is from the sender itself
                // This simple check might not be sufficient for more complex scenarios
                // A common way is for the server to not echo back to the sender,
                // or include a sender ID in the message.
                // For now, we assume any cueBallUpdate is from another player.

                console.log('Received cueBallUpdate, applying to local cueBall:', message.payload);
                window.cueBall.position.set(
                    message.payload.position.x,
                    message.payload.position.y,
                    message.payload.position.z
                );
                window.cueBall.velocity.set(
                    message.payload.velocity.x,
                    message.payload.velocity.y,
                    message.payload.velocity.z
                );
            } else {
                console.warn('window.cueBall not found or improperly configured. Cannot apply update.');
                console.log('Received data:', message.payload);
            }
        }
    } catch (e) {
        console.error('Failed to parse message from server or handle update:', e);
    }
};
