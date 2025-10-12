/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const db = require('./db');

//Fetch upcoming shifts for each employee.
exports.getUpcomingShifts = async (req, res) => {
    const { employeeId } = req.params;
    if(!employeeId) return res.status(400).json({message: 'Employee Id not found.'});
    
    try{
        const [rows] = await db.query (
        `SELECT s.*
         FROM t_shift s
         WHERE s.employee_id = ?  
         AND s.status_ = 'scheduled'
         AND (
             s.date_ > CURDATE() 
             OR 
             (s.date_ = CURDATE() AND s.start_time > TIME(NOW()))
         )
         AND NOT EXISTS (
             SELECT 1 FROM t_leave l 
             WHERE l.employee_id = s.employee_id
             AND l.status_ = 'approved'
             AND s.date_ BETWEEN l.start_date AND l.end_date
         )
         AND NOT EXISTS (
             SELECT 1 FROM t_shift_cancellations sc 
             WHERE sc.shift_id = s.shift_id
         )
         ORDER BY s.date_ ASC, s.start_time ASC
         LIMIT 3`, [employeeId]
    );

     if(!rows || rows.length === 0){
        return res.status(404).json({message: 'No shifts found.'});
       }
     res.json(rows);

    }catch(err){
        console.error('Error fetching shifts:', err);
        return res.status(500).json({error:'Failure trying to fetch shifts.'});
    }
};

