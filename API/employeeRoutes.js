const express = require('express');
const router = express.Router();
const db = require('./db');

// Get all employees
router.get('/', async (req, res) => {
    try {
        const [employees] = await db.query(`
            SELECT e.*, r.title as role_title
            FROM t_employee e
            JOIN t_role r ON e.role_id = r.role_id
            ORDER BY e.last_name, e.first_name
        `);

        res.json(employees);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;