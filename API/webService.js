const express = require('express');
const session = require('express-session');
//const cors = require('cors');
const app = express();
const PORT = 3000;
const pool = require('./db');
const authRoutes = require('./authRoutes');
const leaveRoutes = require('./leaveRoutes');
const shiftsRoutes = require('./shiftsRoutes'); //SHAYZAAD
const payrollRoutes = require('./payrollRoutes'); //SHAYZAAD
const overtimeRoutes = require('./overtimeRoutes');;//SHAYZAAD
const normalQRRouter = require('./normalRoutes');//SHAYZAAD
const leaveController = require('./leaveController'); //Added by Cletus.
const profileRoutes = require('./profileRoutes'); // Added by Yatin
const employeeRoutes = require('./employeeRoutes'); // Added by Yatin
const reportRoutes = require('./reportRoutes'); // Added by Yatin
const cors = require('cors'); //Added by Yatin for testing
const leavesRoutes = require('./leavesRoutes');
const leavesController = require('./leavesController'); //Added by Cletus.
const shiftSwapRoutes = require('./shiftSwapRoutes'); //Added by Cletus.
const messagesRoute = require('./messagesRoute');
const messagesController = require('./messagesController'); //Added by Cletus.
const qrRoute = require('./qrRoutes'); //Added by Cletus
const cron = require('node-cron');  //Added by Cletus for scheduling tasks
const profilesRoutes = require('./profilesRoutes'); //Added by Cletus.
const menuRoutes = require('./menuRoutes'); //Added by Cletus.
const menuController = require('./menuController'); //Added by Cletus.
const scheduleRoute = require('./scheduleRoute'); //Added by Cletus.
//const jwt = require('jsonwebtoken');   //Added by Cletus for JWT authentication.
const shiftRoutes = require('./shiftRoute');
const forgotPassRoute = require('./forgotPassRoute');
const notifyRoute = require('./notifyRoute');
const payrollsRoute = require('./payrollsRoutes');
//Katlego
const { register, login, logout } = require('./authControllerMan');
const managerNotificationRoutes = require('./manager_notifications'); 
const statusRoutes = require('./statusRoutes');
const webforgotPassRoute = require('./webForgotPassRoute');
const messagesRouter = require('./messages');
const path = require('path');


//Load environment variables
require('dotenv').config();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://localhost' //Added for Yatin's frontend
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Cookie',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  optionsSuccessStatus: 200 //Some legacy browsers choke on 204
}));

app.use(express.urlencoded({ extended: true })); //For form submissions
app.use(express.json()); //For API JSON payloads


//Start of Cletus's code
//Serve static files from the 'uploads' directory
app.use('/uploads', express.static('uploads')); //Added by Cletus.

//Method to handle leave status updates.
// async function updateLeaveStatuses() {
//   try {
//     const [rows] = await pool.execute(
//       `SELECT employee_id FROM t_leave 
//        WHERE status_ = 'approved' 
//        AND end_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
//     );

//     for (const row of rows) {
//       await pool.execute(
//         `UPDATE t_employee 
//          SET status_ = 'Not Working' 
//          WHERE employee_id = ? AND status_ = 'On Leave'`,
//         [row.employee_id]
//       );

//       await pool.execute(
//         `INSERT INTO t_notification 
//          (employee_id, message, sent_time, read_status, notification_type_id)
//          VALUES (?, ?, NOW(), 'unread', 1)`,
//         [row.employee_id, 'Your leave has ended. Your status has been updated to "Not Working".']
//       );
//     }
//   } catch (err) {
//     console.error('Error in leave status update job:', err);
//   }
// }

//Run immediately
//updateLeaveStatuses();

//Also schedule daily at midnight
//cron.schedule('* * * * *', updateLeaveStatuses);
//End of cron job added by Cletus.

//SHAYZAAD - Cors Middleware
//app.use(cors());
// Middleware
//app.use(express.json());

//app.set('view engine', 'ejs');

// In webService.js, replace CORS middleware with:
// app.use((req, res, next) => {
//   const origin = req.headers.origin;
  
//   // List of allowed origins - add your frontend URLs here
//   const allowedOrigins = [
//     'http://localhost:3000',
//     'http://127.0.0.1:5500',
//     'http://localhost:5500',
//     'http://127.0.0.1:3000'
//   ];
  
//   // Check if origin is in allowed list
//   if (allowedOrigins.includes(origin)) {
//     res.header('Access-Control-Allow-Origin', origin);
//   }
  
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
//   res.header('Access-Control-Allow-Credentials', 'true'); // This is important for credentials
//   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
//   // Handle preflight requests
//   if (req.method === 'OPTIONS') {
//     return res.sendStatus(200);
//   }
//   next();
// });

//SHAYZAAD
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Front_End_Web', 'signin.html'));
});

//Test API endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: "API works on web & mobile!" });
});

//Session configuration - DO WE NEED (SHAYZAAD)??
//Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-strong-secret-here',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', //HTTPS in production
        maxAge: 3600000, //1 hour
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' //Important for cross-origin
    }
}));

//Make database pool available in routes
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Routes
// app.get('/', (req, res) => {
//     res.send('Hello from Express!');
// });

//Auth routes 
app.use('/auth', authRoutes);

//Leave routes

