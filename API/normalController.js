//AUTHOR - SHAYZAAD

const QRCode = require('qrcode');
const cron = require('node-cron');
const pool = require('./db');
const { v4: uuidv4 } = require('uuid');

//Cron job to generate normal QR codes at shift start times
cron.schedule('* * * * * *', async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get shifts that should start now
    const [dateTime] = await connection.query(
        `SELECT shift_id, date_, start_time, employee_id
        FROM t_shift 
        WHERE status_ = 'scheduled' 
        AND shift_type = 'normal' 
        AND date_ = CURDATE()
        ORDER BY start_time` 
    );

    //If shifts are found...
    if(dateTime.length > 0){
        const now = new Date();
        const formattedDate = now.toLocaleDateString('en-ZA', 
        {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }); //Get todays date in format YYYY/MM/DD

        //Generate the time now
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}:${seconds}`;

        //Check each shift to see if it should start now
        for(const shift of dateTime) {
            //Get the start date of each shift from the db
            const dbDate = new Date(shift.date_).toLocaleDateString('en-ZA'); 

            //Get the start time of each shift from the db
            const shiftStartTime = shift.start_time;

            //If the today's day and time matches any of the shifts in the db...
            if(formattedDate === dbDate && formattedTime === shiftStartTime){

                //Check if QR already exists for this purpose and time
                const [existingQR] = await connection.query(
                    `SELECT qr_id FROM t_qr_code 
                     WHERE purpose = 'clock-in' 
                     AND status_ = 'active'
                     AND DATE(generation_time) = CURDATE()
                     AND TIME(generation_time) = ?`,
                    [formattedTime]
                );

                //No QR's exist for this purpose and time... Create one
                if(existingQR.length === 0) {

                    //Generate new QR code
                    const qrData = `NORMAL-SHIFT-${uuidv4()}`;
                    const expiration = new Date();
                    expiration.setMinutes(expiration.getMinutes() + 1); //15 minutes to clock in (1 min test)

                    //Place generation time in db for qr code
                    const generationDateTime = `${formattedDate} ${formattedTime}`; 

                    //Insert QR code into database
                    await connection.query(
                        `INSERT INTO t_qr_code 
                        (code_value, generation_time, expiration_time, purpose, ip_address, status_, generated_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [qrData, generationDateTime, expiration, 'clock-in', null, 'active', null] 
                    );

                   // console.log(`Generated clock-in QR code: ${qrData} for shift starting at ${formattedTime}`);
                }
            }
        }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Normal QR generation error:', error);
  } finally {
    connection.release();
  }
});

//Cron job to generate proof QR codes at shift end times
cron.schedule('* * * * * *', async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8); //HH:MM:SS format
    const currentDate = now.toLocaleDateString('en-ZA', 
    {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }); //Get todays date in format YYYY/MM/DD
    
    //Find shifts that are ending now
    const [endingShifts] = await connection.query(
      `SELECT shift_id, employee_id, end_time 
       FROM t_shift 
       WHERE status_ = 'scheduled'
       AND shift_type = 'normal'
       AND date_ = ?
       AND end_time = ?`,
      [currentDate, currentTime]
    ); 
    
    //Only generate ONE proof QR if there are shifts ending now and no active proof QR exists
    if (endingShifts.length > 0) {
      //Check if there's already an active proof QR for today
      const [existingProof] = await connection.query(
        `SELECT qr_id FROM t_qr_code 
         WHERE purpose = 'attendanceNormal' 
         AND status_ = 'active'
         AND DATE(generation_time) = CURDATE()
         AND expiration_time > NOW()`
      );

      //No proof QR code exists in the db for today (GOOD)
      if(existingProof.length === 0) {

        //Generate a single proof QR that all employees can use
        const proofData = `SHIFT-PROOF-${currentDate}-${uuidv4()}`;
        const proofExpiration = new Date(Date.now() + 1 * 60 * 1000); //1 min for testing (change to 15 mins)
        
        //Save proof QR 
        await connection.query(
          `INSERT INTO t_qr_code 
           (code_value, generation_time, expiration_time, purpose, status_, generated_by) 
           VALUES (?, NOW(), ?, 'attendanceNormal', 'active', ?)`,
          [proofData, proofExpiration, null]
        );
        
        //console.log(`Generated shared proof QR for ${endingShifts.length} shifts ending at ${currentTime}`);
      }
    }
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Proof QR generation error:', error);
  } finally {
    connection.release();
  }
});

