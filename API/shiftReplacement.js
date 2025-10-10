//AUTHOR: SHAYZAAD KALLAN

const db = require('./db');
const cron = require('node-cron');

//Main function to handle shift replacements
async function handleShiftReplacements() {
    try {
        console.log('Checking for new shift cancellations...');
        
        //Get all pending/approved cancellations that haven't been processed (processed = 0)
        const [cancellations] = await db.query(`
            SELECT 
                sc.cancellation_id,
                sc.shift_id,
                sc.employee_id as cancelled_employee_id,
                sc.status_,
                s.shift_type,
                s.start_time,
                s.end_time,
                s.date_,
                s.end_date,
                s.schedule_id,
                e.role_id,
                r.title as role_title
            FROM t_shift_cancellations sc
            INNER JOIN t_shift s ON sc.shift_id = s.shift_id
            INNER JOIN t_employee e ON sc.employee_id = e.employee_id
            INNER JOIN t_role r ON e.role_id = r.role_id
            WHERE sc.status_ IN ('pending', 'approved') 
            AND sc.processed = 0
        `);

        console.log(`Found ${cancellations.length} new approved cancellations to process`);

        for (const cancellation of cancellations) {
            await processShiftReplacement(cancellation);
        }

    } catch (error) {
        console.error('Error in handleShiftReplacements:', error);
    }
}

