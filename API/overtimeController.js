//AUTHOR - SHAYZAAD

const QRCode = require('qrcode');
const cron = require('node-cron');
const pool = require('./db');
const { v4: uuidv4 } = require('uuid');

//Run every second to check expirations
cron.schedule('* * * * * *', async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    //Expire overtime QR codes after 15 minute
    await connection.query(`
      UPDATE t_qr_code 
      SET status_ = 'expired'
      WHERE status_ = 'active'
      AND purpose = 'overtime'
      AND expiration_time < NOW()
    `);

    //Expire proof QR codes after 15 minutes
    const [proof] = await connection.query(`
      UPDATE t_qr_code 
      SET status_ = 'expired'
      WHERE status_ = 'active'
      AND purpose = 'attendance'
      AND expiration_time < NOW()
    `);

    //Check if the proofQR expired
    const proofExpired = proof.affectedRows > 0;

    //Auto complete overtime sessions after their duration
    const [expiredSessions] = await connection.query(
      `SELECT overtime_id FROM t_overtime 
       WHERE _status = 'on-going' AND end_time < NOW()`
    );

    for (const session of expiredSessions) {
      //Generate proof QR for auto completed sessions
      const proofData = `OVERTIME-ATTENDANCE-${uuidv4()}`;
      const proofExpiration = new Date(Date.now() + 0.3 * 60 * 1000); //15 minutes expiry (1 min test)

      //Inserting the proof QR code for overtime attendance 
      await connection.query(
        `INSERT INTO t_qr_code 
         (code_value, generation_time, expiration_time, purpose, status_) 
         VALUES (?, NOW(), ?, 'attendance', 'active')`,
        [proofData, proofExpiration]
      );

      //Mark session as completed in t_overtime
      await connection.query(
        `UPDATE t_overtime SET _status = 'completed' 
         WHERE overtime_id = ?`,
        [session.overtime_id]
      );
    }

    //Check if any rows were affected
    if(proofExpired){
      const [scheduledShifts] = await connection.query(
        `SELECT s.shift_id, s.employee_id, s.date_, e.first_name, e.last_name  
        FROM t_shift s
        JOIN t_employee e ON s.employee_id = e.employee_id
        WHERE s.status_ = 'scheduled' AND s.shift_type = 'overtime'`
      );

      //Process each scheduled shift
      for (const shift of scheduledShifts) {
        //Check if this employee_id and shift_id combination exists in attendance table
        let [attendanceRecord] = await connection.query(
          `SELECT status_ FROM t_attendance 
          WHERE employee_id = ? AND shift_id = ?`,
          [shift.employee_id, shift.shift_id]
        );

        let newShiftStatus;
        
        if (attendanceRecord.length === 0) {
          //Case 1: No attendance record found - mark as missed
          newShiftStatus = 'missed';
        } else {
          //Case 2: Attendance record exists - check its status
          const attendanceStatus = attendanceRecord[0].status_;
          if (attendanceStatus === 'present') {
            newShiftStatus = 'completed';
          } else if (attendanceStatus === 'absent'){
            newShiftStatus = 'missed';
          }
        }

        //Update the shift status
        await connection.query(
          `UPDATE t_shift 
          SET status_ = ? 
          WHERE shift_id = ? AND employee_id = ?`,
          [newShiftStatus, shift.shift_id, shift.employee_id]
        );

        //Send notification to manager if an employee missed a shift
        if(newShiftStatus === "missed"){
          const formattedDate = new Date(shift.date_).toLocaleDateString('en-ZA');
          await connection.query(
          `INSERT INTO t_notification 
          (employee_id, message, sent_time, notification_type_id)
          SELECT 
            e.employee_id,
            ?,
            NOW(),
            ?
          FROM t_employee e
          WHERE e.type_ = 'manager'`, 
          [`${shift.first_name} ${shift.last_name} has missed an overtime shift on ${formattedDate}`, 4]
        );
        }
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Cron job failed:', error);
  } finally {
    connection.release();
  }
});

