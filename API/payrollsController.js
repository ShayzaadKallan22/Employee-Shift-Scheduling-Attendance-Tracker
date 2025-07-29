/**
 * @author MOYO CT, 221039267
 * @version API
 */

const db = require('./db');
const PDFDocument = require('pdfkit');
//const getStream = require('get-stream');
const { PassThrough } = require('stream');

//Get all payrolls for an employee based on the selected date.
exports.getPayrolls = async (req, res) => {
  const {employeeId} = req.params;
   if(!employeeId){
        return res.status(400).json({message: 'Missing employee id:', employeeId});
    }
  try{
    const [rows] = await db.query(
    `SELECT p.*, e.first_name, e.last_name, e.base_hourly_rate, e.overtime_hourly_rate
     FROM t_payroll p
     JOIN t_employee e ON p.employee_id = e.employee_id
     WHERE p.employee_id = ?
     ORDER BY p.payment_date ASC`, [employeeId]
    );
    const result = rows;
    console.log('Payslips data', result);
    if(!result) return res.status(404).json({error: 'Payslip not found.'});
    res.json(result);
  }catch(err){
    console.error('Failure fetching payslips', err);
    res.status(500).json({error: 'Server error'});
  }
  
};



//Generate a PDF payslip
exports.genPayslipPDF = async (req, res) => {
  const { employeeId, payrollId } = req.params;
  console.log('Request received for employee:', employeeId, 'and payroll:', payrollId);

  const query = `
    SELECT p.*, e.first_name, e.last_name, e.email, e.phone_number,
           e.base_hourly_rate, e.overtime_hourly_rate
    FROM t_payroll p
    JOIN t_employee e ON p.employee_id = e.employee_id
    WHERE p.employee_id = ? AND p.payroll_id = ?;
  `;

  try {
    const [results] = await db.query(query, [employeeId, payrollId]);

    if (results.length === 0) {
      return res.status(404).send("Payslip not found");
    }

    const data = results[0];
    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=payslip-${payrollId}.pdf`);
      res.setHeader('Content-Length', pdfData.length);
      res.end(pdfData);
    });

    doc.fontSize(20).text("Azania Night Lounge", { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Employee: ${data.first_name} ${data.last_name}`);
    doc.text(`Email: ${data.email}`);
    doc.text(`Phone: ${data.phone_number}`);
    doc.text(`Payment Date: ${data.payment_date}`);
    doc.text(`Status: ${data._status}`);
    doc.moveDown();
    doc.fontSize(14).text("Earnings Summary:");
    doc.text(`Base Hours: ${data.base_hours} @ R${data.base_hourly_rate}`);
    doc.text(`Overtime Hours: ${data.overtime_hours} @ R${data.overtime_hourly_rate}`);
    doc.text(`Total Paid: R${data.total_amount}`);
    doc.end();

  } catch (err) {
    console.error("Error generating payslip:", err);
    res.status(500).send("Internal Server Error");
  }
};