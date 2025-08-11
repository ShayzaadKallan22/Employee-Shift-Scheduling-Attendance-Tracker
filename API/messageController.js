const db = require('./db');
exports.sendMessage = async (req, res) => {
    const { sender_id, receiver_id, content } = req.body;
    
    //validate required fields
    if (!sender_id || !receiver_id || !content) {
        return res.status(400).json({ 
            error: "Missing required fields",
            required: ["sender_id", "receiver_id", "content"]
        });
    }
    
    try {
        //validate employees exist
        const [sender] = await db.query('SELECT employee_id FROM t_employee WHERE employee_id = ?', [sender_id]);
        const [receiver] = await db.query('SELECT employee_id FROM t_employee WHERE employee_id = ?', [receiver_id]);
        
        if (!sender.length || !receiver.length) {
            return res.status(404).json({ 
                error: "Sender or receiver not found",
                sender_exists: sender.length > 0,
                receiver_exists: receiver.length > 0
            });
        }

        //insert message
        const [result] = await db.query(
            'INSERT INTO t_message (sender_id, receiver_id, content) VALUES (?, ?, ?)',
            [sender_id, receiver_id, content]
        );

        //get the full message with joined user data
        const [message] = await db.query(`
            SELECT m.*, 
                e1.first_name as sender_first_name, 
                e1.last_name as sender_last_name,
                e2.first_name as receiver_first_name,
                e2.last_name as receiver_last_name
            FROM t_message m
            JOIN t_employee e1 ON m.sender_id = e1.employee_id
            JOIN t_employee e2 ON m.receiver_id = e2.employee_id
            WHERE m.message_id = ?
        `, [result.insertId]);

        res.status(201).json(message[0]);
    } catch (err) {
        console.error("Error sending message:", err);
        res.status(500).json({ 
            error: "Failed to send message",
            details: err.message
        });
    }
};

exports.getConversation = async (req, res) => {
    const { employee1_id, employee2_id } = req.params;
    
    try {
        const [messages] = await db.query(`
            SELECT m.*, 
                   e1.first_name as sender_first_name, 
                   e1.last_name as sender_last_name,
                   e2.first_name as receiver_first_name,
                   e2.last_name as receiver_last_name
            FROM t_message m
            JOIN t_employee e1 ON m.sender_id = e1.employee_id
            JOIN t_employee e2 ON m.receiver_id = e2.employee_id
            WHERE (m.sender_id = ? AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.sent_time ASC
        `, [employee1_id, employee2_id, employee2_id, employee1_id]);

        res.status(200).json(messages);
    } catch (err) {
        console.error("Error fetching conversation:", err);
        res.status(500).json({ error: "Failed to fetch conversation" });
    }
};

exports.markAsRead = async (req, res) => {
    const { message_ids } = req.body;
    
    try {
        if (!Array.isArray(message_ids) || message_ids.length === 0) {
            return res.status(400).json({ error: "Invalid message IDs" });
        }

        await db.query(
            'UPDATE t_message SET read_status = "read" WHERE message_id IN (?)',
            [message_ids]
        );

        res.status(200).json({ success: true });
    } catch (err) {
        console.error("Error marking messages as read:", err);
        res.status(500).json({ error: "Failed to mark messages as read" });
    }
};