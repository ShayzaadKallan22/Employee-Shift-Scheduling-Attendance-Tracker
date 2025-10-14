// Yatin
const express = require('express');
const router = express.Router();
const leaveController = require('./leaveController');
const db = require('./db');

router.get('/employee-summary', async (req, res) => {
  try {
    const [employees] = await db.query(`
      SELECT 
        e.employee_id, 
        e.first_name, 
        e.last_name, 
        e.status_, 
        r.title as role_title,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'leave_type_id', lt.leave_type_id,
              'name_', lt.name_,
              'max_days', lt.max_days_per_year,
              'used_days', IFNULL((
                SELECT SUM(DATEDIFF(l.end_date, l.start_date) + 1)
                FROM t_leave l
                WHERE l.employee_id = e.employee_id 
                AND l.leave_type_id = lt.leave_type_id
                AND l.status_ = 'approved'
              ), 0)
            )
          )
          FROM t_leave_type lt
        ) as leave_balances,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'leave_id', l.leave_id,
              'start_date', l.start_date,
              'end_date', l.end_date,
              'status_', l.status_,
              'leave_type_id', l.leave_type_id,
              'leave_type_name', lt.name_,
              'days_taken', DATEDIFF(l.end_date, l.start_date) + 1,
              'sick_note', l.sick_note
            )
          )
          FROM t_leave l
          JOIN t_leave_type lt ON l.leave_type_id = lt.leave_type_id
          WHERE l.employee_id = e.employee_id
          ORDER BY l.start_date DESC
          LIMIT 3
        ) as leave_requests
      FROM t_employee e
      JOIN t_role r ON e.role_id = r.role_id
      GROUP BY e.employee_id
      ORDER BY e.first_name, e.last_name
    `);

    console.log('Successfully fetched employee leave summary');
    res.json(employees);
  } catch (err) {
    console.error('Error in /employee-summary:', err);
    res.status(500).json({
      message: 'Server error',
      error: err.message,
      sql: err.sql
    });
  }
});

router.get('/types', async (req, res) => {
  try {
    const [types] = await db.query('SELECT * FROM t_leave_type');
    res.json(types);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

//Get leave statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalEmployees] = await db.query('SELECT COUNT(*) AS count FROM t_employee WHERE status_ = "Working"');


    const [onLeaveToday] = await db.query(`
      SELECT COUNT(DISTINCT e.employee_id) AS count 
      FROM t_employee e
      WHERE e.status_ = 'On Leave'
    `);
    const [pendingRequests] = await db.query(`
      SELECT COUNT(*) AS count 
      FROM t_leave 
      WHERE status_ = 'pending'
    `);
    const [leaveThisMonth] = await db.query(`
      SELECT COUNT(DISTINCT employee_id) AS count 
      FROM t_leave 
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


router.get('/chart-data', async (req, res) => {
  try {
    const [data] = await db.query(`
      SELECT 
        t.leave_type_id,
        t.name_ AS leave_type,
        SUM(DATEDIFF(l.end_date, l.start_date) + 1) AS total_days
      FROM t_leave l
      JOIN t_leave_type t ON l.leave_type_id = t.leave_type_id
      WHERE l.status_ = 'approved'
      GROUP BY t.leave_type_id, t.name_
    `);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


router.get('/all', async (req, res) => {
  try {
    const [rows] = await db.query(`
            SELECT 
                l.leave_id, 
                l.start_date, 
                l.end_date, 
                l.status_,
                e.first_name, 
                e.last_name, 
                e.employee_id,
                t.name_ AS leave_type, 
                t.max_days_per_year,
                DATEDIFF(l.end_date, l.start_date) + 1 AS days_requested,

                -- Subquery for used days of this leave type for this employee
                (
                    SELECT IFNULL(SUM(DATEDIFF(l2.end_date, l2.start_date) + 1), 0)
                    FROM t_leave l2
                    WHERE l2.employee_id = e.employee_id
                    AND l2.leave_type_id = t.leave_type_id
                    AND l2.status_ = 'approved'
                    AND l2.leave_id != l.leave_id
                ) AS used_days,

                -- Subquery for checking overlapping events
                (
                    SELECT COUNT(*) 
                    FROM t_event_employee ee
                    JOIN t_event ev ON ee.event_id = ev.event_id
                    WHERE ee.employee_id = e.employee_id
                    AND ev.end_date >= l.start_date 
                    AND ev.start_date <= l.end_date
                ) > 0 AS has_events

            FROM t_leave l
            JOIN t_employee e ON l.employee_id = e.employee_id
            JOIN t_leave_type t ON l.leave_type_id = t.leave_type_id
            WHERE l.status_ = 'pending'
            ORDER BY l.created_at DESC
        `);

    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



router.post('/request', leaveController.requestLeave);
router.get('/all', leaveController.getAllLeaveRequests);
router.post('/respond', leaveController.respondToLeave);
router.get('/my/:employee_id', leaveController.getMyLeaveRequests);
router.post('/check-standby', leaveController.checkStandbyAvailability);

module.exports = router;
