const express = require('express');
const session = require('express-session');
//const cors = require('cors');
const app = express();
const PORT = 3000;
const pool = require('./db');
const authRoutes = require('./authRoutes');
const leaveRoutes = require('./leaveRoutes');
const shiftReplacementSystem = require('./shiftReplacement'); //SHAYZAAD
const { createMonthlyShifts, updateWeeklyStandbyStatus } = require('./shiftSchedular'); //SHAYZAAD
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
  // origin: [
  //   'http://localhost:3000',
  //   'http://127.0.0.1:5500',
  //   'http://localhost:5500',
  //   'http://127.0.0.1:3000',
  //   'http://localhost' //Added for Yatin's frontend
  // ],
  origin: '*',
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

//==========================CRON JOBS ADDED BY SHAYZAAD==========================
shiftReplacementSystem.handleShiftReplacements(); //Run shift replacement check immediately on startup

//Schedule shift replacement system to run every 1 minutes
cron.schedule('*/1 * * * *', () => {
    console.log('Running scheduled shift replacement check...');
    shiftReplacementSystem.handleShiftReplacements();
});

//Create shifts for the entire next month on the last Tuesday of each month at 10:00 UTC
//This creates all shifts for the upcoming month
cron.schedule('0 10 * * 2', async () => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    //Check if next Tuesday would be in the next month
    if (nextWeek.getMonth() !== today.getMonth()) {
        console.log('Running monthly shift creation for upcoming month...');
        try {
            await createMonthlyShifts();
            console.log('Monthly shift creation completed successfully');
        } catch (error) {
            console.error('Error in monthly shift creation:', error);
        }
    }
});

//Update standby status every Tuesday at 10:00 UTC (weekly rotation)
//This rotates standby employees every week while keeping the monthly shift schedule
cron.schedule('0 10 * * 2', async () => {
    console.log('Running weekly standby status update...');
    try {
        await updateWeeklyStandbyStatus();
        console.log('Weekly standby status update completed successfully');
    } catch (error) {
        console.error('Error in weekly standby status update:', error);
    }
});
//==========================END OF CRON JOBS==========================

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
    res.sendFile(path.join(__dirname, 'Front_End_Web', 'signin.html'));
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
  res.sendFile(path.join(__dirname, 'Front_End_Web', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'Front_End_Web')));
app.use('/lib', express.static(path.join(__dirname, 'node_modules')));
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
    const [roles] = await pool.query(`
      SELECT role_id, title 
      FROM t_role 
      WHERE title != 'Leader'
    `);
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

