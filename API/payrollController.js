//AUTHOR - SHAYZAAD

const cron = require('node-cron');
const db = require('./db');

//Get all role rates
exports.getRoleRates = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                role_id,
                title,
                base_hourly_rate,
                overtime_hourly_rate
            FROM t_role
            ORDER BY title
        `);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

//Update role rates
exports.updateRoleRates = async (req, res) => {
    try {
        const updates = req.body;
        const updatedRoleIds = updates.map(update => update.role_id);

        console.log("To Update:" + updatedRoleIds)
        //Process each role update
        for (const update of updates) {
            //Update the role rates first
            await db.query(`
                UPDATE t_role 
                SET base_hourly_rate = ?, overtime_hourly_rate = ?
                WHERE role_id = ?
            `, [update.base_hourly_rate, update.overtime_hourly_rate, update.role_id]);

            //Get all affected employees
            const [affectedEmployees] = await db.query(`
                SELECT employee_id
                FROM t_employee
                WHERE role_id = ?
                AND (
                    (base_hourly_rate IS NULL OR base_hourly_rate < ?)
                    OR 
                    (overtime_hourly_rate IS NULL OR overtime_hourly_rate < ?)
                )
            `, [
                update.role_id,
                update.base_hourly_rate,
                update.overtime_hourly_rate
            ]);

            //Send notifications to all affected employees
            for (const employee of affectedEmployees) {
            await db.query(`
                INSERT INTO t_notification 
                (employee_id, message, sent_time, notification_type_id)
                VALUES (?, ?,NOW(), ?)
            `, [
                employee.employee_id,
                `Your hourly rates have been updated to R${update.base_hourly_rate} (base) and R${update.overtime_hourly_rate} (overtime)`,
                2 //Payroll
            ]);
            }

            //Update employee rates ONLY if they're LOWER than the new role rates
            await db.query(`
                UPDATE t_employee
                SET 
                    base_hourly_rate = CASE 
                        WHEN base_hourly_rate IS NULL OR base_hourly_rate < ? 
                        THEN ? 
                        ELSE base_hourly_rate 
                    END,
                    overtime_hourly_rate = CASE 
                        WHEN overtime_hourly_rate IS NULL OR overtime_hourly_rate < ? 
                        THEN ? 
                        ELSE overtime_hourly_rate 
                    END
                WHERE role_id = ?
            `, [
                update.base_hourly_rate,     //Compare base rate
                update.base_hourly_rate,     //Set base rate
                update.overtime_hourly_rate, //Compare overtime rate
                update.overtime_hourly_rate, //Set overtime rate
                update.role_id
            ]);
        }

        res.status(200).json({ message: 'Role rates updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

//Get employee rates with role defaults
exports.getEmployeeRates = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                e.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                r.title AS role_title,
                COALESCE(e.base_hourly_rate, r.base_hourly_rate) AS base_hourly_rate,
                COALESCE(e.overtime_hourly_rate, r.overtime_hourly_rate) AS overtime_hourly_rate,
                r.base_hourly_rate AS role_base_rate,
                r.overtime_hourly_rate AS role_overtime_rate,
                e.base_hourly_rate AS employee_base_rate,
                e.overtime_hourly_rate AS employee_overtime_rate
            FROM t_employee e
            INNER JOIN t_role r ON e.role_id = r.role_id
            ORDER BY e.first_name, e.last_name
        `);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

