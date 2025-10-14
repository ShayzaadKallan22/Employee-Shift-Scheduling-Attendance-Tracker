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
       AND status_ = 'scheduled'
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

//Get suggested colleagues for shift swap
exports.getSuggestedColleagues = async (req, res) => {
  const { employee_id, shift_date } = req.query;

  console.log('Received request for suggestions:', { employee_id, shift_date });

  if (!employee_id || !shift_date) {
    return res.status(400).json({ message: 'Missing employee ID or shift date' });
  }

  try {
    //Get current employee's shift details
    const [currentShiftRows] = await db.execute(
      `SELECT s.shift_id, s.start_time, s.end_time, e.role_id 
       FROM t_shift s 
       JOIN t_employee e ON s.employee_id = e.employee_id 
       WHERE s.employee_id = ? 
       AND ? BETWEEN s.date_ AND s.end_date 
       AND s.status_ = 'scheduled'
       LIMIT 1`,
      [employee_id, shift_date]
    );

    if (currentShiftRows.length === 0) {
      console.log('No shift found for employee on this date');
      return res.status(404).json({ message: 'No shift found for this date' });
    }

    const currentShift = currentShiftRows[0];
    console.log('Current shift:', currentShift);

    //Check if the shift has an event.
    const hasEvent = currentShift.event_id !== null;
    const eventWarning = hasEvent ? {
        hasEvent: true,
        eventName: currentShift.event_name,
        message: `This shift falls within a "${currentShift.event_name}" event. Swapping may result in losing extra earnings.`
    } :{
        hasEvent: false,
        message: null
    };

    //Check if start_time is null and set default if necessary
    const shiftStartTime = currentShift.start_time || '09:00:00';
    
    //Get colleagues with same role and calculate compatibility score 
    const [suggestedColleagues] = await db.execute(
      `SELECT 
        e.employee_id,
        CONCAT(e.first_name, ' ', e.last_name) AS name,
        e.email,
        (
          40 +
          COALESCE((
            SELECT 30 FROM t_shift_swap ss 
            WHERE ss.requesting_employee_id = e.employee_id 
            AND ss.status_ = 'approved' 
            AND ss.approval_date_time >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
            LIMIT 1
          ), 0) +
          COALESCE((
            SELECT 10 FROM t_shift s2 
            LEFT JOIN t_event ev ON s2.date_ BETWEEN ev.start_date AND ev.end_date 
            WHERE s2.employee_id = e.employee_id 
            AND s2.date_ = ? 
            AND ev.event_id IS NULL 
            LIMIT 1
          ), 0) +
          COALESCE((
            SELECT 10 FROM t_leave l 
            WHERE l.employee_id = e.employee_id 
            AND ? BETWEEN l.start_date AND l.end_date 
            AND l.status_ = 'approved' 
            LIMIT 1
          ), 0) +
          COALESCE((
            SELECT 10 FROM t_shift s3 
            WHERE s3.employee_id = e.employee_id 
            AND s3.start_time BETWEEN SUBTIME(?, '01:00:00') AND ADDTIME(?, '01:00:00')
            AND s3.date_ = DATE_SUB(?, INTERVAL 7 DAY)
            LIMIT 1
          ), 0)
        ) AS compatibility_score,
        
        (SELECT COUNT(*) FROM t_shift_swap ss 
         WHERE ss.requesting_employee_id = e.employee_id 
         AND ss.status_ = 'approved') AS successful_swaps_count,
         
        (SELECT COUNT(*) FROM t_shift_swap ss 
         WHERE ss.approving_employee_id = e.employee_id 
         AND ss.status_ = 'approved') AS approved_for_others_count,
         
        (SELECT GROUP_CONCAT(DISTINCT DATE(s4.date_)) 
         FROM t_shift s4 
         WHERE s4.employee_id = e.employee_id 
         AND s4.date_ >= CURDATE() 
         AND s4.date_ <= DATE_ADD(CURDATE(), INTERVAL 25 DAY)
         AND s4.status_ = 'scheduled') AS upcoming_shifts,

        (SELECT COUNT(*) FROM t_shift s5 
         LEFT JOIN t_event ev ON s5.date_ BETWEEN ev.start_date AND ev.end_date
         WHERE s5.employee_id = e.employee_id 
         AND s5.date_ >= CURDATE() 
         AND s5.status_ = 'scheduled'
         AND ev.event_id IS NOT NULL) AS event_shift_count

       FROM t_employee e
       WHERE e.role_id = ? 
       AND e.employee_id != ?
       AND e.employee_id NOT IN (
         SELECT DISTINCT s5.employee_id 
         FROM t_shift s5 
         WHERE s5.date_ = ? 
         AND s5.status_ = 'scheduled'
       )
       ORDER BY compatibility_score DESC, successful_swaps_count DESC
       LIMIT 10`,
      [
        shift_date, //For event check
        shift_date, //For leave check  
        shiftStartTime, shiftStartTime, shift_date, //For timing compatibility
        currentShift.role_id,
        employee_id,
        shift_date
      ]
    );

    console.log(`Found ${suggestedColleagues.length} suggested colleagues`);

    //Enhance with shift availability
    const enhancedColleagues = await Promise.all(
      suggestedColleagues.map(async (colleague) => {
        //Get colleague's available shift dates for swapping
        const [availableShifts] = await db.execute(
          `SELECT DISTINCT DATE(date_) AS date_
           FROM t_shift 
           WHERE employee_id = ? 
           AND date_ >= CURDATE() 
           AND status_ = 'scheduled'
           AND date_ NOT IN (
             SELECT DISTINCT s.date_ 
             FROM t_shift s 
             WHERE s.employee_id = ?
             AND s.status_ = 'scheduled'
           )
           ORDER BY date_
           LIMIT 10`,
          [colleague.employee_id, employee_id]
        );

        //Format available dates with event information.
        const available_dates = availableShifts.map(shift => ({
          date: shift.date_.toLocaleDateString(),
          hasEvent: shift.event_id !== null,
          eventName: shift.event_name || null,
          payMultiplier: shift.pay_multiplier || 1.0
        }));

        const hasEventShifts = available_dates.some(date => date.hasEvent);

        return {
          ...colleague,
          available_dates: availableShifts.map(s => s.date_.toLocaleDateString()),
          compatibility_level: colleague.compatibility_score >= 70 ? 'High' : 
                               colleague.compatibility_score >= 41 ? 'Moderate' : 'Low',
          compatibility_score: Math.min(100, colleague.compatibility_score), //Cap at 100
          hasEventShifts: hasEventShifts,
          eventShiftCount: colleague.event_shift_count || 0
        };
      })
    );

    console.log('Enhanced colleagues:', enhancedColleagues.map(c => ({
      name: c.name,
      score: c.compatibility_score,
      level: c.compatibility_level,
      available_dates_count: c.available_dates.length
    })));

    res.json(enhancedColleagues);
  } catch (error) {
    console.error('Error fetching suggested colleagues:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: error.sql ? 'SQL error' : 'Unknown error'
    });
  }
};

