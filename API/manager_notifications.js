const express = require('express');
const router = express.Router();
const pool = require('./db');

const validateManager = (req, res, next) => {
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
};

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
        nt._name AS type,
        'notification' AS source,
        '' AS sender_name,
        0 AS sender_id
      FROM t_notification n
      JOIN t_notification_type nt 
        ON n.notification_type_id = nt.notification_type_id
      WHERE n.employee_id = ?
    `;
    const params = [req.employeeId];

    if (type && type !== 'message') {
      query += ` AND nt._name = ?`;
      params.push(type);
    }

    const [notifications] = await pool.query(query, params);
    console.log('📦 Notifications for manager', req.employeeId, ':', notifications);

    let messageQuery = '';
    if (!type || type === 'message' || type === 'all') {
      messageQuery = `
        SELECT 
          m.message_id AS notification_id,
          m.content AS message,
          m.sent_time,
          m.read_status,
          'message' AS type,
          'message' AS source,
          CONCAT(e.first_name, ' ', e.last_name) AS sender_name,
          m.sender_id AS sender_id
        FROM t_message m
        JOIN t_employee e ON m.sender_id = e.employee_id
        WHERE m.receiver_id = ?
      `;
      params.push(req.employeeId);
    } else {
      messageQuery = 'SELECT 1 WHERE 0'; // Empty result for non-message types
    }

    const [messages] = await pool.query(messageQuery, [req.employeeId]);
    console.log('📦 Messages for manager', req.employeeId, ':', messages);

    const combined = [...notifications, ...messages]
      .sort((a, b) => new Date(b.sent_time) - new Date(a.sent_time));
    console.log('📦 Combined notifications and messages for manager', req.employeeId, 'fetched:', combined.length, combined);

    const formattedNotifications = combined.map(n => {
      if (n.type === 'message') {
        return {
          ...n,
          message: n.sender_name ? `${n.sender_name}: ${n.message}` : n.message
        };
      }
      return n;
    });

    res.json(formattedNotifications);
  } catch (err) {
    console.error('🛑 Notification/message fetch error for manager', req.employeeId, ':', err);
    res.status(500).json({ error: 'Failed to load notifications and messages' });
  }
});

router.get('/unread/count', async (req, res) => {
  try {
    const [notificationResult] = await pool.query(
      `SELECT COUNT(*) AS unreadCount
       FROM t_notification
       WHERE read_status = 'unread' AND employee_id = ?`,
      [req.employeeId]
    );
    const [messageResult] = await pool.query(
      `SELECT COUNT(*) AS unreadCount
       FROM t_message
       WHERE read_status = 'unread' AND receiver_id = ?`,
      [req.employeeId]
    );
    const totalUnread = notificationResult[0].unreadCount + messageResult[0].unreadCount;
    console.log('📦 Unread notification and message count for manager', req.employeeId, ':', totalUnread);
    res.json({ unreadCount: totalUnread });
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
        nt._name AS type,
        'notification' AS source
      FROM t_notification n
      JOIN t_notification_type nt 
        ON n.notification_type_id = nt.notification_type_id
      WHERE n.employee_id = ? AND n.read_status = 'unread'
      ORDER BY n.sent_time DESC
      LIMIT 2
    `, [req.employeeId]);
    const [messages] = await pool.query(`
      SELECT 
        m.message_id AS notification_id,
        m.content AS message,
        m.sent_time,
        m.read_status,
        'message' AS type,
        'message' AS source,
        CONCAT(e.first_name, ' ', e.last_name) AS sender_name,
        m.sender_id AS sender_id
      FROM t_message m
      JOIN t_employee e ON m.sender_id = e.employee_id
      WHERE m.receiver_id = ? AND m.read_status = 'unread'
      ORDER BY m.sent_time DESC
      LIMIT 2
    `, [req.employeeId]);
    const combined = [...notifications, ...messages]
      .sort((a, b) => new Date(b.sent_time) - new Date(a.sent_time))
      .slice(0, 2);
    res.json(combined);
  } catch (err) {
    console.error('Failed to fetch latest notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:notification_id/:read_status', async (req, res) => {
  const { notification_id, read_status } = req.params;
  const { type } = req.body;
  console.log(`Processing PATCH for ${type || 'notification'} ${notification_id} to ${read_status}, employeeId: ${req.employeeId}`);

  if (!['read', 'unread'].includes(read_status)) {
    return res.status(400).json({ error: 'Invalid read_status' });
  }

  try {
    let result;
    if (type === 'message') {
      [result] = await pool.query(
        'UPDATE t_message SET read_status = ? WHERE message_id = ? AND receiver_id = ?',
        [read_status, notification_id, req.employeeId]
      );
    } else {
      [result] = await pool.query(
        'UPDATE t_notification SET read_status = ? WHERE notification_id = ? AND employee_id = ?',
        [read_status, notification_id, req.employeeId]
      );
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Notification or message not found or not authorized' });
    }
    console.log(`${type || 'Notification'} ${notification_id} marked as ${read_status}`);
    res.json({ success: true });
  } catch (err) {
    console.error('🛑 Error updating notification/message status:', err);
    res.status(500).json({ error: 'Failed to update notification/message status' });
  }
});

router.patch('/mark-all-read', async (req, res) => {
  const { notificationIds } = req.body;
  console.log('Processing mark all as read for employeeId:', req.employeeId, 'notificationIds:', notificationIds);

  if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
    return res.status(400).json({ error: 'No notification IDs provided' });
  }

  try {
    let totalAffectedRows = 0;

    const notificationIdsList = notificationIds
      .filter(n => n.type !== 'message')
      .map(n => n.id);
    const messageIdsList = notificationIds
      .filter(n => n.type === 'message')
      .map(n => n.id);

    if (notificationIdsList.length > 0) {
      const placeholders = notificationIdsList.map(() => '?').join(',');
      const query = `UPDATE t_notification SET read_status = 'read' WHERE notification_id IN (${placeholders}) AND employee_id = ?`;
      const values = [...notificationIdsList, req.employeeId];
      const [result] = await pool.query(query, values);
      totalAffectedRows += result.affectedRows;
    }

    if (messageIdsList.length > 0) {
      const placeholders = messageIdsList.map(() => '?').join(',');
      const query = `UPDATE t_message SET read_status = 'read' WHERE message_id IN (${placeholders}) AND receiver_id = ?`;
      const values = [...messageIdsList, req.employeeId];
      const [result] = await pool.query(query, values);
      totalAffectedRows += result.affectedRows;
    }

    if (totalAffectedRows === 0) {
      return res.status(404).json({ error: 'No matching notifications or messages found' });
    }
    console.log(`Marked ${totalAffectedRows} notifications/messages as read for employeeId: ${req.employeeId}`);
    res.json({ success: true, affectedRows: totalAffectedRows });
  } catch (err) {
    console.error('🛑 Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

module.exports = router;