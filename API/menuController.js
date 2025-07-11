/**
 * @author MOYO CT, 221039267
 */


const db = require('./db');
//Fetch employee name and role for the burger menu.
exports.getEmpDetails = async (req , res) => {
    const { employee_id } = req.params;

    console.log('Employee Id:', employee_id);
    if(!employee_id){
        return res.status(400).json({message: 'Missing employee id:', employee_id});
    }
    try{
        const [rows] = await db.query(
            `SELECT
               e.employee_id,
               CONCAT(e.first_name, ' ', e.last_name) AS name,
               r.title AS role
            FROM t_employee e
            LEFT JOIN t_role r ON e.role_id = r.role_id
            WHERE e.employee_id = ?`, [employee_id]
        );
        const result = rows[0];

        console.log('Db result:', result);
        if(!result) return res.status(404).json({ error: 'Employee not found'});
        
        const menuData = {
            employeeId: result.employee_id,
            name: result.name,
            role: result.role
        }
        console.log('Menu data:', menuData);
        res.json(menuData);
    }catch(error){
        console.error('Failure fetching employee data', error);
        res.status(500).json({message: 'Server error'});
    }

};