//Get approval recommendation for shift swap
exports.getApprovalRecommendation = async (req, res) => {
  const { swap_id, approving_employee_id } = req.query;

  try {
    //Get swap request details
    const [swapDetails] = await db.execute(
      `SELECT 
        ss.*,
        req_emp.first_name AS req_first_name,
        req_emp.last_name AS req_last_name,
        orig_shift.date_ AS original_shift_date,
        req_shift.date_ AS requested_shift_date,
        orig_shift.start_time AS original_start_time,
        orig_shift.end_time AS original_end_time,
        req_shift.start_time AS requested_start_time,
        req_shift.end_time AS requested_end_time
       FROM t_shift_swap ss
       JOIN t_employee req_emp ON ss.requesting_employee_id = req_emp.employee_id
       JOIN t_shift orig_shift ON ss.original_shift_id = orig_shift.shift_id
       JOIN t_shift req_shift ON ss.requested_shift_id = req_shift.shift_id
       WHERE ss.swap_id = ? AND ss.approving_employee_id = ?`,
      [swap_id, approving_employee_id]
    );

    if (swapDetails.length === 0) {
      return res.status(404).json({ message: 'Swap request not found' });
    }

    const swap = swapDetails[0];
    
    //Calculate recommendation score
    let recommendationScore = 50; //Base score
    let reasons = [];
    let warnings = [];

    //Check 1: Past swap history with this employee
    const [pastSwaps] = await db.execute(
      `SELECT status_, COUNT(*) as count 
       FROM t_shift_swap 
       WHERE requesting_employee_id = ? AND approving_employee_id = ?
       GROUP BY status_`,
      [swap.requesting_employee_id, swap.approving_employee_id]
    );

    const approvedSwaps = pastSwaps.find(p => p.status_ === 'approved')?.count || 0;
    const rejectedSwaps = pastSwaps.find(p => p.status_ === 'rejected')?.count || 0;
    
    if (approvedSwaps > 0) {
      recommendationScore += 20;
      reasons.push(`Successfully swapped ${approvedSwaps} time(s) before`);
    }
    if (rejectedSwaps > 0) {
      recommendationScore -= 10;
      warnings.push(`Had ${rejectedSwaps} rejected swap(s) in past`);
    }

    //Check 2: Check for conflicting events
    const [conflictingEvents] = await db.execute(
      `SELECT COUNT(*) as event_count 
       FROM t_event 
       WHERE ? BETWEEN start_date AND end_date`,
      [swap.requested_shift_date]
    );

    if (conflictingEvents[0].event_count > 0) {
      recommendationScore -= 15;
      warnings.push('There are scheduled events on the requested shift date');
    }

    //Check 3: Check employee's upcoming workload
    const [upcomingShifts] = await db.execute(
      `SELECT COUNT(*) as shift_count 
       FROM t_shift 
       WHERE employee_id = ? 
       AND date_ BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)
       AND status_ = 'scheduled'`,
      [swap.approving_employee_id, swap.requested_shift_date, swap.requested_shift_date]
    );

    if (upcomingShifts[0].shift_count > 5) {
      recommendationScore -= 10;
      warnings.push('High workload in the upcoming week');
    } else if (upcomingShifts[0].shift_count < 3) {
      recommendationScore += 10;
      reasons.push('Light workload in the upcoming week');
    }

   //Check 4: Shift timing compatibility
    const [similarShifts] = await db.execute(
      `SELECT COUNT(*) as similar_count 
       FROM t_shift 
       WHERE employee_id = ? 
       AND start_time BETWEEN SUBTIME(?, '02:00:00') AND ADDTIME(?, '02:00:00')
       AND date_ >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [swap.approving_employee_id, swap.requested_start_time, swap.requested_start_time]
    );

    if (similarShifts[0].similar_count > 0) {
      recommendationScore += 15;
      reasons.push('Familiar with this shift timing');
    }

    //Check 5: Recent cancellations by requesting employee
    const [recentCancellations] = await db.execute(
      `SELECT COUNT(*) as cancel_count 
       FROM t_shift_cancellations 
       WHERE employee_id = ? 
       AND requested_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       AND status_ = 'approved'`,
      [swap.requesting_employee_id]
    );

    if (recentCancellations[0].cancel_count > 0) {
      recommendationScore -= 10;
      warnings.push('Requesting employee had recent shift cancellations');
    }

    //Determine recommendation
    let recommendation = 'neutral';
    if (recommendationScore >= 70) {
      recommendation = 'approve';
    } else if (recommendationScore <= 49) {
      recommendation = 'reject';
    }

    res.json({
      recommendation,
      score: Math.min(100, Math.max(0, recommendationScore)),
      reasons,
      warnings,
      swap_details: {
        requesting_employee: `${swap.req_first_name} ${swap.req_last_name}`,
        original_shift_date: swap.original_shift_date,
        requested_shift_date: swap.requested_shift_date,
        shift_timing: `${swap.requested_start_time} - ${swap.requested_end_time}`
      }
    });

  } catch (error) {
    console.error('Error generating approval recommendation:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


