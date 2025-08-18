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
  console.log('Received request for notifications:', req.query);
  try {
    const { type, since } = req.query;
    let notificationQuery = `
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
    const notificationParams = [req.employeeId];

    if (type && type !== 'message') {
      notificationQuery += ` AND nt._name = ?`;
      notificationParams.push(type);
    }
    if (since) {
      notificationQuery += ` AND n.sent_time > ?`;
      notificationParams.push(since);
    }

    notificationQuery += ` ORDER BY n.sent_time DESC`;
    const [notifications] = await pool.query(notificationQuery, notificationParams);

    // Enrich notifications with sick note details by parsing message
    const enrichedNotifications = await Promise.all(notifications.map(async (n) => {
      const match = n.message.match(/uploaded a sick note for sick leave #(\d+)/);
      if (match) {
        const leaveId = parseInt(match[1]);
        const [[leave]] = await pool.query(`
          SELECT 
            sick_note, 
            start_date, 
            end_date, 
            employee_id,
            DATEDIFF(end_date, start_date) + 1 AS days_taken
          FROM t_leave 
          WHERE leave_id = ?`, [leaveId]);
        
        if (leave && leave.sick_note) {
          const [[employee]] = await pool.query(`
            SELECT CONCAT(first_name, ' ', last_name) AS employee_name 
            FROM t_employee 
            WHERE employee_id = ?`, [leave.employee_id]);
          
          return {
            ...n,
            sick_note: leave.sick_note,
            start_date: leave.start_date,
            end_date: leave.end_date,
            employee_id: leave.employee_id,
            employee_name: employee.employee_name,
            days_taken: leave.days_taken
          };
        }
      }
      return n;
    }));

    let messageQuery = `
      SELECT 
        m.message_id AS notification_id,
        m.content AS message,
        m.sent_time,
        m.read_status,
        'message' AS type,
        m.sender_id,
        CONCAT(e.first_name, ' ', e.last_name) AS sender_name
      FROM t_message m
      JOIN t_employee e ON m.sender_id = e.employee_id
      WHERE m.receiver_id = ?
    `;
    const messageParams = [req.employeeId];

    if (type && type !== 'all' && type !== 'message') {
      messageQuery = `SELECT 1 WHERE 0`;
    }
    if (since) {
      messageQuery += ` AND m.sent_time > ?`;
      messageParams.push(since);
    }

    messageQuery += ` ORDER BY m.sent_time DESC`;
    const [messages] = await pool.query(messageQuery, messageParams);

    const combined = [
      ...enrichedNotifications,
      ...messages
    ].sort((a, b) => new Date(b.sent_time) - new Date(a.sent_time));

    const formattedNotifications = combined.map(n => {
      if (n.type === 'message') {
        return {
          ...n,
          message: n.sender_name ? `${n.sender_name}: ${n.message}` : n.message
        };
      }
      // Construct link if it's a sick note notification with details
      const link = n.sick_note ? 
        `ViewSickNote.html?note=${encodeURIComponent(n.sick_note)}&employeeId=${n.employee_id || ''}&startDate=${n.start_date || ''}&endDate=${n.end_date || ''}&employeeName=${encodeURIComponent(n.employee_name || '')}&daysTaken=${n.days_taken || ''}` 
        : null;
      return {
        ...n,
        link
      };
    });

    console.log('📦 Notifications and messages for manager', req.employeeId, 'fetched:', combined.length, combined);
    res.json(formattedNotifications);
  } catch (err) {
    console.error('🛑 Notification fetch error for manager', req.employeeId, ':', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
};

const getUnreadCount = async (req, res) => {
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
    console.error('🛑 Failed to count unread notifications and messages for manager', req.employeeId, ':', err);
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
        m.sender_id,
        CONCAT(e.first_name, ' ', e.last_name) AS sender_name
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
    console.error('Failed to fetch latest notifications and messages:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

const toggleReadStatus = async (req, res) => {
  const { notification_id, read_status } = req.params;
  const { type } = req.body;
  console.log(`Processing PATCH for ${type || 'notification'} ${notification_id} to ${read_status}, employeeId: ${req.employeeId}`);
  if (!['read', 'unread'].includes(read_status)) {
    console.log('Invalid read_status:', read_status);
    return res.status(400).json({ error: 'Invalid read_status' });
  }
  try {
    let result;
    if (type === 'message') {
      // Messages remain persistent, no update to read_status
      return res.json({ success: true });
    } else {
      [result] = await pool.query(
        'UPDATE t_notification SET read_status = ? WHERE notification_id = ? AND employee_id = ?',
        [read_status, notification_id, req.employeeId]
      );
    }
    if (result && result.affectedRows === 0) {
      console.log('No rows affected, notification_id:', notification_id, 'employeeId:', req.employeeId);
      return res.status(404).json({ error: 'Notification not found or not authorized' });
    }
    console.log(`${type || 'Notification'} ${notification_id} marked as ${read_status}`);
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
    const notificationIdsList = notificationIds
      .filter(n => n.type !== 'message') // Exclude messages
      .map(n => n.id);
    
    let totalAffectedRows = 0;

    if (notificationIdsList.length > 0) {
      const placeholders = notificationIdsList.map(() => '?').join(',');
      const query = `UPDATE t_notification SET read_status = 'read' WHERE notification_id IN (${placeholders}) AND employee_id = ?`;
      const values = [...notificationIdsList, employeeId];
      const [result] = await pool.query(query, values);
      totalAffectedRows += result.affectedRows;
    }

    if (totalAffectedRows === 0) {
      console.warn('No notifications updated for employeeId:', employeeId);
      return res.status(404).json({ error: 'No matching notifications found' });
    }

    console.log(`Marked ${totalAffectedRows} notifications as read for employeeId: ${employeeId}`);
    return res.status(200).json({ success: true, message: 'All notifications marked as read', affectedRows: totalAffectedRows });
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