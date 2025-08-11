const fs = require('fs');
const path = require('path');

// Map your table names from any variant to the correct lowercase form
const tableNameMap = {
  // t_attendance variants
  't_attendance': 't_attendance',
  't_attendance': 't_attendance',
  't_attendance': 't_attendance',

  // t_device variants
  't_device': 't_device',
  't_device': 't_device',
  't_device': 't_device',

  // t_employee variants
  't_employee': 't_employee',
  't_employee': 't_employee',
  't_employee': 't_employee',

  // t_leave variants
  't_leave': 't_leave',
  't_leave': 't_leave',
  't_leave': 't_leave',

  // t_leave_type variants
  't_leave_type': 't_leave_type',
  't_leave_type': 't_leave_type',
  't_leave_type': 't_leave_type',

  // t_message variants
  't_message': 't_message',
  't_message': 't_message',
  't_message': 't_message',

  // t_notification variants
  't_notification': 't_notification',
  't_notification': 't_notification',
  't_notification': 't_notification',

  // t_notification_type variants
  't_notification_type': 't_notification_type',
  't_notification_type': 't_notification_type',
  't_notification_type': 't_notification_type',

  // t_overtime variants
  't_overtime': 't_overtime',
  't_overtime': 't_overtime',
  't_overtime': 't_overtime',

  // t_overtime_roles variants
  't_overtime_roles': 't_overtime_roles',
  't_overtime_roles': 't_overtime_roles',
  't_overtime_roles': 't_overtime_roles',

  // t_payroll variants
  't_payroll': 't_payroll',
  't_payroll': 't_payroll',
  't_payroll': 't_payroll',

  // t_payroll_period variants
  't_payroll_period': 't_payroll_period',
  't_payroll_period': 't_payroll_period',
  't_payroll_period': 't_payroll_period',

  // t_payslip variants
  't_payslip': 't_payslip',
  't_payslip': 't_payslip',
  't_payslip': 't_payslip',

  // t_qr_code variants
  't_qr_code': 't_qr_code',
  't_qr_code': 't_qr_code',
  't_qr_code': 't_qr_code',

  // t_report variants
  't_report': 't_report',
  't_report': 't_report',
  't_report': 't_report',

  // t_role variants
  't_role': 't_role',
  't_role': 't_role',
  't_role': 't_role',

  // t_schedule variants
  't_schedule': 't_schedule',
  't_schedule': 't_schedule',
  't_schedule': 't_schedule',

  // t_shift variants
  't_shift': 't_shift',
  't_shift': 't_shift',
  't_shift': 't_shift',

  // t_shift_swap variants
  't_shift_swap': 't_shift_swap',
  't_shift_swap': 't_shift_swap',
  't_shift_swap': 't_shift_swap',
};


// Folder where your code lives (adjust if needed)
const rootDir = path.resolve(__dirname, './'); // e.g. './src' or './'

// File extensions to process
const fileExtensions = ['.js'];

// Build a regex pattern to match any key in tableNameMap (word boundaries)
const pattern = new RegExp(`\\b(${Object.keys(tableNameMap).join('|')})\\b`, 'g');

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (fileExtensions.includes(path.extname(entry.name))) {
      fixFile(fullPath);
    }
  }
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.replace(pattern, (match) => {
    return tableNameMap[match] || match;
  });
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Fixed table names in: ${filePath}`);
  }
}

walkDir(rootDir);

console.log('Table name normalization complete.');
