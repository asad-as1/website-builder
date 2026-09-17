const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectMongoDB } = require('./shared/mongodb/mongodb.client');
const { initializeSocket } = require('./shared/socket/socket.server');

dotenv.config();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({
  limit: '50mb',  
  verify: (req, res, buffer) => {
    req.rawBody = buffer;
  }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));  

// Auth routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/ai', require('./modules/ai/ai.routes'));
app.use('/api/preview', require('./modules/preview/preview.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/contact', require('./routes/contact.routes'));
app.use('/api/upload', require('./routes/upload.routes'));  

// Initialize Socket.IO
const io = initializeSocket(server);
console.log('✅ Socket.IO initialized');

// Start server
connectMongoDB()
  .then(() => server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`🔌 WebSocket ready on ws://localhost:${PORT}`);
  }))
  .catch((error) => {
    process.exit(1);
  });