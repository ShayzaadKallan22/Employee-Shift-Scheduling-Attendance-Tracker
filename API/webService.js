// Load environment variables
const express = require('express');
const path = require('path');
const { register, login, logout } = require('./authController');
const managerNotificationRoutes = require('./manager_notifications');
const session = require('express-session');
const pool = require('./db');
const authRoutes = require('./authRoutes');
const leaveRoutes = require('./leaveRoutes');
const shiftRoutes = require('./shiftsRoutes'); //SHAYZAAD
const payrollRoutes = require('./payrollRoutes'); //SHAYZAAD
const overtimeRoutes = require('./overtimeRoutes'); //SHAYZAAD
const normalQRRouter = require('./normalRoutes'); //SHAYZAAD
const leaveController = require('./leaveController'); //Added by Cletus.
const profileRoutes = require('./profileRoutes'); // Added by Yatin
const employeeRoutes = require('./employeeRoutes'); // Added by Yatin
const reportRoutes = require('./reportRoutes'); // Added by Yatin
const cors = require('cors'); //Added by Yatin for testing
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config();
app.use(cookieParser());

// Author : Katlego Mmadi
app.use(cors({
  origin: 'http://localhost:3000', 
  credentials: true  // Allow cookies/auth headers
}));

// Middleware
//Author: Katlego Mmadi
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Cache control middleware
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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

// Custom Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Front_End_Web', 'signin.html'));
});

app.get('/registration', (req, res) => {
  res.sendFile(path.join(__dirname, '../Front_End_Web', 'registration.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../Front_End_Web', 'index.html'));
});

app.get('/set-employee-status', (req, res) => {
  res.sendFile(path.join(__dirname, '../Front_End_Web', 'set-employee-status.html'));
});

// API Endpoints

// Logout endpoint
app.post('/api/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(200).json({ success: true });
    }
    
    // Simple token invalidation by clearing client-side storage
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(200).json({ success: true });
  }
});

// Employees endpoint
app.get('/api/employees', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.employee_id AS id,
        CONCAT(e.first_name, ' ', e.last_name) AS name,
        e.email,
        r.title AS role,
        CASE
          WHEN e.status_ = 'on_leave' THEN 'On Leave'
          WHEN e.status_ = 'active' THEN 'Working'
          WHEN e.status_ = 'inactive' THEN 'Not Working'
          ELSE e.status_
        END AS status
      FROM t_employee e
      JOIN t_role r ON e.role_id = r.role_id
      WHERE e.type_ = 'employee'
    `);
    
    res.json(rows);
  } catch (err) {
    console.error('🛑 Failed to fetch employees:', err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Generate a random 6-digit OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// Store OTPs temporarily
const otpStorage = new Map();

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Forgot password endpoint
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  try {
    const [rows] = await pool.query('SELECT * FROM t_employee WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const otp = generateOTP();
    otpStorage.set(email, {
      otp,
      expires: Date.now() + 300000
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP for password reset is: ${otp}. This code expires in 5 minutes.`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('Error in forgot password:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Verify OTP endpoint
app.post('/api/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  
  try {
    const storedData = otpStorage.get(email);
    
    if (!storedData || storedData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    if (Date.now() > storedData.expires) {
      otpStorage.delete(email);
      return res.status(400).json({ error: 'OTP expired' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    otpStorage.set(email, {
      ...storedData,
      resetToken,
      tokenExpires: Date.now() + 3600000
    });

    res.json({ 
      message: 'OTP verified',
      resetToken 
    });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Reset password endpoint
app.post('/api/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  
  try {
    const storedData = otpStorage.get(email);
    
    if (!storedData || storedData.resetToken !== token) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    if (Date.now() > storedData.tokenExpires) {
      otpStorage.delete(email);
      return res.status(400).json({ error: 'Token expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await pool.query(
      'UPDATE t_employee SET password_hash = ? WHERE email = ?',
      [hashedPassword, email]
    );
    
    otpStorage.delete(email);
    
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Route middlewares
app.use('/api/manager', profileRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/shifts', shiftRoutes);
app.use('/payroll', payrollRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/normal-qr', normalQRRouter);
app.use('/api/manager-notifications', managerNotificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/leave', leaveRoutes);

// Authentication routes
app.post('/api/register', register);
app.post('/api/login', login);

// Serve static assets
app.use(express.static(path.join(__dirname, '../Front_End_Web')));

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../Front_End_Web', '404.html'));
});

// Start server
app.listen(3000, '0.0.0.0', () => {
  console.log("Server running on http://localhost:3000");
});

// Additional code from second file
const leavesRoutes = require('./leavesRoutes');
const leavesController = require('./leavesController'); //Added by Cletus.
const shiftSwapRoutes = require('./shiftSwapRoutes'); //Added by Cletus.
const qrRoute = require('./qrRoutes'); //Added by Cletus
const profilesRoutes = require('./profilesRoutes'); //Added by Cletus.
const menuRoutes = require('./menuRoutes'); //Added by Cletus.
const menuController = require('./menuController'); //Added by Cletus.
const scheduleRoute = require('./scheduleRoute'); //Added by Cletus.
// const shiftRoutes = require('./shiftRoute');
const forgotPassRoute = require('./forgotPassRoute');
const notifyRoute = require('./notifyRoute');
const payrollsRoute = require('./payrollsRoutes');

app.use(express.urlencoded({ extended: true })); // For form submissions

app.set('view engine', 'ejs');

// Make database pool available in routes
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Test API endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: "API works on web & mobile!" });
});

//No session check
app.post('/api/leave/request', leaveController.requestLeave); //Added by Cletus.
app.post('/api/leave/request', leavesController.requestLeave); //Added by Cletus.

app.use('/api/leave', leavesRoutes);

app.get('/register', (req, res) => {
    res.render('registration', { 
        formData: {}, 
        errorMessage: null, 
        successMessage: null, 
        temporaryPassword: null 
    });
});

// Protected profile route
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    res.json({ user: req.session.user });
});

//CLETUS
//Shiftswap routes....
app.use('/api/shift-swap', shiftSwapRoutes);

//Qr Code routes
app.use('/api/qr', qrRoute)
//Profile route
app.use('/api/profile', profilesRoutes);
//Burger menu route.
app.use('/api/menu', menuRoutes);

app.post('/api/menu/respond', menuController.getEmpDetails); //Added by Cletus.
//Schedule route
app.use('/api/schedule', scheduleRoute); //Added by Cletus.

// app.use('/api/shifts', shiftRoutes);

app.use('/api', forgotPassRoute);

app.use('/api', notifyRoute);

app.use('/api/payroll', payrollsRoute);

// SHAYZAAD - Added roles endpoint
app.get('/api/roles', async (req, res) => {
  try {
    const [roles] = await pool.query('SELECT role_id, title FROM t_role');
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Server error' });
  }
});