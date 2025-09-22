/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const db = require('./db');

//Get employee shifts according to their monthly schedule.
exports.getEmpShifts = async( req, res) => {

    const { id: employee_id } = req.params;
    if(!employee_id) return res.status(400).json({message: 'Employee Id not found.'});

    try{
        const [rows] = await db.query (
            `SELECT s.*
            FROM t_shift s
            WHERE s.employee_id = ?  
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