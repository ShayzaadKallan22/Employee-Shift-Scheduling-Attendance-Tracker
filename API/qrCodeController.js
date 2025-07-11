/**
 * @author MOYO CT, 221039267
 */


const db = require ('./db');

//Scan attendance QR code.
exports.scanQR = async (req, res) => {
  const { code_value, employee_id } = req.body;

  try {
    //Check if the scanned QR code exists
    const [rows] = await db.execute(
      `SELECT * FROM t_qr_code WHERE code_value = ?`,
      [code_value]
    );

    if (!rows.length)
      return res.status(404).json({ message: 'QR code was not found' });

    const qr = rows[0];

    //Check if the QR code is still valid.
    if (qr.status_ !== 'active')
      return res.status(400).json({ message: 'QR code has already been used' });

    if (new Date(qr.expiration_time) < new Date()) {
      await db.execute(
        `UPDATE t_qr_code SET status_ = 'expired' WHERE qr_id = ?`,
        [qr.qr_id]
      );
      return res.status(400).json({ message: 'QR code has expired' });
    }

    //Mark QR code as used
    await db.execute(
      `UPDATE t_qr_code SET status_ = 'used' WHERE qr_id = ?`,
      [qr.qr_id]
    );

    //Determine shift type based on QR purpose
    let shiftType = '';
    if (qr.purpose === 'clock-in' || qr.purpose === 'attendanceNormal') {
      shiftType = 'normal';
    } else if (qr.purpose === 'overtime' || qr.purpose === 'attendance') {
      shiftType = 'overtime';
    } else {
      return res.status(400).json({ message: 'Invalid QR purpose' });
    }

    //Find matching shift or if employee was assigned that shift.
    const [shiftRows] = await db.execute(
      `SELECT shift_id FROM t_shift
       WHERE employee_id = ?
         AND shift_type = ?
         AND CURDATE() BETWEEN date_ AND end_date
         AND CURTIME() BETWEEN start_time AND end_time
         AND status_ = 'scheduled'
       LIMIT 1`,
      [employee_id, shiftType]
    );

    if (shiftRows.length === 0)
      return res.status(404).json({ message: `No active ${shiftType} shift found.` });

    const shift_id = shiftRows[0].shift_id;

    //Handle all employee attendances(clock-in and overtime).
    if (qr.purpose === 'clock-in' || qr.purpose === 'overtime') {
      //Check for existing clock-in
      const [existing] = await db.execute(
        `SELECT * FROM t_attendance WHERE employee_id = ? AND shift_id = ?`,
        [employee_id, shift_id]
      );

      if (existing.length > 0)
        return res.status(400).json({ message: `You have already clocked in for this ${shiftType} shift.` });

      //Insert new attendance record.
      await db.execute(
        `INSERT INTO t_attendance (employee_id, shift_id, clock_in_time, qr_id)
         VALUES (?, ?, NOW(), ?)`,
        [employee_id, shift_id, qr.qr_id]
      );
      
      await db.execute(
         `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
          VALUES (?, ?, NOW(), ?, ?)`,
          [employee_id, 'Your clock in for today has been approved.', 'unread', 4]
      );
    } else if (qr.purpose === 'attendanceNormal' || qr.purpose === 'attendance') {

      //Proof of employee attendance(employee clock-out)
      const [attendance] = await db.execute(
        `SELECT * FROM t_attendance 
         WHERE employee_id = ? AND shift_id = ? AND clock_out_time IS NULL`,
        [employee_id, shift_id]
      );

      if (attendance.length === 0)
        return res.status(400).json({ message: `No active ${shiftType} clock-in found.` });
      //Update the clock-out time.
      await db.execute(
        `UPDATE t_attendance SET clock_out_time = NOW(), status_ = ?
         WHERE attendance_id = ?`,
        ['present',attendance[0].attendance_id]
      );

       await db.execute(
         `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
          VALUES (?, ?, NOW(), ?, ?)`,
          [employee_id, 'Your proof of attendance has been recorded.', 'unread', 4]
      );
    }

    return res.status(200).json({ message: `QR code has been accepted for ${qr.purpose}` });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};