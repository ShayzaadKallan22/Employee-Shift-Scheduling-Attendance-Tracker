/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const db = require('./db');
const multer = require('multer');   //For handling file uploads.
const supabase = require('./supabase'); //Supabase client for file storage.
const path = require('path');   //For handling file paths.
const fs = require('fs');
const MAX_FILE_SIZE = 5 * 1024 * 1024; //5MB limit for sick note uploads.
const cron = require('node-cron');   //For scheduling tasks.
const { type } = require('os');

//Cron job to update leave status at midnight
//This job runs every day at midnight to update leave statuses
cron.schedule('0 0 * * *', async () => {
  try {
    //Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0];
    
    //Find approved leaves where start_date is today
    const [rows] = await db.execute(
      `SELECT l.employee_id, l.leave_id, l.status_, l.start_date, l.end_date
       FROM t_leave l
       JOIN t_employee e ON l.employee_id = e.employee_id
       WHERE l.status_ = 'approved' 
       AND l.start_date = ?
       AND e.status_ != 'On Leave'`,
      [currentDate]
    );

    for (const row of rows) {
      //Update employee status to "On Leave"
      await db.execute(
        `UPDATE t_employee 
         SET status_ = 'On Leave' 
         WHERE employee_id = ?`,
        [row.employee_id]
      );

      if(row.status_ == 'approved'){

        //Find the role of the employee going on leave
        const [[role]] = await db.execute(
            `SELECT e.role_id AS role
             FROM t_employee e
             WHERE e.employee_id = ?`,
            [row.employee_id]
        );

        //Find standby employees with the same role
        const [employees] = await db.execute(
            `SELECT employee_id FROM t_employee 
             WHERE role_id = ? AND standby = 'standby' AND status_ = 'Not Working'`, 
             [role.role]
        );
        if (employees.length === 0) {
            console.log('No standby employees found for role:', row.role);
             await db.execute(
               `DELETE FROM t_shift WHERE employee_id = ? AND date_ BETWEEN ? AND ?`,
                [row.employee_id, row.start_date, row.end_date]
            );
        }else {
            //Assign shifts to a random standby employee
            const randomIndex = Math.floor(Math.random() * employees.length);
            const standbyEmployeeId = employees[randomIndex].employee_id;   
            //Reassign shifts from the employee going on leave to the standby employee.
            await db.execute(
                `UPDATE t_shift 
                 SET employee_id = ?
                    WHERE employee_id = ? AND date_ BETWEEN ? AND ?`,
                [standbyEmployeeId, row.employee_id, row.start_date, row.end_date]
            );
            console.log(`Shifts reassigned from employee ${row.employee_id} to standby employee ${standbyEmployeeId}`);

            await db.execute(
                `INSERT INTO t_notification 
                 (employee_id, message, sent_time, read_status, notification_type_id)
                 VALUES (?, ?, NOW(), 'unread', 1)`,
                 [standbyEmployeeId, `You have been assigned shifts from ${row.start_date} to ${row.end_date} due to a colleague's leave. Please check your schedule.`]
            );
        }
      }
      
      //Send notification to employee
      await db.execute(
        `INSERT INTO t_notification 
         (employee_id, message, sent_time, read_status, notification_type_id)
         VALUES (?, ?, NOW(), 'unread', 1)`,
        [row.employee_id, `Your leave from ${row.start_date} to ${row.end_date} has started today. Your status has been updated to "On Leave".`]
      );

    }

    //Also check for leaves that have ended and update status back to "Not Working"
    const [endedLeaves] = await db.execute(
      `SELECT l.employee_id, l.leave_id 
       FROM t_leave l
       JOIN t_employee e ON l.employee_id = e.employee_id
       WHERE l.status_ = 'approved' 
       AND l.end_date < ?
       AND e.status_ = 'On Leave'`,
      [currentDate]
    );

    for (const row of endedLeaves) {
      await db.execute(
        `UPDATE t_employee 
         SET status_ = 'Not Working' 
         WHERE employee_id = ?`,
        [row.employee_id]
      );
      
      await db.execute(
        `INSERT INTO t_notification 
         (employee_id, message, sent_time, read_status, notification_type_id)
         VALUES (?, ?, NOW(), 'unread', 1)`,
        [row.employee_id, 'Your leave has ended. Your status has been updated to "Not Working".']
      );
    }
  } catch (err) {
    console.error('Error in leave status update job:', err);
  }
});

