const db = require('./db');

// Create a new event
exports.createEvent = async (req, res) => {
  const { event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance, organizer_id } = req.body;

  try {
    const [result] = await db.execute(
      `INSERT INTO t_event 
       (event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance, organizer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance, organizer_id]
    );
    
    res.status(201).json({ 
      message: 'Event created successfully',
      event_id: result.insertId 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all events
exports.getEvents = async (req, res) => {
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
};

// Get a specific event
exports.getEvent = async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const [events] = await db.query(
      `SELECT e.*, 
              CONCAT(emp.first_name, ' ', emp.last_name) AS organizer_name
       FROM t_event e
       LEFT JOIN t_employee emp ON e.organizer_id = emp.employee_id
       WHERE e.event_id = ?`,
      [eventId]
    );
    
    if (events.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.status(200).json(events[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update an event
exports.updateEvent = async (req, res) => {
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
};

// Delete an event
exports.deleteEvent = async (req, res) => {
  const { eventId } = req.params;
  
  try {
    await db.execute('DELETE FROM t_event WHERE event_id = ?', [eventId]);
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get staff assigned to an event
// exports.getEventStaff = async (req, res) => {
//   const { eventId } = req.params;
  
//   try {
//     const [staff] = await db.query(
//       `SELECT e.employee_id, e.first_name, e.last_name, r.title, ee.role
//        FROM t_event_employee ee
//        JOIN t_employee e ON ee.employee_id = e.employee_id
//        JOIN t_role r ON e.role_id = r.role_id
//        WHERE ee.event_id = ?`,
//       [eventId]
//     );
    
//     res.status(200).json(staff);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

exports.getEventStaff = async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const [staff] = await db.query(
      `SELECT e.employee_id, e.first_name, e.last_name, r.title, r.role_id
       FROM t_event_employee ee
       JOIN t_employee e ON ee.employee_id = e.employee_id
       JOIN t_role r ON ee.role_id = r.role_id
       WHERE ee.event_id = ?`,
      [eventId]
    );
    
    res.status(200).json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get count of staff assigned to an event
exports.getEventStaffCount = async (req, res) => {
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
};

// Assign staff to an event
exports.assignStaffToEvent = async (req, res) => {
  const { eventId, staffId } = req.params;
  const { role } = req.body;
  
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
    
    await db.execute(
      `INSERT INTO t_event_employee (event_id, employee_id, role)
       VALUES (?, ?, ?)`,
      [eventId, staffId, role || 'staff']
    );
    
    res.status(200).json({ message: 'Staff assigned to event successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove staff from an event
exports.removeStaffFromEvent = async (req, res) => {
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
};

// Remove all staff from an event
exports.removeAllStaffFromEvent = async (req, res) => {
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
};

// Get available staff (not assigned to any event during the specified time)
exports.getAvailableStaff = async (req, res) => {
  try {
    const [staff] = await db.query(
      `SELECT e.employee_id, e.first_name, e.last_name, r.title
       FROM t_employee e
       JOIN t_role r ON e.role_id = r.role_id
       WHERE e.status_ = 'Working' AND e.type_ = 'employee'
       ORDER BY e.first_name, e.last_name`
    );
    
    res.status(200).json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Check for events during a leave period
exports.checkEventsDuringLeave = async (req, res) => {
  const { employee_id, start_date, end_date } = req.query;
  
  try {
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
};