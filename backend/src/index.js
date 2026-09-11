const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectMongoDB } = require('./shared/mongodb/mongodb.client');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req, res, buffer) => {
    req.rawBody = buffer;
  }
}));


// Auth routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/ai', require('./modules/ai/ai.routes'));
app.use('/api/preview', require('./modules/preview/preview.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

// Start server
connectMongoDB()
  .then(() => app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  }))
  .catch((error) => {
    process.exit(1);
  });