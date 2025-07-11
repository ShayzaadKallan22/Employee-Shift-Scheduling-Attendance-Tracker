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

module.exports = router;