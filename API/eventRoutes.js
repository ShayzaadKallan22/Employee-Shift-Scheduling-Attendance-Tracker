const express = require('express');
const router = express.Router();
const db = require('./db');

const validateEventDates = (req, res, next) => {
  const { start_date, end_date } = req.body;
  
  if (!start_date || !end_date) {
    return res.status(400).json({ message: 'Start date and end date are required' });
  }
  
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const today = new Date();
  
  // Check if event spans more than 7 days
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
  
  if (diffDays > 7) {
    return res.status(400).json({ 
      message: 'Event cannot span more than 7 days' 
    });
  }
  
  // Check for closed days (Tuesday, Wednesday, Thursday)
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) { // Tuesday, Wednesday, Thursday
      return res.status(400).json({ 
        message: 'Night Lounge is closed on Tuesdays, Wednesdays, and Thursdays. Please choose different dates.' 
      });
    }
  }
  
  next();
};


// Create new event
// router.post('/events', validateEventDates, async (req, res) => {
//   // Get organizer_id from body or session
//   let organizer_id = req.body.organizer_id;
  
//   // If not provided in body, try to get from session
//   if (!organizer_id && req.session.user) {
//     organizer_id = req.session.user.employee_id;
//   }
  
//   // If still not available, return error
//   if (!organizer_id) {
//     return res.status(400).json({ message: 'Organizer ID is required' });
//   }
  
//   const { event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance } = req.body;
  
//   try {
//     const [result] = await db.execute(
//       `INSERT INTO t_event 
//        (event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance, organizer_id)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         event_name || '', 
//         description || '', 
//         start_date || null, 
//         end_date || null, 
//         start_time || null, 
//         end_time || null, 
//         location || 'Night Lounge', 
//         expected_attendance || null, 
//         organizer_id
//       ]
//     );

//     // If roles are provided in the request, assign staff and schedule notifications
//     if (req.body.roleIds && req.body.roleIds.length > 0) {
//       await db.execute('DELETE FROM t_event_employee WHERE event_id = ?', [result.insertId]);
      
//       // Get employees with selected roles
//       const [employees] = await db.query(
//         `SELECT employee_id FROM t_employee WHERE role_id IN (?)`,
//         [req.body.roleIds]
//       );
      
//       // Assign employees
//       for (const employee of employees) {
//         const [roleData] = await db.query(
//           `SELECT title FROM t_role WHERE role_id = (
//             SELECT role_id FROM t_employee WHERE employee_id = ?
//           )`,
//           [employee.employee_id]
//         );
        
//         const roleTitle = roleData[0]?.title?.toLowerCase() || 'staff';
        
//         await db.execute(
//           `INSERT INTO t_event_employee (event_id, employee_id, role_id) 
//            VALUES (?, ?, ?)`,
//           [result.insertId, employee.employee_id, roleTitle]
//         );
//       }
      
//       // Schedule notifications
//       await sendEventNotifications(result.insertId);
//     }
    