//Configure file upload with size limit and PDF validation
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

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

        //Verify leave exists & is approved
        const [leave] = await db.execute(
            `SELECT status_ FROM t_leave WHERE leave_id = ?`,
            [leave_id]
        );

        if (!leave.length) {
            return res.status(404).json({ message: 'Leave not found' });
        }

        if (leave[0].status_ !== 'approved') {
            return res.status(400).json({ 
                message: 'Sick notes can only be uploaded for approved leaves' 
            });
        }

        //If previous sick note exists, delete it from Supabase
        const [existing] = await db.execute(
            `SELECT sick_note FROM t_leave WHERE leave_id = ?`,
            [leave_id]
        );

        if (existing[0].sick_note) {
            await supabase.storage
                .from('Azania_app_sick_notes')
                .remove([existing[0].sick_note]);
        }

        //Upload new PDF to Supabase
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
        const { error: uploadError } = await supabase.storage
            .from('Azania_app_sick_notes')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true,
            });

        if (uploadError) throw uploadError;

       const { data: publicUrlData } = supabase.storage
        .from('Azania_app_sick_notes')
        .getPublicUrl(fileName);

        const fileUrl = publicUrlData.publicUrl;
        //console.log('File uploaded to Supabase at path:', path);
        //Save Supabase path to DB
        await db.execute(
            `UPDATE t_leave SET sick_note = ? WHERE leave_id = ?`,
            [fileUrl, leave_id]
        );

        //Insert notifications for employee and manager
        const [leaveRecord] = await db.execute(
            `SELECT employee_id FROM t_leave WHERE leave_id = ?`,
            [leave_id]
        );

        await db.execute(
            `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
             VALUES (?, ?, NOW(), ?, ?)`,
            [leaveRecord[0].employee_id, `Sick note uploaded for leave #${leave_id}`, 'unread', 1]
        );

        const [manager] = await db.execute(
            `SELECT employee_id FROM t_employee WHERE type_ = 'manager'`
        );

        if (manager.length === 0) {
            return res.status(404).json({ message: 'Manager not found' });
        }

        const [employee] = await db.execute(
            `SELECT CONCAT(first_name, ' ', last_name) As name
             FROM t_employee WHERE employee_id = ?`, [leaveRecord[0].employee_id]
        );

        for (const mgr of manager) {
            console.log('Notifying manager ID:', mgr.employee_id);

            await db.execute(
            `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
             VALUES (?, ?, NOW(), ?, ?)`,       
            [mgr.employee_id, `${employee[0].name} uploaded a sick note for sick leave #${leave_id}`, 'unread', 1]
            );

        }
       
        res.status(200).json({ 
            success: true,
            message: 'Sick note uploaded successfully',
            filePath: fileName
        });

    } catch (err) {
        console.error('Error uploading sick note:', err);
        res.status(500).json({ 
            success: false,
            message: err.message || 'Server error during sick note upload'
        });
    }
};