//======================================Endpoints for testing shift creation======================================
//SHAYZAAD: Manual trigger endpoint for testing monthly shift creation
app.post('/api/admin/create-monthly-shifts', async (req, res) => {
    try {
        console.log('Manual monthly shift creation triggered');
        await createMonthlyShifts();
        res.json({ 
            success: true, 
            message: 'Monthly shifts created successfully' 
        });
    } catch (error) {
        console.error('Error in manual monthly shift creation:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

//SHAYZAAD: Manual trigger endpoint for testing weekly standby updates
app.post('/api/admin/update-standby', async (req, res) => {
    try {
        console.log('Manual standby update triggered');
        await updateWeeklyStandbyStatus();
        res.json({ 
            success: true, 
            message: 'Standby status updated successfully' 
        });
    } catch (error) {
        console.error('Error in manual standby update:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

//SHAYZAAD: Add an endpoint to check next scheduled operations
app.get('/api/admin/next-scheduled-operations', (req, res) => {
    const now = new Date();
    
    // Find next month creation (last Tuesday of month)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
    let lastTuesdayOfNextMonth = new Date(lastDayOfNextMonth);
    
    // Find last Tuesday of next month
    while (lastTuesdayOfNextMonth.getDay() !== 2) {
        lastTuesdayOfNextMonth.setDate(lastTuesdayOfNextMonth.getDate() - 1);
    }
    lastTuesdayOfNextMonth.setHours(10, 0, 0, 0);
    
    // Find next Tuesday for standby update
    let nextTuesday = new Date(now);
    const daysUntilTuesday = (2 + 7 - now.getDay()) % 7;
    if (daysUntilTuesday === 0 && now.getHours() >= 9) {
        nextTuesday.setDate(now.getDate() + 7);
    } else {
        nextTuesday.setDate(now.getDate() + (daysUntilTuesday || 7));
    }
    nextTuesday.setHours(9, 0, 0, 0);
    
    res.json({
        current_time: now.toISOString(),
        next_monthly_shift_creation: lastTuesdayOfNextMonth.toISOString(),
        next_standby_update: nextTuesday.toISOString(),
        hours_until_next_standby_update: Math.round((nextTuesday - now) / (1000 * 60 * 60)),
        hours_until_next_monthly_creation: Math.round((lastTuesdayOfNextMonth - now) / (1000 * 60 * 60))
    });
});

//SHAYZAAD: Keeping the old weekly endpoint incase needed
app.post('/api/admin/create-shifts', async (req, res) => {
    try {
        console.log('Legacy weekly shift creation - redirecting to monthly creation');
        await createMonthlyShifts();
        res.json({ 
            success: true, 
            message: 'Monthly shifts created successfully (legacy endpoint)' 
        });
    } catch (error) {
        console.error('Error in legacy shift creation:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
//======================================End of Endpoints for testing shift creation======================================


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

const eventRoutes = require('./eventRoutes');
app.use('/api', eventRoutes);

// Scheduled task to send event notifications
// const checkEventNotifications = async () => {
//   try {
//     const currentDate = new Date();
//     console.log('Checking for pending event notifications...');
    
//     // Find notifications that are scheduled for today or earlier but not read yet
//     const [notifications] = await pool.execute(
//       `SELECT n.notification_id, n.employee_id, n.message, e.email, e.first_name
//        FROM t_notification n
//        JOIN t_employee e ON n.employee_id = e.employee_id
//        WHERE n.sent_time <= ? 
//        AND n.read_status = 'unread'
//        AND n.notification_type_id = 7`,
//       [currentDate]
//     );
    
//     for (const notification of notifications) {
//       console.log(`Event notification ready for employee ${notification.employee_id}: ${notification.message}`);
      
      
//       console.log(`Would send notification to ${notification.email}: ${notification.message}`);
      
//     }
    
//     console.log(`Found ${notifications.length} event notifications ready for delivery`);
    
//   } catch (err) {
//     console.error('Error in event notification check:', err);
//   }
// };

// // Run notification check every hour to catch notifications
// cron.schedule('0 * * * *', checkEventNotifications);

// // Also run immediately on server start
// setTimeout(checkEventNotifications, 5000); // Wait 5 seconds after server start

// // Run notification check daily at 9:00 AM
// cron.schedule('0 9 * * *', checkEventNotifications);

// // Also run immediately on server start
// checkEventNotifications();  

// Add this check on server startup
const ensureEventNotificationType = async () => {
  try {
    const [existing] = await pool.execute(
      `SELECT * FROM t_notification_type WHERE notification_type_id = 7`
    );
    
    if (existing.length === 0) {
      await pool.execute(
        `INSERT INTO t_notification_type (notification_type_id, _name) VALUES (7, 'event')`
      );
      console.log('Created event notification type');
    }
  } catch (err) {
    console.error('Error ensuring event notification type:', err);
  }
};

// Call this on server startup
ensureEventNotificationType();

const eventReminderState = new Map(); // In-memory storage for reminder status

const sendEventRemindersMemory = async () => {
  try {
    const currentDate = new Date();
    console.log('Checking for event reminders (7 days before event)...');
    
    // Calculate date 7 days from now
    const sevenDaysFromNow = new Date(currentDate);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysFromNowStr = sevenDaysFromNow.toISOString().split('T')[0];
    
    // Find events starting in exactly 7 days
    const [eventsDueForReminder] = await pool.execute( // CHANGE db to pool
      `SELECT e.event_id, e.event_name, e.start_date, 
              ee.employee_id, emp.first_name, emp.email
       FROM t_event e
       JOIN t_event_employee ee ON e.event_id = ee.event_id
       JOIN t_employee emp ON ee.employee_id = emp.employee_id
       WHERE e.start_date = ?`,
      [sevenDaysFromNowStr]
    );
    
    if (eventsDueForReminder.length === 0) {
      console.log('No events require 7-day reminders today.');
      return;
    }
    
    // Group by event
    const eventsMap = new Map();
    eventsDueForReminder.forEach(row => {
      if (!eventsMap.has(row.event_id)) {
        eventsMap.set(row.event_id, {
          event_name: row.event_name,
          start_date: row.start_date,
          employees: []
        });
      }
      eventsMap.get(row.event_id).employees.push({
        employee_id: row.employee_id,
        first_name: row.first_name,
        email: row.email
      });
    });
    
    // Send reminders only for events that haven't been reminded yet today
    for (const [eventId, eventData] of eventsMap) {
      const reminderKey = `${eventId}-${currentDate.toISOString().split('T')[0]}`;
      
      if (eventReminderState.has(reminderKey)) {
        console.log(`Reminders already sent today for event: ${eventData.event_name}`);
        continue;
      }
      
      console.log(`Sending 7-day reminders for event: ${eventData.event_name}`);
      
      for (const employee of eventData.employees) {
        // Create the reminder notification
        await pool.execute( // CHANGE db to pool
          `INSERT INTO t_notification 
           (employee_id, message, sent_time, read_status, notification_type_id) 
           VALUES (?, ?, NOW(), 'unread', 7)`,
          [
            employee.employee_id,
            `Reminder: Event "${eventData.event_name}" is starting in 7 days (${new Date(eventData.start_date).toLocaleDateString()}). Please check your schedule.`
          ]
        );
        
        console.log(`7-day reminder sent to ${employee.first_name} (${employee.email})`);
      }
      
      // Mark as sent in memory
      eventReminderState.set(reminderKey, true);
    }
    
    console.log(`Sent 7-day reminders for ${eventsMap.size} events`);
    
    // Clean up old memory entries (older than 2 days)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    for (const [key] of eventReminderState) {
      const keyDate = new Date(key.split('-').slice(1).join('-'));
      if (keyDate < twoDaysAgo) {
        eventReminderState.delete(key);
      }
    }
    
  } catch (err) {
    console.error('Error in event reminder check:', err);
  }
};

// Schedule the memory-based reminder check
cron.schedule('0 9 * * *', sendEventRemindersMemory); // Daily at 9 AM

// Run immediately on server start
setTimeout(sendEventRemindersMemory, 10000);
//End of Yatin's code