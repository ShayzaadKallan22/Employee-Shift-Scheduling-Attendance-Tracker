/**
 * @author MOYO CT, 221039267
 */


const db = require('./db');
//Fetch upcoming shifts for each employee.
exports.getUpcomingShifts = async (req, res) =>{
    const { employeeId } = req.params;
    if(!employeeId) return res.status(400).json({message: 'Employee Id not found.'});
    
    try{
        const [rows] = await db.query (
        `SELECT date_, start_time
         FROM t_shift
         WHERE employee_id = ? AND date_ >= CURDATE()
         ORDER BY date_ ASC
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