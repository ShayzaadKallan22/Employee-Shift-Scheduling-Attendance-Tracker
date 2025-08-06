/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */


const db = require('./db');
const multer = require('multer');
const path = require('path');

//Configure file upload.
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'), //Directory to save uploaded files.
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

exports.uploadFile = upload.single('sick_note');
//Fetch an employee's remaining leave days.
exports.getRemainingLeaveDays = async (req, res) => {
    const { employee_id, leave_type_id } = req.params;

    if (!employee_id || !leave_type_id) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }

    try {
        const leaveTypeMax = {
            1: 20,  //Annual
            2: 30,  //Sick
            3: 15   //Family
        };

        const leaveTypeIdNum = parseInt(leave_type_id);
        const maxBalance = leaveTypeMax[leaveTypeIdNum];

        if (!maxBalance) {
            return res.status(400).json({ message: 'Invalid leave type ID' });
        }

        const [rows] = await db.execute(
            `SELECT COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS used_days
             FROM t_leave
             WHERE employee_id = ? AND leave_type_id = ? AND status_ = 'approved'`, 
            [employee_id, leaveTypeIdNum]
        );
 
        //get the total used days per leave type.
        const usedDays = rows[0].used_days || 0;
        //Calculate the remaining leave days from the maximum balance per leave type.
        const remainingDays = maxBalance - usedDays;

        res.status(200).json({ 
            remainingDays,
            maxBalance,
            usedDays
        });
    } catch (err) {
        console.error('Error fetching remaining leave days:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

//handle employee leave requests.
exports.requestLeave = async (req, res) => {
    try {
        const { employee_id, leave_type_id, start_date, end_date } = req.body;
        //Extract the uploaded file if any.
        //This is for sick leave where a sick note is required.
        const file = req.file;

        if (!employee_id || !leave_type_id || !start_date || !end_date) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const start = new Date(start_date);
        const end = new Date(end_date);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (daysRequested < 1 || start > end) {
            return res.status(400).json({ message: 'Invalid date range' });
        }
        //Check if the employee has any existing approved or pending leaves that conflict with the requested dates.
        const [existingLeaves] = await db.execute(
            `SELECT * FROM t_leave 
             WHERE employee_id = ? 
             AND status_ IN ('approved', 'pending')
             AND (
                 (start_date BETWEEN ? AND ?) OR 
                 (end_date BETWEEN ? AND ?) OR
                 (? BETWEEN start_date AND end_date) OR
                 (? BETWEEN start_date AND end_date)
             )`,
            [employee_id, start_date, end_date, start_date, end_date, start_date, end_date]
        );

        //If there are existing leaves that conflict with the requested dates, return an error.
        //This prevents double booking of leave days.
        if (existingLeaves.length > 0) {
            return res.status(400).json({ 
                message: 'You already have an approved or pending leave for the selected dates',
                conflictingLeaves: existingLeaves
            });
        }

        //Check the leave type and calculate the remaining days.
        const leaveTypeMax = { 1: 20, 2: 30, 3: 15 };
        const typeId = parseInt(leave_type_id);
        const maxBalance = leaveTypeMax[typeId];
        if (!maxBalance) return res.status(400).json({ message: 'Invalid leave type ID' });

        //Calculate the used days for the leave type.
        //This is the total number of days already used for the leave type.
        const [rows] = await db.execute(
            `SELECT COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS used_days
             FROM t_leave
             WHERE employee_id = ? AND leave_type_id = ? AND status_ = 'approved'`,
            [employee_id, typeId]
        );

        const usedDays = rows[0].used_days || 0;
        const remaining = maxBalance - usedDays;
        let status_ = 'pending';   //Inialiaze status to pending.

        //If the requested days exceed the remaining balance for sick leave, a sick note is required.
        let sickNoteFile = null;

        if (typeId === 2) {
            if (daysRequested > remaining && !file) {
                return res.status(400).json({ message: 'A PDF sick note is required for sick leave beyond your balance.' });
            }
            sickNoteFile = file ? file.filename : null;
            //If a sick note is provided, it will be saved in the uploads directory.
        } else if (remaining >= daysRequested) {
            status_ = 'approved';
        }

        //Insert the leave request into the database.
        //If the status is approved, update the employee's status to "On Leave".
        const [insertResult] = await db.execute(
            `INSERT INTO t_leave (start_date, end_date, status_, employee_id, leave_type_id, used_days, remaining_days, sick_note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [start_date, end_date, status_, employee_id, typeId, usedDays, remaining, sickNoteFile]
        );

        //Insert a notification for the employee about the leave request.
        //This will notify the employee about the status of their leave request.
        await db.execute(
            `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
             VALUES (?, ?, NOW(), ?, ?)`,
            [employee_id, `Your leave request has been ${status_} for ${daysRequested} days.`, 'unread', 1]
        );

        //If the leave is approved, update the employee's status to "On Leave".
        //This is to reflect that the employee is currently on leave.
        if (status_ === 'approved') {
            await db.execute(`UPDATE t_employee SET status_ = ? WHERE employee_id = ?`, ['On Leave', employee_id]);
        }

        res.status(200).json({ message: 'Leave request submitted', leave_id: insertResult.insertId, status_ });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

//Cancel a leave request.
//This allows an employee to cancel their pending leave request.
exports.cancelLeave = async (req, res) => {
    const {leave_id} = req.params;

    try{
        const[rows] = await db.execute(`SELECT status_ FROM t_leave WHERE leave_id = ?`, [leave_id]);

        if(!rows.length) return res.status(404).json({message: 'Leave not found'});
        //Cannot cancel if leave status !== pending.
        if(rows[0].status_ !== 'pending'){
            return res.status(400).json({message: 'Only pending requests can be cancelled.'});
        }
        //Otherwise cancel and delete record.
        await db.execute(`DELETE FROM t_leave WHERE leave_id = ?`, [leave_id]);
        res.json({message: 'Leave request cancelled'});
    }catch(err){
        console.error(err);
        console.log(err);
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
