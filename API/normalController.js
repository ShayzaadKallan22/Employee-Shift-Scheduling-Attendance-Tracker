//AUTHOR - SHAYZAAD

const QRCode = require('qrcode');
const cron = require('node-cron');
const pool = require('./db');
const { v4: uuidv4 } = require('uuid');

//Cron job to generate normal QR codes at shift start times
cron.schedule('*/5 * * * * *', async () => {
  const connection = await pool.getConnection();
  //await connection.query("SET time_zone = '+02:00'"); //TIME ZONE
  try {
    await connection.beginTransaction();
    await connection.query("SET time_zone = '+02:00'"); // Ensure session uses SAST
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
        now.setHours(now.getHours() + 2); // Add 2 hours to the Date object

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
                    expiration.setHours(expiration.getHours() + 2); // Add 2 hours
                    expiration.setMinutes(expiration.getMinutes() + 1); // Add 1 minute

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
cron.schedule('*/5 * * * * *', async () => {
  const connection = await pool.getConnection();
  //await connection.query("SET time_zone = '+02:00'");
  try {
    await connection.beginTransaction();
    await connection.query("SET time_zone = '+02:00'"); // Ensure session uses SAS

    const now = new Date(Date.now() + (2 * 60 * 60 * 1000)); // SAST adjustment
    const currentTime = now.toTimeString().slice(0, 8);
    const currentDate = new Date(Date.now() + (2 * 60 * 60 * 1000))
    .toISOString()
    .split('T')[0]; // YYYY-MM-DD
    
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
        AND expiration_time > NOW()` // NOW() will use SAST
      );

      //No proof QR code exists in the db for today (GOOD)
      if(existingProof.length === 0) {

        //Generate a single proof QR that all employees can use
        const proofData = `SHIFT-PROOF-${currentDate}-${uuidv4()}`;
        const proofExpiration = new Date();
        proofExpiration.setHours(proofExpiration.getHours() + 2); // +2 hours     
        proofExpiration.setMinutes(proofExpiration.getMinutes() + 1); // +1 minute
        
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
cron.schedule('*/5 * * * * *', async () => {  
  const connection = await pool.getConnection();
  await connection.query("SET time_zone = '+02:00'");
  try {
    await connection.beginTransaction();
    await connection.query("SET time_zone = '+02:00'"); // Ensure session uses SAST
    //Update expired normal (clock-in) QR codes 
    await connection.query(
      `UPDATE t_qr_code 
       SET status_ = 'expired' 
       WHERE status_ = 'active' 
       AND expiration_time < NOW() 
       AND purpose = 'clock-in'`
    );

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
              [shift.employee_id, `${shift.first_name} ${shift.last_name} has missed a normal shift on ${formattedDate}`, 4]
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