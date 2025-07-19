// Author: Katlego Mmadi
const pool = require('./db');

// Get all employees with their status
const getEmployees = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.employee_id AS id,
        CONCAT(e.first_name, ' ', e.last_name) AS name,
        e.email,
        r.title AS role,
        CASE
          WHEN e.status_ = 'on_leave' THEN 'On Leave'
          WHEN e.status_ = 'active' THEN 'Working'
          WHEN e.status_ = 'inactive' THEN 'Not Working'
          ELSE e.status_
        END AS status
      FROM t_employee e
      JOIN t_role r ON e.role_id = r.role_id
      WHERE e.type_ = 'employee'
    `);
    
    res.json(rows);
  } catch (err) {
    console.error('🛑 Failed to fetch employees:', err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

// Get all roles
const getRoles = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT title FROM t_role');
    res.json(rows.map(r => r.title));
  } catch (err) {
    console.error('❌ Failed to load roles:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

module.exports = {
  getEmployees,
  getRoles
};