//AUTHOR - SHAYZAAD

const express = require('express');
const router = express.Router();
const payrollController = require('./payrollController');

//Fetch all roles with their rates
router.get('/roles', payrollController.getRoleRates);

//Update multiple role rates
router.put('/roles', payrollController.updateRoleRates);

//Fetch all employees with their rates
router.get('/employees', payrollController.getEmployeeRates);

//Update multiple employee rates
router.put('/employees', payrollController.updateEmployeeRates);

//Get payroll summary (totals)
router.get('/summary', payrollController.getPayrollSummary);

//Get detailed payment records
router.get('/payments', payrollController.getPaymentDetails);

//Get budget history
router.get('/budget-history', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT * FROM t_budget_history 
            ORDER BY payment_date DESC
        `);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

//Manual budget override
router.post('/set-budget', async (req, res) => {
    try {
        const { budget, date } = req.body;
        
        await db.query(`
            INSERT INTO t_budget_history 
            (payment_date, initial_budget, actual_spend, adjusted_budget, adjustment_reason)
            VALUES (?, ?, 0, ?, 'Manually set by administrator')
            ON DUPLICATE KEY UPDATE
                initial_budget = VALUES(initial_budget),
                adjusted_budget = VALUES(adjusted_budget),
                adjustment_reason = VALUES(adjustment_reason)
        `, [date, budget, budget]);
        
        res.status(200).json({ message: 'Budget updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/budget', payrollController.getBudgetForDate);

router.get('/budget-comparison', payrollController.getBudgetComparison);

module.exports = router;