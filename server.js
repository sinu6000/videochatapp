const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// वीडियो कॉल सिग्नल्स को एक यूजर से दूसरे यूजर तक भेजने के लिए
io.on('connection', (socket) => {
    socket.on('chat-message', (msg) => {
        socket.broadcast.emit('chat-message', msg);
    });

    // WebRTC सिग्नल्स (Offer, Answer, Candidates) ट्रांसफर करना
    socket.on('signal', (data) => {
        socket.broadcast.emit('signal', data);
    });
});

server.listen(3000, () => {
    console.log('Server runs on port 3000');
});
