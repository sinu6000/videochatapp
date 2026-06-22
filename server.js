const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// index.html फाइल को सर्व करने के लिए
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// जब कोई यूजर वेबसाइट पर आएगा
io.on('connection', (socket) => {
    console.log('एक नया यूजर जुड़ गया है: ' + socket.id);

    // चैट मैसेज को बाकी सभी लोगों तक पहुँचाना
    socket.on('chat-message', (data) => {
        socket.broadcast.emit('chat-message', data);
    });

    // वीडियो कॉल सिग्नलिंग (WebRTC के लिए)
    socket.on('signal', (data) => {
        socket.broadcast.emit('signal', data);
    });

    socket.on('disconnect', () => {
        console.log('यूजर चला गया: ' + socket.id);
    });
});

// सर्वर को पोर्ट 3000 पर चालू करना
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
