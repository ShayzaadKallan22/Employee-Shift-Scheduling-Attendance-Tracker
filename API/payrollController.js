//AUTHOR - SHAYZAAD

const cron = require('node-cron');
const db = require('./db');

const BUDGET_ADJUSTMENT_FACTOR = 0.5; //Aggresiveness
const MIN_BUDGET = 10000; //Minimum budget to prevent going too low
const MAX_BUDGET = 130000; //Maximum budget cap


async function adjustBudgetForNextPeriod(currentPaymentDate, actualSpend) {
    try {
        const MIN_BUDGET = 10000;  //Minimum allowed budget (R10,000)
        const MAX_BUDGET = 130000;  //Maximum allowed budget (R100,000)
        const BUFFER_PERCENTAGE = 0.2; //20% buffer above/below actual spend
        
        //Ensure actualSpend is a proper number
        const cleanActualSpend = parseFloat(actualSpend) || 0;
        
        //Calculate next payment date
        const nextPaymentDate = new Date(currentPaymentDate);
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
        const nextPaymentDateStr = nextPaymentDate.toISOString().split('T')[0];
        
        //Get current budget (default to R10,000 if not found)
        const [currentBudgetRow] = await db.query(`
            SELECT adjusted_budget FROM t_budget_history 
            WHERE payment_date = ?
            ORDER BY created_at DESC
            LIMIT 1
        `, [currentPaymentDate]);
        
        const currentBudget = currentBudgetRow.length > 0 
            ? parseFloat(currentBudgetRow[0].adjusted_budget) || 10000
            : 10000;

        //Calculate new budget
        let newBudget;
        let adjustmentReason;
        
        if (cleanActualSpend > currentBudget) {
            //Case 1: Budget was exceeded
            //Set new budget to actual spend + 20% buffer
            const overage = cleanActualSpend - currentBudget;
            const buffer = overage * BUFFER_PERCENTAGE;
            newBudget = cleanActualSpend + buffer;
            adjustmentReason = `Exceeded by R${overage.toFixed(2)}, added ${(BUFFER_PERCENTAGE * 100)}% buffer`;
            
            console.log(`Budget exceeded by R${overage.toFixed(2)}. Setting new budget to actual spend (R${cleanActualSpend.toFixed(2)}) + ${(BUFFER_PERCENTAGE * 100)}% buffer (R${buffer.toFixed(2)})`);
            
        } else if (cleanActualSpend < currentBudget) {
            //Case 2: Budget wasn't fully used
            //Reduce budget but maintain a buffer above actual spend
            const underage = currentBudget - cleanActualSpend;
            const buffer = underage * BUFFER_PERCENTAGE;
            
            //New budget = actual spend + a portion of the underage as buffer
            newBudget = cleanActualSpend + buffer;
            adjustmentReason = `Under budget by R${underage.toFixed(2)}, reduced with ${(BUFFER_PERCENTAGE * 100)}% buffer`;
            
            console.log(`Budget under by R${underage.toFixed(2)}. Setting new budget to actual spend (R${cleanActualSpend.toFixed(2)}) + ${(BUFFER_PERCENTAGE * 100)}% buffer (R${buffer.toFixed(2)})`);
            
        } else {
            //Case 3: Exactly on budget (rare)
            //Keep similar budget with small buffer
            newBudget = cleanActualSpend * (1 + BUFFER_PERCENTAGE);
            adjustmentReason = `Exactly on budget, maintained with ${(BUFFER_PERCENTAGE * 100)}% buffer`;
            
            console.log(`Exactly on budget. Maintaining with ${(BUFFER_PERCENTAGE * 100)}% buffer`);
        }
        
        //Apply constraints
        newBudget = Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, newBudget));
        
        //Round to nearest R1000
        newBudget = Math.round(newBudget / 1000) * 1000;
        
        //Ensure newBudget is valid
        if (isNaN(newBudget) || newBudget < MIN_BUDGET) {
            newBudget = MIN_BUDGET;
            adjustmentReason = 'Fallback to minimum budget';
        }
        
        //Insert the new budget record
        await db.query(`
            INSERT INTO t_budget_history 
            (payment_date, initial_budget, actual_spend, adjusted_budget, adjustment_reason)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                initial_budget = VALUES(initial_budget),
                actual_spend = VALUES(actual_spend),
                adjusted_budget = VALUES(adjusted_budget),
                adjustment_reason = VALUES(adjustment_reason)
        `, [
            nextPaymentDateStr,
            currentBudget,
            cleanActualSpend,
            newBudget,
            adjustmentReason
        ]);
        
        console.log(`Budget adjusted: R${currentBudget.toFixed(2)} -> R${newBudget.toFixed(2)} (Actual spend: R${cleanActualSpend.toFixed(2)})`);
        console.log(`Reason: ${adjustmentReason}`);
        
        return newBudget;
    } catch (err) {
        console.error('Error adjusting budget:', err);
        return 10000; //Fallback to default
    }
}

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
        //Get current date in South Africa timezone (SAST - UTC+2)
        const today = new Date();
        const saToday = new Date(today.toLocaleString("en-US", {timeZone: "Africa/Johannesburg"}));
        const dayOfWeek = saToday.getDay();
        
        //Calculate most recent Tuesday (0-6, Sunday=0)
        const daysToSubtract = dayOfWeek >= 2 ? dayOfWeek - 2 : dayOfWeek + 5;
        const paymentDate = new Date(saToday);
        paymentDate.setDate(saToday.getDate() - daysToSubtract);
        
        console.log(`Today (SA Time): ${saToday.toDateString()} (day ${dayOfWeek})`);
        console.log(`Days to subtract: ${daysToSubtract}`);
        console.log(`Payment date calculated: ${paymentDate.toDateString()}`);

        //Set up date range for payroll period using SA timezone
        let startDateTime, endDateTime;

        //Set end date to Tuesday 11:59:00 AM (SA Time)
        endDateTime = new Date(paymentDate);
        endDateTime.setHours(11, 59, 0, 0); //Tuesday 11:59:00 AM SA Time

        //Start date is previous Tuesday 12:00:00 PM (SA Time)
        const previousTuesday = new Date(paymentDate);
        previousTuesday.setDate(paymentDate.getDate() - 7);
        startDateTime = new Date(previousTuesday);
        startDateTime.setHours(12, 0, 0, 0); //Previous Tuesday 12:00:00 PM SA Time

        //Format payment date for database (SA timezone)
        const paymentDateStr = paymentDate.toLocaleDateString('en-CA', {timeZone: 'Africa/Johannesburg'}); // YYYY-MM-DD format

        console.log(`Generating payroll for period (SA Time): ${startDateTime.toLocaleString('en-ZA', {timeZone: 'Africa/Johannesburg'})} to ${endDateTime.toLocaleString('en-ZA', {timeZone: 'Africa/Johannesburg'})}, payment date: ${paymentDateStr}`);

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

        //Parameters using DATETIME format for precise time filtering (in SA timezone)
        //Convert SA time to UTC for database storage if needed, or keep as SA time if database is configured for SA timezone
        const startDateTimeStr = startDateTime.toLocaleString('sv-SE', {timeZone: 'Africa/Johannesburg'}).replace(' ', ' '); // YYYY-MM-DD HH:MM:SS format
        const endDateTimeStr = endDateTime.toLocaleString('sv-SE', {timeZone: 'Africa/Johannesburg'}).replace(' ', ' ');
        
        const params = [
            startDateTimeStr,
            endDateTimeStr,
            startDateTimeStr,
            endDateTimeStr
        ];
        
        const [payrollData] = await db.query(payrollQuery, params);

        //Insert into payroll table WITH historical rates stored
        for (const employee of payrollData) {
            await db.query(`
                INSERT INTO t_payroll 
                    (employee_id, base_hours, overtime_hours, total_amount, _status, payment_date,
                     base_hourly_rate_used, overtime_hourly_rate_used, role_title_snapshot, employee_name_snapshot)
                VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    base_hours = VALUES(base_hours),
                    overtime_hours = VALUES(overtime_hours),
                    total_amount = VALUES(total_amount),
                    _status = VALUES(_status),
                    base_hourly_rate_used = VALUES(base_hourly_rate_used),
                    overtime_hourly_rate_used = VALUES(overtime_hourly_rate_used),
                    role_title_snapshot = VALUES(role_title_snapshot),
                    employee_name_snapshot = VALUES(employee_name_snapshot)
            `, [
                employee.employee_id,
                employee.base_hours,
                employee.overtime_hours,
                employee.total_amount,
                paymentDateStr,
                employee.base_hourly_rate,    //Store the actual rate used for this payroll period
                employee.overtime_hourly_rate, //Store the actual rate used for this payroll period
                employee.role_title,          //Store role title at time of payment
                employee.employee_name        //Store employee name at time of payment
            ]);
        }

        //Calculate total payroll amount with proper number conversion
        const totalPayroll = payrollData.reduce((sum, emp) => {
            return sum + (parseFloat(emp.total_amount) || 0);
        }, 0);
        
        //Adjust budget for next period automatically
        await adjustBudgetForNextPeriod(paymentDateStr, totalPayroll);
        
        console.log(`Payroll generated successfully for ${paymentDateStr} - processed ${payrollData.length} employees, total: R${totalPayroll.toFixed(2)}`);
        
    } catch (err) {
        console.error('Error generating payroll:', err);
    }
}

