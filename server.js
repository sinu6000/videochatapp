const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors()); // क्रॉस-ओरिजिन कनेक्शन को अलाउ करने के लिए

const server = http.createServer(app);

// रेंडर लाइव सर्वर के लिए CORS सेटिंग्स को फिक्स करना
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
    console.log('User joined server:', socket.id);

    socket.on('join-matching', (preferences) => {
        // पुराना यूजर अगर पहले से लिस्ट में है तो हटाएं
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
            const modeMatch = userProfile.mode === peer.mode;
            const genderMatch = (userProfile.lookFor === 'anyone' || userProfile.lookFor === peer.myGender) &&
                                (peer.lookFor === 'anyone' || peer.lookFor === userProfile.myGender);
            const countryMatch = (userProfile.country === 'any' || peer.country === 'any' || userProfile.country === peer.country);
            const langMatch = (userProfile.language === 'any' || peer.language === 'any' || userProfile.language === peer.language);

            return modeMatch && genderMatch && countryMatch && langMatch;
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

const PORT = process.env.PORT || 10000; // रेंडर के डिफ़ॉल्ट पोर्ट को सपोर्ट करना
server.listen(PORT, '0.0.0.0', () => console.log(`Server Running...`));
