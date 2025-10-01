//AUTHOR: SHAYZAAD KALLAN

const db = require('./db');

class MonthlyShiftScheduler {
    constructor() {
        this.SHIFT_START_TIME = '17:00:00';
        this.SHIFT_END_TIME = '02:00:00';
        this.EMPLOYEES_PER_ROLE = 2; //2 employees from each role work per week
    }

    /**
     * Main function to create shifts for the upcoming month
     */
    async createMonthlyShifts() {
        try {
            console.log('Starting monthly shift creation...');
            
            //Get the first Friday of next month
            const nextMonthFirstFriday = this.getNextMonthFirstFriday();
            console.log(`Creating shifts for month starting: ${nextMonthFirstFriday.toDateString()}`);

            //Get all Fridays in the month
            const monthFridays = this.getAllFridaysInMonth(nextMonthFirstFriday);
            console.log(`Found ${monthFridays.length} work weeks in the month`);

            //Get or create schedule for this month
            const scheduleId = await this.getOrCreateMonthlySchedule(nextMonthFirstFriday);
            
            //Get all roles and their employees
            const roleEmployees = await this.getEmployeesByRole();
            console.log(`Found employees across ${roleEmployees.length} roles`);

            //Create shifts for each week in the month
            for (let weekIndex = 0; weekIndex < monthFridays.length; weekIndex++) {
                const weekStartFriday = monthFridays[weekIndex];
                console.log(`\n--- Processing Week ${weekIndex + 1} starting ${weekStartFriday.toDateString()} ---`);

                //Select working employees for this specific week
                const workingEmployees = await this.selectWorkingEmployeesForWeek(
                    roleEmployees, weekStartFriday, weekIndex, monthFridays.length
                );
                console.log(`${workingEmployees.length} employees scheduled to work this week`);

                //Create shifts for working employees
                await this.createShiftsForEmployees(workingEmployees, scheduleId, weekStartFriday);
            }

            console.log('Monthly shift creation completed successfully');
            
        } catch (error) {
            console.error('Error in createMonthlyShifts:', error);
            throw error;
        }
    }

    /**
     * Weekly standby update - called every week to rotate standby status
     */
    async updateWeeklyStandbyStatus() {
        try {
            console.log('Starting weekly standby status update...');
            
            //Get the current or next Friday
            const currentFriday = this.getCurrentWeekFriday();
            console.log(`Updating standby for week starting: ${currentFriday.toDateString()}`);

            //Get all roles and their employees
            const roleEmployees = await this.getEmployeesByRole();

            //Get employees scheduled to work this week
            const workingEmployees = await this.getWorkingEmployeesForWeek(currentFriday);
            console.log(`${workingEmployees.length} employees are working this week`);

            //Update standby status
            await this.updateStandbyStatus(roleEmployees, workingEmployees);

            console.log('Weekly standby status update completed successfully');
            
        } catch (error) {
            console.error('Error in updateWeeklyStandbyStatus:', error);
            throw error;
        }
    }

    /**
     * Get the first Friday of next month
     */
    getNextMonthFirstFriday() {
        const today = new Date();
        
        //Get first day of next month
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        
        //Find the first Friday of next month
        let firstFriday = new Date(nextMonth);
        while (firstFriday.getDay() !== 5) { //5 is Friday
            firstFriday.setDate(firstFriday.getDate() + 1);
        }
        
        firstFriday.setHours(0, 0, 0, 0);
        return firstFriday;
    }

    /**
     * Get current week's Friday (for standby updates)
     */
    getCurrentWeekFriday() {
        const today = new Date();
        
        //Find this week's Friday
        let weekFriday = new Date(today);
        const daysToFriday = (5 + 7 - today.getDay()) % 7;
        
        if (daysToFriday === 0 && today.getHours() >= 17) {
            //It's Friday after 5 PM, get next Friday
            weekFriday.setDate(today.getDate() + 7);
        } else if (daysToFriday === 0) {
            //It's Friday before 5 PM, use today
            weekFriday = new Date(today);
        } else {
            //Get this week's Friday
            weekFriday.setDate(today.getDate() + daysToFriday);
        }
        
        weekFriday.setHours(0, 0, 0, 0);
        return weekFriday;
    }

