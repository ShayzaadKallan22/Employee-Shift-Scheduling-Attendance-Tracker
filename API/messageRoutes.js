const express = require('express');
const router = express.Router();
const pool = require('./db');

//get conversation between two users
router.get('/conversation/:senderId/:receiverId', async (req, res) => {
    try {
        const { senderId, receiverId } = req.params;
        const limit = req.query.limit || 50;
        const since = req.query.since || null;

        let query = `
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
        `;

        const params = [senderId, receiverId, receiverId, senderId];

        if (since) {
            query += ' AND m.sent_time > ?';
            params.push(since);
        }

        query += ' ORDER BY m.sent_time DESC';

        if (limit) {
            query += ' LIMIT ?';
            params.push(parseInt(limit));
        }

        const [messages] = await pool.query(query, params);
        res.json(messages.reverse()); //return in chronological order
    } catch (err) {
        console.error('Error fetching conversation:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

//send a message
router.post('/send', async (req, res) => {
    try {
        const { sender_id, receiver_id, content } = req.body;

        if (!sender_id || !receiver_id || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const [result] = await pool.query(
            'INSERT INTO t_message (sender_id, receiver_id, content) VALUES (?, ?, ?)',
            [sender_id, receiver_id, content]
        );

        //get the full message details with user information
        const [savedMessage] = await pool.query(`
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

        res.status(201).json(savedMessage[0]);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

//mark messages as read...needs work
router.post('/mark-read', async (req, res) => {
    try {
        const { message_ids } = req.body;

        if (!message_ids || !Array.isArray(message_ids)) {
            return res.status(400).json({ error: 'Invalid message IDs' });
        }

        await pool.query(
            'UPDATE t_message SET read_status = "read" WHERE message_id IN (?)',
            [message_ids]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error marking messages as read:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;