// server/server.js - Main server file with HTTPS and Socket.IO
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const accommodationRoutes = require('./routes/accommodations');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const searchRoutes = require('./routes/search');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const rateLimitMiddleware = require('./middleware/rateLimit');

// Import socket handlers
const messageHandler = require('./sockets/messageHandler');
const notificationHandler = require('./sockets/notificationHandler');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://maps.googleapis.com"],
      scriptSrc: ["'self'", "https://maps.googleapis.com"],
      connectSrc: ["'self'", "wss:", "ws:", "https://api.cloudinary.com"]
    }
  }
}));

app.use(compression());
app.use(morgan('combined'));

// CORS configuration for bilingual support
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://danangrentals.com', 'https://www.danangrentals.com']
    : ['https://localhost:3000', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', rateLimitMiddleware);

// Language detection middleware
app.use((req, res, next) => {
  const acceptLanguage = req.headers['accept-language'] || 'en';
  req.language = acceptLanguage.includes('vi') ? 'vi' : 'en';
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/search', searchRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    language: req.language
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/danang_rental_platform', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log(' MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// HTTPS configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

let server;

if (process.env.NODE_ENV === 'production') {
  // Production HTTPS setup
  try {
    const privateKey = fs.readFileSync(process.env.SSL_PRIVATE_KEY || '/etc/ssl/private/private.key', 'utf8');
    const certificate = fs.readFileSync(process.env.SSL_CERTIFICATE || '/etc/ssl/certs/certificate.crt', 'utf8');
    const ca = fs.readFileSync(process.env.SSL_CA || '/etc/ssl/certs/ca_bundle.crt', 'utf8');

    const credentials = {
      key: privateKey,
      cert: certificate,
      ca: ca
    };

    server = https.createServer(credentials, app);
    console.log('🔒 HTTPS server configured for production');
  } catch (error) {
    console.warn('⚠️ SSL certificates not found, falling back to HTTP');
    server = http.createServer(app);
  }
} else {
  // Development setup with self-signed certificate
  try {
    const sslPath = path.join(__dirname, 'ssl');
    
    // Create SSL directory if it doesn't exist
    if (!fs.existsSync(sslPath)) {
      fs.mkdirSync(sslPath, { recursive: true });
    }

    // Check if certificates exist, if not create them
    const keyPath = path.join(sslPath, 'localhost.key');
    const certPath = path.join(sslPath, 'localhost.crt');

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      console.log('🔧 Generating self-signed certificates for development...');
      generateSelfSignedCert(sslPath);
    }

    const credentials = {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8')
    };

    server = https.createServer(credentials, app);
    console.log(' HTTPS server configured for development with self-signed certificate');
  } catch (error) {
    console.warn(' Failed to setup HTTPS for development, using HTTP:', error.message);
    server = http.createServer(app);
  }
}

// Socket.IO setup with CORS and bilingual support
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://danangrentals.com', 'https://www.danangrentals.com']
      : ['https://localhost:3000', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Socket.IO middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const language = socket.handshake.auth.language || 'en';
  
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.language = language;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  } else {
    // Allow anonymous connections for public features
    socket.language = language;
    next();
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.userId || 'Anonymous'} (${socket.language})`);

  // Join user to their personal room for notifications
  if (socket.userId) {
    socket.join(`user_${socket.userId}`);
  }

  // Handle language change
  socket.on('change_language', (language) => {
    socket.language = language;
    console.log(`🌐 Language changed to: ${language}`);
  });

  // Message handling
  messageHandler(io, socket);
  
  // Notification handling
  notificationHandler(io, socket);

  // Handle room viewing for analytics
  socket.on('view_room', (roomId) => {
    socket.join(`room_${roomId}`);
    // Emit to other viewers that someone is viewing
    socket.to(`room_${roomId}`).emit('viewer_joined');
  });

  // Handle leaving room view
  socket.on('leave_room', (roomId) => {
    socket.leave(`room_${roomId}`);
    socket.to(`room_${roomId}`).emit('viewer_left');
  });

  // Handle property search events for real-time updates
  socket.on('join_search', (searchParams) => {
    const searchRoom = `search_${JSON.stringify(searchParams).replace(/\s/g, '')}`;
    socket.join(searchRoom);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.userId || 'Anonymous'}`);
  });
});

// Function to generate self-signed certificate for development
function generateSelfSignedCert(sslPath) {
  const { execSync } = require('child_process');
  
  try {
    // Generate private key
    execSync(`openssl genrsa -out ${path.join(sslPath, 'localhost.key')} 2048`);
    
    // Generate certificate
    execSync(`openssl req -new -x509 -key ${path.join(sslPath, 'localhost.key')} -out ${path.join(sslPath, 'localhost.crt')} -days 365 -subj "/C=VN/ST=DaNang/L=DaNang/O=DaNangRentals/CN=localhost"`);
    
    console.log(' Self-signed certificates generated successfully');
  } catch (error) {
    console.error(' Failed to generate self-signed certificates:', error.message);
    console.log(' Please install OpenSSL or create certificates manually');
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(' SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log(' Server closed');
    mongoose.connection.close(false, () => {
      console.log(' MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Start server
server.listen(PORT, HOST, () => {
  const protocol = server instanceof https.Server ? 'https' : 'http';
  console.log(`
 Da Nang Rental Platform Server running on ${protocol}://${HOST}:${PORT}
 Environment: ${process.env.NODE_ENV || 'development'}
 Protocol: ${protocol.toUpperCase()}
 Socket.IO: Enabled
Bilingual Support: English/Vietnamese
 Location: Da Nang, Vietnam
  `);
});

module.exports = { app, io, server };