// Yatin
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
            `INSERT INTO t_leave (start_date, end_date, status_, employee_id, leave_type_id)
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
        e.role_id,
        t.name_ AS leave_type, 
        t.max_days_per_year,
        DATEDIFF(l.end_date, l.start_date) + 1 AS days_requested,
        (SELECT IFNULL(SUM(DATEDIFF(l2.end_date, l2.start_date) + 1), 0)
         FROM t_leave l2
         WHERE l2.employee_id = e.employee_id
         AND l2.leave_type_id = t.leave_type_id
         AND l2.status_ = 'approved') AS used_days,
        (SELECT COUNT(*) 
         FROM t_event_employee ee
         JOIN t_event ev ON ee.event_id = ev.event_id
         WHERE ee.employee_id = e.employee_id
         AND ev.end_date >= l.start_date 
         AND ev.start_date <= l.end_date) > 0 AS has_events,
        (SELECT GROUP_CONCAT(CONCAT(ev.event_name, ' (', ev.start_date, ' to ', ev.end_date, ')') SEPARATOR '; ')
         FROM t_event_employee ee
         JOIN t_event ev ON ee.event_id = ev.event_id
         WHERE ee.employee_id = e.employee_id
         AND ev.end_date >= l.start_date 
         AND ev.start_date <= l.end_date) AS event_names
      FROM t_leave l
      JOIN t_employee e ON l.employee_id = e.employee_id
      JOIN t_leave_type t ON l.leave_type_id = t.leave_type_id
      WHERE l.status_ = 'pending'
      ORDER BY l.created_at DESC
    `);

        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};