//No session check
//app.post('/api/leave/request', leaveController.requestLeave); //Added by Cletus.
//app.post('/api/leaves/request', leavesController.requestLeave); //Added by Cletus.


// app.use('/api/leave', (req, res, next) => {
//     if (!req.session.user) {
//         return res.status(401).json({ message: 'Unauthorized' });
//     }
//     next();
// }, leaveRoutes);

//No session check - Edited by Shayzaad
app.use('/api/leave', leaveRoutes); 


app.use('/api/manager', profileRoutes); //Added by Yatin
app.use('/api/employees', employeeRoutes); //Added by Yatin
app.use('/api/reports', reportRoutes); // Added by Yatin

// app.use(cors({                          // Added by Yatin for testing
//     origin: 'http://localhost', // Or your frontend URL
//     methods: ['GET', 'POST', 'PUT', 'DELETE'],
//     allowedHeaders: ['Content-Type', 'Authorization']
// }));

//---------------------------------------------------------------------------------------------------
//Katlego
//Replace all CORS configurations with this single one:
// app.use(cors({
//   origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
//   credentials: true,
//   methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
// }));

//Katlego
app.post('/api/login', login);
app.use('/api/manager-notifications', managerNotificationRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/web', webforgotPassRoute);
app.use('/api/notifications-messages', messagesRouter);
app.get('/api/employees/search', async (req, res) => {
  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT employee_id FROM t_employee WHERE CONCAT(first_name, ' ', last_name) = ? AND type_ != 'manager'`,
      [name]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (rows.length > 1) {
      return res.status(409).json({ error: 'Multiple employees found with the same name; contact admin' });
    }
    res.json({ employee_id: rows[0].employee_id });
  } catch (err) {
    console.error('Error searching employee:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


//Routes for HTML pages
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../Front_End_Web', 'index.html'));
});

app.use(express.static(path.join(__dirname, '../Front_End_Web')));
//---------------------------------------------------------------------------------------------------

// app.use('/api/reports', (req, res, next) => {   //Added by Yatin, still in progress...
//     if (!req.session.user) {
//         return res.status(401).json({ message: 'Unauthorized' });
//     }
//     next();
// }, reportRoutes);

//SHAYZAAD - Added middleware for the shifts routes
app.use('/shifts', shiftsRoutes)

//SHAYZAAD - Added middleware for the payroll routes
app.use('/payroll', payrollRoutes);

//SHAYZAAD - Added middleware for the overtime routes
app.use('/api/overtime', overtimeRoutes);

//SHAYZAAD - Added middleware for the normal QR routes
app.use('/api/normal-qr', normalQRRouter);

//SHAYZAAD - Added roles endpoint
app.get('/api/roles', async (req, res) => {
  try {
    const [roles] = await pool.query('SELECT role_id, title FROM t_role');
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// app.use('/api/leave', (req, res, next) => {
//     if (!req.session.user) {
//         return res.status(401).json({ message: 'Unauthorized' });
//     }
//     next();
// }, leaveRoutes);

app.get('/register', (req, res) => {
    res.render('registration', { 
        formData: {}, 
        errorMessage: null, 
        successMessage: null, 
        temporaryPassword: null 
    });
});

//Protected profile route
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    res.json({ user: req.session.user });
});

app.listen(3000, '0.0.0.0', () => {  // Listen on all network interfaces
    console.log("Server running on http://localhost:3000");
});

//CLETUS

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error('JWT verification error:', err);
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Token expired' });
      }
      return res.status(403).json({ message: 'Invalid token' });
    }

    //Attach decoded user to request
    req.user = decoded;
    next();
  });
};


app.use('/api/leaves', leavesRoutes);
//Shiftswap routes....
app.use('/api/shift-swap', shiftSwapRoutes);

//Qr Code routes
app.use('/api/qr', qrRoute); //Added by Cletus.
//Profile route
app.use('/api/profile', profilesRoutes); //Added by Cletus.
//Burger menu route.
app.use('/api/menu', menuRoutes); //Added by Cletus.

app.post('/api/menu/respond', menuController.getEmpDetails); //Added by Cletus.
//Schedule route
app.use('/api/schedule', scheduleRoute); //Added by Cletus.

app.use('/api/shifts', shiftRoutes); //Added by Cletus.

app.use('/api', forgotPassRoute); //Added by Cletus.

app.use('/api', notifyRoute); //Added by Cletus.

app.use('/api/payroll', payrollsRoute); //Added by Cletus.
//app.post('/api/conversation/:employeeId', messagesController.getMessages); //Added by Cletus.

app.use('/api/conversation', messagesRoute); //Added by Cletus.

//Added By Yatin for messages:

const messageRoutes = require('./messageRoutes');
app.use('/api/messages', messageRoutes);

//End of Yatin's Message code

//Yatin:
const uploadsPath = path.join(__dirname, 'uploads');

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsPath, {
    setHeaders: (res, path) => {
        if (path.endsWith('.pdf')) {
            res.set('Content-Type', 'application/pdf');
        }
    }
}));

//added route to serve the view-sick-note.html
app.get('/view-sick-note.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view-sick-note.html'));
});

//added this route to serve the sick note viewer
app.get('/view-sick-note.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view-sick-note.html'));
});

//End of Yatin's code

const eventRoutes = require('./eventRoutes');
app.use('/api', eventRoutes);