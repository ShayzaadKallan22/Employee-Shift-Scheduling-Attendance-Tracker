const db = require('./db');

// Submit a leave request (employee)
exports.requestLeave = async (req, res) => {
    const { employee_id, leave_type_id, start_date, end_date } = req.body;

    //Edited by Cletus
    if (!employee_id || !leave_type_id || !start_date || !end_date) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO T_Leave (start_date, end_date, status_, employee_id, leave_type_id)
             VALUES (?, ?, 'pending', ?, ?)`,
            [start_date, end_date, employee_id, leave_type_id]
        );
    //End of edit.
        res.status(201).json({ message: 'Leave request submitted', leave_id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// View all leave requests (manager)
exports.getAllLeaveRequests = async (req, res) => {
    try {
        const [rows] = await db.query(`
    SELECT 
        l.leave_id, 
        l.start_date, 
        l.end_date, 
        l.status_,
        e.first_name, 
        e.last_name, 
        e.employee_id,
        t.name_ AS leave_type, 
        t.max_days_per_year,
        DATEDIFF(l.end_date, l.start_date) + 1 AS days_requested
    FROM T_Leave l
    JOIN T_Employee e ON l.employee_id = e.employee_id
    JOIN T_Leave_Type t ON l.leave_type_id = t.leave_type_id
    WHERE l.status_ = 'pending'  -- Only pending requests
    ORDER BY l.created_at DESC
`);

        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Editted By Yatin

exports.respondToLeave = async (req, res) => {
    const { leave_id, action } = req.body;

    if (!leave_id || !['approved', 'rejected'].includes(action)) {
        return res.status(400).json({ message: 'Invalid input' });
    }

    try {
        //get leave info before updating
        const [[leaveInfo]] = await db.query(`
            SELECT 
                l.*,
                e.first_name,
                e.last_name,
                t.name_ as leave_type_name
            FROM T_Leave l
            JOIN T_Employee e ON l.employee_id = e.employee_id
            JOIN T_Leave_Type t ON l.leave_type_id = t.leave_type_id
            WHERE l.leave_id = ?
        `, [leave_id]);

        if (!leaveInfo) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        //Update leave status
        await db.execute(
            `UPDATE T_Leave SET status_ = ?, updated_at = CURRENT_TIMESTAMP WHERE leave_id = ?`,
            [action, leave_id]
        );

        //If approved, update employee status to On Leave and schedule status reset
        if (action === 'approved') {
            await db.execute(
                `UPDATE T_Employee SET status_ = 'On Leave' WHERE employee_id = ?`,
                [leaveInfo.employee_id]
            );

            //Schedule status reset to Not Working when leave period ends
            const endDate = new Date(leaveInfo.end_date);
            const now = new Date();
            
            if (endDate > now) {
                const timeUntilEnd = endDate.getTime() - now.getTime();
                
                // Schedule the status update
                setTimeout(async () => {
                    try {
                        await db.execute(
                            `UPDATE T_Employee SET status_ = 'Not Working' WHERE employee_id = ? AND status_ = 'On Leave'`,
                            [leaveInfo.employee_id]
                        );
                    } catch (err) {
                        console.error('Error resetting employee status after leave:', err);
                    }
                }, timeUntilEnd);
            } else {
                //if leave has already ended, set status to not working immediately
                await db.execute(
                    `UPDATE T_Employee SET status_ = 'Not Working' WHERE employee_id = ?`,
                    [leaveInfo.employee_id]
                );
            }
        }

        // Create notification message
        const message = action === 'approved' 
            ? `Your ${leaveInfo.leave_type_name} request from ${leaveInfo.start_date} to ${leaveInfo.end_date} has been approved`
            : `Your ${leaveInfo.leave_type_name} request from ${leaveInfo.start_date} to ${leaveInfo.end_date} has been rejected`;

        //Insert notification with CURRENT_TIMESTAMP for sent_time (datetime)
        await db.execute(
            `INSERT INTO T_Notification (employee_id, message, notification_type_id, sent_time, read_status)
             VALUES (?, ?, 1, CURRENT_TIMESTAMP, 'unread')`,
            [leaveInfo.employee_id, message]
        );

        // Adjust used_days if approved
        if (action === 'approved') {
            const daysRequested = leaveInfo.days_requested || 
                (new Date(leaveInfo.end_date) - new Date(leaveInfo.start_date)) / (1000 * 60 * 60 * 24) + 1;    //AI calculation that works

            //update the leave record with used days
            await db.execute(
                `UPDATE T_Leave 
                 SET used_days = ?, 
                     remaining_days = (SELECT max_days_per_year FROM T_Leave_Type WHERE leave_type_id = ?) - ?
                 WHERE leave_id = ?`,
                [daysRequested, leaveInfo.leave_type_id, daysRequested, leave_id]
            );
        }

        res.status(200).json({ message: `Leave request ${action}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
//end of Yatin edit

// View my leave requests (employee)
exports.getMyLeaveRequests = async (req, res) => {
    const employee_id = req.params.employee_id;

    try {
        const [rows] = await db.query(`
            SELECT l.leave_id, l.start_date, l.end_date, l.status_,
                   t.name_ AS leave_type
            FROM T_Leave l
            JOIN T_Leave_Type t ON l.leave_type_id = t.leave_type_id
            WHERE l.employee_id = ?
            ORDER BY l.created_at DESC
        `, [employee_id]);

        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};
