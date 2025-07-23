/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const db = require('./db');
//Get employee shifts according to their monthly schedule.
exports.getEmpShifts = async( req, res) => {
const { id: employee_id } = req.params;

try{
    const [rows] = await db.query (
        `SELECT s.shift_id, s.start_time, s.end_time, s.date_, s.shift_type, s.status_, r.title AS role
         FROM t_shift s
         JOIN t_employee e ON s.employee_id = e.employee_id
         JOIN t_role r ON e.role_id = r.role_id
         WHERE s.employee_id = ? AND s.status_ = 'scheduled' AND DATE(date_) >= CURDATE() 
         ORDER BY s.date_ ASC
         LIMIT 30`, [employee_id]
    );

    if(!rows || rows.length === 0){
        return res.status(404).json({message: 'No shifts found.'});
    }
    res.json(rows);
}catch(err){
    console.error('Error fetching employee shifts:', err);
    return res.status(500).json({message: 'Server error.'});
}
    
};