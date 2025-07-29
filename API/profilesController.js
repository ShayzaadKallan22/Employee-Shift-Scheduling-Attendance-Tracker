/**
 * @author MOYO CT, 221039267
 */


const db = require('./db');
//Fetch all required fields for the employee profile.
exports.getEmpProfile = async(req, res)=> {
   const { employee_id } = req.params;

   //console.log('Employee Id', employee_id);  //Trying to debug something.....
   if (!employee_id){
    return res.status(400).json({message: 'Missing field ', employee_id});
   }

    try{
        const[rows] = await db.query(
           `SELECT 
              e.employee_id,
              CONCAT(e.first_name, ' ', e.last_name) AS name,
              e.email,
              e.phone_number AS cellNumber,
              e.status_,
              r.title AS role
            FROM t_employee e
            LEFT JOIN t_role r ON e.role_id = r.role_id
            WHERE e.employee_id = ?`, [employee_id] 
        );
        //console.log('Entire db result', rows);

        const result = rows[0]; 
        //console.log('dbResult', result);
        if(!result) return res.status(404).json({ error: 'Employee not found'});

        const profile = {
            employeeId: result.employee_id,
            name: result.name,
            email: result.email,
            cellNumber: result.cellNumber,
            role: result.role,
            status: result.status_
        };
        //console.log('Result object:', profile);
        res.json(profile);

    }catch(error){
        console.error('Error fetching employee profile data:', error);
        res.status(500).json({error: 'Server error'});
    }
};

//Update employee profile
exports.updateProfile = async(req, res) =>{

    const{ id } = req.params;
    const{ name, email, cellNumber, status} = req.body;
    if (!name || !email || !cellNumber || !status) {
       return res.status(400).json({ error: 'Missing required fields' });
    }

    const [first_name, last_name = ''] = name.split(' ');

    try{
        await db.query(
            `UPDATE t_employee SET
              first_name = ?,
              last_name = ?,
              email = ?,
              phone_number = ?,
              status_ = ?,
            WHERE employee_id = ?`, [first_name, last_name, email, cellNumber, status, id]
        );

        const [updated] = await db.query(
            `SELECT 
              employee_id,
              CONCAT(first_name, ' ', last_name) AS name,
              email,
              phone_number AS cellNumber,
              status_,
              r.title AS role
            FROM t_employee e
            LEFT JOIN t_role r ON e.role_id = r.role_id
            WHERE e.employee_id = ?`, [id]
        );

        res.json({
            employeeId: `EMP-${updated.employee_id}`,
            name: updated.name,
            email: updated.email,
            cellNumber: updated.cellNumber,
            role: updated.role,
            status: updated.status_
        });
    }catch(error) {
        console.error('Error updating your profile:', error);
        res.status(500).json({error: 'Failure updating the profile'});
    }
};