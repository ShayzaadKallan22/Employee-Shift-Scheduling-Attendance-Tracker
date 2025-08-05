/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */


const db = require('./db');
//Fetch upcoming shifts for each employee.
exports.getUpcomingShifts = async (req, res) =>{
    const { employeeId } = req.params;
    if(!employeeId) return res.status(400).json({message: 'Employee Id not found.'});
    
    try{
        const [rows] = await db.query (
        `SELECT s.*
         FROM t_shift s
         WHERE s.employee_id = ? 
         AND s.status_ = 'scheduled' 
         AND s.date_ >= CURDATE()
         AND NOT EXISTS (
             SELECT 1 FROM t_leave l 
             WHERE l.employee_id = s.employee_id
             AND l.status_ = 'approved'
             AND s.date_ BETWEEN l.start_date AND l.end_date
         )
         ORDER BY s.date_ ASC
         LIMIT 5`, [employeeId]
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