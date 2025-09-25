// const express = require('express');
// const router = express.Router();
// const db = require('./db');

// // Get manager profile...i just chose the first employee id for now
// router.get('/profile/:id', async (req, res) => {
//     try {
//         const managerId = req.params.id;
        
//         // Get basic manager info
//         const [[manager]] = await db.query(`
//             SELECT e.*, r.title as role_title
//             FROM t_employee e
//             JOIN t_role r ON e.role_id = r.role_id
//             WHERE e.employee_id = ? AND e.type_ = 'manager'
//         `, [managerId]);

//         if (!manager) {
//             return res.status(404).json({ message: 'Manager not found' });
//         }

//         // mock data for demonstration until login connected and database updated where needed
//         manager.employees_managed = 5;
//         manager.shifts_scheduled = 42;
//         manager.years_at_company = 2;
        
//         // add recent activity (mock data for now)
//         manager.recent_activity = [
//             {
//                 id: 1,
//                 type: 'new_employee',
//                 title: 'Registered new employee',
//                 description: 'Registered Sarah Johnson as a new employee',
//                 date: '2025-05-20T14:30:00'
//             },
//             {
//                 id: 2,
//                 type: 'shift_approved',
//                 title: 'Approved shift swap',
//                 description: 'Approved shift swap between Employee 1 and Employee 2',
//                 date: '2025-05-19T10:15:00'
//             },
//             {
//                 id: 3,
//                 type: 'payroll_processed',
//                 title: 'Processed payroll',
//                 description: 'Completed payroll for May 2025',
//                 date: '2025-05-15T16:45:00'
//             }
//         ];

//         res.json(manager);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: 'Server error' });
//     }
// });

// module.exports = router;

// profileRoutes.js - Enhance to fetch real data
const express = require('express');
const router = express.Router();
const db = require('./db');

// Get manager profile
router.get('/profile/:id', async (req, res) => {
    try {
        const managerId = req.params.id;
        
        // Get basic manager info
        const [[manager]] = await db.query(`
            SELECT e.*, r.title as role_title
            FROM t_employee e
            JOIN t_role r ON e.role_id = r.role_id
            WHERE e.employee_id = ? AND e.type_ = 'manager'
        `, [managerId]);

        if (!manager) {
            return res.status(404).json({ message: 'Manager not found' });
        }

        // Get actual count of employees managed
        const [[managedCount]] = await db.query(`
            SELECT COUNT(*) as count 
            FROM t_employee 
            WHERE type_ = 'employee' AND status_ = 'Working'
        `);
        manager.employees_managed = managedCount.count;

        // Get actual count of shifts scheduled for today
        const today = new Date().toISOString().split('T')[0];
        const [[shiftsCount]] = await db.query(`
            SELECT COUNT(*) as count 
            FROM t_shift 
            WHERE date_ = ? AND status_ = 'scheduled'
        `, [today]);
        manager.shifts_scheduled = shiftsCount.count;

        // Calculate years at company
        const startDate = new Date(manager.created_at);
        const todayDate = new Date();
        const yearsDiff = todayDate.getFullYear() - startDate.getFullYear();
        manager.years_at_company = yearsDiff;

        // Get recent activity from database
        const [recentActivity] = await db.query(`
            SELECT 
                'leave_processed' as type,
                CONCAT('Processed leave request for ', e.first_name, ' ', e.last_name) as title,
                CONCAT('Leave request was ', l.status_) as description,
                l.updated_at as date
            FROM t_leave l
            JOIN t_employee e ON l.employee_id = e.employee_id
            WHERE l.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY l.updated_at DESC
            LIMIT 5
        `);
        
        manager.recent_activity = recentActivity;

        res.json(manager);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;