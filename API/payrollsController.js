/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const db = require('./db');
const PDFDocument = require('pdfkit');
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
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=payslip-${payrollId}.pdf`);
      res.setHeader('Content-Length', pdfData.length);
      res.end(pdfData);
    });

    // Helper functions for styling
    const drawLine = (y, color = '#E0E0E0') => {
      doc.strokeColor(color).lineWidth(1)
         .moveTo(50, y)
         .lineTo(545, y)
         .stroke();
    };

    const drawBox = (x, y, width, height, fillColor) => {
      doc.rect(x, y, width, height).fill(fillColor);
    };

    //Calculate totals
    const baseAmount = parseFloat(data.base_hours) * parseFloat(data.base_hourly_rate);
    const overtimeAmount = parseFloat(data.overtime_hours) * parseFloat(data.overtime_hourly_rate);
    const grossPay = baseAmount + overtimeAmount;
    const deductions = 0; 
    const netPay = parseFloat(data.total_amount);

    //Header with company name and logo area
    drawBox(0, 0, 595, 120, '#1a1a1a');
    doc.fillColor('#FFFFFF')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('AZANIA NIGHT LOUNGE', 50, 40, { align: 'center' });
    
    doc.fillColor('#007bff')
       .fontSize(12)
       .font('Helvetica')
       .text('EMPLOYEE PAYSLIP', 50, 75, { align: 'center' });

    doc.fillColor('#aaaaaa')
       .fontSize(9)
       .text('Confidential Document', 50, 95, { align: 'center' });

    let yPosition = 150;

    // Payslip Information Box
    drawBox(50, yPosition, 495, 60, '#f8f9fa');
    doc.fillColor('#1a1a1a')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('PAYSLIP ID:', 70, yPosition + 15)
       .font('Helvetica')
       .text(`#${data.payroll_id}`, 160, yPosition + 15);

    doc.font('Helvetica-Bold')
       .text('PAYMENT DATE:', 70, yPosition + 35)
       .font('Helvetica')
       .text(new Date(data.payment_date).toLocaleDateString('en-ZA', { 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       }), 160, yPosition + 35);

    //Status badge
    const statusColor = data._status === 'Paid' ? '#28a745' : '#ffc107';
    const statusX = 400;
    doc.roundedRect(statusX, yPosition + 20, 100, 25, 5)
       .fillAndStroke(statusColor, statusColor);
    
    doc.fillColor('#FFFFFF')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(data._status.toUpperCase(), statusX, yPosition + 26, { 
         width: 100, 
         align: 'center' 
       });

    yPosition += 90;

    // Employee Information Section
    doc.fillColor('#007bff')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('EMPLOYEE INFORMATION', 50, yPosition);
    
    yPosition += 25;
    drawLine(yPosition, '#007bff');
    yPosition += 20;

    doc.fillColor('#666666')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('FULL NAME', 70, yPosition);
    
    doc.fillColor('#1a1a1a')
       .fontSize(11)
       .font('Helvetica')
       .text(`${data.first_name} ${data.last_name}`, 70, yPosition + 15);

    doc.fillColor('#666666')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('EMAIL', 300, yPosition);
    
    doc.fillColor('#1a1a1a')
       .fontSize(11)
       .font('Helvetica')
       .text(data.email, 300, yPosition + 15);

    yPosition += 50;

    doc.fillColor('#666666')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('PHONE NUMBER', 70, yPosition);
    
    doc.fillColor('#1a1a1a')
       .fontSize(11)
       .font('Helvetica')
       .text(data.phone_number, 70, yPosition + 15);

    doc.fillColor('#666666')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('PAYMENT PERIOD', 300, yPosition);
    
    doc.fillColor('#1a1a1a')
       .fontSize(11)
       .font('Helvetica')
       .text(data.period || 'N/A', 300, yPosition + 15);

    yPosition += 50;

    // Earnings Breakdown Section
    doc.fillColor('#007bff')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('EARNINGS BREAKDOWN', 50, yPosition);
    
    yPosition += 25;
    drawLine(yPosition, '#007bff');
    yPosition += 20;

    //Table header
    drawBox(50, yPosition, 495, 30, '#f0f0f0');
    doc.fillColor('#1a1a1a')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('DESCRIPTION', 70, yPosition + 10)
       .text('HOURS', 280, yPosition + 10, { width: 60, align: 'center' })
       .text('RATE (R)', 360, yPosition + 10, { width: 80, align: 'center' })
       .text('AMOUNT (R)', 460, yPosition + 10, { width: 80, align: 'right' });

    yPosition += 30;

    //Regular hours row
    drawBox(50, yPosition, 495, 35, '#ffffff');
    doc.fillColor('#1a1a1a')
       .fontSize(10)
       .font('Helvetica')
       .text('Regular Hours', 70, yPosition + 12);
    
    doc.fillColor('#007bff')
       .font('Helvetica-Bold')
       .text(parseFloat(data.base_hours).toFixed(2), 280, yPosition + 12, { width: 60, align: 'center' });
    
    doc.fillColor('#666666')
       .font('Helvetica')
       .text(parseFloat(data.base_hourly_rate).toFixed(2), 360, yPosition + 12, { width: 80, align: 'center' });
    
    doc.fillColor('#1a1a1a')
       .font('Helvetica-Bold')
       .text(baseAmount.toFixed(2), 460, yPosition + 12, { width: 80, align: 'right' });

    yPosition += 35;
    drawLine(yPosition, '#E0E0E0');

    // Overtime hours row
    drawBox(50, yPosition, 495, 35, '#fffbf0');
    doc.fillColor('#1a1a1a')
       .fontSize(10)
       .font('Helvetica')
       .text('Overtime Hours', 70, yPosition + 12);
    
    doc.fillColor('#ffc107')
       .font('Helvetica-Bold')
       .text(parseFloat(data.overtime_hours).toFixed(2), 280, yPosition + 12, { width: 60, align: 'center' });
    
    doc.fillColor('#666666')
       .font('Helvetica')
       .text(parseFloat(data.overtime_hourly_rate).toFixed(2), 360, yPosition + 12, { width: 80, align: 'center' });
    
    doc.fillColor('#1a1a1a')
       .font('Helvetica-Bold')
       .text(overtimeAmount.toFixed(2), 460, yPosition + 12, { width: 80, align: 'right' });

    yPosition += 50;

    //Payment Summary Section
    doc.fillColor('#007bff')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('PAYMENT SUMMARY', 50, yPosition);
    
    yPosition += 25;
    drawLine(yPosition, '#007bff');
    yPosition += 20;

    //Gross Pay
    drawBox(50, yPosition, 495, 30, '#f8f9fa');
    doc.fillColor('#666666')
       .fontSize(10)
       .font('Helvetica')
       .text('Gross Pay', 70, yPosition + 10);
    
    doc.fillColor('#1a1a1a')
       .font('Helvetica-Bold')
       .text(`R ${grossPay.toFixed(2)}`, 460, yPosition + 10, { width: 80, align: 'right' });

    yPosition += 30;

    // Deductions
    drawBox(50, yPosition, 495, 30, '#ffffff');
    doc.fillColor('#666666')
       .fontSize(10)
       .font('Helvetica')
       .text('Deductions', 70, yPosition + 10);
    
    doc.fillColor('#1a1a1a')
       .font('Helvetica-Bold')
       .text(`R ${deductions.toFixed(2)}`, 460, yPosition + 10, { width: 80, align: 'right' });

    yPosition += 40;

    //Net Pay - highlighted
    drawBox(50, yPosition, 495, 50, '#007bff');
    doc.fillColor('#FFFFFF')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('NET PAY', 70, yPosition + 17);
    
    doc.fontSize(18)
       .text(`R ${netPay.toFixed(2)}`, 460, yPosition + 14, { width: 80, align: 'right' });

    yPosition += 70;

    //Footer
    drawLine(yPosition, '#E0E0E0');
    yPosition += 15;

    doc.fillColor('#666666')
       .fontSize(8)
       .font('Helvetica')
       .text('This is a computer-generated payslip and does not require a signature.', 50, yPosition, { 
         align: 'center',
         width: 495 
       });

    yPosition += 15;

    doc.fontSize(7)
       .text('For queries regarding this payslip, please contact the HR department.', 50, yPosition, { 
         align: 'center',
         width: 495 
       });

    yPosition += 20;

    doc.fontSize(7)
       .fillColor('#aaaaaa')
       .text(`Generated on ${new Date().toLocaleString('en-ZA')}`, 50, yPosition, { 
         align: 'center',
         width: 495 
       });

    doc.end();

  } catch (err) {
    console.error("Error generating payslip:", err);
    res.status(500).send("Internal Server Error");
  }
};