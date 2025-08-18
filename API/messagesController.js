/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const db = require('./db');


exports.getConversationPartners = async (req, res) => {
  const { employeeId } = req.params;
  
  if (!employeeId || isNaN(employeeId)) {
    return res.status(400).json({ error: 'Invalid employee ID' });
  }

  try {
    const [partners] = await db.query(`
       SELECT DISTINCT 
         e.employee_id,
         e.first_name,
         e.last_name
        FROM (
            SELECT DISTINCT receiver_id as partner_id FROM t_message WHERE sender_id = ?
            UNION
            SELECT DISTINCT sender_id as partner_id FROM t_message WHERE receiver_id = ?
        ) AS conversation_partners
        JOIN t_employee e ON e.employee_id = conversation_partners.partner_id
        WHERE e.employee_id != ?
            AND e.first_name IS NOT NULL 
            AND e.last_name IS NOT NULL
        `, [employeeId, employeeId, employeeId]);

    res.status(200).json(partners);
  } catch (err) {
    console.error("Error fetching conversation partners:", err);
    return res.status(500).json({ error: 'Server error' });
  }
};

//Fetch conversation between two users
exports.getConversation = async (req, res) => {
  const { employeeId, otherUserId } = req.params;
 
  if (!employeeId || isNaN(employeeId) || !otherUserId || isNaN(otherUserId)) {
    return res.status(400).json({ error: 'Invalid user IDs' });
  }

  try {
    const [messages] = await db.query(
      `SELECT 
        m.message_id, 
        m.sender_id, 
        CONCAT(s.first_name, " ", s.last_name) AS sender_name,
        m.receiver_id, 
        CONCAT(r.first_name, " ", r.last_name) AS receiver_name,
        m.content, 
        m.sent_time, 
        m.read_status
      FROM t_message m
      JOIN t_employee s ON m.sender_id = s.employee_id
      JOIN t_employee r ON m.receiver_id = r.employee_id
      WHERE (m.sender_id = ? AND m.receiver_id = ?)
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.sent_time ASC`,
      [employeeId, otherUserId, otherUserId, employeeId]
    );

    if (!messages) {
      return res.status(404).json({ message: 'No messages found' });
    }

    console.log("Conversation fetched successfully");
    res.status(200).json(messages);
  } catch(err) {
    console.error("Error fetching conversation:", err);
    return res.status(500).json({ error: 'Server error' });
  }
};

//Send a reply message
exports.sendMessage = async (req, res) => {
  const { sender_id, receiver_id, content } = req.body;

  if (!sender_id || !receiver_id || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO t_message (sender_id, receiver_id, content, sent_time, read_status) 
       VALUES (?, ?, ?, NOW(), 'unread')`,
      [sender_id, receiver_id, content]
    );

    //Get the full message details with sender/receiver names
    const [message] = await db.query(
      `SELECT 
        m.message_id, 
        m.sender_id, 
        CONCAT(s.first_name, " ", s.last_name) AS sender_name,
        m.receiver_id, 
        CONCAT(r.first_name, " ", r.last_name) AS receiver_name,
        m.content, 
        m.sent_time, 
        m.read_status
      FROM t_message m
      JOIN t_employee s ON m.sender_id = s.employee_id
      JOIN t_employee r ON m.receiver_id = r.employee_id
      WHERE m.message_id = ?`,
      [result.insertId]
    );
    console.log("Message sent successfully");
    res.status(201).json(message[0]);
  } catch (err) {
    console.error("Error sending message:", err);
    return res.status(500).json({ error: 'Server error' });
  }
};

//Mark messages as read
exports.markMessagesAsRead = async (req, res) => {
  const { sender_id, receiver_id } = req.body;

  if (!sender_id || !receiver_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await db.query(
      `UPDATE t_message 
       SET read_status = 'read' 
       WHERE sender_id = ? AND receiver_id = ? AND read_status = 'unread'`,
      [sender_id, receiver_id]
    );

    console.log("Messages marked as read");
    res.status(200).json({ message: 'Messages marked as read' });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    return res.status(500).json({ error: 'Server error' });
  }
};