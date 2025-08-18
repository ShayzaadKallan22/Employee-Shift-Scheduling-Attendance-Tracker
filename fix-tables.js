const fs = require('fs');
const path = require('path');

// Map your table names from any variant to the correct lowercase form
const tableNameMap = {
  // t_attendance variants
  't_attendance': 't_attendance',
  'T_Attendance': 't_attendance',
  'T_ATTENDANCE': 't_attendance',

  // t_device variants
  't_device': 't_device',
  'T_Device': 't_device',
  'T_DEVICE': 't_device',

  // t_employee variants
  't_employee': 't_employee',
  'T_Employee': 't_employee',
  'T_EMPLOYEE': 't_employee',

  // t_leave variants
  't_leave': 't_leave',
  'T_Leave': 't_leave',
  'T_LEAVE': 't_leave',

  // t_leave_type variants
  't_leave_type': 't_leave_type',
  'T_Leave_Type': 't_leave_type',
  'T_LEAVE_TYPE': 't_leave_type',

  // t_message variants
  't_message': 't_message',
  'T_Message': 't_message',
  'T_MESSAGE': 't_message',

  // t_notification variants
  't_notification': 't_notification',
  'T_Notification': 't_notification',
  'T_NOTIFICATION': 't_notification',

  // t_notification_type variants
  't_notification_type': 't_notification_type',
  'T_Notification_Type': 't_notification_type',
  'T_NOTIFICATION_TYPE': 't_notification_type',

  // t_overtime variants
  't_overtime': 't_overtime',
  'T_Overtime': 't_overtime',
  'T_OVERTIME': 't_overtime',

  // t_overtime_roles variants
  't_overtime_roles': 't_overtime_roles',
  'T_Overtime_Roles': 't_overtime_roles',
  'T_OVERTIME_ROLES': 't_overtime_roles',

  // t_payroll variants
  't_payroll': 't_payroll',
  'T_Payroll': 't_payroll',
  'T_PAYROLL': 't_payroll',

  // t_payroll_period variants
  't_payroll_period': 't_payroll_period',
  'T_Payroll_Period': 't_payroll_period',
  'T_PAYROLL_PERIOD': 't_payroll_period',

  // t_payslip variants
  't_payslip': 't_payslip',
  'T_Payslip': 't_payslip',
  'T_PAYSLIP': 't_payslip',

  // t_qr_code variants
  't_qr_code': 't_qr_code',
  'T_Qr_Code': 't_qr_code',
  'T_QR_CODE': 't_qr_code',

  // t_report variants
  't_report': 't_report',
  'T_Report': 't_report',
  'T_REPORT': 't_report',

  // t_role variants
  't_role': 't_role',
  'T_Role': 't_role',
  'T_ROLE': 't_role',

  // t_schedule variants
  't_schedule': 't_schedule',
  'T_Schedule': 't_schedule',
  'T_SCHEDULE': 't_schedule',

  // t_shift variants
  't_shift': 't_shift',
  'T_Shift': 't_shift',
  'T_SHIFT': 't_shift',

  // t_shift_swap variants
  't_shift_swap': 't_shift_swap',
  'T_Shift_Swap': 't_shift_swap',
  'T_SHIFT_SWAP': 't_shift_swap',
};



// Folder where your code lives (adjust if needed)
const rootDir = path.resolve(__dirname, './API'); // e.g. './src' or './'

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
