// routes/messages.js
const express = require('express');
const router = express.Router();
const pool = require('./db'); // Adjust path as needed

// Middleware to validate user
function validateUser(req, res, next) {
  const employeeId = req.query.employeeId || req.body.employeeId;
  
  if (!employeeId) {
    return res.status(400).json({ error: 'Employee ID required' });
  }
  req.employeeId = employeeId;
  next();
}

// Apply validation to all routes
router.use(validateUser);

// Get messages for notification panel
router.get('/for-notifications', async (req, res) => {
  try {
    const [messages] = await pool.query(`
      SELECT 
        message_id AS notification_id,
        content AS message,
        sent_time,
        read_status,
        'message' AS type,
        'message' AS source
      FROM t_message
      WHERE receiver_id = ?
      ORDER BY sent_time DESC
    `, [req.employeeId]);
    
    res.json(messages);
  } catch (err) {
    console.error('Message fetch error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Toggle read status
router.patch('/:message_id/:read_status', async (req, res) => {
  const { message_id, read_status } = req.params;
  
  if (!['read', 'unread'].includes(read_status)) {
    return res.status(400).json({ error: 'Invalid read_status' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE t_message SET read_status = ? WHERE message_id = ? AND receiver_id = ?',
      [read_status, message_id, req.employeeId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating message status:', err);
    res.status(500).json({ error: 'Failed to update message status' });
  }
});

// Mark multiple messages as read
router.patch('/mark-all-read', async (req, res) => {
  const { messageIds } = req.body;

  if (!messageIds || !Array.isArray(messageIds)) {
    return res.status(400).json({ error: 'messageIds array is required' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE t_message SET read_status = "read" WHERE message_id IN (?) AND receiver_id = ?',
      [messageIds, req.employeeId]
    );
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error('Error marking messages as read:', err);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;