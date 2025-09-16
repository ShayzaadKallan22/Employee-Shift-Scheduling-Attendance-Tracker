// Author: Katlego Mmadi
const express = require('express');
const router = express.Router();
const statusController = require('./statusController');

// Get all employees with status
router.get('/employees', statusController.getEmployees);

// Get all roles
router.get('/roles', statusController.getRoles);

// Get shifts for a specific employee
router.get('/shifts/:id', statusController.getEmployeeShifts);

module.exports = router;
