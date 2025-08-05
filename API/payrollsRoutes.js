/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const express = require('express');
const router = express.Router();
const payrollController = require('./payrollsController');

router.get('/:employeeId', payrollController.getPayrolls);
router.get('/:employeeId/pdf/:payrollId', payrollController.genPayslipPDF);

module.exports = router;