//     res.status(201).json({ 
//       message: 'Event created successfully',
//       event_id: result.insertId 
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.post('/events', validateEventDates, async (req, res) => {
  // Get organizer_id from body or session
  let organizer_id = req.body.organizer_id;
  
  // If not provided in body, try to get from session
  if (!organizer_id && req.session.user) {
    organizer_id = req.session.user.employee_id;
  }
  
  // If still not available, return error
  if (!organizer_id) {
    return res.status(400).json({ message: 'Organizer ID is required' });
  }
  
  const { event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance } = req.body;
  
  try {
    const [result] = await db.execute(
      `INSERT INTO t_event 
       (event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance, organizer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event_name || '', 
        description || '', 
        start_date || null, 
        end_date || null, 
        start_time || null, 
        end_time || null, 
        location || 'Night Lounge', 
        expected_attendance || null, 
        organizer_id
      ]
    );

    // If roles are provided in the request, assign staff and schedule notifications
    if (req.body.roleIds && req.body.roleIds.length > 0) {
      await db.execute('DELETE FROM t_event_employee WHERE event_id = ?', [result.insertId]);
      
      // Get employees with selected roles
      const [employees] = await db.query(
        `SELECT employee_id, role_id FROM t_employee WHERE role_id IN (?)`, // ← Get role_id directly
        [req.body.roleIds]
      );
      
      // Assign employees - FIXED VERSION
      for (const employee of employees) {
        await db.execute(
          `INSERT INTO t_event_employee (event_id, employee_id, role_id) 
           VALUES (?, ?, ?)`,
          [result.insertId, employee.employee_id, employee.role_id] // ← Use the role_id from the employee
        );
      }
      
      // Schedule notifications
      // await sendEventNotifications(result.insertId);
    }
    
    res.status(201).json({ 
      message: 'Event created successfully',
      event_id: result.insertId 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get events within date range
router.get('/events', async (req, res) => {
    const { start_date, end_date } = req.query;
    
    try {
        const [events] = await db.query(
            `SELECT e.*, 
                    CONCAT(emp.first_name, ' ', emp.last_name) AS organizer_name
             FROM t_event e
             JOIN t_employee emp ON e.organizer_id = emp.employee_id
             WHERE e.end_date >= ? AND e.start_date <= ?
             ORDER BY e.start_date, e.start_time`,
            [start_date || new Date().toISOString().split('T')[0], 
             end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]
        );
        
        res.status(200).json(events);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Check for events during leave period
router.get('/events/check-leave', async (req, res) => {
    const { employee_id, start_date, end_date } = req.query;
    
    try {
        // Check if employee is assigned to any events during leave period
        const [events] = await db.query(
            `SELECT e.* 
             FROM t_event e
             JOIN t_event_employee ee ON e.event_id = ee.event_id
             WHERE ee.employee_id = ?
               AND e.end_date >= ? 
               AND e.start_date <= ?`,
            [employee_id, start_date, end_date]
        );
        
        res.status(200).json({ hasEvents: events.length > 0, events });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// NEW ROUTES FOR EVENT MANAGEMENT

// Get all events (for event management page)
router.get('/', async (req, res) => {
    try {
        const [events] = await db.query(
            `SELECT e.*, 
                    CONCAT(emp.first_name, ' ', emp.last_name) AS organizer_name
             FROM t_event e
             LEFT JOIN t_employee emp ON e.organizer_id = emp.employee_id
             ORDER BY e.start_date, e.start_time`
        );
        
        res.status(200).json(events);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a specific event
router.put('/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const { event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance } = req.body;

    try {
        await db.execute(
            `UPDATE t_event 
             SET event_name = ?, description = ?, start_date = ?, end_date = ?, 
                 start_time = ?, end_time = ?, location = ?, expected_attendance = ?
             WHERE event_id = ?`,
            [
                event_name || '', 
                description || '', 
                start_date || null, 
                end_date || null, 
                start_time || null, 
                end_time || null, 
                location || 'Night Lounge', 
                expected_attendance || null, 
                eventId
            ]
        );
        
        res.status(200).json({ message: 'Event updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update an event
router.put('/:eventId', validateEventDates, async (req, res) => {
    const { eventId } = req.params;
    const { event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance } = req.body;

    try {
        await db.execute(
            `UPDATE t_event 
             SET event_name = ?, description = ?, start_date = ?, end_date = ?, 
                 start_time = ?, end_time = ?, location = ?, expected_attendance = ?
             WHERE event_id = ?`,
            [event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance, eventId]
        );
        
        res.status(200).json({ message: 'Event updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete an event
router.delete('/:eventId', async (req, res) => {
    const { eventId } = req.params;
    
    try {
        await db.execute('DELETE FROM t_event WHERE event_id = ?', [eventId]);
        res.status(200).json({ message: 'Event deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get staff assigned to an event
// router.get('/:eventId/staff', async (req, res) => {
//     const { eventId } = req.params;
    
//     try {
//         const [staff] = await db.query(
//             `SELECT e.employee_id, e.first_name, e.last_name, r.title, ee.role
//              FROM t_event_employee ee
//              JOIN t_employee e ON ee.employee_id = e.employee_id
//              JOIN t_role r ON e.role_id = r.role_id
//              WHERE ee.event_id = ?`,
//             [eventId]
//         );
        
//         res.status(200).json(staff);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: 'Server error' });
//     }
// });

// router.get('/:eventId/staff', async (req, res) => {
//   const { eventId } = req.params;
  
//   try {
//     const [staff] = await db.query(
//       `SELECT e.employee_id, e.first_name, e.last_name, r.title, r.role_id
//        FROM t_event_employee ee
//        JOIN t_employee e ON ee.employee_id = e.employee_id
//        JOIN t_role r ON ee.role_id = r.role_id
//        WHERE ee.event_id = ?`,
//       [eventId]
//     );
    
//     res.status(200).json(staff);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Get staff assigned to an event - UPDATED
// router.get('/:eventId/staff', async (req, res) => {
//   const { eventId } = req.params;
  
//   try {
//     const [staff] = await db.query(
//       `SELECT e.employee_id, e.first_name, e.last_name, r.title as role_name, r.role_id
//        FROM t_event_employee ee
//        JOIN t_employee e ON ee.employee_id = e.employee_id
//        JOIN t_role r ON ee.role_id = r.role_id  
//        WHERE ee.event_id = ?`,
//       [eventId]
//     );
    
//     res.status(200).json(staff);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// Get staff assigned to an event with shift information
router.get('/:eventId/staff', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    // First get the event dates
    const [event] = await db.query(
      `SELECT start_date, end_date FROM t_event WHERE event_id = ?`,
      [eventId]
    );
    
    if (event.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const eventStart = event[0].start_date;
    const eventEnd = event[0].end_date;
    
    // Get staff with shift information
    const [staff] = await db.query(
      `SELECT 
         e.employee_id, 
         e.first_name, 
         e.last_name, 
         r.title as role_name,
         r.role_id,
         EXISTS(
           SELECT 1 FROM t_shift s 
           WHERE s.employee_id = e.employee_id 
           AND s.date_ BETWEEN ? AND ?
           AND s.status_ = 'scheduled'
         ) as has_shift_during_event
       FROM t_event_employee ee
       JOIN t_employee e ON ee.employee_id = e.employee_id
       JOIN t_role r ON ee.role_id = r.role_id
       WHERE ee.event_id = ?`,
      [eventStart, eventEnd, eventId]
    );
    
    res.status(200).json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get count of staff assigned to an event
router.get('/:eventId/staff-count', async (req, res) => {
    const { eventId } = req.params;
    
    try {
        const [result] = await db.query(
            `SELECT COUNT(*) as count 
             FROM t_event_employee 
             WHERE event_id = ?`,
            [eventId]
        );
        
        res.status(200).json({ count: result[0].count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Assign staff to an event
// router.post('/:eventId/staff/:staffId', async (req, res) => {
//     const { eventId, staffId } = req.params;
//     const { role } = req.body;
    
//     try {
//         // Check if staff is already assigned to this event
//         const [existing] = await db.query(
//             `SELECT * FROM t_event_employee 
//              WHERE event_id = ? AND employee_id = ?`,
//             [eventId, staffId]
//         );
        
//         if (existing.length > 0) {
//             return res.status(400).json({ message: 'Staff already assigned to this event' });
//         }
        
//         await db.execute(
//             `INSERT INTO t_event_employee (event_id, employee_id, role)
//              VALUES (?, ?, ?)`,
//             [eventId, staffId, role || 'staff']
//         );
        
//         res.status(200).json({ message: 'Staff assigned to event successfully' });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: 'Server error' });
//     }
// });

// Assign staff to an event - UPDATED
router.post('/:eventId/staff/:staffId', async (req, res) => {
  const { eventId, staffId } = req.params;
  const { role_id } = req.body; // Changed from 'role' to 'role_id'
  
  try {
    // Check if staff is already assigned to this event
    const [existing] = await db.query(
      `SELECT * FROM t_event_employee 
       WHERE event_id = ? AND employee_id = ?`,
      [eventId, staffId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Staff already assigned to this event' });
    }
    
    // Get the employee's role_id from t_employee
    const [employeeData] = await db.query(
      `SELECT role_id FROM t_employee WHERE employee_id = ?`,
      [staffId]
    );
    
    const employeeRoleId = employeeData[0]?.role_id;
    
    if (!employeeRoleId) {
      return res.status(400).json({ message: 'Employee role not found' });
    }
    
    await db.execute(
      `INSERT INTO t_event_employee (event_id, employee_id, role_id)
       VALUES (?, ?, ?)`,
      [eventId, staffId, employeeRoleId]
    );
    
    res.status(200).json({ message: 'Staff assigned to event successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove staff from an event
router.delete('/:eventId/staff/:staffId', async (req, res) => {
    const { eventId, staffId } = req.params;
    
    try {
        await db.execute(
            `DELETE FROM t_event_employee 
             WHERE event_id = ? AND employee_id = ?`,
            [eventId, staffId]
        );
        
        res.status(200).json({ message: 'Staff removed from event successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Remove all staff from an event
router.delete('/:eventId/staff', async (req, res) => {
    const { eventId } = req.params;
    
    try {
        await db.execute(
            `DELETE FROM t_event_employee 
             WHERE event_id = ?`,
            [eventId]
        );
        
        res.status(200).json({ message: 'All staff removed from event successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get available staff (not assigned to any event during the specified time)
router.get('/employees/available', async (req, res) => {
    try {
        // const [staff] = await db.query(
        //     `SELECT e.employee_id, e.first_name, e.last_name, r.title
        //      FROM t_employee e
        //      JOIN t_role r ON e.role_id = r.role_id
        //      WHERE e.status_ = 'Working' AND e.type_ = 'employee'
        //      ORDER BY e.first_name, e.last_name`
        // );
        const [staff] = await db.query(
            `SELECT e.employee_id, e.first_name, e.last_name, r.title
             FROM t_employee e
             JOIN t_role r ON e.role_id = r.role_id
             WHERE e.type_ = 'employee'
             ORDER BY e.first_name, e.last_name`
        );
        
        res.status(200).json(staff);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// In your eventRoutes.js - update the roles endpoint
router.get('/:eventId/roles', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const [roles] = await db.query(
      `SELECT DISTINCT r.role_id 
       FROM t_event_employee ee
       JOIN t_employee e ON ee.employee_id = e.employee_id
       JOIN t_role r ON ee.role_id = r.role_id
       WHERE ee.event_id = ?`,
      [eventId]
    );
    
    // Extract just the role IDs and filter out any nulls
    const roleIds = roles.map(r => r.role_id).filter(id => id !== null);
    
    res.status(200).json({ roles: roleIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save required roles for an event
router.post('/:eventId/roles', async (req, res) => {
  const { eventId } = req.params;
  const { roles } = req.body;
  
  try {
    // For simplicity, we'll just ensure staff with these roles are assigned
    // In a real implementation, you might want to store required roles separately
    res.status(200).json({ message: 'Roles updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// router.get('/employees/role/:role', async (req, res) => {
//   const { role } = req.params;
  
//   try {
//     // Map role to title (adjust this based on your database structure)
//     const roleTitleMap = {
//       'bartender': 'Bartender',
//       'sparkler_girl': 'Sparkler Girl',
//       'waiter': 'Waiter',
//       'cleaner': 'Cleaner',
//       'bouncer': 'Bouncer',
//       'runner': 'Runner',
//       'leader': 'Manager'
//     };
    
//     const title = roleTitleMap[role];
    
//     if (!title) {
//       return res.status(400).json({ message: 'Invalid role' });
//     }
    
//     const [employees] = await db.query(
//       `SELECT e.employee_id, e.first_name, e.last_name, r.title
//        FROM t_employee e
//        JOIN t_role r ON e.role_id = r.role_id
//        WHERE r.title = ? AND e.status_ = 'Working'`,
//       [title]
//     );
    
//     res.status(200).json(employees);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// router.get('/role/:roleTitle', async (req, res) => {
//   const { roleTitle } = req.params;
  
//   try {
//     console.log('Searching for employees with role title:', roleTitle);
    
//     // Map frontend role names to database role titles
//     const roleTitleMap = {
//       'bartender': 'Bartender',
//       'sparkler_girl': 'Sparkler Girl', 
//       'waiter': 'Waiter',
//       'cleaner': 'Cleaner',
//       'bouncer': 'Bouncer',
//       'runner': 'Runners',  // Your DB has "Runners" (plural)
//       'manager': 'Leader'   // Your DB has "Leader" not "Manager"
//     };
    
//     const dbRoleTitle = roleTitleMap[roleTitle.toLowerCase()] || roleTitle;
//     console.log('Mapped to database role title:', dbRoleTitle);
    
//     // FIXED QUERY: Include all statuses except "On Leave"
//     const [employees] = await db.query(
//       `SELECT e.employee_id, e.first_name, e.last_name, r.title, e.status_
//        FROM t_employee e
//        JOIN t_role r ON e.role_id = r.role_id
//        WHERE r.title = ? AND e.status_ != 'On Leave'`,  // Changed this line
//       [dbRoleTitle]
//     );
    
//     console.log('Found employees:', employees);
//     res.status(200).json(employees);
//   } catch (err) {
//     console.error('Error fetching employees by role:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.get('/employees/role-id/:roleId', async (req, res) => {
  const { roleId } = req.params;
  
  try {
    const [employees] = await db.query(
      `SELECT e.employee_id, e.first_name, e.last_name, r.title, e.status_
       FROM t_employee e
       JOIN t_role r ON e.role_id = r.role_id
       WHERE e.role_id = ? AND e.status_ != 'On Leave'`,
      [roleId]
    );
    
    res.status(200).json(employees);
  } catch (err) {
    console.error('Error fetching employees by role ID:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this endpoint
router.get('/role-id/:roleId', async (req, res) => {
  const { roleId } = req.params;
  
  try {
    const [employees] = await db.query(
      `SELECT e.employee_id, e.first_name, e.last_name, r.title, e.status_
       FROM t_employee e
       JOIN t_role r ON e.role_id = r.role_id
       WHERE e.role_id = ? AND e.status_ != 'On Leave'`,
      [roleId]
    );
    
    res.status(200).json(employees);
  } catch (err) {
    console.error('Error fetching employees by role ID:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// In eventRoutes.js, add this if it doesn't exist
router.get('/events', async (req, res) => {
    try {
        const [events] = await db.query(
            `SELECT e.*, 
                    CONCAT(emp.first_name, ' ', emp.last_name) AS organizer_name
             FROM t_event e
             LEFT JOIN t_employee emp ON e.organizer_id = emp.employee_id
             ORDER BY e.start_date, e.start_time`
        );
        
        res.status(200).json(events);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Assign staff by role to event
// router.post('/:eventId/assign-by-role', async (req, res) => {
//   const { eventId } = req.params;
//   const { roleIds } = req.body;
  
//   try {
//     // First remove all existing staff from this event
//     await db.execute('DELETE FROM t_event_employee WHERE event_id = ?', [eventId]);
    
//     if (!roleIds || roleIds.length === 0) {
//       return res.status(200).json({ message: 'No roles selected, all staff removed' });
//     }
    
//     // Get all employees with the selected role IDs
//     const [employees] = await db.query(
//       `SELECT employee_id FROM t_employee WHERE role_id IN (?)`,
//       [roleIds]
//     );
    
//     // Assign each employee to the event
//     for (const employee of employees) {
//       // Get the role title for this employee
//       const [roleData] = await db.query(
//         `SELECT title FROM t_role WHERE role_id = (
//           SELECT role_id FROM t_employee WHERE employee_id = ?
//         )`,
//         [employee.employee_id]
//       );
      
//       const roleTitle = roleData[0]?.title?.toLowerCase() || 'staff';
      
//       await db.execute(
//         `INSERT INTO t_event_employee (event_id, employee_id, role) 
//          VALUES (?, ?, ?)`,
//         [eventId, employee.employee_id, roleTitle]
//       );
//     }
//     // await sendEventNotifications(eventId);
//     await sendImmediateEventNotifications(eventId, 'assignment');
//     res.status(200).json({ 
//       message: `Assigned ${employees.length} employees to event and scheduled notifications` 
//     });
    
//   } catch (err) {
//     console.error('Error assigning by role:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.post('/:eventId/assign-by-role', async (req, res) => {
  const { eventId } = req.params;
  const { roleIds } = req.body;
  
  try {
    // First remove all existing staff from this event
    await db.execute('DELETE FROM t_event_employee WHERE event_id = ?', [eventId]);
    
    if (!roleIds || roleIds.length === 0) {
      return res.status(200).json({ message: 'No roles selected, all staff removed' });
    }
    
    // Get all employees with the selected role IDs
    const [employees] = await db.query(
      `SELECT employee_id FROM t_employee WHERE role_id IN (?)`,
      [roleIds]
    );
    
    // Assign each employee to the event with their role_id
    for (const employee of employees) {
      // Get the employee's role_id from t_employee
      const [employeeData] = await db.query(
        `SELECT role_id FROM t_employee WHERE employee_id = ?`,
        [employee.employee_id]
      );
      
      const employeeRoleId = employeeData[0]?.role_id;
      
      if (employeeRoleId) {
        await db.execute(
          `INSERT INTO t_event_employee (event_id, employee_id, role_id) 
           VALUES (?, ?, ?)`,
          [eventId, employee.employee_id, employeeRoleId]
        );
      }
    }
    
    await sendImmediateEventNotifications(eventId, 'assignment');
    res.status(200).json({ 
      message: `Assigned ${employees.length} employees to event` 
    });
    
  } catch (err) {
    console.error('Error assigning by role:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get required roles for event
// router.get('/:eventId/required-roles', async (req, res) => {
//   const { eventId } = req.params;
  
//   try {
//     // Get unique role IDs from assigned staff
//     const [roles] = await db.query(
//       `SELECT DISTINCT r.role_id, r.title 
//        FROM t_event_employee ee
//        JOIN t_employee e ON ee.employee_id = e.employee_id
//        JOIN t_role r ON e.role_id = r.role_id
//        WHERE ee.event_id = ?`,
//       [eventId]
//     );
    
//     res.status(200).json(roles);
//   } catch (err) {
//     console.error('Error fetching required roles:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// router.get('/:eventId/required-roles', async (req, res) => {
//   const { eventId } = req.params;
  
//   try {
//     // Get unique role IDs from assigned staff
//     const [roles] = await db.query(
//       `SELECT DISTINCT r.role_id, r.title 
//        FROM t_event_employee ee
//        JOIN t_employee e ON ee.employee_id = e.employee_id
//        JOIN t_role r ON ee.role_id = r.role_id
//        WHERE ee.event_id = ?`,
//       [eventId]
//     );
    
//     res.status(200).json(roles);
//   } catch (err) {
//     console.error('Error fetching required roles:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// Update the required roles endpoint
router.get('/:eventId/required-roles', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    // Get unique role IDs from assigned staff
    const [roles] = await db.query(
      `SELECT DISTINCT r.role_id, r.title 
       FROM t_event_employee ee
       JOIN t_employee e ON ee.employee_id = e.employee_id
       JOIN t_role r ON ee.role_id = r.role_id
       WHERE ee.event_id = ?`,
      [eventId]
    );
    
    // Ensure role_id is returned as number
    const rolesWithNumbers = roles.map(role => ({
      ...role,
      role_id: parseInt(role.role_id) // Convert to number
    }));
    
    res.status(200).json(rolesWithNumbers);
  } catch (err) {
    console.error('Error fetching required roles:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// // Notification function for event assignments
// const sendEventNotifications = async (eventId) => {
//   try {
//     const [event] = await db.query(
//       `SELECT event_name, start_date, start_time, location 
//        FROM t_event WHERE event_id = ?`,
//       [eventId]
//     );
    
//     if (event.length === 0) return;
    
//     const eventData = event[0];
//     const eventDate = new Date(eventData.start_date);
    
//     // Calculate notification date (7 days before event)
//     const notificationDate = new Date(eventDate);
//     notificationDate.setDate(notificationDate.getDate() - 7);
    
//     // Get all employees assigned to this event
//     const [assignedEmployees] = await db.query(
//       `SELECT e.employee_id, e.first_name, e.email 
//        FROM t_event_employee ee
//        JOIN t_employee e ON ee.employee_id = e.employee_id
//        WHERE ee.event_id = ?`,
//       [eventId]
//     );
    
//     for (const employee of assignedEmployees) {
//       // Create notification with future sent_time
//       await db.execute(
//         `INSERT INTO t_notification 
//          (employee_id, message, sent_time, read_status, notification_type_id)
//          VALUES (?, ?, ?, 'unread', 7)`, // 7 = event type
//         [
//           employee.employee_id,
//           `Your role has been assigned to event "${eventData.event_name}" on ${eventData.start_date} at ${eventData.start_time} (${eventData.location}). Check your schedule to see if you'll be working during the event.`,
//           notificationDate
//         ]
//       );
      
//       console.log(`Notification scheduled for employee ${employee.employee_id} for event ${eventId}`);
//     }
    
//   } catch (err) {
//     console.error('Error creating event notifications:', err);
//   }
// };

// Get event notifications for an employee
// router.get('/employee/:employeeId/event-notifications', async (req, res) => {
//   const { employeeId } = req.params;
  
//   try {
//     const [notifications] = await db.query(
//       `SELECT n.*, e.event_name, e.start_date, e.start_time, e.location
//        FROM t_notification n
//        LEFT JOIN t_event e ON n.message LIKE CONCAT('%', e.event_name, '%')
//        WHERE n.employee_id = ? 
//        AND n.notification_type_id = 7
//        ORDER BY n.sent_time DESC`,
//       [employeeId]
//     );
    
//     res.status(200).json(notifications);
//   } catch (err) {
//     console.error('Error fetching event notifications:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// Mark notification as read
router.patch('/notification/:notificationId/read', async (req, res) => {
  const { notificationId } = req.params;
  
  try {
    await db.execute(
      `UPDATE t_notification SET read_status = 'read' WHERE notification_id = ?`,
      [notificationId]
    );
    
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Error updating notification:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Real-time event notification system with better logging
const sendImmediateEventNotifications = async (eventId, messageType = 'assignment') => {
  try {
    console.log(`Starting notification process for event ${eventId}`);
    
    const [event] = await db.query(
      `SELECT event_name, start_date, start_time, location 
       FROM t_event WHERE event_id = ?`,
      [eventId]
    );
    
    if (event.length === 0) {
      console.log(`Event ${eventId} not found`);
      return;
    }
    
    const eventData = event[0];
    console.log(`Found event: ${eventData.event_name}`);
    
    // // Get all employees assigned to this event
    // const [assignedEmployees] = await db.query(
    //   `SELECT e.employee_id, e.first_name, e.email 
    //    FROM t_event_employee ee
    //    JOIN t_employee e ON ee.employee_id = e.employee_id
    //    WHERE ee.event_id = ?`,
    //   [eventId]
    // );

    const [assignedEmployees] = await db.query(
      `SELECT e.employee_id, e.first_name, e.email, r.title as role_title
       FROM t_event_employee ee
       JOIN t_employee e ON ee.employee_id = e.employee_id
       JOIN t_role r ON ee.role_id = r.role_id
       WHERE ee.event_id = ?`,
      [eventId]
    );
    
    console.log(`Found ${assignedEmployees.length} employees assigned to event`);
    
    if (assignedEmployees.length === 0) {
      console.log('No employees assigned to this event');
      return;
    }
    
    let message = '';
    const currentDate = new Date();
    
    if (messageType === 'assignment') {
      message = `Your role has been assigned to event "${eventData.event_name}" on ${eventData.start_date} at ${eventData.start_time} (${eventData.location}). Check your schedule to see if you'll be working during the event.`;
    } else if (messageType === 'reminder') {
      const eventDate = new Date(eventData.start_date);
      const daysUntilEvent = Math.ceil((eventDate - currentDate) / (1000 * 60 * 60 * 24));
      message = `Reminder: Event "${eventData.event_name}" is in ${daysUntilEvent} days (${eventData.start_date} at ${eventData.start_time}, ${eventData.location}).`;
    }
    
    let notificationCount = 0;
    
    for (const employee of assignedEmployees) {
      console.log(`Creating notification for employee ${employee.employee_id}: ${employee.first_name}`);
      
      try {
        // Create immediate notification
        const [result] = await db.execute(
          `INSERT INTO t_notification 
           (employee_id, message, sent_time, read_status, notification_type_id)
           VALUES (?, ?, NOW(), 'unread', 7)`,
          [employee.employee_id, message]
        );
        
        console.log(`✓ Notification created with ID: ${result.insertId}`);
        notificationCount++;
        
      } catch (err) {
        console.error(`✗ Error creating notification for employee ${employee.employee_id}:`, err);
      }
    }
    
    console.log(`Successfully created ${notificationCount} notifications for event ${eventId}`);
    
  } catch (err) {
    console.error('Error in sendImmediateEventNotifications:', err);
  }
};

// // Weekly event reminder check
// const checkEventReminders = async () => {
//   try {
//     const currentDate = new Date();
//     console.log('Checking for event reminders...');
    
//     // Find events happening in the next 7 days
//     const nextWeek = new Date();
//     nextWeek.setDate(nextWeek.getDate() + 7);
    
//     const [upcomingEvents] = await pool.execute(
//       `SELECT e.event_id, e.event_name, e.start_date, e.start_time, e.location
//        FROM t_event e
//        WHERE e.start_date BETWEEN ? AND ?
//        AND e.start_date > CURDATE()`,
//       [currentDate, nextWeek]
//     );
    
//     for (const event of upcomingEvents) {
//       // Check if reminders were already sent this week
//       const eventDate = new Date(event.start_date);
//       const [existingReminders] = await pool.execute(
//         `SELECT COUNT(*) as count 
//          FROM t_notification 
//          WHERE message LIKE CONCAT('%', ?, '%') 
//          AND message LIKE '%Reminder%'
//          AND sent_time > DATE_SUB(NOW(), INTERVAL 2 DAY)`,
//         [event.event_name]
//       );
      
//       if (existingReminders[0].count === 0) {
//         // Send reminder notification
//         await sendImmediateEventNotifications(event.event_id, 'reminder');
//         console.log(`Sent reminder for event: ${event.event_name}`);
//       }
//     }
    
//   } catch (err) {
//     console.error('Error in event reminder check:', err);
//   }
// };
// const cron = require('node-cron');
// // Schedule weekly reminder check (daily at 10:00 AM)
// cron.schedule('0 10 * * *', checkEventReminders);

// Debug endpoint to test notifications manually
router.post('/:eventId/debug-notifications', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    console.log(`=== DEBUG: Manual notification test for event ${eventId} ===`);
    
    // First, check if event exists
    const [event] = await db.query('SELECT * FROM t_event WHERE event_id = ?', [eventId]);
    if (event.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check assigned employees
    const [employees] = await db.query(
      `SELECT e.* FROM t_event_employee ee 
       JOIN t_employee e ON ee.employee_id = e.employee_id 
       WHERE ee.event_id = ?`,
      [eventId]
    );
    
    console.log(`Event: ${event[0].event_name}`);
    console.log(`Assigned employees: ${employees.length}`);
    employees.forEach(emp => console.log(`- ${emp.first_name} ${emp.last_name} (ID: ${emp.employee_id})`));
    
    // Send notifications
    await sendImmediateEventNotifications(eventId, 'assignment');
    
    res.status(200).json({ 
      message: 'Debug notifications completed',
      event: event[0],
      assignedEmployees: employees
    });
    
  } catch (err) {
    console.error('Debug error:', err);
    res.status(500).json({ message: 'Debug failed', error: err.message });
  }
});

// Get shifts for a specific employee
router.get('/employee/:employeeId/shifts', async (req, res) => {
  const { employeeId } = req.params;
  
  try {
    const [shifts] = await db.query(
      `SELECT date_, start_time, end_time, shift_type, status_
       FROM t_shift 
       WHERE employee_id = ? 
       ORDER BY date_`,
      [employeeId]
    );
    
    res.status(200).json(shifts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.post('/:eventId/assignment-notifications', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    // Get event details
    const [eventRows] = await db.execute(
      `SELECT event_name, start_date FROM t_event WHERE event_id = ?`,
      [eventId]
    );
    
    if (eventRows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    const event = eventRows[0];
    
    // Get assigned staff
    const [staffRows] = await db.execute(
      `SELECT ee.employee_id, e.first_name, e.email 
       FROM t_event_employee ee 
       JOIN t_employee e ON ee.employee_id = e.employee_id 
       WHERE ee.event_id = ?`,
      [eventId]
    );
    
    // Create immediate assignment notifications only
    for (const staff of staffRows) {
      await db.execute(
        `INSERT INTO t_notification 
         (employee_id, message, sent_time, read_status, notification_type_id) 
         VALUES (?, ?, NOW(), 'unread', 7)`,
        [
          staff.employee_id,
          `You have been assigned to event "${event.event_name}" starting on ${new Date(event.start_date).toLocaleDateString()}.`
        ]
      );
    }
    
    // Store event reminder info in a separate table or use existing t_event table
    // We'll add a column to track if 7-day reminder was sent
    await db.execute(
      `UPDATE t_event SET reminder_sent = 0 WHERE event_id = ?`,
      [eventId]
    );
    
    res.json({ 
      message: 'Assignment notifications sent successfully',
      notified: staffRows.length
    });
    
  } catch (err) {
    console.error('Error sending assignment notifications:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get employee event notifications
router.get('/employee/:employeeId/event-notifications', async (req, res) => {
  const { employeeId } = req.params;
  
  try {
    const [notifications] = await db.execute(
      `SELECT n.* FROM t_notification n
       WHERE n.employee_id = ? 
       AND n.notification_type_id = 7
       ORDER BY n.sent_time DESC`,
      [employeeId]
    );
    
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching event notifications:', err);
    res.status(500).json({ message: 'Server error' });
  }
});




module.exports = router;