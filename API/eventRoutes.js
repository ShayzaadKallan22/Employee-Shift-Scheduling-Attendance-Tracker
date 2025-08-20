const express = require('express');
const router = express.Router();
const db = require('./db');

//create new event
router.post('/events', async (req, res) => {
    const { event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance, organizer_id } = req.body;
    
    try {
        const [result] = await db.execute(
            `INSERT INTO t_event 
             (event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance, organizer_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [event_name, description, start_date, end_date, start_time, end_time, location, expected_attendance, organizer_id]
        );
        console.log("checking if getting events created:");
    console.log(result);
        res.status(201).json({ 
            message: 'Event created successfully',
            event_id: result.insertId 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

//get events within date range
router.get('/events', async (req, res) => {
    const { start_date, end_date } = req.query;
    
    try {
        const [events] = await db.query(
            `SELECT e.*, 
                    CONCAT(emp.first_name, ' ', emp.last_name) AS organizer_name
             FROM t_event e
             JOIN t_employee emp ON e.organizer_id = emp.employee_id
             WHERE e.end_date >= ? AND e.start_date <= ?
             ORDER BY e.start_date, e.start_time`,
            [start_date || new Date().toISOString().split('T')[0], 
             end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]
        );
        console.log("checking if getting events:");
    console.log(events);
        res.status(200).json(events);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
    
});

//check for events during leave period
router.get('/events/check-leave', async (req, res) => {
    const { employee_id, start_date, end_date } = req.query;
    
    try {
        //check if employee is assigned to any events during leave period
        const [events] = await db.query(
            `SELECT e.* 
             FROM t_event e
             JOIN t_event_employee ee ON e.event_id = ee.event_id
             WHERE ee.employee_id = ?
               AND e.end_date >= ? 
               AND e.start_date <= ?`,
            [employee_id, start_date, end_date]
        );
        console.log(events);
        console.log(start_date, end_date, employee_id);
        res.status(200).json({ hasEvents: events.length > 0, events });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;