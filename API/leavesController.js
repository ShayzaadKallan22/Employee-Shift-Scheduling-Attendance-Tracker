/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const db = require('./db');
const multer = require('multer');   //For handling file uploads.
const path = require('path');   //For handling file paths.
const fs = require('fs');
const MAX_FILE_SIZE = 5 * 1024 * 1024; //5MB limit for sick note uploads.
// const cron = require('node-cron');   //For scheduling tasks.

// //Cron job to update leave status at midnight
// //This job runs every day at midnight to update leave statuses
// cron.schedule('0 0 * * *', async () => {
//   try {
//     const [rows] = await db.execute(
//       `SELECT employee_id FROM t_leave 
//        WHERE status_ = 'approved' 
//        AND end_date <= DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
//     );

//     for (const row of rows) {
//       await db.execute(
//         `UPDATE t_employee 
//          SET status_ = 'Not Working' 
//          WHERE employee_id = ? AND status_ = 'On Leave'`,
//         [row.employee_id]
//       );
      
//       //Send notification to employee.
//       await db.execute(
//         `INSERT INTO t_notification 
//          (employee_id, message, sent_time, read_status, notification_type_id)
//          VALUES (?, ?, NOW(), 'unread', 1)`,
//         [row.employee_id, 'Your leave has ended. Your status has been updated to "Not Working".']
//       );
//     }
//   } catch (err) {
//     console.error('Error in leave status update job:', err);
//   }
// });

//Configure file upload with size limit and PDF validation
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

//Filter to allow only PDF files.
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

//Set up multer with storage, file filter, and size limit.
const upload = multer({ 
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});

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
 
        //Get the total used days per leave type.
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

//Handle employee sick note uploads.
exports.uploadSickNote = async (req, res) => {
    const { leave_id } = req.params;
    
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                message: 'No file uploaded or file is not a PDF' 
            });
        }

        //Verify the leave exists and is approved
        const [leave] = await db.execute(
            `SELECT status_ FROM t_leave WHERE leave_id = ?`,
            [leave_id]
        );

        if (!leave.length) {
            //Clean up the uploaded file if leave doesn't exist
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ message: 'Leave not found' });
        }

        if (leave[0].status_ !== 'approved') {
            //Clean up the uploaded file if leave isn't approved
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                message: 'Sick notes can only be uploaded for approved leaves' 
            });
        }

        //If there was a previous sick note, delete it
        const [existing] = await db.execute(
            `SELECT sick_note FROM t_leave WHERE leave_id = ?`,
            [leave_id]
        );

        if (existing[0].sick_note) {
            try {
                fs.unlinkSync(path.join('uploads', existing[0].sick_note));
            } catch (err) {
                console.error('Error deleting old sick note:', err);
            }
        }

        await db.execute(
            `UPDATE t_leave SET sick_note = ? WHERE leave_id = ?`,
            [req.file.filename, leave_id]
        );

        //Add notification about sick note upload
       const [leaveRecord] = await db.execute(
         `SELECT employee_id FROM t_leave WHERE leave_id = ?`,
         [leave_id]
       );

       await db.execute(
         `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
         VALUES (?, ?, NOW(), ?, ?)`,
         [leaveRecord[0].employee_id, `Sick note uploaded for leave #${leave_id}`, 'unread', 1]
       );
       
       //Notify the manager about the sick note upload
       const [manager] = await db.execute(
        `SELECT employee_id FROM t_employee 
         WHERE type_ = 'manager'
        `
       );
         if (manager.length === 0) {
              return res.status(404).json({ message: 'Manager not found' });
         }

        //Get the employee's name for the notification.
        const [employee] = await db.execute(
            `SELECT CONCAT(first_name, last_name) As name
             FROM t_employee WHERE employee_id = ?`,   [leaveRecord[0].employee_id]
        );

       //Insert notification for manager
       await db.execute(
        `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
         VALUES (?, ?, NOW(), ?, ?)`,       
        [manager[0].employee_id, `${employee[0].name} uploaded a sick note for sick leave #${leave_id}`, 'unread', 1]
       );

        res.status(200).json({ 
            success: true,
            message: 'Sick note uploaded successfully',
            filename: req.file.filename
        });
    } catch (err) {
        console.error('Error uploading sick note:', err);
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupErr) {
                console.error('Error cleaning up uploaded file:', cleanupErr);
            }
        }
        res.status(500).json({ 
            success: false,
            message: err.message || 'Server error during sick note upload'
        });
    }
};

