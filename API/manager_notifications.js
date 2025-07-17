//Author: Katlego Mmadi
const express = require('express');
const router = express.Router();
const pool = require('./db');

// Simplified middleware - just checks for employeeId in query params
function validateManager(req, res, next) {
  const employeeId = req.query.employeeId;
  
  if (!employeeId) {
    return res.status(400).json({ error: 'Employee ID required' });
  }

  // You might want to add additional validation here to verify the user is a manager
  pool.query('SELECT type_ FROM t_employee WHERE employee_id = ?', [employeeId])
    .then(([rows]) => {
      if (rows.length === 0 || rows[0].type_ !== 'manager') {
        return res.status(403).json({ error: 'Access restricted to managers only' });
      }
      req.employeeId = employeeId;
      next();
    })
    .catch(err => {
      console.error('🛑 Manager validation error:', err);
      res.status(500).json({ error: 'Failed to validate manager status' });
    });
}

// Apply validation to all routes
router.use(validateManager);

router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let query = `
      SELECT 
        n.notification_id,
        n.message,
        n.sent_time,
        n.read_status,
        nt._name AS type
      FROM t_notification n
      JOIN t_notification_type nt 
        ON n.notification_type_id = nt.notification_type_id
      WHERE n.employee_id = ?
    `;
    const params = [req.employeeId];

    if (type) {
      query += ` AND nt._name = ?`;
      params.push(type);
    }

    query += ` ORDER BY n.sent_time DESC`;  

    const [notifications] = await pool.query(query, params);
    console.log('📦 Notifications for manager', req.employeeId, 'fetched:', notifications.length);
    res.json(notifications);
  } catch (err) {
    console.error('🛑 Notification fetch error for manager', req.employeeId, ':', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.get('/unread/count', async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT COUNT(*) AS unreadCount
      FROM t_notification
      WHERE read_status = 'unread' AND employee_id = ?
    `, [req.employeeId]);
    console.log('📦 Unread notification count for manager', req.employeeId, ':', result[0].unreadCount);
    res.json(result[0]);
  } catch (err) {
    console.error('🛑 Failed to count unread notifications for manager', req.employeeId, ':', err);
    res.status(500).json({ error: 'Failed to count unread notifications' });
  }
});

router.get('/unread/latest', async (req, res) => {
  try {
    const [notifications] = await pool.query(`
      SELECT 
        n.notification_id,
        n.message,
        n.sent_time,
        n.read_status,
        nt._name AS type
      FROM t_notification n
      JOIN t_notification_type nt 
        ON n.notification_type_id = nt.notification_type_id
      WHERE n.employee_id = ?
      ORDER BY n.sent_time DESC
      LIMIT 2
    `, [req.employeeId]);
    res.json(notifications);
  } catch (err) {
    console.error('Failed to fetch latest notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