//Process individual shift replacement
async function processShiftReplacement(cancellation) {
    try {
        const {
            cancellation_id,
            shift_id,
            cancelled_employee_id,
            role_id,
            role_title,
            shift_type,
            start_time,
            end_time,
            date_,
            end_date,
            schedule_id
        } = cancellation;

        const currentDate = new Date(date_).toLocaleDateString('en-ZA', 
        {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        console.log(`Processing cancellation ${cancellation_id} for shift ${shift_id}`);

        //Mark the original shift as "missed"
        const [originalEmployee] = await db.query(`
            SELECT first_name, last_name 
            FROM t_employee 
            WHERE employee_id = ?
        `, [cancelled_employee_id]);
        
        await db.query(`
            UPDATE t_shift 
            SET status_ = 'missed' 
            WHERE shift_id = ?
        `, [shift_id]);

        //Find all available standby employees with same role
        const [standbyEmployees] = await db.query(`
            SELECT 
                employee_id,
                first_name,
                last_name,
                email,
                phone_number
            FROM t_employee 
            WHERE role_id = ? 
            AND standby = 'standby' 
            AND status_ = 'Not Working'
            AND employee_id != ?
            ORDER BY employee_id
        `, [role_id, cancelled_employee_id]);

        if (standbyEmployees.length === 0) {
            console.log(`No available standby employee found for role: ${role_title}`);
            
            //Send notification to manager about no standby available
            await sendManagerNotification(
                `Shift Replacement Failed: No standby employee available for cancelled ${role_title} shift on ${currentDate} at ${start_time}. Contingency plan required`
            );
            
            //Mark as processed even if no replacement found
            await markCancellationAsProcessed(cancellation_id);
            return;
        }

        //Try each standby employee until we find one without conflicts
        let replacementEmployee = null;
        let employeeFound = false;

        for (const employee of standbyEmployees) {
            console.log(`Checking replacement candidate: ${employee.first_name} ${employee.last_name}`);

            //Check if this employee already has a shift at the same time
            const [conflictingShifts] = await db.query(`
                SELECT shift_id 
                FROM t_shift 
                WHERE employee_id = ? 
                AND date_ = ? 
                AND (
                    (start_time <= ? AND end_time > ?) OR
                    (start_time < ? AND end_time >= ?) OR
                    (start_time >= ? AND end_time <= ?)
                )
                AND status_ IN ('scheduled', 'completed')
            `, [
                employee.employee_id,
                date_,
                start_time, start_time,
                end_time, end_time,
                start_time, end_time
            ]);

            if (conflictingShifts.length === 0) {
                replacementEmployee = employee;
                employeeFound = true;
                console.log(`Found available replacement: ${employee.first_name} ${employee.last_name}`);
                break;
            } else {
                console.log(`${employee.first_name} ${employee.last_name} has conflicting shift, trying next candidate...`);
            }
        }

        if (!employeeFound) {
            console.log(`All standby employees for role ${role_title} have conflicting shifts`);
            
            //Send notification to manager about all employees having conflicts
            await sendManagerNotification(
                `Shift Replacement Failed: All standby ${role_title} employees have conflicting shifts for cancelled shift on ${currentDate} at ${start_time}. Contingency plan required`
            );
            
            //Mark as processed since we've exhausted all options
            await markCancellationAsProcessed(cancellation_id);
            return;
        }

        //Create new shift for replacement employee
        const [newShiftResult] = await db.query(`
            INSERT INTO t_shift (
                shift_type,
                start_time,
                end_time,
                date_,
                end_date,
                status_,
                employee_id,
                schedule_id,
                created_at,
                updated_at,
                is_replacement
            ) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, NOW(), NOW(), 1)
        `, [
            shift_type,
            start_time,
            end_time,
            date_,
            end_date,
            replacementEmployee.employee_id,
            schedule_id
        ]);

        const newShiftId = newShiftResult.insertId;
        console.log(`Created new shift ${newShiftId} for replacement employee`);

        //Send notification to replacement employee
        const notificationMessage = `You have been assigned a replacement shift for ${role_title} on ${currentDate} from ${start_time} to ${end_time} due to a missed shift. Be there within the hour, see you soon!`;
        
        await db.query(`
            INSERT INTO t_notification (
                employee_id,
                message,
                sent_time,
                read_status,
                notification_type_id
            ) VALUES (?, ?, NOW(), 'unread', 3)
        `, [replacementEmployee.employee_id, notificationMessage]);

        //Send confirmation notification to manager
        await sendManagerNotification(
            `${replacementEmployee.first_name} ${replacementEmployee.last_name}: Is filling in for a missed shift by ${originalEmployee[0].first_name} ${originalEmployee[0].last_name} (${role_title}) on ${currentDate} at ${start_time}`
        );

        //Mark cancellation as processed in database
        await markCancellationAsProcessed(cancellation_id);

        console.log(`Successfully processed shift replacement for cancellation ${cancellation_id}`);

    } catch (error) {
        console.error(`Error processing shift replacement for cancellation ${cancellation.cancellation_id}:`, error);
    }
}

//Mark cancellation as processed in database
async function markCancellationAsProcessed(cancellation_id) {
    try {
        await db.query(`
            UPDATE t_shift_cancellations 
            SET processed = 1 
            WHERE cancellation_id = ?
        `, [cancellation_id]);
        
        console.log(`Marked cancellation ${cancellation_id} as processed`);
    } catch (error) {
        console.error(`Error marking cancellation ${cancellation_id} as processed:`, error);
    }
}

//Send notification to all managers
async function sendManagerNotification(message) {
    try {
        const [managers] = await db.query(`
            SELECT employee_id 
            FROM t_employee 
            WHERE type_ = 'manager'
        `);

        for (const manager of managers) {
            await db.query(`
                INSERT INTO t_notification (
                    employee_id,
                    message,
                    sent_time,
                    read_status,
                    notification_type_id
                ) VALUES (?, ?, NOW(), 'unread', 4)
            `, [manager.employee_id, message]);
        }

        console.log(`Manager notification sent: ${message}`);
    } catch (error) {
        console.error('Error sending manager notification:', error);
    }
}

//Function to manually trigger shift replacement check (for testing)
async function triggerShiftReplacementCheck() {
    console.log('Manually triggering shift replacement check...');
    await handleShiftReplacements();
}

//Export functions for use in webService.js
module.exports = {
    handleShiftReplacements,
    triggerShiftReplacementCheck
};
