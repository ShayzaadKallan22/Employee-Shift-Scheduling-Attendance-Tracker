const express = require('express');
const router = express.Router();
const pool = require('./db');

// Middleware to validate manager
function validateManager(req, res, next) {
  console.log('Request method:', req.method);
  console.log('Request query:', req.query);
  console.log('Request body:', req.body);
  
  const employeeId = req.query.employeeId || req.body.employeeId;

  if (!employeeId) {
    console.log('No employeeId provided in query or body');
    return res.status(400).json({ error: 'Employee ID required' });
  }

  pool.query('SELECT type_ FROM t_employee WHERE employee_id = ?', [employeeId])
    .then(([rows]) => {
      console.log('Employee query result:', rows);
      if (rows.length === 0 || rows[0].type_ !== 'manager') {
        console.log('Invalid manager or employee not found');
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

// Fetch all notifications
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

// Fetch unread notification count
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

// Fetch latest unread notifications
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

// Toggle read/unread status for a single notification
router.patch('/:notification_id/:read_status', async (req, res) => {
  const { notification_id, read_status } = req.params;
  console.log(`Processing PATCH for notification ${notification_id} to ${read_status}, employeeId: ${req.employeeId}`);

  if (!['read', 'unread'].includes(read_status)) {
    return res.status(400).json({ error: 'Invalid read_status' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE t_notification SET read_status = ? WHERE notification_id = ? AND employee_id = ?',
      [read_status, notification_id, req.employeeId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Notification not found or not authorized' });
    }
    console.log(`Notification ${notification_id} marked as ${read_status}`);
    res.json({ success: true });
  } catch (err) {
    console.error('🛑 Error updating notification status:', err);
    res.status(500).json({ error: 'Failed to update notification status' });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', async (req, res) => {
  const { notificationIds } = req.body;
  console.log('Processing mark all as read for employeeId:', req.employeeId, 'notificationIds:', notificationIds);

  if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
    return res.status(400).json({ error: 'No notification IDs provided' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE t_notification SET read_status = "read" WHERE employee_id = ? AND notification_id IN (?)',
      [req.employeeId, notificationIds]
    );
    console.log(`Marked ${result.affectedRows} notifications as read for employeeId: ${req.employeeId}`);
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error('🛑 Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

module.exports = router