//handle employee leave requests.
exports.requestLeave = async (req, res) => {
    try {
        const employee_id = req.body.employee_id || req.body.fields?.employee_id;
        const leave_type_id = req.body.leave_type_id || req.body.fields?.leave_type_id;
        const start_date = req.body.start_date || req.body.fields?.start_date;
        const end_date = req.body.end_date || req.body.fields?.end_date;
        //Extract the uploaded file if any.
        //This is for sick leave where a sick note is required.
        const file = req.file;

        if (!employee_id || !leave_type_id || !start_date || !end_date) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        //Convert the dates to Date objects for validation.
        const start = new Date(start_date);
        const end = new Date(end_date);

        //Set the time to midnight for accurate date comparison.
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        //Calculate the number of days requested.
        const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        //Validate the requested dates and days.
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


        //If the employee does not exist or has no leave records, return an error.
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Employee not found or no leave records' });
        }
         //Get the total used days for the leave type.
        const usedDays = rows[0].used_days || 0;
        //Calculate the remaining days based on the maximum balance and used days.
        const remaining = maxBalance - usedDays;
        let status_ = 'pending';   //Inialiaze status to pending.

        //If the requested days exceed the remaining balance for sick leave, a sick note is required.
        let sickNoteFile = null;

        if (typeId === 2 && remaining < daysRequested) {
            if (!file) {            
                //If the sick note is not provided and the remaining days are less than requested, return
                return res.status(400).json({ 
                    message: 'Insufficient sick leave balance. Sick note is required for this request.' 
               });
            }
            //If a sick note is provided, validate the file size.
            if (file.size > MAX_FILE_SIZE) {
                return res.status(400).json({ 
                    message: `Sick note file size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` 
                });
            }
            //If the sick note is valid, set the sick note file name.
            sickNoteFile = file.filename;
        } else if (typeId === 2 && remaining >= daysRequested) {
            //If the sick leave balance is sufficient, no sick note is required.    
            sickNoteFile = file ? file.filename : null;
            status_ = 'approved';  //Set status to approved if sick leave balance is sufficient
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
        if (status_ === 'approved' || status_ === 'rejected') {
            await db.execute(
                `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
                 VALUES (?, ?, NOW(), ?, ?)`,
                [employee_id, `Your leave request for ${daysRequested} days has been ${status_}.`, 'unread', 1]
            );
        }else {
            //If the leave is pending, notify the employee that their request is pending.
            await db.execute(
                `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
                 VALUES (?, ?, NOW(), ?, ?)`,
                [employee_id, `Your leave request for ${daysRequested} days is pending approval.`, 'unread', 1]
            );
        }
       
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

//Fetch the leave history for an employee..
exports.getLeaveHistory = async (req, res) => {
    const { employee_id } = req.params;

    try {
        const [rows] = await db.query(`
            SELECT 
                l.leave_id,
                l.start_date,
                l.end_date,
                l.status_,
                l.sick_note,
                t.name_ AS leave_type,
                DATEDIFF(l.end_date, l.start_date) + 1 AS days_taken,
                l.created_at
            FROM t_leave l
            JOIN t_leave_type t ON l.leave_type_id = t.leave_type_id
            WHERE l.employee_id = ?
            ORDER BY l.created_at DESC
        `, [employee_id]);

        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching leave history:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

//View all leave requests (manager)
exports.getAllLeaveRequests = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT l.leave_id, l.start_date, l.end_date, l.status_,
                   e.first_name, e.last_name, e.employee_id,
                   t.name_ AS leave_type
            FROM t_leave l
            JOIN t_employee e ON l.employee_id = e.employee_id
            JOIN t_leave_type t ON l.leave_type_id = t.leave_type_id
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
            `SELECT status_, employee_id 
            FROM t_leave WHERE leave_id = ?`, [leave_id]
        );

        if(!leave) {
            return res.status(404).json({message: 'Leave not found.'});
        }
        if(leave.status_ !== 'pending'){
            return res.status(400).json({message: 'Only pending requests can be updated.'})
        }
        //Update leave status
        await db.execute(
            `UPDATE t_leave SET status_ = ?, updated_at = CURRENT_TIMESTAMP WHERE leave_id = ?`,
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
                FROM t_leave
                WHERE leave_id = ?`, [leave_id]);
            //get days used so far.
            const [rows] = await db.execute(`
                SELECT COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS used_so_far
                FROM t_leave
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
                `UPDATE t_leave SET used_days = ?, remaining_days = ?
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
