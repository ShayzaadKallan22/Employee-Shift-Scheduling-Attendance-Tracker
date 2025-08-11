//Author: Katlego Mmadi
const pool = require('./db');

const validateManager = (req, res, next) => {
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
};

const getNotifications = async (req, res) => {
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
};

const getUnreadCount = async (req, res) => {
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
};

const getLatestUnread = async (req, res) => {
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
};

const toggleReadStatus = async (req, res) => {
  const { notification_id, read_status } = req.params;
  console.log(`Processing PATCH for notification ${notification_id} to ${read_status}, employeeId: ${req.employeeId}`);
  if (!['read', 'unread'].includes(read_status)) {
    console.log('Invalid read_status:', read_status);
    return res.status(400).json({ error: 'Invalid read_status' });
  }
  try {
    const [existing] = await pool.query(
      'SELECT * FROM t_notification WHERE notification_id = ? AND employee_id = ?',
      [notification_id, req.employeeId]
    );
    console.log('Existing notification:', existing);
    const [result] = await pool.query(
      'UPDATE t_notification SET read_status = ? WHERE notification_id = ? AND employee_id = ?',
      [read_status, notification_id, req.employeeId]
    );
    console.log('Query result:', result);
    if (result.affectedRows === 0) {
      console.log('No rows affected, notification_id:', notification_id, 'employeeId:', req.employeeId);
      return res.status(404).json({ error: 'Notification not found or not authorized' });
    }
    console.log(`Notification ${notification_id} marked as ${read_status}`);
    res.json({ success: true });
  } catch (err) {
    console.error('🛑 Error updating notification status:', err);
    res.status(500).json({ error: 'Failed to update notification status' });
  }
};

const markAllAsRead = async (req, res) => {
  try {
      const { employeeId, notificationIds } = req.body;

      if (!employeeId || !notificationIds || !Array.isArray(notificationIds)) {
        return res.status(400).json({ error: 'employeeId and notificationIds array are required' });
      }

      // Verify the employeeId matches the session user (for security)
      if (!req.session.user || req.session.user.id !== employeeId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Update notifications in the database
      const placeholders = notificationIds.map(() => '?').join(',');
      const query = `UPDATE t_notifications SET read_status = 'read' WHERE notification_id IN (${placeholders}) AND employee_id = ?`;
      const values = [...notificationIds, employeeId];

      const [result] = await pool.query(query, values);

      if (result.affectedRows === 0) {
        console.warn('No notifications updated for employeeId:', employeeId);
        return res.status(404).json({ error: 'No matching notifications found' });
      }

      console.log(`Marked ${result.affectedRows} notifications as read for employeeId: ${employeeId}`);
      return res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
      console.error('Mark all as read error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

module.exports = {
  validateManager,
  getNotifications,
  getUnreadCount,
  getLatestUnread,
  toggleReadStatus,
  markAllAsRead
};