//Generate overtime QR code
exports.generateQR = async (req, res) => {
  try {
    const { roles, duration } = req.body;

    //Validate input from manager
    if (!roles || !Array.isArray(roles) || roles.length === 0 || 
        !duration || duration < 60 || duration > 180) {
      return res.status(400).json({ 
        error: 'Invalid parameters. Roles must be an array and duration must be between 60-180 minutes.' 
      });
    }

    //Generate unique QR code data
    const qrData = uuidv4();
    
    //Set QR code expiration to 15 minutes (Testing purpose 1 minute)
    const qrExpiration = new Date(Date.now() + 0.3 * 60 * 1000);
    
    //Set overtime session expiration to manager specified duration
    const overtimeExpiration = new Date(Date.now() + duration * 60 * 1000);

    //Generate QR image
    const qrImage = await QRCode.toDataURL(qrData);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      //Save QR code (expires in 15 minutes) (1 min test)
      const [qrResult] = await connection.query(
        `INSERT INTO t_qr_code 
        (code_value, generation_time, expiration_time, purpose, status_) 
        VALUES (?, NOW(), ?, 'overtime', 'active')`,
        [qrData, qrExpiration]
      );

      //Save overtime session (expires after manager specified duration)
      const [overtimeResult] = await connection.query(
        `INSERT INTO t_overtime 
        (_date, start_time, end_time, _status, employee_id, qr_code_id) 
        VALUES (CURDATE(), CURTIME(), ?, 'on-going', NULL, ?)`,
        [overtimeExpiration, qrResult.insertId]
      );

      //Save the roles that can claim this overtime (CLETUS CAN USE)
      if (roles && roles.length > 0) {
        const roleValues = roles.map(roleId => [overtimeResult.insertId, roleId]);
        await connection.query(
          `INSERT INTO t_overtime_roles (overtime_id, role_id) VALUES ?`,
          [roleValues]
        );
      }

      //Get all employees with the selected roles
      const [employees] = await connection.query(
        `SELECT employee_id, role_id FROM t_employee 
         WHERE role_id IN (${roles.map(() => '?').join(',')}) AND status_ != 'On Leave'`,
        roles
      );

      //GET RID 
      //ensures that there's a daily schedule to which overtime shifts can be attached
      //Get or create a schedule for today
      const today = new Date();
      const scheduleStartDate = new Date(today);
      scheduleStartDate.setHours(0, 0, 0, 0); //Start of today 
      const scheduleEndDate = new Date(today);
      scheduleEndDate.setHours(23, 59, 59, 999); //End of today

      //Check if a schedule exists for today
      let [scheduleResults] = await connection.query(
        `SELECT schedule_id FROM t_schedule 
         WHERE DATE(period_start_date) = CURDATE()`,
        []
      );

      let scheduleId;
      if (scheduleResults.length === 0) {
        //Create a new schedule for today
        const [newSchedule] = await connection.query(
          `INSERT INTO t_schedule (period_start_date, period_end_date) 
           VALUES (?, ?)`,
          [scheduleStartDate, scheduleEndDate]
        );
        scheduleId = newSchedule.insertId;
      } else {
        scheduleId = scheduleResults[0].schedule_id;
      }

      //Create shifts for all employees with selected roles
      const currentTime = new Date();
      const shiftStartTime = currentTime.toTimeString().slice(0, 8);
      const shiftEndTime = overtimeExpiration.toTimeString().slice(0, 8);
      const shiftDate = today.toISOString().slice(0, 10);

      const createdShifts = [];
      
      for (const employee of employees) {
        try {
          const [shiftResult] = await connection.query(
            `INSERT INTO t_shift 
             (shift_type, start_time, end_time, date_, end_date, status_, employee_id, schedule_id) 
             VALUES ('overtime', ?, ?, ?, ?, 'scheduled', ?, ?)`,
            [shiftStartTime, shiftEndTime, shiftDate, shiftDate, employee.employee_id, scheduleId]
          );

          createdShifts.push({
            shiftId: shiftResult.insertId,
            employeeId: employee.employee_id,
            roleId: employee.role_id
          });
        } catch (shiftError) {
          console.error(`Failed to create shift for employee ${employee.employee_id}:`, shiftError.message);
        }
      }

      await connection.commit();

      res.json({
        qrImage,
        qrId: qrResult.insertId,
        overtimeId: overtimeResult.insertId,
        expiration: overtimeExpiration.toISOString(),
        qrExpiration: qrExpiration.toISOString(), 
        allowedRoles: roles,
        scheduleId: scheduleId,
        createdShifts: createdShifts,
        message: `Successfully created ${createdShifts.length} overtime shifts for employees with selected roles`
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

//Extend overtime duration
exports.extendOvertime = async (req, res) => {
  try {
    const { overtimeId, additionalMinutes } = req.body;

    //Validate input
    if (!overtimeId || !additionalMinutes || additionalMinutes > 60) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      //Get current overtime details
      const [overtimes] = await connection.query(
        `SELECT o.*
        FROM t_overtime o
        WHERE o.overtime_id = ? AND o._status = 'on-going'`,
        [overtimeId]
      );

      if (overtimes.length === 0) {
        return res.status(404).json({ error: 'Overtime session not found or already completed' });
      }

      const overtime = overtimes[0];

      //Update overtime end_time using SQL time arithmetic
      await connection.query(
        `UPDATE t_overtime 
        SET end_time = ADDTIME(end_time, SEC_TO_TIME(? * 60))
        WHERE overtime_id = ?`,
        [additionalMinutes, overtimeId]
      );

      //Get the updated end_time
      const [updatedOvertime] = await connection.query(
        `SELECT end_time 
        FROM t_overtime 
        WHERE overtime_id = ?`,
        [overtimeId]
      );

      const newExpiration = updatedOvertime[0].end_time;

      //Update all related shifts end time using the same SQL time arithmetic
      await connection.query(
        `UPDATE t_shift s
         JOIN t_overtime_roles or_r ON or_r.overtime_id = ?
         JOIN t_employee e ON e.role_id = or_r.role_id
         SET s.end_time = ADDTIME(s.end_time, SEC_TO_TIME(? * 60))
         WHERE s.employee_id = e.employee_id 
         AND s.date_ = CURDATE() 
         AND s.shift_type = 'overtime'
         AND s.status_ = 'scheduled'`,
        [overtimeId, additionalMinutes]
      );

      await connection.commit();

      //Create a Date object with today's date and the time
      const today = new Date();
      const timeString = newExpiration.toString();
      const [hours, minutes, seconds] = timeString.split(':');
      const responseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds);

      res.json({
        success: true,
        newExpiration: responseDate.toISOString(),
        additionalMinutes,
        message: 'Overtime and related shifts extended successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Extension error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

//End overtime session
exports.endOvertime = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { overtimeId } = req.body;

    //Validate overtime session
    const [overtime] = await connection.query(
      `SELECT o.*, q.qr_id FROM t_overtime o
       JOIN t_qr_code q ON o.qr_code_id = q.qr_id
       WHERE o.overtime_id = ? AND o._status = 'on-going'`,
      [overtimeId]
    );
    
    if (!overtime.length) {
      return res.status(404).json({ error: 'Overtime session not found or already completed' });
    }

    //Generate proof QR code
    const proofData = `OVERTIME-ATTENDANCE-${uuidv4()}`;
    const proofImage = await QRCode.toDataURL(proofData);
    const proofExpiration = new Date(Date.now() + 0.3 * 60 * 1000); // 1 minute for testing

    //Save proof QR to database
    const [qrResult] = await connection.query(
      `INSERT INTO t_qr_code 
       (code_value, generation_time, expiration_time, purpose, status_) 
       VALUES (?, NOW(), ?, 'attendance', 'active')`,
      [proofData, proofExpiration]
    );

    //Mark overtime as completed
    await connection.query(
      `UPDATE t_overtime SET _status = 'completed' WHERE overtime_id = ?`,
      [overtimeId]
    );

    //Mark original QR code as expired using the correct qr_id
    await connection.query(
      `UPDATE t_qr_code SET status_ = 'expired' WHERE qr_id = ?`,
      [overtime[0].qr_id]
    );

    await connection.commit();

    res.json({
      success: true,
      proofImage,
      proofQRId: qrResult.insertId,
      proofExpiration: proofExpiration.toISOString(),
      message: 'Overtime session ended. Proof QR generated.'
    });

  } catch (error) {
    await connection.rollback();
    console.error('End overtime error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
};

//Check overtime session status
exports.getSessionStatus = async (req, res) => {
  try {
    const { overtimeId } = req.params;

    if (!overtimeId) {
      return res.status(400).json({ error: 'Overtime ID is required' });
    }

    const connection = await pool.getConnection();
    try {
      //Get overtime session details
      const [overtimeResults] = await connection.query(
        `SELECT o.*, q.status_ as qr_status, q.expiration_time
         FROM t_overtime o
         JOIN t_qr_code q ON o.qr_code_id = q.qr_id
         WHERE o.overtime_id = ?`,
        [overtimeId]
      );

      if (overtimeResults.length === 0) {
        return res.status(404).json({ error: 'Overtime session not found' });
      }

      const overtime = overtimeResults[0];
      let proofImage = null;
      let proofQRId = null;
      let proofExpiration = null;

      //If session is completed, check for proof QR
      if (overtime._status === 'completed') {
        const [proofResults] = await connection.query(
          `SELECT q.*, o.overtime_id
           FROM t_qr_code q
           LEFT JOIN t_overtime o ON q.qr_id = o.qr_code_id
           WHERE q.purpose = 'attendance' 
           AND q.status_ = 'active'
           AND DATE(q.generation_time) = CURDATE()
           AND (o.overtime_id = ? OR o.overtime_id IS NULL)
           ORDER BY q.generation_time DESC
           LIMIT 1`,
          [overtimeId]
        );

        if (proofResults.length > 0) {
          //Generate QR image for the proof code
          const QRCode = require('qrcode');
          proofImage = await QRCode.toDataURL(proofResults[0].code_value);
          proofQRId = proofResults[0].qr_id;
          proofExpiration = proofResults[0].expiration_time;
        }
      }

      res.json({
        overtimeId: overtime.overtime_id,
        status: overtime._status,
        qrStatus: overtime.qr_status,
        expiration: overtime.expiration_time,
        proofImage: proofImage,
        proofQRId: proofQRId,
        proofExpiration: proofExpiration
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get session status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

//Check proof QR status
exports.getProofStatus = async (req, res) => {
  try {
    const { proofQRId } = req.params;

    if (!proofQRId) {
      return res.status(400).json({ error: 'Proof QR ID is required' });
    }

    const connection = await pool.getConnection();
    try {
      //Get proof QR details
      const [proofResults] = await connection.query(
        `SELECT qr_id, status_, expiration_time, purpose
         FROM t_qr_code
         WHERE qr_id = ? AND purpose = 'attendance'`,
        [proofQRId]
      );

      if (proofResults.length === 0) {
        return res.status(404).json({ error: 'Proof QR not found' });
      }

      const proofQR = proofResults[0];

      res.json({
        proofQRId: proofQR.qr_id,
        status: proofQR.status_,
        expiration: proofQR.expiration_time
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get proof status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};