const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// बिना किसी बाहरी लाइब्रेरी के सीधा सॉकेट.इओ में ही क्रॉस-ओरिजिन अलाउ करना
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let waitingUsers = [];

io.on('connection', (socket) => {
    console.log('Node active:', socket.id);

    socket.on('join-matching', (preferences) => {
        waitingUsers = waitingUsers.filter(user => user.id !== socket.id);

        const userProfile = {
            id: socket.id,
            mode: preferences.mode,
            myGender: preferences.myGender,
            lookFor: preferences.lookFor,
            country: preferences.country,
            language: preferences.language
        };

        let matchIndex = waitingUsers.findIndex(peer => {
            return userProfile.mode === peer.mode &&
                   (userProfile.lookFor === 'anyone' || userProfile.lookFor === peer.myGender) &&
                   (peer.lookFor === 'anyone' || peer.lookFor === userProfile.myGender) &&
                   (userProfile.country === 'any' || peer.country === 'any' || userProfile.country === peer.country) &&
                   (userProfile.language === 'any' || peer.language === 'any' || userProfile.language === peer.language);
        });

        if (matchIndex !== -1) {
            let partner = waitingUsers.splice(matchIndex, 1)[0];

            io.to(socket.id).emit('matched', { role: 'creator' });
            io.to(partner.id).emit('matched', { role: 'joiner' });

            socket.partnerId = partner.id;
            const partnerSocket = io.sockets.sockets.get(partner.id);
            if(partnerSocket) partnerSocket.partnerId = socket.id;
        } else {
            waitingUsers.push(userProfile);
            io.to(socket.id).emit('waiting');
        }
    });

    socket.on('chat-message', (msg) => {
        if (socket.partnerId) io.to(socket.partnerId).emit('chat-message', msg);
    });

    socket.on('signal', (data) => {
        if (socket.partnerId) io.to(socket.partnerId).emit('signal', data);
    });

    socket.on('leave-chat', () => { handleDisconnect(socket); });
    socket.on('disconnect', () => { handleDisconnect(socket); });
});

function handleDisconnect(socket) {
    waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
    if (socket.partnerId) {
        io.to(socket.partnerId).emit('partner-disconnected');
        const partnerSocket = io.sockets.sockets.get(socket.partnerId);
        if (partnerSocket) partnerSocket.partnerId = null;
        socket.partnerId = null;
    }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`Gateway active on port ${PORT}`));
