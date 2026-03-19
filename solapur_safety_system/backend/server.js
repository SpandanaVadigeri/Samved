/**
 * Solapur Safety System - Main Backend Server
 * Express.js REST API with Socket.IO for real-time updates
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { createLogger, format, transports } = require('winston');

// Load environment variables
dotenv.config();

// Import modules
const db = require('./database/db');
const readingsRouter = require('./api/readings');
const alertsRouter = require('./api/alerts');
const syncRouter = require('./api/sync');
const authRouter = require('./api/auth');
const { authenticateToken } = require('./middleware/auth');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5000'],
    methods: ['GET', 'POST']
  }
});

// Logger configuration
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
    new transports.Console({ format: format.simple() })
  ]
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// Make logger available globally
app.use((req, res, next) => {
  req.logger = logger;
  next();
});

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
// app.use('/api/auth', authRouter);
// app.use('/api/readings', authenticateToken, readingsRouter);
// app.use('/api/alerts', authenticateToken, alertsRouter);
// app.use('/api/sync', authenticateToken, syncRouter);


const fs = require('fs'); // For storing logs in files
app.post('/api/simulator', (req, res) => {
  const data = req.body;
  console.log("📡 Simulator Data Received:", data);

  // 🚨 ALERT LOGIC
  let status = "SAFE";

  if (data.h2s > 10 || data.o2 < 19) {
    status = "DANGER";
  } else if (data.h2s > 5) {
    status = "CAUTION";
  }

  const response = {
    ...data,
    status
  };

  console.log("⚠️ Status:", status);

  // Send to frontend
  req.io.emit('sensor-data', response);
  res.json(response);

  fs.appendFileSync('data.csv',JSON.stringify(data) + '\n');
  req.io.emit('sensor-data', data);
  res.json({message: "Data received"});

});
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: db.isConnected ? 'connected' : 'disconnected'
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  
  // Join room based on role
  socket.on('join', (data) => {
    const { role, userId } = data;
    socket.join(role);
    socket.join(`user_${userId}`);
    logger.info(`Socket ${socket.id} joined room: ${role}`);
  });
  
  // Handle real-time alerts
  socket.on('alert-acknowledge', async (data) => {
    const { alertId, userId } = data;
    // Update in database
    await db.query(
      'UPDATE alerts SET acknowledged = true, acknowledged_by = $1, acknowledged_at = NOW() WHERE id = $2',
      [userId, alertId]
    );
    // Broadcast to all supervisors
    io.to('supervisor').emit('alert-updated', { alertId, acknowledged: true });
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    db.end();
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;