/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */


const db = require('./db');

//Get shift IDs
exports.getShiftID = async (req, res) => {
  const { employee_id, date } = req.query;
  //Check if the selected shift dates exist.
  if (!employee_id || !date) {
    return res.status(400).json({ message: 'Missing employee ID or date' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT shift_id FROM t_shift
       WHERE employee_id = ?
       AND ? BETWEEN date_ AND end_date
       LIMIT 1`,
      [employee_id, date]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No shift found for this employee on that date' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};


//Submit a new shift swap request
exports.createShiftSwap = async (req, res) => {
  const {
    original_shift_id,
    requested_shift_id,
    requesting_employee_id,
    approving_employee_id
  } = req.body;
  //Check if all the required fields have been entered.
  if (!original_shift_id || !requested_shift_id || !requesting_employee_id || !approving_employee_id) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const query = `
      INSERT INTO t_shift_swap (
        original_shift_id,
        requested_shift_id,
        requesting_employee_id,
        approving_employee_id
      ) VALUES (?, ?, ?, ?)`;

    await db.execute(query, [
      original_shift_id,
      requested_shift_id,
      requesting_employee_id,
      approving_employee_id
    ]);
     const [[rows]] = await db.execute(
        `SELECT CONCAT(first_name, ' ', last_name) AS name
         FROM t_employee
         WHERE employee_id = ?`, [requesting_employee_id]
     );
     await db.execute(
         `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
          VALUES (?, ?, NOW(), ?, ?)`,
          [approving_employee_id, `${rows.name} has requested a shift swap with you.`, 'unread', 5]
      );

    return res.status(201).json({ message: 'Shift swap request created successfully' });
  } catch (error) {
    console.error('Shift swap insert error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

//Get colleagues with same role
exports.getColleaguesSameRole = async (req, res) => {
  const { employee_id } = req.params;

  try {
    const [roleData] = await db.execute(
      `SELECT role_id FROM t_employee WHERE employee_id = ?`, [employee_id]
    );

    if (!roleData.length) return res.status(404).json({ message: 'Employee not found' });

    const [colleagues] = await db.execute(
      `SELECT employee_id, CONCAT(first_name, ' ', last_name) AS name 
       FROM t_employee 
       WHERE role_id = ? AND employee_id != ?`,
      [roleData[0].role_id, employee_id]
    );

    return res.json(colleagues);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Internal error' });
  }
};

//Get shift swap requests made by the employee
exports.getSwapRequests = async (req, res) => {
  const { employee_id } = req.params;

  if (!employee_id) {
    return res.status(400).json({ message: 'Employee ID is required' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT 
        swap_id AS id,
        ts.status_ AS status,
        s1.date_ AS assignedDate,
        s2.date_ AS swapDate,
        CONCAT(e.first_name, ' ', e.last_name) AS colleague
     FROM t_shift_swap ts
     JOIN t_employee e ON ts.approving_employee_id = e.employee_id
     JOIN t_shift s1 ON ts.original_shift_id = s1.shift_id
     JOIN t_shift s2 ON ts.requested_shift_id = s2.shift_id
     WHERE ts.requesting_employee_id = ?
     ORDER BY s1.date_ DESC`,[employee_id]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching my shift swap requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

//Get shift swap requests assigned to the employee for approval.
exports.getColleagueRequests = async (req, res) => {
  const { employee_id } = req.params;

  if (!employee_id) {
    return res.status(400).json({ message: 'Employee ID is required' });
  }

  try {
    const [rows] = await db.execute(
     `SELECT 
       swap_id AS id,
       ts.status_ AS status,
       s1.date_ AS assignedDate,
       s2.date_ AS swapDate,
       CONCAT(e.first_name, ' ', e.last_name) AS colleague
     FROM t_shift_swap ts
     JOIN t_employee e ON ts.requesting_employee_id = e.employee_id
     JOIN t_shift s1 ON ts.original_shift_id = s1.shift_id
     JOIN t_shift s2 ON ts.requested_shift_id = s2.shift_id
     WHERE ts.approving_employee_id = ?
     ORDER BY s2.date_ DESC`,[employee_id]
    );
    
    console.log(rows);

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching colleague shift swap requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

//get own Shift dates.
exports.getEmpShiftDates = async (req,res) =>{

  const {employee_id} = req.params;

  if(!employee_id){
    return res.status(400).json({message: 'Employee ID is required, could not be found.'});
  }

  try {
    const[rows] = await db.execute(
      `SELECT DISTINCT DATE(date_) AS date_
       FROM t_shift
       WHERE employee_id = ?
       AND date_ >= CURDATE()
       ORDER BY date_`, [employee_id]
    );
    const dateStrings = rows.map(row => row.date_.toLocaleDateString('en-CA'));
    console.log(dateStrings);

    res.status(200).json(dateStrings);
  }catch(error){
    console.error('Error fetching employee shift dates:', error);
    res.status(500).json({message: 'Server error'});
  }
};


//Get available shift dates for a selected colleague.
exports.getColleagueShiftDates = async (req, res) => {
  const {employee_id} = req.params;

  if(!employee_id){
    return res.status(400).json({message: 'Employee ID is required.'});
  }

  try{
    const [rows] = await db.execute(
       `SELECT DISTINCT DATE(date_) AS date_
        FROM t_shift
        WHERE employee_id = ?
        AND date_ >= CURDATE()
        ORDER BY date_`, [employee_id]     
    );
    const dateStrings = rows.map(row => row.date_.toLocaleDateString('en-CA'));
    console.log('Colleague:', dateStrings);

    res.status(200).json(dateStrings);
  }catch(error){
    console.error('Error fetching colleague shift dates:', error);
    res.status(500).json({message: 'Server error.'});
  }
};
//Approve or decline a shift swap
exports.respondToSwap = async (req, res) => {
  const { swap_id, action } = req.body;

  if (!['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action' });
  }

  try {
    //Update the swap status
    const query = `
      UPDATE t_shift_swap
      SET status_ = ?, approval_date_time = NOW()
      WHERE swap_id = ?
    `;
    await db.execute(query, [action, swap_id]);
   
    //If the swap was approved, update the shift assignment
    if(action === 'approved'){
      const[rows] = await db.execute(
        `SELECT original_shift_id, requested_shift_id, requesting_employee_id, approving_employee_id
         FROM t_shift_swap 
         WHERE swap_id = ?`, [swap_id]
      );

      if(rows.length ===0){
        return res.status(404).json({message: 'Shift-swap record not found.'});
      }

      const {
        original_shift_id,
        requested_shift_id,
        requesting_employee_id,
        approving_employee_id
      } = rows[0];

      //Swap the employee IDs in the corresponding shifts as requested and approved.
      await db.execute(
        `UPDATE t_shift SET employee_id = ?
         WHERE shift_id = ?`, [approving_employee_id, original_shift_id]
      );

      //Get the approving employee's name to notify them about the swap approval.
      const [[result]] = await db.execute(
        `SELECT CONCAT(first_name, ' ', last_name) AS name
         FROM t_employee
         WHERE employee_id = ?`, [approving_employee_id]
     );

     //Get the requesting employee's name to notify them about the swap approval.
     const [[requestingEmployee]] = await db.execute(
        `SELECT CONCAT(first_name, ' ', last_name) AS name
          FROM t_employee
          WHERE employee_id = ?`, [requesting_employee_id]
     );
      //Insert notifications for both employees about the swap approval.
      await db.execute(
         `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
          VALUES (?, ?, NOW(), ?, ?)`,
          [requesting_employee_id, `${result.name} has approved your shift swap request.`, 'unread', 5]
      );
      //Get the manager's details to notify them about the swap approval.
      const [[manager]] = await db.execute(
        `SELECT *
         FROM t_employee
         WHERE type_ = 'manager'`
      );
      //Notify the manager about the swap approval.
      //This will notify the manager about the shift swap approval.
      await db.execute(
         `INSERT INTO t_notification (employee_id, message, sent_time, read_status, notification_type_id)
          VALUES (?, ?, NOW(), ?, ?)`,
          [manager.employee_id, `${result.name} has approved a shift swap request from ${requestingEmployee.name}`, 'unread', 5]
      );

      //Update the requesting employee's shift to the requested shift.
      await db.execute(
        `UPDATE t_shift SET employee_id = ?
         WHERE shift_id = ?`, [requesting_employee_id, requested_shift_id]
      );
    }
    return res.status(200).json({ message: `Request ${action}` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};
