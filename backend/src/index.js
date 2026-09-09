const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req, res, buffer) => {
    req.rawBody = buffer;
  }
}));


// Auth routes
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/ai', require('./modules/ai/ai.routes'));
app.use('/api/billing', require('./modules/billing/billing.routes'));
app.use('/api/preview', require('./modules/preview/preview.routes'));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});