//Schedule to run every Tuesday at 12:00 PM (noon) to align with payroll period start
cron.schedule('0 12 * * 2', generatePayroll);
//cron.schedule('*/5 * * * * *', generatePayroll);

//getPaymentDetails function - using payroll table with historical rates stored during payroll generation
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

        //Query the payroll table using stored historical rates instead of current rates
        const query = `
            SELECT 
                p.employee_id,
                COALESCE(p.employee_name_snapshot, CONCAT(e.first_name, ' ', e.last_name)) AS employee_name,
                COALESCE(p.role_title_snapshot, r.title) AS role_title,
                p.base_hours AS regular_hours,
                p.overtime_hours,
                p.total_amount,
                DATE_FORMAT(p.payment_date, '%d-%m-%Y') AS payment_date,
                COALESCE(p.base_hourly_rate_used, COALESCE(e.base_hourly_rate, r.base_hourly_rate)) AS base_hourly_rate,
                COALESCE(p.overtime_hourly_rate_used, COALESCE(e.overtime_hourly_rate, r.overtime_hourly_rate)) AS overtime_hourly_rate
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

//getPayrollSummary to use the budget history table
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

        //Get the budget for this period
        const [budgetRows] = await db.query(`
            SELECT adjusted_budget 
            FROM t_budget_history 
            WHERE payment_date = ?
            ORDER BY created_at DESC
            LIMIT 1
        `, [paymentDate]);

        const budget = budgetRows.length > 0 ? budgetRows[0].adjusted_budget : 10000;

        //Query the payroll table for summary data
        const query = `
            SELECT 
                COUNT(p.employee_id) AS employeesPaid,
                COALESCE(SUM(p.total_amount), 0) AS totalBudgetUsed,
                ? AS totalBudget,
                ? AS paymentDate
            FROM t_payroll p
            WHERE p.payment_date = ?
            AND p._status = 'paid';
        `;

        const [rows] = await db.query(query, [budget, paymentDate, paymentDate]);

        if (rows.length === 0) {
            return res.status(200).json({
                employeesPaid: 0,
                totalBudgetUsed: 0,
                totalBudget: budget,
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

//Get budget for specific date
exports.getBudgetForDate = async (req, res) => {
    try {
        const { date } = req.query;
        
        const [rows] = await db.query(`
            SELECT adjusted_budget AS budget
            FROM t_budget_history
            WHERE payment_date = ?
            ORDER BY created_at DESC
            LIMIT 1
        `, [date]);
        
        //Ensure budget is never negative
        const budget = rows.length > 0 
            ? Math.max(10000, rows[0].budget) //Minimum R10,000
            : 10000; //Default
         
        res.status(200).json({ budget });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getBudgetComparison = async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ message: 'Date parameter required' });
        }
        
        //Calculate previous payment date (7 days earlier)
        const currentDate = new Date(date);
        const previousDate = new Date(currentDate);
        previousDate.setDate(currentDate.getDate() - 7);
        const previousDateStr = previousDate.toISOString().split('T')[0];
        
        //Get current week's budget data
        const [currentBudgetRows] = await db.query(`
            SELECT 
                adjusted_budget as current_budget,
                initial_budget,
                actual_spend,
                adjustment_reason,
                created_at
            FROM t_budget_history 
            WHERE payment_date = ?
            ORDER BY created_at DESC
            LIMIT 1
        `, [date]);
        
        //Get previous week's budget data
        const [previousBudgetRows] = await db.query(`
            SELECT 
                adjusted_budget as previous_budget,
                actual_spend as previous_spend
            FROM t_budget_history 
            WHERE payment_date = ?
            ORDER BY created_at DESC
            LIMIT 1
        `, [previousDateStr]);
        
        //If no current budget data, return default response
        if (currentBudgetRows.length === 0) {
            return res.status(200).json({
                currentBudget: 10000,
                previousBudget: 10000,
                adjustment: 0,
                adjustmentPercentage: 0,
                adjustmentReason: 'No budget history available',
                hasAdjustment: false,
                currentDate: date,
                previousDate: previousDateStr
            });
        }
        
        const currentBudget = parseFloat(currentBudgetRows[0].current_budget) || 10000;
        const previousBudget = previousBudgetRows.length > 0 
            ? parseFloat(previousBudgetRows[0].previous_budget) || 10000 
            : 10000;
        
        //Calculate adjustment
        const adjustment = currentBudget - previousBudget;
        const adjustmentPercentage = previousBudget > 0 
            ? (adjustment / previousBudget) * 100 
            : 0;
        
        //Determine if there was a meaningful adjustment (more than R100 change)
        const hasAdjustment = Math.abs(adjustment) > 100;
        
        const response = {
            currentBudget: currentBudget,
            previousBudget: previousBudget,
            adjustment: adjustment,
            adjustmentPercentage: adjustmentPercentage,
            adjustmentReason: currentBudgetRows[0].adjustment_reason || 'No reason provided',
            hasAdjustment: hasAdjustment,
            currentDate: date,
            previousDate: previousDateStr,
            //Additional details for debugging/logging
            currentSpend: parseFloat(currentBudgetRows[0].actual_spend) || 0,
            previousSpend: previousBudgetRows.length > 0 
                ? parseFloat(previousBudgetRows[0].previous_spend) || 0 
                : 0,
            initialBudget: parseFloat(currentBudgetRows[0].initial_budget) || currentBudget
        };
        
        res.status(200).json(response);
        
    } catch (err) {
        console.error('Error in getBudgetComparison:', err);
        res.status(500).json({ 
            message: 'Server error',
            currentBudget: 10000,
            previousBudget: 10000,
            adjustment: 0,
            adjustmentPercentage: 0,
            adjustmentReason: 'Error loading budget comparison',
            hasAdjustment: false
        });
    }
};