exports.respondToLeave = async (req, res) => {
    const { leave_id, action, rejection_reason, custom_message, manager_id } = req.body;

    if (!leave_id || !['approved', 'rejected'].includes(action)) {
        return res.status(400).json({ message: 'Invalid input' });
    }

    try {
        //Get leave info before updating
        const [[leaveInfo]] = await db.query(`
            SELECT 
                l.*,
                e.first_name,
                e.last_name,
                t.name_ as leave_type_name
            FROM t_leave l
            JOIN t_employee e ON l.employee_id = e.employee_id
            JOIN t_leave_type t ON l.leave_type_id = t.leave_type_id
            WHERE l.leave_id = ?
        `, [leave_id]);

        if (!leaveInfo) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        
        const formatSADate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-ZA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        const formattedStartDate = formatSADate(leaveInfo.start_date);
        const formattedEndDate = formatSADate(leaveInfo.end_date);

        //Update leave status
        await db.execute(
            `UPDATE t_leave SET status_ = ?, updated_at = CURRENT_TIMESTAMP WHERE leave_id = ?`,
            [action, leave_id]
        );

        //If approved, update employee status to On Leave and schedule status reset
        if (action === 'approved') {
            await db.execute(
                `UPDATE t_employee SET status_ = 'On Leave' WHERE employee_id = ?`,
                [leaveInfo.employee_id]
            );

            //Schedule status reset to Not Working when leave period ends
            const endDate = new Date(leaveInfo.end_date);
            const now = new Date();

            if (endDate > now) {
                const timeUntilEnd = endDate.getTime() - now.getTime();

                //Schedule the status update
                setTimeout(async () => {
                    try {
                        await db.execute(
                            `UPDATE t_employee SET status_ = 'Not Working' WHERE employee_id = ? AND status_ = 'On Leave'`,
                            [leaveInfo.employee_id]
                        );
                    } catch (err) {
                        console.error('Error resetting employee status after leave:', err);
                    }
                }, timeUntilEnd);
            } else {
                //If leave has already ended, set status to not working immediately
                await db.execute(
                    `UPDATE t_employee SET status_ = 'Not Working' WHERE employee_id = ?`,
                    [leaveInfo.employee_id]
                );
            }
        }

        //Create notification message with formatted dates
        const message = action === 'approved'
            ? `Your ${leaveInfo.leave_type_name} request from ${formattedStartDate} to ${formattedEndDate} has been approved`
            : `Your ${leaveInfo.leave_type_name} request from ${formattedStartDate} to ${formattedEndDate} has been rejected`;

        //Insert notification
        await db.execute(
            `INSERT INTO t_notification (employee_id, message, notification_type_id, sent_time, read_status)
             VALUES (?, ?, 1, CURRENT_TIMESTAMP, 'unread')`,
            [leaveInfo.employee_id, message]
        );

        //If rejected, send automatic message with rejection reason
        if (action === 'rejected') {
            let actualManagerId = manager_id;

            //If no manager_id provided in request, try to get one from database
            if (!actualManagerId) {
                console.warn('No manager ID provided in request, finding a manager from database');
                const [[manager]] = await db.query(
                    `SELECT employee_id FROM t_employee WHERE type_ = 'manager' LIMIT 1`
                );
                actualManagerId = manager ? manager.employee_id : 1;
                console.log('Using manager ID from database:', actualManagerId);
            } else {
                console.log('Using manager ID from request:', actualManagerId);
            }

            await this.sendRejectionMessage(
                leaveInfo,
                rejection_reason,
                custom_message,
                actualManagerId,
                formattedStartDate,
                formattedEndDate
            );
        }

        //Adjust used_days if approved
        if (action === 'approved') {
            const daysRequested = leaveInfo.days_requested ||
                (new Date(leaveInfo.end_date) - new Date(leaveInfo.start_date)) / (1000 * 60 * 60 * 24) + 1;

            await db.execute(
                `UPDATE t_leave 
                 SET used_days = ?, 
                     remaining_days = (SELECT max_days_per_year FROM t_leave_type WHERE leave_type_id = ?) - ?
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



exports.sendRejectionMessage = async (leaveInfo, rejection_reason, custom_message, manager_id, formattedStartDate, formattedEndDate) => {
    try {
        // Use the provided manager_id
        if (!manager_id) {
            console.error('No manager ID provided for rejection message');
            return;
        }

        // If formatted dates weren't provided, format them here
        if (!formattedStartDate || !formattedEndDate) {
            // const formatSADate = (dateString) => {
            //     const date = new Date(dateString);
            //     return date.toLocaleDateString('en-ZA', {
            //         year: 'numeric',
            //         month: '2-digit',
            //         day: '2-digit'
            //     });
            // };
            const formatSADate = (dateString) => {
                const date = new Date(dateString);
                return date.toLocaleDateString('en-ZA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            };
            formattedStartDate = formatSADate(leaveInfo.start_date);
            formattedEndDate = formatSADate(leaveInfo.end_date);
        }

        let messageContent = '';

        // Generate message based on rejection reason with formatted dates
        switch (rejection_reason) {
            case 'event_conflict':
                messageContent = `Your leave request from ${formattedStartDate} to ${formattedEndDate} was rejected due to scheduled events during this period. You may be needed for the event.`;
                break;

            case 'insufficient_standby':
                messageContent = `Your leave request from ${formattedStartDate} to ${formattedEndDate} was rejected due to insufficient standby staff availability. We cannot ensure proper coverage during your absence.`;
                break;

            case 'peak_period':
                messageContent = `Your leave request from ${formattedStartDate} to ${formattedEndDate} was rejected as it falls during a peak business period. Please consider alternative dates.`;
                break;

            case 'insufficient_leave_balance':
                messageContent = `Your leave request from ${formattedStartDate} to ${formattedEndDate} was rejected due to insufficient leave balance. Please check your available leave days.`;
                break;

            case 'other':
                messageContent = custom_message || `Your leave request from ${formattedStartDate} to ${formattedEndDate} was rejected. Please contact me for more details.`;
                break;

            default:
                messageContent = `Your leave request from ${formattedStartDate} to ${formattedEndDate} was rejected.`;
        }

        // invitation to discuss
        messageContent += `\n\nIf you have questions or would like to discuss this decision, please reply to this message or speak to me in person.`;

        //Insert message into database
        await db.execute(
            `INSERT INTO t_message (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
            [manager_id, leaveInfo.employee_id, messageContent]
        );

        console.log(`Rejection message sent to employee ${leaveInfo.employee_id} from manager ${manager_id}`);

    } catch (err) {
        console.error('Error sending rejection message:', err);
        
    }
};

//View my leave requests (employee)
exports.getMyLeaveRequests = async (req, res) => {
    const employee_id = req.params.employee_id;

    try {
        const [rows] = await db.query(`
            SELECT l.leave_id, l.start_date, l.end_date, l.status_,
                   t.name_ AS leave_type
            FROM t_leave l
            JOIN t_leave_type t ON l.leave_type_id = t.leave_type_id
            WHERE l.employee_id = ?
            ORDER BY l.created_at DESC
        `, [employee_id]);

        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

//Check standby availability for leave period
exports.checkStandbyAvailability = async (req, res) => {
    const { employee_id, start_date, end_date } = req.body;

    if (!employee_id || !start_date || !end_date) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        //Get the employee's role to find suitable standby employees
        const [employeeData] = await db.execute(
            `SELECT role_id FROM t_employee WHERE employee_id = ?`,
            [employee_id]
        );

        if (employeeData.length === 0) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const role_id = employeeData[0].role_id;

        // ind available standby employees with the same role who are not on leave during the requested period
        const [availableStandby] = await db.execute(`
      SELECT 
        e.employee_id,
        e.first_name,
        e.last_name,
        e.status_
      FROM t_employee e
      WHERE e.role_id = ?
      AND e.employee_id != ?
      AND e.status_ != 'On Leave'
      AND NOT EXISTS (
        SELECT 1 
        FROM t_leave l 
        WHERE l.employee_id = e.employee_id 
        AND l.status_ = 'approved'
        AND l.start_date <= ? 
        AND l.end_date >= ?
      )
    `, [role_id, employee_id, end_date, start_date]);

        //Count total standby employees with the same role (regardless of availability)
        const [totalStandby] = await db.execute(`
      SELECT COUNT(*) as total_count
      FROM t_employee
      WHERE role_id = ?
      AND employee_id != ?
    `, [role_id, employee_id]);

        res.status(200).json({
            available: availableStandby.length,
            total: totalStandby[0].total_count,
            standbyEmployees: availableStandby
        });
    } catch (err) {
        console.error('Error checking standby availability:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
