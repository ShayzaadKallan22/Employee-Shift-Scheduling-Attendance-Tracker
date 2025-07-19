const express = require('express');
  const session = require('express-session');
  const path = require('path');
  const app = express();
  const PORT = 3000;
  const pool = require('./db');
  const authRoutes = require('./authRoutes');
  const leaveRoutes = require('./leaveRoutes');
  const shiftsRoutes = require('./shiftsRoutes');
  const payrollRoutes = require('./payrollRoutes');
  const overtimeRoutes = require('./overtimeRoutes');
  const normalQRRouter = require('./normalRoutes');
  const leaveController = require('./leaveController');
  const profileRoutes = require('./profileRoutes');
  const employeeRoutes = require('./employeeRoutes');
  const reportRoutes = require('./reportRoutes');
  const cors = require('cors');
  const leavesRoutes = require('./leavesRoutes');
  const leavesController = require('./leavesController');
  const shiftSwapRoutes = require('./shiftSwapRoutes');
  const qrRoute = require('./qrRoutes');
  const profilesRoutes = require('./profilesRoutes');
  const menuRoutes = require('./menuRoutes');
  const menuController = require('./menuController');
  const scheduleRoute = require('./scheduleRoute');
  const shiftRoutes = require('./shiftRoute');
  const forgotPassRoute = require('./forgotPassRoute');
  const notifyRoute = require('./notifyRoute');
  const payrollsRoute = require('./payrollsRoutes');
  //Author : Katlego Mmadi
  const { register, login, logout } = require('./authController');
  const managerNotificationRoutes = require('./manager_notifications'); 
const statusRoutes = require('./statusRoutes');


  // Load environment variables
  require('dotenv').config();

  // Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS Middleware
app.use(cors({
  origin: 'http://127.0.0.1:5500',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-strong-secret-here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3600000,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Database pool middleware
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// API Routes
app.post('/api/login', login);
app.use('/api/manager-notifications', managerNotificationRoutes); // Use manager_notifications.js
app.use('/auth', authRoutes);
app.post('/api/leave/request', leaveController.requestLeave);
app.post('/api/leave/request', leavesController.requestLeave);
app.use('/api/leave', leaveRoutes);
app.use('/api/manager', profileRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/shifts', shiftsRoutes);
app.use('/payroll', payrollRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/normal-qr', normalQRRouter);
app.use('/api/leave', leavesRoutes);
app.use('/api/shift-swap', shiftSwapRoutes);
app.use('/api/qr', qrRoute);
app.use('/api/profile', profilesRoutes);
app.use('/api/menu', menuRoutes);
app.post('/api/menu/respond', menuController.getEmpDetails);
app.use('/api/schedule', scheduleRoute);
app.use('/api/shifts', shiftRoutes);
app.use('/api', forgotPassRoute);
app.use('/api', notifyRoute);
app.use('/api/payroll', payrollsRoute);
app.use('/api/status', statusRoutes);







// Routes for HTML pages
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../Front_End_Web', 'index.html'));
});

app.get('/register', (req, res) => {
  res.render('registration', {
    formData: {},
    errorMessage: null,
    successMessage: null,
    temporaryPassword: null
  });
});

app.get('/', (req, res) => {
  res.render('registration');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

//Author : Katlego Mmadi
console.log('Static file path:', path.join(__dirname, '../Front_End_Web'));
app.use(express.static(path.join(__dirname, '../Front_End_Web')));

