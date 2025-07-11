const express = require('express');
const router = express.Router();
const leaveController = require('./leaveController');
const db = require('./db');
// Yatin
router.get('/employee-summary', async (req, res) => {
  try {
    const [employees] = await db.query(`
      SELECT e.employee_id, e.first_name, e.last_name, e.status_, r.title as role_title,
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'leave_type_id', lt.leave_type_id,
                 'days', IFNULL(l.used_days, 0)
               )
             ) as leave_used,
             (
               SELECT JSON_ARRAYAGG(
                 JSON_OBJECT(
                   'leave_id', l.leave_id,
                   'start_date', l.start_date,
                   'end_date', l.end_date,
                   'status_', l.status_,
                   'leave_type_id', l.leave_type_id
                 )
               )
               FROM T_Leave l
               WHERE l.employee_id = e.employee_id
               ORDER BY l.start_date DESC
               LIMIT 3
             ) as leave_requests
      FROM T_Employee e
      JOIN T_Role r ON e.role_id = r.role_id
      LEFT JOIN T_Leave l ON e.employee_id = l.employee_id AND l.status_ = 'approved'
      LEFT JOIN T_Leave_Type lt ON l.leave_type_id = lt.leave_type_id
      GROUP BY e.employee_id
    `);
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/types', async (req, res) => {
  try {
    const [types] = await db.query('SELECT * FROM T_Leave_Type');
    res.json(types);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leave statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalEmployees] = await db.query('SELECT COUNT(*) AS count FROM T_Employee WHERE status_ = "Working"');

    // const [onLeaveToday] = await db.query(`
    //   SELECT COUNT(DISTINCT l.employee_id) AS count 
    //   FROM T_Leave l 
    //   WHERE CURDATE() BETWEEN l.start_date AND l.end_date 
    //   AND l.status_ = 'approved'
    // `);

    const [onLeaveToday] = await db.query(`
      SELECT COUNT(DISTINCT e.employee_id) AS count 
      FROM T_Employee e
      WHERE e.status_ = 'On Leave'
    `);
    const [pendingRequests] = await db.query(`
      SELECT COUNT(*) AS count 
      FROM T_Leave 
      WHERE status_ = 'pending'
    `);
    const [leaveThisMonth] = await db.query(`
      SELECT COUNT(DISTINCT employee_id) AS count 
      FROM T_Leave 
      WHERE MONTH(start_date) = MONTH(CURDATE()) 
      AND YEAR(start_date) = YEAR(CURDATE())
    `);

    res.json({
      totalEmployees: totalEmployees[0].count,
      onLeaveToday: onLeaveToday[0].count,
      pendingRequests: pendingRequests[0].count,
      leaveThisMonth: leaveThisMonth[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get leave distribution data for chart
router.get('/chart-data', async (req, res) => {
  try {
    const [data] = await db.query(`
      SELECT 
        t.name_ AS leave_type,
        SUM(DATEDIFF(l.end_date, l.start_date) + 1) AS total_days
      FROM T_Leave l
      JOIN T_Leave_Type t ON l.leave_type_id = t.leave_type_id
      WHERE l.status_ = 'approved'
      GROUP BY t.name_
    `);

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


router.post('/request', leaveController.requestLeave);
router.get('/all', leaveController.getAllLeaveRequests);
router.post('/respond', leaveController.respondToLeave);
router.get('/my/:employee_id', leaveController.getMyLeaveRequests);

module.exports = router;