//handle employee leave requests.
exports.requestLeave = async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        
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
                success: false,
                message: 'You already have an approved or pending leave for the selected dates'
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
        let sickNoteUrl = null;

        if (typeId === 2) {
           if (remaining < daysRequested) {
                // Sick note required when insufficient balance
                if (!file) {  
                     status_ = 'pending';          
                    return res.status(400).json({ 
                        message: 'Insufficient sick leave balance. Sick note is required for this request.' 
                    });
                   
                }
                
                //Upload sick note to Supabase
                try {
                    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`;
                    const { error: uploadError } = await supabase.storage
                        .from('Azania_app_sick_notes')
                        .upload(fileName, file.buffer, {
                            contentType: file.mimetype,
                            upsert: true,
                        });

                    if (uploadError) {
                        console.error('Supabase upload error:', uploadError);
                        throw uploadError;
                    }

                    const { data: publicUrlData } = supabase.storage
                        .from('Azania_app_sick_notes')
                        .getPublicUrl(fileName);

                    sickNoteUrl = publicUrlData.publicUrl;
                    status_ = 'approved'; //Sick leave auto approved.


                } catch (uploadError) {
                    console.error('Error uploading sick note:', uploadError);
                    return res.status(500).json({ 
                        message: 'Failed to upload sick note: ' + uploadError.message 
                    });
                }
        } //Sufficient sick leave balance
                if (file) {
                    //Optional sick note provided
                    try {
                        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.pdf`;
                        const { error: uploadError } = await supabase.storage
                            .from('Azania_app_sick_notes')
                            .upload(fileName, file.buffer, {
                                contentType: file.mimetype,
                                upsert: true,
                            });

                        if (!uploadError) {
                            const { data: publicUrlData } = supabase.storage
                                .from('Azania_app_sick_notes')
                                .getPublicUrl(fileName);
                            sickNoteUrl = publicUrlData.publicUrl;
                        }
                        const [managers] = await db.execute(
                            `SELECT employee_id FROM t_employee WHERE type_ = 'manager'`
                        );

                        const [employee] = await db.execute(
                            `SELECT CONCAT(first_name, " ", last_name) AS name FROM t_employee WHERE employee_id = ?`, 
                            [employee_id]
                        );

                        const leaveTypes = {1: 'Annual', 2: 'Sick', 3: 'Family'};
                        const leaveTypeName = leaveTypes[typeId];

                        for (const mgr of managers) {
                            await db.execute(
                                `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
                                VALUES (?, ?, NOW(), ?, ?)`,
                                [mgr.employee_id, `${employee[0].name} has uploaded a sick note for ${leaveTypeName} leave from ${start_date} to ${end_date}.`, 'unread', 1]
                            );
                        }

                    } catch (uploadError) {
                        console.warn('Optional sick note upload failed:', uploadError);
                        // Don't fail the request if optional upload fails
                    }
                }
                status_ = 'approved'; // Auto-approve when balance is sufficient
            
            }else {
            //Non-sick leave types
            if (remaining < daysRequested) {
                return res.status(400).json({ 
                    message: `Insufficient leave balance. You have ${remaining} days remaining.` 
                });
            }
            status_ = 'pending'; //Requires manager approval
        }

        //Insert the leave request into the database.
        const [insertResult] = await db.execute(
            `INSERT INTO t_leave (start_date, end_date, status_, employee_id, leave_type_id, used_days, remaining_days, sick_note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [start_date, end_date, status_, employee_id, typeId, usedDays, remaining, sickNoteUrl]
        );

        //Insert notification for the employee
        await db.execute(
            `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
             VALUES (?, ?, NOW(), ?, ?)`,
            [employee_id, `Your leave request for ${daysRequested} days has been ${status_ === 'approved' ? 'approved' : 'submitted and is pending approval'}.`, 'unread', 1]
        );
       
        //If the leave is approved and starts today, update employee status
        if (status_ === 'approved') {
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            const formattedCurrentDate = currentDate.toISOString().split('T')[0];
            
            if (start_date === formattedCurrentDate) {
                await db.execute(
                    `UPDATE t_employee SET status_ = ? WHERE employee_id = ?`,
                    ['On Leave', employee_id]
                );
            }
        }

        //If it's a pending request, notify managers
        if (status_ === 'pending') {
            try {
                const [managers] = await db.execute(
                    `SELECT employee_id FROM t_employee WHERE type_ = 'manager'`
                );

                const [employee] = await db.execute(
                    `SELECT CONCAT(first_name, " ", last_name) AS name FROM t_employee WHERE employee_id = ?`, 
                    [employee_id]
                );

                const leaveTypes = {1: 'Annual', 2: 'Sick', 3: 'Family'};
                const leaveTypeName = leaveTypes[typeId];

                for (const mgr of managers) {
                    await db.execute(
                        `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
                         VALUES (?, ?, NOW(), ?, ?)`,
                        [mgr.employee_id, `${employee[0].name} has requested ${daysRequested} days of ${leaveTypeName} leave from ${start_date} to ${end_date}.`, 'unread', 1]
                    );
                }
            } catch (notificationError) {
                console.error('Error sending manager notifications:', notificationError);
                //Don't fail the request if notifications fail
            }
        }

        res.status(200).json({ 
            message: 'Leave request submitted successfully', 
            leave_id: insertResult.insertId, 
            status_: status_,
            days_requested: daysRequested,
            remaining_balance: remaining - (status_ === 'approved' ? daysRequested : 0)
        });

    }catch (err) {
        console.error('Error in requestLeave:', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
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
            `SELECT status_, employee_id 
            FROM T_Leave WHERE leave_id = ?`, [leave_id]
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