    /**
     * Get all Fridays in the month starting from the given Friday
     */
    getAllFridaysInMonth(firstFriday) {
        const fridays = [];
        const currentMonth = firstFriday.getMonth();
        
        let currentFriday = new Date(firstFriday);
        
        while (currentFriday.getMonth() === currentMonth) {
            fridays.push(new Date(currentFriday));
            currentFriday.setDate(currentFriday.getDate() + 7);
        }
        
        return fridays;
    }

    /**
     * Get or create a monthly schedule
     */
    async getOrCreateMonthlySchedule(firstFriday) {
        //Calculate end date (end of month + 4 days for last Monday night shift)
        const lastDayOfMonth = new Date(firstFriday.getFullYear(), firstFriday.getMonth() + 1, 0);
        const endDate = new Date(lastDayOfMonth);
        endDate.setDate(lastDayOfMonth.getDate() + 4); //Add 4 days for last Monday shift
        endDate.setHours(23, 59, 59, 999);

        try {
            //Check if schedule already exists for this month
            const [existingSchedule] = await db.query(
                `SELECT schedule_id FROM t_schedule 
                 WHERE YEAR(period_start_date) = ? AND MONTH(period_start_date) = ?`,
                [firstFriday.getFullYear(), firstFriday.getMonth() + 1]
            );

            if (existingSchedule.length > 0) {
                console.log(`Using existing monthly schedule: ${existingSchedule[0].schedule_id}`);
                return existingSchedule[0].schedule_id;
            }

            //Create new monthly schedule
            const [result] = await db.query(
                `INSERT INTO t_schedule (period_start_date, period_end_date) 
                 VALUES (?, ?)`,
                [firstFriday, endDate]
            );

            console.log(`Created new monthly schedule: ${result.insertId}`);
            return result.insertId;

        } catch (error) {
            console.error('Error in getOrCreateMonthlySchedule:', error);
            throw error;
        }
    }

    /**
     * Get employees grouped by their roles
     */
    async getEmployeesByRole() {
        try {
            const [employees] = await db.query(`
                SELECT 
                    e.employee_id,
                    e.first_name,
                    e.last_name,
                    e.status_,
                    e.type_,
                    e.role_id,
                    r.title as role_title
                FROM t_employee e
                JOIN t_role r ON e.role_id = r.role_id
                WHERE e.type_ = 'employee' 
                AND e.status_ IN ('Working', 'Not Working')
                AND e.role_id != 7
                ORDER BY r.title, e.employee_id
            `);

            //Group employees by role
            const roleGroups = {};
            employees.forEach(emp => {
                if (!roleGroups[emp.role_id]) {
                    roleGroups[emp.role_id] = {
                        role_id: emp.role_id,
                        role_title: emp.role_title,
                        employees: []
                    };
                }
                roleGroups[emp.role_id].employees.push(emp);
            });

            return Object.values(roleGroups);
        } catch (error) {
            console.error('Error getting employees by role:', error);
            throw error;
        }
    }

    /**
     * Select employees from each role to work for a specific week in the month
     */
    async selectWorkingEmployeesForWeek(roleEmployees, weekStartFriday, weekIndex, totalWeeks) {
        const workingEmployees = [];

        for (const roleGroup of roleEmployees) {
            console.log(`Processing role: ${roleGroup.role_title} (${roleGroup.employees.length} total employees)`);
            
            //Filter out employees on leave
            const availableEmployees = [];
            for (const employee of roleGroup.employees) {
                const isOnLeave = await this.isEmployeeOnLeave(employee.employee_id, weekStartFriday);
                if (!isOnLeave) {
                    availableEmployees.push(employee);
                } else {
                    console.log(`  ${employee.first_name} ${employee.last_name} is on leave - skipping`);
                }
            }

            console.log(`  Available employees: ${availableEmployees.length}`);

            if (availableEmployees.length === 0) {
                console.warn(`  Warning: No available employees for role ${roleGroup.role_title}`);
                continue;
            }

            //Determine how many employees from this role should work
            const employeesToSelect = this.calculateEmployeesToSelect(availableEmployees.length);
            console.log(`  Will select ${employeesToSelect} employees from this role`);

            //Select employees who should work this specific week
            const selectedEmployees = await this.selectEmployeesForSpecificWeek(
                availableEmployees, weekStartFriday, weekIndex, totalWeeks, employeesToSelect
            );
            
            console.log(`  Selected ${selectedEmployees.length} employees: ${selectedEmployees.map(e => `${e.first_name} ${e.last_name}`).join(', ')}`);
            workingEmployees.push(...selectedEmployees);
        }

        return workingEmployees;
    }

