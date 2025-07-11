const express = require('express');
const router = express.Router();
const db = require('./db');

// (helper function to handle database errors for testing)
const handleDbError = (res, error, message) => {
    console.error(message, error);
    res.status(500).json({ 
        error: 'Database operation failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};



// Get employees for dropdown
router.get('/employees', async (req, res) => {
    try {
        const query = 'SELECT employee_id, first_name, last_name FROM t_employee WHERE status_ = "active"';
        const [results] = await db.query(query);
        res.json(results);
    } catch (error) {
        handleDbError(res, error, 'Error fetching employees:');
    }
});

// Payroll Report
router.get('/payroll', async (req, res) => {
    try {
        const { startDate, endDate, employeeId } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start and end dates are required' });
        }
        
        const query = `
            SELECT 
                p.*,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                e.employee_id,
                e.base_hourly_rate,
                e.overtime_hourly_rate,
                r.title as role,
                p.base_hours,
                p.overtime_hours,
                MIN(s.date_) as start_date,
                MAX(s.date_) as end_date
            FROM t_payroll p
            JOIN t_employee e ON p.employee_id = e.employee_id
            JOIN t_role r ON e.role_id = r.role_id
            LEFT JOIN t_shift s ON p.employee_id = s.employee_id 
                AND s.date_ BETWEEN ? AND ?
            WHERE p.payment_date BETWEEN ? AND ?
            ${employeeId ? 'AND p.employee_id = ?' : ''}
            GROUP BY p.payroll_id, e.employee_id
        `;
        
        const params = [startDate, endDate, startDate, endDate];
        if (employeeId) params.push(employeeId);
        
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (error) {
        console.error('Error in payroll report:', error);
        res.status(500).json({ 
            error: 'Database operation failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Attendance Report
router.get('/attendance', async (req, res) => {
    try {
        const { startDate, endDate, employeeId, shiftType } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start and end dates are required' });
        }
        
        let query = `
            SELECT 
                s.shift_id,
                s.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                s.date_ as date,
                s.start_time,
                s.end_time,
                s.status_,
                s.shift_type,
                CASE 
                    WHEN TIME_TO_SEC(TIMEDIFF(s.end_time, s.start_time)) < 0 
                    THEN TIMESTAMPDIFF(HOUR, s.start_time, ADDTIME(s.end_time, '24:00:00'))
                    ELSE TIMESTAMPDIFF(HOUR, s.start_time, s.end_time)
                END as hours_scheduled,
                r.title as role
            FROM t_shift s
            JOIN t_employee e ON s.employee_id = e.employee_id
            JOIN t_role r ON e.role_id = r.role_id
            WHERE s.date_ BETWEEN ? AND ?
        `;
        
        const params = [startDate, endDate];
        
        if (shiftType && shiftType !== 'all') {
            query += ' AND s.shift_type = ?';
            params.push(shiftType);
        }
        
        if (employeeId && employeeId !== 'all') {
            query += ' AND s.employee_id = ?';
            params.push(employeeId);
        }
        
        query += ' ORDER BY s.date_ DESC, s.start_time DESC';
        
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (error) {
        handleDbError(res, error, 'Error generating attendance report:');
    }
});

// Leave Report
router.get('/leave', async (req, res) => {
    try {
        const { startDate, endDate, employeeId } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start and end dates are required' });
        }
        
        let query = `
            SELECT 
                l.leave_id,
                l.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                l.start_date,
                l.end_date,
                DATEDIFF(l.end_date, l.start_date) + 1 as days_taken,
                l.status_,
                lt.name_ as leave_type,
                r.title as role
            FROM t_leave l
            JOIN t_employee e ON l.employee_id = e.employee_id
            JOIN t_leave_type lt ON l.leave_type_id = lt.leave_type_id
            JOIN t_role r ON e.role_id = r.role_id
            WHERE l.start_date BETWEEN ? AND ?
        `;
        
        const params = [startDate, endDate];
        
        if (employeeId && employeeId !== 'all') {
            query += ' AND l.employee_id = ?';
            params.push(employeeId);
        }
        
        query += ' ORDER BY l.start_date DESC';
        
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (error) {
        handleDbError(res, error, 'Error generating leave report:');
    }
});

// Shift Swaps Report - Fixed?
router.get('/swaps', async (req, res) => {
    try {
        const { startDate, endDate, employeeId } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start and end dates are required' });
        }
        
        let query = `
            SELECT 
                ss.swap_id,
                ss.status_,
                ss.request_date_time,
                ss.approval_date_time,
                e1.employee_id as original_employee_id,
                CONCAT(e1.first_name, ' ', e1.last_name) as original_employee_name,
                e2.employee_id as requesting_employee_id,
                CONCAT(e2.first_name, ' ', e2.last_name) as requesting_employee_name,
                s1.shift_id as original_shift_id,
                s1.start_time as original_start_time,
                s1.end_time as original_end_time,
                s1.date_ as original_date,
                s2.shift_id as requested_shift_id,
                s2.start_time as requested_start_time,
                s2.end_time as requested_end_time,
                s2.date_ as requested_date,
                e3.employee_id as approving_employee_id,
                CONCAT(e3.first_name, ' ', e3.last_name) as approving_employee_name
            FROM t_shift_swap ss
            JOIN t_employee e1 ON ss.requesting_employee_id = e1.employee_id
            JOIN t_shift s1 ON ss.original_shift_id = s1.shift_id
            JOIN t_shift s2 ON ss.requested_shift_id = s2.shift_id
            JOIN t_employee e2 ON s2.employee_id = e2.employee_id
            LEFT JOIN t_employee e3 ON ss.approving_employee_id = e3.employee_id
            WHERE DATE(ss.request_date_time) BETWEEN ? AND ?
        `;
        
        const params = [startDate, endDate];
        
        if (employeeId && employeeId !== 'all') {
            query += ' AND (ss.requesting_employee_id = ? OR s2.employee_id = ?)';
            params.push(employeeId, employeeId);
        }
        
        query += ' ORDER BY ss.request_date_time DESC';
        
        const [results] = await db.query(query, params);
        res.json(results);
    } catch (error) {
        handleDbError(res, error, 'Error generating swaps report:');
    }
});

// Summary statistics for dashboard
router.get('/summary', async (req, res) => {
    try {
        // Get current payroll period
        const [periods] = await db.query(`
            SELECT * FROM t_payroll_period 
            WHERE _status = 'open' 
            ORDER BY start_date DESC 
            LIMIT 1
        `);
        
        const currentPeriod = periods[0];
        
        // Get payroll summary
        const [payrollSummary] = await db.query(`
            SELECT 
                COUNT(*) as employee_count,
                SUM(total_amount) as total_payroll,
                SUM(base_hours) as total_base_hours,
                SUM(overtime_hours) as total_overtime_hours
            FROM t_payroll
            WHERE period_id = ?
        `, [currentPeriod?.period_id || 0]);
        
        // Get attendance summary
        const [attendanceSummary] = await db.query(`
            SELECT 
                COUNT(*) as total_shifts,
                SUM(CASE WHEN status_ = 'present' THEN 1 ELSE 0 END) as present,
                SUM(CASE WHEN status_ = 'late' THEN 1 ELSE 0 END) as late,
                SUM(CASE WHEN status_ = 'absent' THEN 1 ELSE 0 END) as absent
            FROM t_attendance
            WHERE DATE(clock_in_time) BETWEEN ? AND ?
        `, [
            currentPeriod?.start_date || new Date().toISOString().split('T')[0],
            currentPeriod?.end_date || new Date().toISOString().split('T')[0]
        ]);
        
        // Get leave summary
        const [leaveSummary] = await db.query(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status_ = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status_ = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status_ = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM t_leave
            WHERE start_date BETWEEN ? AND ?
        `, [
            currentPeriod?.start_date || new Date().toISOString().split('T')[0],
            currentPeriod?.end_date || new Date().toISOString().split('T')[0]
        ]);
        
        res.json({
            payroll: payrollSummary[0] || {},
            attendance: attendanceSummary[0] || {},
            leave: leaveSummary[0] || {},
            currentPeriod
        });
    } catch (error) {
        handleDbError(res, error, 'Error generating summary report:');
    }
});

module.exports = router;