//Fetch employee status and last clock-in time.
exports.getEmployeeStatus = async (req, res) => {
    const { employeeId } = req.params;
    
    try {
        //Get employee status from t_employee table
        const [employeeRows] = await db.query(
            `SELECT 
                e.status_,
                e.first_name,
                e.last_name
             FROM t_employee e
             WHERE e.employee_id = ?`,
            [employeeId]
        );

        if (employeeRows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const employee = employeeRows[0];
        
        //Get the most recent clock-in time from t_attendance table
        const [attendanceRows] = await db.query(
            `SELECT 
                a.clock_in_time,
                a.clock_out_time,
                a.status_ as attendance_status,
                a.on_time
             FROM t_attendance a
             WHERE a.employee_id = ?
             ORDER BY a.clock_in_time DESC
             LIMIT 1`,
            [employeeId]
        );

        let lastClockIn = null;
        let attendanceStatus = null;
        let onTime = null;
        


        if (attendanceRows.length > 0) {
            const attendance = attendanceRows[0];
            lastClockIn = attendance.clock_in_time;
            attendanceStatus = attendance.status_;
            onTime = attendance.on_time;
        }

       const [attendanceStats] = await db.query(
            `SELECT 
                COUNT(*) as total_past_shifts,
                SUM(CASE WHEN s.status_ = 'completed' THEN 1 ELSE 0 END) as completed_shifts,
                SUM(CASE WHEN s.status_ = 'missed' THEN 1 ELSE 0 END) as missed_shifts
             FROM t_shift s
             WHERE s.employee_id = ?
             AND s.date_ < CURDATE()
             AND s.status_ IN ('completed', 'missed')`,
            [employeeId]
        );

        const stats = attendanceStats[0];
        let attendancePercentage = 0;

        //Get recent shift history (last 10 shifts)
        const [recentShifts] = await db.query(
            `SELECT COUNT(*) as recent_shifts_count
             FROM t_shift
             WHERE employee_id = ?
             AND date_ < CURDATE()
             ORDER BY date_ DESC
             LIMIT 10`,
            [employeeId]
        );
       if (recentShifts.length > 0) {
        attendancePercentage = Math.round((stats.completed_shifts / stats.total_past_shifts) * 100);
       }
        console.log('Attendance stats:', stats, 'Attendance Percentage:', attendancePercentage);
        //Construct response object
        res.json({
            status: employee.status_, //From t_employee table
            last_clock_in: lastClockIn, //From t_attendance table
            attendance_status: attendanceStatus, //From t_attendance table
            on_time: onTime,
            employee_name: `${employee.first_name} ${employee.last_name}`,
            attendance_metrics: {
                completed_shifts: stats.completed_shifts,
                missed_shifts: stats.missed_shifts,
                attendance_percentage: attendancePercentage,
                //Performance rating based on attendance
                performance_rating: attendancePercentage >= 70 ? 'Excellent' :
                                   attendancePercentage >= 60 ? 'Good' :
                                   attendancePercentage >= 50 ? 'Average' : 'Very poor, improvement needed.'
            }
        });

    } catch (err) {
        console.error('Error fetching employee status:', err);
        res.status(500).json({ error: 'Failed to fetch employee status' });
    }
};

//Fetch employee strike count from shift cancellations.
exports.getStrikeCount = async (req, res) => {
    const { employeeId } = req.params;
    if(!employeeId) return res.status(400).json({message: 'Employee Id not found.'});

    try {
        const [rows] = await db.query(
            `SELECT count(*) AS strike_count
             FROM t_shift_cancellations
             WHERE employee_id = ?`,
            [employeeId]
        );  
        const strikeCount = rows[0].strike_count || 0;
        res.json({ strike_count: strikeCount });
    } catch (err) {
        console.error('Error fetching strike count:', err);
        res.status(500).json({ error: 'Failed to fetch strike count' });
    }

};

//Handle shift cancellation requests with validations and notifications.
exports.cancelShift = async (req, res) => {
    
    const { employee_id, shift_id, date, reason, notes } = req.body;
    
    try {
        if (!employee_id || !shift_id || !date || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        //Check if shift exists and belongs to employee
        const [shiftRows] = await db.query(
            `SELECT s.*, e.first_name, e.last_name
             FROM t_shift s
             JOIN t_employee e ON s.employee_id = e.employee_id
             WHERE s.shift_id = ? AND s.employee_id = ? AND s.date_ = ?`,
            [shift_id, employee_id, date]
        );
        console.log(shiftRows);
        if (shiftRows.length === 0) {
            return res.status(404).json({ error: 'Shift not found or does not belong to employee' });
        }

        const shift = shiftRows[0];
        const shiftDateTime = new Date(`${shift.date_}T${shift.start_time}`);
        const now = new Date();
        
        //Check if within 3-hour cancellation window
        const timeDiff = shiftDateTime - now;
        const threeHoursInMs = 3 * 60 * 60 * 1000;
        
        if (timeDiff <= 0) {
            return res.status(400).json({ error: 'Shift has already started or completed' });
        }
        
        if (timeDiff < threeHoursInMs ) {
            return res.status(400).json({ error: 'Can only cancel shifts 3 hours before start time' });
        }

        //Check if already cancelled
        const [existingCancellation] = await db.query(
            `SELECT * FROM t_shift_cancellations WHERE shift_id = ?`,
            [shift_id]
        );

        if (existingCancellation.length > 0) {
            return res.status(400).json({ error: 'Shift cancellation already requested' });
        }

        //Count employee's previous cancellations
        const [cancellationCount] = await db.query(
            `SELECT count(*) AS total 
             FROM t_shift_cancellations 
             WHERE employee_id = ?`,
            [employee_id]
        );

        // if (cancellationCount[0].total >= 3) {
        //     return res.status(403).json({ error: 'Maximum cancellations reached (3). You cannot cancel more shifts.' });
        // }

        //Create cancellation request with incremented count
        const newCount = cancellationCount[0].total + 1;

        const [result] = await db.query(
            `INSERT INTO t_shift_cancellations 
             (shift_id, employee_id, requested_at, reason, notes, status_, count)
             VALUES (?, ?, NOW(), ?, ?, 'pending', ?)`,
            [shift_id, employee_id, reason, notes || '', newCount]
        );

        //Notify managers with reason included
        const [managerRows] = await db.query(
            `SELECT employee_id, first_name, last_name, email 
             FROM t_employee 
             WHERE type_ = 'manager' AND status_ != 'On Leave'`
        );

        if (managerRows.length > 0) {
            //Create detailed notification message with reason
            const reasonText = getReasonText(reason); //Helper function to format reason
            let notificationMessage = `${shift.first_name} ${shift.last_name} ` +
                                   `has cancelled their shift on ${shift.date_.toLocaleDateString('en-CA')} at ${shift.start_time}.\n` +
                                   `Reason: ${reasonText}.\n`;
            
            //Add notes if provided
            if (notes && notes.trim() !== '') {
                notificationMessage += `\nAdditional Notes: ${notes}`;
            }
            
            notificationMessage += `\nPlease verify and take necessary action.`;

                    const notificationValues = managerRows.map(manager => [
                        manager.employee_id,
                        notificationMessage,
                        new Date(),
                        'unread',
                        4
                    ]);

            console.log(notificationValues);
           try {
                console.log('Inserting notifications for managers:', notificationValues);
                await db.query(
                    `INSERT INTO t_notification 
                    (employee_id, message, sent_time, read_status, notification_type_id)
                    VALUES ?`,
                    [notificationValues]
                );
            } catch (notifErr) {
                console.error('Error inserting notifications:', notifErr);
            }
            
           for(const mgr of managerRows) {
                try {
                    console.log(`Notifying manager ${mgr.first_name} ${mgr.last_name} (${mgr.email})`);
                    await db.query(
                        `INSERT INTO t_message 
                        (sender_id, receiver_id, content, sent_time, read_status)
                        VALUES (?, ?, ?, NOW(), 'unread')`,
                        [employee_id, mgr.employee_id, notes || ''] 
                    );
                } catch (msgErr) {
                    console.error(`Error inserting message for manager ${mgr.employee_id}:`, msgErr);
                }
            }
        }

        res.status(200).json({ 
            message: `Shift cancellation successful. You have cancelled ${newCount} shift(s).`,
        });

    } catch (err) {
        console.error('Error cancelling shift:', err);
        res.status(500).json({ error: 'Failed to process shift cancellation' });
    }
};

//Helper function to format reason text
function getReasonText(reasonCode) {
    const reasonMap = {
        'sick': 'Sick',
        'emergency': 'Emergency',
        'personal': 'Personal Reasons',
        'transport': 'Transport Issues',
        'other': 'Other'
    };
    return reasonMap[reasonCode] || reasonCode;
}