    /**
     * Get employees who are scheduled to work for a specific week (for standby updates)
     */
    async getWorkingEmployeesForWeek(weekStartFriday) {
        try {
            const weekEndMonday = new Date(weekStartFriday);
            weekEndMonday.setDate(weekStartFriday.getDate() + 3); //Friday + 3 = Monday

            const [workingEmployees] = await db.query(`
                SELECT DISTINCT s.employee_id, e.first_name, e.last_name, e.role_id
                FROM t_shift s
                JOIN t_employee e ON s.employee_id = e.employee_id
                WHERE s.date_ >= ? AND s.date_ <= ?
                AND s.status_ = 'scheduled'
            `, [weekStartFriday, weekEndMonday]);

            return workingEmployees;
        } catch (error) {
            console.error('Error getting working employees for week:', error);
            return [];
        }
    }

    /**
     * Calculate how many employees should be selected from a role based on available count
     */
    calculateEmployeesToSelect(availableCount) {
        if (availableCount === 0) return 0;
        if (availableCount === 1) return 1; //Only one available, must work
        if (availableCount === 2) return 1; //Two available, alternate (1 works, 1 on standby)
        if (availableCount === 3) return 2; //Three available, 2 work, 1 on standby  
        if (availableCount >= 4) {
            //For 4+, aim for roughly half working, but ensure alternation
            return Math.ceil(availableCount / 2);
        }
        
        return Math.min(this.EMPLOYEES_PER_ROLE, availableCount);
    }

    /**
     * Select which employees from a role should work for a specific week in the month
     */
    async selectEmployeesForSpecificWeek(availableEmployees, weekStartFriday, weekIndex, totalWeeks, employeesToSelect) {
        if (availableEmployees.length === 0 || employeesToSelect === 0) return [];
        
        const selectedEmployees = [];

        //Sort employees by ID for consistent selection
        availableEmployees.sort((a, b) => a.employee_id - b.employee_id);

        //Get employees who worked in the last 2 weeks (from previous month)
        //const recentWorkers = await this.getRecentWorkers(availableEmployees, weekStartFriday);
        //console.log(`    Recent workers: ${recentWorkers.length} employees`);
        
        //Strategy depends on how many we need vs how many are available
        if (availableEmployees.length <= 2) {
            //Simple alternation for small groups
            const startIndex = weekIndex % availableEmployees.length;
            for (let i = 0; i < employeesToSelect; i++) {
                const index = (startIndex + i) % availableEmployees.length;
                selectedEmployees.push(availableEmployees[index]);
            }
        } else {
            //For larger groups, use round-robin distribution across the month
            //This ensures fair distribution over the entire month
            const startIndex = weekIndex % availableEmployees.length;
            
            for (let i = 0; i < employeesToSelect; i++) {
                const index = (startIndex + i) % availableEmployees.length;
                selectedEmployees.push(availableEmployees[index]);
            }
        }

        return selectedEmployees;
    }

    /**
     * Get employees who worked in the last 2 weeks (from previous month)
     */
    async getRecentWorkers(employees, weekStartFriday) {
        if (employees.length === 0) return [];

        const twoWeeksAgo = new Date(weekStartFriday);
        twoWeeksAgo.setDate(weekStartFriday.getDate() - 14);

        const employeeIds = employees.map(emp => emp.employee_id);
        const placeholders = employeeIds.map(() => '?').join(',');

        const [recentShifts] = await db.query(`
            SELECT DISTINCT s.employee_id
            FROM t_shift s
            INNER JOIN t_schedule sc ON s.schedule_id = sc.schedule_id
            WHERE s.employee_id IN (${placeholders})
            AND sc.period_start_date >= ?
            AND sc.period_start_date < ?
        `, [...employeeIds, twoWeeksAgo, weekStartFriday]);

        return recentShifts.map(row => row.employee_id);
    }

