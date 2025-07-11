//AUTHOR - SHAYZAAD

const db = require('./db');

//Returns all the shifts, ordered by their roles
exports.getAllShifts = async (req, res) =>{
    try{
    const [rows] = await db.query
    (`
        SELECT 
        s.shift_id,
        s.shift_type,
        s.start_time,
        s.end_time,
        s.date_,
        s.status_,
        CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
        r.title AS role_title,
        r.description AS role_description,
        r.base_hourly_rate,
        r.overtime_hourly_rate,
        sc.period_start_date,
        sc.period_end_date
        FROM t_shift s
        INNER JOIN t_employee e ON s.employee_id = e.employee_id
        INNER JOIN t_role r ON e.role_id = r.role_id
        INNER JOIN t_schedule sc ON s.schedule_id = sc.schedule_id
        ORDER BY r.title, s.date_, s.start_time
    `);
       res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
}

//To get todays shifts
exports.getTodaysShifts = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0]; //Get today's date in YYYY-MM-DD format
        const [rows] = await db.query(`
            SELECT 
                s.shift_id,
                s.shift_type,
                s.start_time,
                s.end_time,
                s.date_,
                s.status_,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                r.title AS role_title,
                e.employee_id
            FROM t_shift s
            INNER JOIN t_employee e ON s.employee_id = e.employee_id
            INNER JOIN t_role r ON e.role_id = r.role_id
            WHERE s.date_ = ? 
            ORDER BY s.start_time
        `, [today]);
        
        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
}