//Cron job to expire QR codes that have passed their expiration time
cron.schedule('* * * * * *', async () => {  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    //Get expired clock-in QR codes before updating them
    const [expiredClockInQRs] = await connection.query(
      `SELECT qr_id, code_value, generation_time FROM t_qr_code 
       WHERE status_ = 'active' 
       AND expiration_time < NOW() 
       AND purpose = 'clock-in'`
    );

    //Update expired normal (clock-in) QR codes 
    await connection.query(
      `UPDATE t_qr_code 
       SET status_ = 'expired' 
       WHERE status_ = 'active' 
       AND expiration_time < NOW() 
       AND purpose = 'clock-in'`
    );

    //NEW LOGIC: Check attendance for expired clock-in QRs
    for (const qr of expiredClockInQRs) {
      const qrGenerationTime = new Date(qr.generation_time);
      const qrGenerationDate = qrGenerationTime.toLocaleDateString('en-ZA', 
      { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
      
      const currentDate = new Date().toLocaleDateString('en-ZA', 
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      //Only process QRs that were generated today
      if (qrGenerationDate === currentDate) {
        //Get the start time from the QR generation time
        const startTime = qrGenerationTime.toTimeString().slice(0, 8);

        //Find all shifts that started at this time today
        const [shiftsAtThisTime] = await connection.query(
          `SELECT s.shift_id, s.employee_id, s.start_time, s.end_time, s.date_, s.end_date, 
                  s.shift_type, s.schedule_id, e.first_name, e.last_name, e.role_id, r.title as role_title
          FROM t_shift s
          JOIN t_employee e ON s.employee_id = e.employee_id
          JOIN t_role r ON e.role_id = r.role_id
          WHERE s.status_ = 'scheduled' 
          AND s.shift_type = 'normal'
          AND s.date_ = ?
          AND s.is_replacement = FALSE
          AND s.start_time = ?`,
          [currentDate, startTime]
        );

        //Check each shift to see if employee clocked in
        for (const shift of shiftsAtThisTime) {
          //Check if this employee has an attendance record for this shift
          const [attendanceRecord] = await connection.query(
            `SELECT attendance_id FROM t_attendance 
            WHERE employee_id = ? AND shift_id = ?`,
            [shift.employee_id, shift.shift_id]
          );

          //If no attendance record exists, mark shift as missed and find replacement
          if (attendanceRecord.length === 0) {
            //Mark shift as missed
            await connection.query(
              `UPDATE t_shift 
              SET status_ = 'missed'
              WHERE shift_id = ?`,
              [shift.shift_id]
            );

            //Get all managers for notifications
            const [managers] = await connection.query(
              `SELECT 
                  employee_id,
                  first_name,
                  last_name,
                  email,
                  phone_number,
                  status_,
                  role_id
              FROM t_employee 
              WHERE type_ = 'manager'`
            );

            //Send initial notification about missed clock-in
            const formattedDate = new Date().toLocaleDateString('en-ZA');
            for (const manager of managers) {
              await connection.query(
                `INSERT INTO t_notification 
                (employee_id, message, sent_time, notification_type_id)
                VALUES (?, ?, NOW(), ?)`, 
                [manager.employee_id, `${shift.first_name} ${shift.last_name}: Failed to clock in for their shift starting at ${startTime} on ${formattedDate} with no reason. Consider taking disciplinary action`, 4]
              );
            }

            console.log(`Marked shift ${shift.shift_id} as missed - employee ${shift.employee_id} did not clock in`);

            //REPLACEMENT LOGIC: Find standby employee with same role
            console.log(`Finding replacement for missed ${shift.role_title} shift`);

            //Find all available standby employees with same role
            const [standbyEmployees] = await connection.query(`
              SELECT 
                  employee_id,
                  first_name,
                  last_name,
                  email,
                  phone_number
              FROM t_employee 
              WHERE role_id = ? 
              AND standby = 'standby' 
              AND status_ = 'Not Working'
              AND employee_id != ?
              ORDER BY employee_id
            `, [shift.role_id, shift.employee_id]);

            if (standbyEmployees.length === 0) {
              console.log(`No available standby employee found for role: ${shift.role_title}`);
              
              //Send notification to manager about no standby available
              for (const manager of managers) {
                await connection.query(
                  `INSERT INTO t_notification (
                      employee_id,
                      message,
                      sent_time,
                      read_status,
                      notification_type_id
                  ) VALUES (?, ?, NOW(), 'unread', 4)`,
                  [manager.employee_id, `Shift Replacement Failed: No standby employee available for missed ${shift.role_title} shift on ${formattedDate} at ${startTime}. Contingency plan required`]
                );
              }
              continue; //Move to next shift
            }

            //Try each standby employee until we find one without conflicts
            let replacementEmployee = null;
            let employeeFound = false;

            for (const employee of standbyEmployees) {
              console.log(`Checking replacement candidate: ${employee.first_name} ${employee.last_name}`);

              //Check if this employee already has a shift at the same time
              const [conflictingShifts] = await connection.query(`
                  SELECT shift_id 
                  FROM t_shift 
                  WHERE employee_id = ? 
                  AND date_ = ? 
                  AND (
                      (start_time <= ? AND end_time > ?) OR
                      (start_time < ? AND end_time >= ?) OR
                      (start_time >= ? AND end_time <= ?)
                  )
                  AND status_ IN ('scheduled', 'completed')
              `, [
                  employee.employee_id,
                  shift.date_,
                  shift.start_time, shift.start_time,
                  shift.end_time, shift.end_time,
                  shift.start_time, shift.end_time
              ]);

              if (conflictingShifts.length === 0) {
                  replacementEmployee = employee;
                  employeeFound = true;
                  console.log(`Found available replacement: ${employee.first_name} ${employee.last_name}`);
                  break;
              } else {
                  console.log(`${employee.first_name} ${employee.last_name} has conflicting shift, trying next candidate...`);
              }
            }

            if (!employeeFound) {
              console.log(`All standby employees for role ${shift.role_title} have conflicting shifts`);
              
              //Send notification to manager about all employees having conflicts
              for (const manager of managers) {
                await connection.query(
                  `INSERT INTO t_notification (
                      employee_id,
                      message,
                      sent_time,
                      read_status,
                      notification_type_id
                  ) VALUES (?, ?, NOW(), 'unread', 4)`,
                  [manager.employee_id, `Shift Replacement Failed: All standby ${shift.role_title} employees have conflicting shifts for missed shift on ${formattedDate} at ${startTime}. Contingency plan required`]
                );
              }
              continue; //Move to next shift
            }

            //Create new shift for replacement employee
            const [newShiftResult] = await connection.query(`
                INSERT INTO t_shift (
                    shift_type,
                    start_time,
                    end_time,
                    date_,
                    end_date,
                    status_,
                    employee_id,
                    schedule_id,
                    created_at,
                    updated_at,
                    is_replacement
                ) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, NOW(), NOW(), TRUE)
            `, [
                shift.shift_type,
                shift.start_time,
                shift.end_time,
                shift.date_,
                shift.end_date,
                replacementEmployee.employee_id,
                shift.schedule_id
            ]);

            const newShiftId = newShiftResult.insertId;
            console.log(`Created new shift ${newShiftId} for replacement employee`);

            //Send notification to replacement employee
            const replacementNotificationMessage = `You have been assigned a replacement shift for ${shift.role_title} on ${formattedDate} from ${shift.start_time} to ${shift.end_time} due to a missed clock-in. Be there within the hour, see you soon!`;
            
            await connection.query(`
                INSERT INTO t_notification (
                    employee_id,
                    message,
                    sent_time,
                    read_status,
                    notification_type_id
                ) VALUES (?, ?, NOW(), 'unread', 3)
            `, [replacementEmployee.employee_id, replacementNotificationMessage]);

            //Send confirmation notification to managers
            for (const manager of managers) {
              await connection.query(
                `INSERT INTO t_notification (
                    employee_id,
                    message,
                    sent_time,
                    read_status,
                    notification_type_id
                ) VALUES (?, ?, NOW(), 'unread', 4)`,
                [manager.employee_id, `${replacementEmployee.first_name} ${replacementEmployee.last_name}: Is filling in for a missed shift by ${shift.first_name} ${shift.last_name} (${shift.role_title}) on ${formattedDate} at ${shift.start_time}`]
              );
            }

            //EXTEND QR CODE EXPIRY: Give replacement employee time to get to work
            //Calculate new expiry time (60 minutes from now)
            const extendedExpiryTime = new Date();
            extendedExpiryTime.setMinutes(extendedExpiryTime.getMinutes() + 10); //WAS 180, NOW JUST 10 MINUTE (TESTING)

            const shiftDateObj = new Date(shift.date_);
            //Add 2 hours to convert from UTC to SA time
            shiftDateObj.setHours(shiftDateObj.getHours() + 2);
            const shiftDate = shiftDateObj.toISOString().split('T')[0];

            //Update the QR code expiry time for this shift's start time
            await connection.query(`
                UPDATE t_qr_code 
                SET expiration_time = ?, 
                    status_ = 'active'
                WHERE purpose = 'clock-in' 
                AND DATE(generation_time) = ? 
                AND TIME(generation_time) = ?
            `, [
                extendedExpiryTime.toISOString().slice(0, 19).replace('T', ' '),
                shiftDate,
                shift.start_time
            ]);
            // console.log("DATE: " + shiftDate);
            // console.log("TIME: " + shift.start_time);
            // console.log(`Extended QR code expiry time by 60 minutes for replacement employee`);

            //Send additional notification to replacement employee about the extended time
            //const urgentNotificationMessage = `URGENT: You have been assigned an immediate replacement shift for ${shift.role_title}. Please arrive as soon as possible. QR code has been extended for 30 minutes to allow travel time.`;
            
            // await connection.query(`
            //     INSERT INTO t_notification (
            //         employee_id,
            //         message,
            //         sent_time,
            //         read_status,
            //         notification_type_id
            //     ) VALUES (?, ?, NOW(), 'unread', 3)
            // `, [replacementEmployee.employee_id, urgentNotificationMessage]);


           // console.log(`Successfully assigned replacement employee ${replacementEmployee.first_name} ${replacementEmployee.last_name} for missed shift ${shift.shift_id}`);
          }
        }
      }
    }

    //Get all proof QR codes that have expired (MAY CLASH WITH OVERTIME LOGIC)
    const [expiredProofQRs] = await connection.query(
      `SELECT code_value, generation_time FROM t_qr_code 
       WHERE status_ = 'active' 
       AND expiration_time < NOW() 
       AND purpose = 'attendanceNormal'`
    );

    //Expire the proof QR codes (MAY CLASH WITH OVERTIME LOGIC)
    await connection.query(
      `UPDATE t_qr_code 
       SET status_ = 'expired' 
       WHERE status_ = 'active' 
       AND expiration_time < NOW() 
       AND purpose = 'attendanceNormal'`
    );

    //Update shift status for shifts whose proof QRs have expired
    for (const qr of expiredProofQRs) {
    const qrGenerationDate = new Date(qr.generation_time).toLocaleDateString('en-ZA', 
    { year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).replace(/-/g, '/'); 
    
    const currentDate = new Date().toLocaleDateString('en-ZA', 
    {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }); //Get todays date in format YYYY/MM/DD
      
      //Only process QRs that were generated today
      if (qrGenerationDate === currentDate) {

        //Find all shifts that ended today and should be affected by this proof QR expiration
         const [affectedShifts] = await connection.query(
          `SELECT s.shift_id, s.employee_id, s.end_time, s.end_date, e.first_name, e.last_name
          FROM t_shift s
          JOIN t_employee e ON s.employee_id = e.employee_id
          WHERE s.status_ = 'scheduled' 
          AND s.shift_type = 'normal'
          AND s.end_date = ?`,
          [currentDate]
        );

        //console.log(`Processing ${affectedShifts.length} shifts for expired proof QR`);
        
        for (const shift of affectedShifts) {
          //Check if this employee_id and shift_id combination exists in attendance table
          let [attendanceRecord] = await connection.query(
            `SELECT status_ FROM t_attendance 
             WHERE employee_id = ? AND shift_id = ?`,
            [shift.employee_id, shift.shift_id]
          );

          let newShiftStatus;
          
          if (attendanceRecord.length === 0) {
            //Case 1: No attendance record found - mark as missed (REDUNDANT)
            newShiftStatus = 'missed';
          } else {
            //Case 2: Attendance record exists - check its status
            const attendanceStatus = attendanceRecord[0].status_;
            if (attendanceStatus === 'present') {
              newShiftStatus = 'completed';
            } else if (attendanceStatus === 'absent' || attendanceStatus === null){
              newShiftStatus = 'missed';
            }
          }
          
          //Update the shift status
          if (newShiftStatus) {
            await connection.query(
              `UPDATE t_shift 
               SET status_ = ?
               WHERE shift_id = ?`,
              [newShiftStatus, shift.shift_id]
            );
            
            //console.log(`Updated shift ${shift.shift_id} status to '${newShiftStatus}' after proof QR expired`);
          }

          //Send notification to manager of missed shift
          if (newShiftStatus === "missed") {
            const formattedDate = new Date(shift.end_date).toLocaleDateString('en-ZA');
            await connection.query(
              `INSERT INTO t_notification 
               (employee_id, message, sent_time, notification_type_id)
               VALUES (?, ?,NOW(), ?)`, 
              [shift.employee_id, `${shift.first_name} ${shift.last_name}: Has missed a normal shift on ${formattedDate}, failed to scan proof QR code. Consider taking disciplinary action`, 4]
            );
          }
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('QR expiration update error:', error);
  } finally {
    connection.release();
  }
});

//Get current normal QR (Clock-in QR)
exports.getCurrentNormalQR = async (req, res) => {
  try {
    //Find the QR code for today
    const [qrCodes] = await pool.query(
      `SELECT qr_id, code_value, expiration_time FROM t_qr_code 
       WHERE purpose = 'clock-in' 
       AND status_ = 'active'
       AND expiration_time > NOW()
       AND DATE(generation_time) = CURDATE()
       ORDER BY generation_time DESC 
       LIMIT 1`
    );
    
    //No QR code found
    if (qrCodes.length === 0) {
      return res.json({ normalQR: null });
    }

    //Convert the qr code to image format
    const qrImage = await QRCode.toDataURL(qrCodes[0].code_value);
    res.json({
      normalQR: {
        image: qrImage,
        expiration: qrCodes[0].expiration_time,
        qrId: qrCodes[0].qr_id
      }
    });
  } catch (error) {
    console.error('Get normal QR error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

//Get proof QR for all employees to scan
exports.getProofQR = async (req, res) => {
  try {
    //Get the active proof QR for today for all employees
    const [qrCodes] = await pool.query(
      `SELECT qr_id, code_value, expiration_time 
       FROM t_qr_code 
       WHERE purpose = 'attendanceNormal' 
       AND status_ = 'active'
       AND expiration_time > NOW()
       AND DATE(generation_time) = CURDATE()
       ORDER BY generation_time DESC 
       LIMIT 1`
    );
    
    //No proof QR code found in db
    if (qrCodes.length === 0) {
      return res.json({ proofQR: null });
    }
    
    //Convert the qr code to image format
    const qrImage = await QRCode.toDataURL(qrCodes[0].code_value);
    res.json({
      proofQR: {
        image: qrImage,
        expiration: qrCodes[0].expiration_time,
        qrId: qrCodes[0].qr_id
      }
    });
  } catch (error) {
    console.error('Get proof QR error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

//Additional cron job to check if replacement employees showed up
//Run every minute to check for replacement employee no-shows
//Cron job to monitor replacement employees after QR codes expire
cron.schedule('* * * * *', async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    //Find QR codes that just expired (within the last minute) that were extended for replacements
    const [expiredQRs] = await connection.query(`
      SELECT 
        qr.qr_id,
        qr.code_value,
        qr.generation_time,
        qr.expiration_time,
        DATE(qr.generation_time) as qr_date,
        TIME(qr.generation_time) as qr_time
      FROM t_qr_code qr
      WHERE qr.purpose = 'clock-in' 
      AND qr.status_ = 'expired'
      AND qr.expiration_time <= NOW()
      AND qr.expiration_time >= DATE_SUB(NOW(), INTERVAL 30 SECOND)
      AND DATE(qr.generation_time) = CURDATE()
    `);
    //console.log(expiredQRs);
    for (const qr of expiredQRs) {
      //Find replacement shifts that should have used this QR code
      const [replacementShifts] = await connection.query(`
        SELECT 
          s.shift_id,
          s.employee_id,
          s.start_time,
          s.date_,
          e.first_name,
          e.last_name,
          r.title as role_title
        FROM t_shift s
        JOIN t_employee e ON s.employee_id = e.employee_id
        JOIN t_role r ON e.role_id = r.role_id
        WHERE s.is_replacement = TRUE
        AND s.status_ = 'scheduled'
        AND s.date_ = ?
        AND s.start_time = ?
      `, [qr.qr_date, qr.qr_time]);

      for (const shift of replacementShifts) {
        //Check if replacement employee clocked in
        const [attendanceRecord] = await connection.query(
          `SELECT attendance_id FROM t_attendance 
           WHERE employee_id = ? AND shift_id = ?`,
          [shift.employee_id, shift.shift_id]
        );

        //If replacement employee didn't clock in, send notification to managers
        if (attendanceRecord.length === 0) {
          //Mark the replacement shift as missed
          await connection.query(
            `UPDATE t_shift 
             SET status_ = 'missed'
             WHERE shift_id = ?`,
            [shift.shift_id]
          );

          //Get all managers for notifications
          const [managers] = await connection.query(
            `SELECT employee_id FROM t_employee WHERE type_ = 'manager'`
          );

          const currentDate = new Date().toLocaleDateString('en-ZA');

          //Send notification to managers about replacement employee not showing up
          for (const manager of managers) {
            await connection.query(
              `INSERT INTO t_notification 
               (employee_id, message, sent_time, notification_type_id)
               VALUES (?, ?, NOW(), ?)`, 
              [
                manager.employee_id, 
                `${shift.first_name} ${shift.last_name}: Replacement employee failed to clock in for ${shift.role_title} shift on ${currentDate} at ${shift.start_time}. Consider taking disciplinary action. Contingency plan required.`,
                4
              ]
            );
          }

          //console.log(`Replacement employee ${shift.first_name} ${shift.last_name} failed to show up for shift ${shift.shift_id} - QR expired`);
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error('Replacement monitoring error:', error);
  } finally {
    connection.release();
  }
});