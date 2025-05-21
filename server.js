// server.js
// Reminder: You need to install the 'ws' library using: npm install ws

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected. Total clients:', clients.size);

    ws.on('message', (message) => {
        console.log('Received message => %s', message);
        let parsedMessage;
        try {
            // Attempt to parse the message as JSON
            // The message is received as a Buffer or string, convert to string first if necessary
            parsedMessage = JSON.parse(message.toString());
        } catch (e) {
            console.error('Failed to parse message as JSON:', e);
            // Optionally, send an error back to the sender or simply don't broadcast
            return;
        }

        // Broadcast the parsed message to all other clients
        const messageToSend = JSON.stringify(parsedMessage);
        clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(messageToSend);
            }
        });
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected. Total clients:', clients.size);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        // Optionally, remove the client on error as well if it's a connection-fatal error
        clients.delete(ws);
        console.log('Client removed due to error. Total clients:', clients.size);
    });
});

console.log('WebSocket server started on port 8080');