//Update employee rates
exports.updateEmployeeRates = async (req, res) => {
    try {
        const updates = req.body;
        
        for (const update of updates) {
            if (update.base_hourly_rate && update.overtime_hourly_rate && update.employee_id) {
                
                //First, get the current rates for this employee
                const [currentRates] = await db.query(`
                    SELECT 
                        e.base_hourly_rate as current_base,
                        e.overtime_hourly_rate as current_overtime,
                        COALESCE(e.base_hourly_rate, r.base_hourly_rate) as effective_base,
                        COALESCE(e.overtime_hourly_rate, r.overtime_hourly_rate) as effective_overtime
                    FROM t_employee e
                    INNER JOIN t_role r ON e.role_id = r.role_id
                    WHERE e.employee_id = ?
                `, [update.employee_id]);

                if (currentRates.length === 0) {
                    continue; // Skip if employee not found
                }

                const current = currentRates[0];
                
                //Check if rates are actually changing
                const baseRateChanged = parseFloat(current.effective_base) !== parseFloat(update.base_hourly_rate);
                const overtimeRateChanged = parseFloat(current.effective_overtime) !== parseFloat(update.overtime_hourly_rate);
                
                //Only update if rates have changed
                if (baseRateChanged || overtimeRateChanged) {
                    // Update the employee rates
                    await db.query(`
                        UPDATE t_employee 
                        SET base_hourly_rate = ?, overtime_hourly_rate = ?
                        WHERE employee_id = ?
                    `, [update.base_hourly_rate, update.overtime_hourly_rate, update.employee_id]);

                    //Only send notification if rates actually changed
                    await db.query(`
                        INSERT INTO t_notification 
                        (employee_id, message, sent_time, notification_type_id)
                        VALUES (?, ?,NOW(), ?)
                    `, [
                        update.employee_id,
                        `Your hourly rates have been updated to R${update.base_hourly_rate} (base) and R${update.overtime_hourly_rate} (overtime)`,
                        2 //Payroll
                    ]);
                    
                    console.log(`Updated rates for employee ${update.employee_id}: Base ${current.effective_base} -> ${update.base_hourly_rate}, Overtime ${current.effective_overtime} -> ${update.overtime_hourly_rate}`);
                } else {
                    console.log(`No rate changes for employee ${update.employee_id} - skipping notification`);
                }
            }
        }
        res.status(200).json({ message: 'Employee rates updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

async function generatePayroll() {
    try {
        const today = new Date();
        const dayOfWeek = today.getDay();
        
        //Calculate most recent Tuesday (0-6, Sunday=0)
        const daysToSubtract = dayOfWeek >= 2 ? dayOfWeek - 2 : dayOfWeek + 5;
        const paymentDate = new Date(today);
        paymentDate.setDate(today.getDate() - daysToSubtract);
        
        console.log(`Today: ${today.toDateString()} (day ${dayOfWeek})`);
        console.log(`Days to subtract: ${daysToSubtract}`);
        console.log(`Payment date calculated: ${paymentDate.toDateString()}`);

        //Set up date range for payroll period
        let startDateTime, endDateTime;

        //Set end date to Tuesday 11:59:00 AM
        endDateTime = new Date(paymentDate);
        endDateTime.setHours(11, 59, 0, 0); //Tuesday 11:59:00 AM

        //Start date is previous Tuesday 12:00:00 PM
        const previousTuesday = new Date(paymentDate);
        previousTuesday.setDate(paymentDate.getDate() - 7);
        startDateTime = new Date(previousTuesday);
        startDateTime.setHours(12, 0, 0, 0); //Previous Tuesday 12:00:00 PM

        //Format payment date for database
        const paymentDateStr = paymentDate.toISOString().split('T')[0];

        console.log(`Generating payroll for period: ${startDateTime.toISOString()} to ${endDateTime.toISOString()}, payment date: ${paymentDateStr}`);

        //query to include ALL active employees, not just those with shifts
        const payrollQuery = `
            SELECT 
                e.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                r.title AS role_title,
                COALESCE(e.base_hourly_rate, r.base_hourly_rate) AS base_hourly_rate,
                COALESCE(e.overtime_hourly_rate, r.overtime_hourly_rate) AS overtime_hourly_rate,
                
                -- Calculate regular hours based on shift_type = 'normal'
                COALESCE(SUM(CASE 
                    WHEN s.shift_type = 'normal' 
                    THEN CASE
                        WHEN s.end_time < s.start_time 
                        THEN TIMESTAMPDIFF(HOUR, 
                            CONCAT(s.date_, ' ', s.start_time), 
                            CONCAT(DATE_ADD(s.date_, INTERVAL 1 DAY), ' ', s.end_time))
                        ELSE TIMESTAMPDIFF(HOUR, 
                            CONCAT(s.date_, ' ', s.start_time), 
                            CONCAT(s.end_date, ' ', s.end_time))
                    END
                    ELSE 0
                END), 0) AS base_hours,
                
                -- Calculate overtime hours based on shift_type = 'overtime'
                COALESCE(SUM(CASE 
                    WHEN s.shift_type = 'overtime' 
                    THEN CASE
                        WHEN s.end_time < s.start_time 
                        THEN TIMESTAMPDIFF(HOUR, 
                            CONCAT(s.date_, ' ', s.start_time), 
                            CONCAT(DATE_ADD(s.date_, INTERVAL 1 DAY), ' ', s.end_time))
                        ELSE TIMESTAMPDIFF(HOUR, 
                            CONCAT(s.date_, ' ', s.start_time), 
                            CONCAT(s.end_date, ' ', s.end_time))
                    END
                    ELSE 0
                END), 0) AS overtime_hours,
                
                -- Calculate total payment based on shift_type
                COALESCE(SUM(
                    CASE 
                        WHEN s.shift_type = 'normal'
                        THEN CASE
                            WHEN s.end_time < s.start_time 
                            THEN TIMESTAMPDIFF(HOUR, 
                                CONCAT(s.date_, ' ', s.start_time), 
                                CONCAT(DATE_ADD(s.date_, INTERVAL 1 DAY), ' ', s.end_time)) * 
                                COALESCE(e.base_hourly_rate, r.base_hourly_rate)
                            ELSE TIMESTAMPDIFF(HOUR, 
                                CONCAT(s.date_, ' ', s.start_time), 
                                CONCAT(s.end_date, ' ', s.end_time)) * 
                                COALESCE(e.base_hourly_rate, r.base_hourly_rate)
                        END
                        WHEN s.shift_type = 'overtime'
                        THEN CASE
                            WHEN s.end_time < s.start_time 
                            THEN TIMESTAMPDIFF(HOUR, 
                                CONCAT(s.date_, ' ', s.start_time), 
                                CONCAT(DATE_ADD(s.date_, INTERVAL 1 DAY), ' ', s.end_time)) * 
                                COALESCE(e.overtime_hourly_rate, r.overtime_hourly_rate)
                            ELSE TIMESTAMPDIFF(HOUR, 
                                CONCAT(s.date_, ' ', s.start_time), 
                                CONCAT(s.end_date, ' ', s.end_time)) * 
                                COALESCE(e.overtime_hourly_rate, r.overtime_hourly_rate)
                        END
                        ELSE 0
                    END
                ), 0) AS total_amount
                
            FROM t_employee e
            INNER JOIN t_role r ON e.role_id = r.role_id
            LEFT JOIN t_shift s ON e.employee_id = s.employee_id 
                AND s.status_ = 'completed'
                AND (
                    -- Shifts that start on/after Tuesday 12:00:00 PM AND end before next Tuesday 11:59:00 AM
                    (s.date_ >= ? AND s.end_date <= ?)
                    OR
                    -- Shifts that span the period
                    (s.date_ < ? AND s.end_date > ?)
                )
            GROUP BY e.employee_id, e.first_name, e.last_name, r.title, 
                     COALESCE(e.base_hourly_rate, r.base_hourly_rate),
                     COALESCE(e.overtime_hourly_rate, r.overtime_hourly_rate)
            ORDER BY e.first_name, e.last_name;
        `;

        //Parameters using DATETIME format for precise time filtering
        const params = [
            startDateTime.toISOString().slice(0, 19).replace('T', ' '), //YYYY-MM-DD HH:MM:SS
            endDateTime.toISOString().slice(0, 19).replace('T', ' '),
            startDateTime.toISOString().slice(0, 19).replace('T', ' '),
            endDateTime.toISOString().slice(0, 19).replace('T', ' ')
        ];
        
        const [payrollData] = await db.query(payrollQuery, params);

        //Insert into payroll table - Helps Cletus and Yatin
        for (const employee of payrollData) {
            await db.query(`
                INSERT INTO t_payroll 
                    (employee_id, base_hours, overtime_hours, total_amount, _status, payment_date)
                VALUES (?, ?, ?, ?, 'paid', ?)
                ON DUPLICATE KEY UPDATE
                    base_hours = VALUES(base_hours),
                    overtime_hours = VALUES(overtime_hours),
                    total_amount = VALUES(total_amount),
                    _status = VALUES(_status)
            `, [
                employee.employee_id,
                employee.base_hours,
                employee.overtime_hours,
                employee.total_amount,
                paymentDateStr
            ]);
        }

        console.log(`Payroll generated successfully for ${paymentDateStr} - processed ${payrollData.length} employees`);
        
    } catch (err) {
        console.error('Error generating payroll:', err);
    }
}

//Schedule to run every Tuesday at 12:00 PM (noon) to align with payroll period start
cron.schedule('0 12 * * 2', generatePayroll);
//cron.schedule('*/5 * * * * *', generatePayroll);;

//getPaymentDetails function - using payroll table with current rates
exports.getPaymentDetails = async (req, res) => {
    try {
        const { date } = req.query;
        
        //Determine payment date
        let paymentDate;
        
        if (date) {
            paymentDate = date;
        } else {
            //Calculate most recent Tuesday if no date provided
            const today = new Date();
            const dayOfWeek = today.getDay();
            const daysToSubtract = dayOfWeek >= 2 ? dayOfWeek - 2 : dayOfWeek + 5;
            const mostRecentTuesday = new Date(today);
            mostRecentTuesday.setDate(today.getDate() - daysToSubtract);
            paymentDate = mostRecentTuesday.toISOString().split('T')[0];
        }

        //Query the payroll table with current employee rates for display
        const query = `
            SELECT 
                p.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                r.title AS role_title,
                p.base_hours AS regular_hours,
                p.overtime_hours,
                p.total_amount,
                DATE_FORMAT(p.payment_date, '%d-%m-%Y') AS payment_date,
                COALESCE(e.base_hourly_rate, r.base_hourly_rate) AS base_hourly_rate,
                COALESCE(e.overtime_hourly_rate, r.overtime_hourly_rate) AS overtime_hourly_rate
            FROM t_payroll p
            INNER JOIN t_employee e ON p.employee_id = e.employee_id
            INNER JOIN t_role r ON e.role_id = r.role_id
            WHERE p.payment_date = ?
            AND p._status = 'paid'
            ORDER BY p.total_amount DESC;
        `;
        
        const [rows] = await db.query(query, [paymentDate]);
        
        console.log(`Retrieved payroll details for payment date: ${paymentDate}`);
        console.log(rows);

        res.status(200).json(rows);
        
    } catch (err) {
        console.error('Error in getPaymentDetails:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getPayrollSummary = async (req, res) => {
    try {
        const { date } = req.query;
        let paymentDate;

        if (date) {
            paymentDate = date;
        } else {
            //Calculate most recent Tuesday if no date provided
            const today = new Date();
            const dayOfWeek = today.getDay();
            const daysToSubtract = dayOfWeek >= 2 ? dayOfWeek - 2 : dayOfWeek + 5;
            const mostRecentTuesday = new Date(today);
            mostRecentTuesday.setDate(today.getDate() - daysToSubtract);
            paymentDate = mostRecentTuesday.toISOString().split('T')[0];
        }

        //Query the payroll table for summary data
        const query = `
            SELECT 
                COUNT(p.employee_id) AS employeesPaid,
                COALESCE(SUM(p.total_amount), 0) AS totalBudgetUsed,
                50000 AS totalBudget,
                ? AS paymentDate
            FROM t_payroll p
            WHERE p.payment_date = ?
            AND p._status = 'paid';
        `;

        const [rows] = await db.query(query, [paymentDate, paymentDate]);

        if (rows.length === 0) {
            return res.status(200).json({
                employeesPaid: 0,
                totalBudgetUsed: 0,
                totalBudget: 50000,
                paymentDate: paymentDate
            });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error in getPayrollSummary:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

//Updated getPaymentDates function to use payroll table
exports.getPaymentDates = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT DISTINCT payment_date
            FROM t_payroll
            WHERE _status = 'paid'
            ORDER BY payment_date DESC
        `);
        
        //Transform to match expected format
        const paymentDates = rows.map(row => ({
            payment_date: row.payment_date
        }));
        
        res.status(200).json(paymentDates);
    } catch (err) {
        console.error('Error in getPaymentDates:', err);
        res.status(500).json({ message: 'Server error' });
    }
};