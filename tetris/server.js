const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Add MIME types
express.static.mime.define({
  'application/wasm': ['wasm']
});

// Serve WASM files with the correct MIME type
app.get('/wasm/*.wasm', (req, res) => {
  const wasmPath = path.join(__dirname, req.path);
  console.log(`Serving WASM file: ${wasmPath}`);
  
  res.setHeader('Content-Type', 'application/wasm');
  fs.createReadStream(wasmPath).pipe(res);
});

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Serve static files from the wasm directory
app.use('/wasm', express.static(path.join(__dirname, 'wasm')));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from the assets directory
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        // Broadcast message to all clients (or handle AI logic here)
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
    });
});

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Access your game at http://localhost:${PORT}`);
}); 