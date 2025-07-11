/**
 * @author MOYO CT, 221039267
 */


const db = require('./db');

//Submit a leave request (employee)
exports.requestLeave = async (req, res) => {
    const { employee_id, leave_type_id, start_date, end_date } = req.body;

    //Edited by Cletus
    if (!employee_id || !leave_type_id || !start_date || !end_date) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {

        //Calculate the number of leave days.
        const start = new Date(start_date);
        const end = new Date(end_date);
        const daysRequested = Math.ceil((end-start)/ (1000 * 60 * 60 * 24)) + 1;

        //get max balance for the leave type.
        const leaveTypeMax ={
            1: 20,  //Annual
            2: 30,  //Sick
            3: 15   //Family
        };

        const maxBalance = leaveTypeMax[leave_type_id];

        //Auto approve sick leave.
        let status ='pending';
        let usedDays = 0;
        let remaining = maxBalance;

        if(leave_type_id === 2){
            status = 'approved';
        }else{
            //Check leave balance
            const [rows] = await db.execute(
                `SELECT COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS used_days
                 FROM T_Leave
                 WHERE employee_id = ? AND leave_type_id = ? AND status_ = 'approved'`, [employee_id, leave_type_id]
            );

            usedDays = rows[0].used_days;
            remaining = maxBalance - usedDays;

            //Auto- approve if more than half of max balance remains
            if(remaining >= (maxBalance / 2) && remaining >= daysRequested){
                status = 'approved';
            }
        }
        //Insert leave request
        const [insertResult] = await db.execute(
            `INSERT INTO T_Leave (start_date, end_date, status_, employee_id, leave_type_id, used_days, remaining_days)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [start_date, end_date, status, employee_id, leave_type_id, usedDays, remaining]
        );

        await db.execute(
            `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
             VALUES (?, ?, NOW(), ?, ?)`, 
             [employee_id, `Your leave request has been ${status} for ${daysRequested} days.`, 'unread', 1]
        );

        if(status === 'approved'){
            await db.execute(
                 `UPDATE t_employee SET status_ = ? 
                  WHERE employee_id = ?`, ['On Leave', employee_id]
            );
        }
        //res.json(insertResult);
        res.status(201).json({ message: 'Leave request submitted', leave_id: insertResult.insertId, status });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.cancelLeave = async (req, res) => {
    const {leave_id} = req.params;

    try{
        const[rows] = await db.execute(`SELECT status_ FROM T_Leave WHERE leave_id = ?`, [leave_id]);

        if(!rows.length) return res.status(404).json({message: 'Leave not found'});
        //Cannot cancel if leave status !== pending.
        if(rows[0].status_ !== 'pending'){
            return res.status(400).json({message: 'Only pending requests can be cancelled.'});
        }
        //Otherwise cancel and delete record.
        await db.execute(`DELETE FROM T_Leave WHERE leave_id = ?`, [leave_id]);
        res.json({message: 'Leave request cancelled'});
    }catch(err){
        console.error(err);
        res.status(500).json({message: 'Server error.'});
    }
};

//View all leave requests (manager)
exports.getAllLeaveRequests = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT l.leave_id, l.start_date, l.end_date, l.status_,
                   e.first_name, e.last_name, e.employee_id,
                   t.name_ AS leave_type
            FROM T_Leave l
            JOIN T_Employee e ON l.employee_id = e.employee_id
            JOIN T_Leave_Type t ON l.leave_type_id = t.leave_type_id
            WHERE l.status_ = 'pending' AND
              t.name_ IN ('Annual Leave', 'Family leave')
            ORDER BY l.created_at DESC
        `);

        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

//Approve or reject leave (manager)
exports.respondToLeave = async (req, res) => {
    const { leave_id, action } = req.body;

    if (!leave_id || !['approved', 'rejected'].includes(action)) {
        return res.status(400).json({ message: 'Invalid input' });
    }

    try {
        //Check current status
        const [[leave]] = await db.query(
            `SELECT status_, employee_id FROM T_Leave WHERE leave_id = ?`, [leave_id]
        );

        if(!leave) {
            return res.status(404).json({message: 'Leave not found.'});
        }
        if(leave.status_ !== 'pending'){
            return res.status(400).json({message: 'Only pending requests can be updated.'})
        }
        //Update leave status
        await db.execute(
            `UPDATE T_Leave SET status_ = ?, updated_at = CURRENT_TIMESTAMP WHERE leave_id = ?`,
            [action, leave_id]
        );

        await db.execute(
            `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
             VALUES (?, ?, NOW(), ?, ?)`, 
             [leave.employee_id, `Your leave request has been ${action}`, 'unread', 1]
        );
         //get max balance for the leave type.
        const leaveTypeMax ={
            1: 20,  //Annual
            2: 30,  //Sick
            3: 15   //Family
        };

        //Adjust used_days if approved
        if (action === 'approved') {
            //get days requested.
            const [[leaveInfo]] = await db.query(`
                SELECT employee_id, leave_type_id, 
                   DATEDIFF(end_date, start_date) + 1 AS days_requested
                FROM T_Leave
                WHERE leave_id = ?`, [leave_id]);
            //get days used so far.
            const [rows] = await db.execute(`
                SELECT COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS used_so_far
                FROM T_Leave
                WHERE employee_id = ? 
                  AND leave_type_id = ?
                  AND status_ = 'approved'
                  AND leave_id != ?
                `, [leaveInfo.employee_id, leaveInfo.leave_type_id, leave_id]);

            const usedSoFar = rows[0].used_so_far || 0; 

            const maxBalance = leaveTypeMax[leave_type_id];
            const totalUsed = usedSoFar + leaveInfo.days_Requested
            const remaining = maxBalance - totalUsed;
            await db.execute(
                `UPDATE T_Leave SET used_days = ?, remaining_days = ?
                 WHERE leave_id = ?`,
                [totalUsed, remaining, leave_id]
            );
        }

        res.status(200).json({ message: `Leave request ${action}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

//View my leave requests (employee)
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
