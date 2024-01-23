const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
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
http.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
