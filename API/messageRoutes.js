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

// Get recent messages for navbar dropdown
router.get('/recent/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        const [messages] = await pool.query(`
            SELECT m.*, 
                CASE 
                    WHEN m.sender_id = ? THEN e2.employee_id
                    ELSE e1.employee_id
                END as other_employee_id,
                CASE 
                    WHEN m.sender_id = ? THEN CONCAT(e2.first_name, ' ', e2.last_name)
                    ELSE CONCAT(e1.first_name, ' ', e1.last_name)
                END as other_employee_name
            FROM t_message m
            JOIN t_employee e1 ON m.sender_id = e1.employee_id
            JOIN t_employee e2 ON m.receiver_id = e2.employee_id
            WHERE m.message_id IN (
                SELECT MAX(message_id)
                FROM t_message
                WHERE sender_id = ? OR receiver_id = ?
                GROUP BY 
                    CASE 
                        WHEN sender_id < receiver_id THEN CONCAT(sender_id, '-', receiver_id)
                        ELSE CONCAT(receiver_id, '-', sender_id)
                    END
            )
            ORDER BY m.sent_time DESC
            LIMIT 5
        `, [employeeId, employeeId, employeeId, employeeId]);

        res.json(messages);
    } catch (err) {
        console.error('Error fetching recent messages:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get unread message count
router.get('/unread/count/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        const [result] = await pool.query(
            'SELECT COUNT(*) as unreadCount FROM t_message WHERE receiver_id = ? AND read_status = "unread"',
            [employeeId]
        );
        
        res.json({ unreadCount: result[0].unreadCount });
    } catch (err) {
        console.error('Error fetching unread count:', err);
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
// router.post('/mark-read', async (req, res) => {
//     try {
//         const { message_ids } = req.body;

//         if (!message_ids || !Array.isArray(message_ids)) {
//             return res.status(400).json({ error: 'Invalid message IDs' });
//         }

//         await pool.query(
//             'UPDATE t_message SET read_status = "read" WHERE message_id IN (?)',
//             [message_ids]
//         );

//         res.json({ success: true });
//     } catch (err) {
//         console.error('Error marking messages as read:', err);
//         res.status(500).json({ error: 'Server error' });
//     }
// });

// Get shift cancellation requests for a conversation
router.get('/cancellations/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        const [cancellations] = await pool.query(`
            SELECT sc.*, s.start_time, s.end_time, s.date_ as shift_date
            FROM t_shift_cancellations sc
            JOIN t_shift s ON sc.shift_id = s.shift_id
            WHERE sc.employee_id = ?
            ORDER BY sc.requested_at DESC
        `, [employeeId]);
        
        res.json(cancellations);
    } catch (err) {
        console.error('Error fetching cancellations:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get cancellation count for an employee
router.get('/cancellation-count/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        const [result] = await pool.query(
            'SELECT COUNT(*) as count FROM t_shift_cancellations WHERE employee_id = ?',
            [employeeId]
        );
        
        res.json({ count: result[0].count });
    } catch (err) {
        console.error('Error fetching cancellation count:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Process shift cancellation response
router.post('/cancellation-response', async (req, res) => {
    try {
        const { cancellation_id, status_, response_notes, manager_id } = req.body;
        
        // Update cancellation status
        await pool.query(
            `UPDATE t_shift_cancellations 
             SET status_ = ?, response_notes = ?, responded_at = NOW(), processed = 1 
             WHERE cancellation_id = ?`,
            [status_, response_notes, cancellation_id]
        );
        
        // Get cancellation details for notification
        const [cancellation] = await pool.query(`
            SELECT sc.*, s.shift_date, s.start_time, s.end_time,
                   e.first_name, e.last_name, e.employee_id
            FROM t_shift_cancellations sc
            JOIN t_shift s ON sc.shift_id = s.shift_id
            JOIN t_employee e ON sc.employee_id = e.employee_id
            WHERE sc.cancellation_id = ?
        `, [cancellation_id]);
        
        if (cancellation.length > 0) {
            const cancelData = cancellation[0];
            const statusText = status_ === 'approved' ? 'approved' : 'rejected';
            
            // Create notification for employee
            await pool.query(
                `INSERT INTO t_notification 
                 (employee_id, message, sent_time, read_status, notification_type_id)
                 VALUES (?, ?, NOW(), 'unread', 3)`,
                [cancelData.employee_id, 
                 `Your shift cancellation request for ${cancelData.shift_date} has been ${statusText}.`]
            );
            
            // Send message to employee about the decision
            await pool.query(
                `INSERT INTO t_message (sender_id, receiver_id, content) 
                 VALUES (?, ?, ?)`,
                [manager_id, cancelData.employee_id, 
                 `Your shift cancellation for ${cancelData.shift_date} has been ${statusText}. ${response_notes || ''}`]
            );
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error processing cancellation response:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


//mark messages as read
router.post('/mark-read', async (req, res) => {
    try {
        const { message_ids } = req.body;
        console.log('Received mark-read request for message IDs:', message_ids); // ADD THIS

        if (!message_ids || !Array.isArray(message_ids)) {
            console.log('Invalid message IDs received');
            return res.status(400).json({ error: 'Invalid message IDs' });
        }

        // Log the SQL query that will be executed
        console.log('Executing SQL: UPDATE t_message SET read_status = "read" WHERE message_id IN (?)', [message_ids]);

        const [result] = await pool.query(
            'UPDATE t_message SET read_status = "read" WHERE message_id IN (?)',
            [message_ids]
        );

        console.log('Update result:', result);
        console.log('Rows affected:', result.affectedRows);

        res.json({ success: true, affectedRows: result.affectedRows });
    } catch (err) {
        console.error('Error marking messages as read:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;