    /**
     * Check if employee is on approved leave during the shift week
     */
    async isEmployeeOnLeave(employeeId, weekStartFriday) {
        try {
            //Check Friday through Monday of work week
            const weekEndMonday = new Date(weekStartFriday);
            weekEndMonday.setDate(weekStartFriday.getDate() + 4);

            const [leaveRecords] = await db.query(`
                SELECT leave_id 
                FROM t_leave 
                WHERE employee_id = ? 
                AND status_ = 'approved'
                AND (
                    (start_date <= ? AND end_date >= ?) OR
                    (start_date <= ? AND end_date >= ?) OR
                    (start_date >= ? AND end_date <= ?)
                )
            `, [
                employeeId,
                weekStartFriday, weekStartFriday,
                weekEndMonday, weekEndMonday,
                weekStartFriday, weekEndMonday
            ]);

            return leaveRecords.length > 0;
        } catch (error) {
            console.error('Error checking employee leave:', error);
            return false;
        }
    }

    /**
     * Create shifts for working employees (Friday, Saturday, Sunday, Monday nights)
     */
    async createShiftsForEmployees(employees, scheduleId, weekStartFriday) {
        const shifts = [];

        for (const employee of employees) {
            //Create shifts for Friday, Saturday, Sunday, Monday nights
            for (const dayOffset of [0, 1, 2, 3]) {
                const shiftDate = new Date(weekStartFriday);
                shiftDate.setDate(weekStartFriday.getDate() + dayOffset);
                
                const endDate = new Date(shiftDate);
                endDate.setDate(shiftDate.getDate() + 1);

                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][shiftDate.getDay()];
                console.log(`Creating shift for ${employee.first_name} ${employee.last_name} on ${dayName} ${shiftDate.toDateString()} 17:00-02:00`);

                //Format dates without timezone conversion
                const formatDateForDB = (date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                shifts.push({
                    employee_id: employee.employee_id,
                    schedule_id: scheduleId,
                    shift_type: 'normal',
                    start_time: this.SHIFT_START_TIME,
                    end_time: this.SHIFT_END_TIME,
                    date_: formatDateForDB(shiftDate),
                    end_date: formatDateForDB(endDate),
                    status_: 'scheduled'
                });
            }
        }

        if (shifts.length > 0) {
            const values = shifts.map(shift => [
                shift.employee_id,
                shift.schedule_id,
                shift.shift_type,
                shift.start_time,
                shift.end_time,
                shift.date_,
                shift.end_date,
                shift.status_
            ]);

            await db.query(`
                INSERT INTO t_shift 
                (employee_id, schedule_id, shift_type, start_time, end_time, date_, end_date, status_)
                VALUES ?
            `, [values]);

            console.log(`Created ${shifts.length} shifts for ${employees.length} employees`);
        }
    }

    /**
     * Update standby status for employees based on current week's working employees
     */
    async updateStandbyStatus(roleEmployees, workingEmployees) {
        try {
            const workingEmployeeIds = workingEmployees.map(emp => emp.employee_id);
            
            //First, reset all employees to not standby
            await db.query(`UPDATE t_employee SET standby = NULL`);
            
            //If there are working employees, they're already set to NULL above
            if (workingEmployeeIds.length === 0) {
                console.log('No working employees to update');
                return;
            }

            //Get all non-working employee IDs who should be on standby
            const allEmployeeIds = [];
            roleEmployees.forEach(roleGroup => {
                roleGroup.employees.forEach(emp => {
                    if (!workingEmployeeIds.includes(emp.employee_id)) 
                    {
                        allEmployeeIds.push(emp.employee_id);
                    }
                });
            });

            //Set non-working employees to standby in one query
            if (allEmployeeIds.length > 0) {
                const placeholders = allEmployeeIds.map(() => '?').join(',');
                await db.query(`
                    UPDATE t_employee 
                    SET standby = 'standby' 
                    WHERE employee_id IN (${placeholders})
                `, allEmployeeIds);
            }

            console.log('Updated standby status for all employees');
        } catch (error) {
            console.error('Error updating standby status:', error);
            throw error;
        }
    }
}

//Export the scheduler instance
const monthlyShiftScheduler = new MonthlyShiftScheduler();

module.exports = {
    createMonthlyShifts: () => monthlyShiftScheduler.createMonthlyShifts(),
    updateWeeklyStandbyStatus: () => monthlyShiftScheduler.updateWeeklyStandbyStatus(),
    MonthlyShiftScheduler
};