const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https').createServer({
    key: fs.readFileSync('ssl/client-key.pem'),
    cert: fs.readFileSync('ssl/client-cert.pem'),
    ca: fs.readFileSync('ssl/ca.crt'),
    requestCert: true,
    rejectUnauthorized: false
}, app);
const io = require('socket.io')(https, {
    cors: {
        origin: '*',
    }
});

// fix cors in http
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

// Serve static files
app.use(express.static('public'));

// Handle incoming connections
io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle 'message' channel
    socket.on('message', (message) => {
        // Broadcast the message to all connected clients
        socket.broadcast.emit('message', message);
    });

});

// Add / path for health check
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Start the server
const port = 3001;
https.listen(port, () => {
    console.log(`Server is running on https://localhost:${port}`);
});

/**
 * Generate ssl certificates and ca for https
 *
 * openssl genrsa -out ca.key 2048
 * openssl req -new -x509 -days 3650 -key ca.key -out ca.crt
 * openssl genrsa -out client-key.pem 2048
 * openssl req -new -key client-key.pem -out client.csr
 * openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client-cert.pem -days 3650
 *
    */
//assing the ssl certificates to the server
// const server = https.createServer({
//     key: fs.readFileSync('ssl/client-key.pem'),
//     cert: fs.readFileSync('ssl/client-cert.pem'),
//     ca: fs.readFileSync('ssl/ca.crt'),
//     requestCert: true,
//     rejectUnauthorized: false
// }, app);