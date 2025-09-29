const Chart = window.Chart;
document.addEventListener('DOMContentLoaded', function () {
    const { createApp } = Vue;


    createApp({
        data() {
            return {
                reportType: 'payroll',
                startDate: this.getDefaultStartDate(),
                endDate: this.getDefaultEndDate(),
                employeeId: 'all',
                employees: [],

                shiftType: 'all',

                reportData: null,
                isLoading: false,
                chartInstances: {},
                payrollTableData: [],
                attendanceTableData: [],
                leaveTableData: [],
                swapsTableData: [],
                payrollTotal: 'R0.00',
                apiBaseUrl: 'http://localhost:3000/api/reports', //base API URL

                storageKey: 'lastReportData'
            };
        },
        async created() {
            await this.fetchEmployees();


            // Initialize tooltips
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    this.loadReportFromStorage();
            // Set default payroll period to the most recent one
            // if (this.payrollPeriods.length > 0) {
            //     this.selectedPayrollPeriod = this.payrollPeriods[0].period_id;
            // }
        },
        methods: {
            async fetchEmployees() {
                try {
                    // const response = await fetch('/api/reports/employees');
                    const response = await fetch('http://localhost:3000/api/employees');
                    if (!response.ok) throw new Error('Failed to fetch employees');
                    this.employees = await response.json();
                } catch (error) {
                    console.error('Error fetching employees:', error);
                    alert('Failed to load employee list');
                }
            },

            getDefaultStartDate() {
                const date = new Date();
                date.setMonth(date.getMonth() - 1);
                return date.toISOString().split('T')[0];
            },
            getDefaultEndDate() {
                return new Date().toISOString().split('T')[0];
            },
            // formatDate(dateString) {
            //     const options = { year: 'numeric', month: 'short', day: 'numeric' };
            //     return new Date(dateString).toLocaleDateString(undefined, options);
            // },

            formatTime(timeString) {
                if (!timeString) return 'N/A';
                //Handle both full datetime strings and time-only strings
                const time = new Date(`2000-01-01T${timeString}`);
                return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            },

            formatDate(dateString) {
                if (!dateString) return 'N/A';
                const options = { year: 'numeric', month: 'short', day: 'numeric' };
                return new Date(dateString).toLocaleDateString(undefined, options);
            },

            formatDateTime(datetimeString) {
                if (!datetimeString) return 'N/A';
                const options = {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                };
                return new Date(datetimeString).toLocaleDateString(undefined, options);
            },

            saveReportToStorage() {
    if (this.reportData) {
      const reportState = {
        reportType: this.reportType,
        startDate: this.startDate,
        endDate: this.endDate,
        employeeId: this.employeeId,
        shiftType: this.shiftType,
        reportData: this.reportData,
        payrollTableData: this.payrollTableData,
        attendanceTableData: this.attendanceTableData,
        leaveTableData: this.leaveTableData,
        swapsTableData: this.swapsTableData,
        payrollTotal: this.payrollTotal
      };
      localStorage.setItem(this.storageKey, JSON.stringify(reportState));
    }
  },

  loadReportFromStorage() {
    const savedReport = localStorage.getItem(this.storageKey);
    if (savedReport) {
      try {
        const reportState = JSON.parse(savedReport);
        
        // Restore filter values
        this.reportType = reportState.reportType;
        this.startDate = reportState.startDate;
        this.endDate = reportState.endDate;
        this.employeeId = reportState.employeeId;
        this.shiftType = reportState.shiftType || 'all';
        
        // Restore report data
        this.reportData = reportState.reportData;
        this.payrollTableData = reportState.payrollTableData || [];
        this.attendanceTableData = reportState.attendanceTableData || [];
        this.leaveTableData = reportState.leaveTableData || [];
        this.swapsTableData = reportState.swapsTableData || [];
        this.payrollTotal = reportState.payrollTotal || 'R0.00';
        
        // Initialize charts after data is loaded
        this.$nextTick(() => {
          this.initCharts();
        });
      } catch (e) {
        console.error('Failed to load saved report:', e);
        localStorage.removeItem(this.storageKey);
      }
    }
  },

    //         async generateReport() {
    //             this.isLoading = true;
    //             this.reportData = null;

    //             try {
    //                 let url = '';
    //                 const params = new URLSearchParams();

    //                 // Common parameters
    //                 if (this.startDate) params.append('startDate', this.startDate);
    //                 if (this.endDate) params.append('endDate', this.endDate);
    //                 if (this.employeeId && this.employeeId !== 'all') {
    //                     params.append('employeeId', this.employeeId);
    //                 }

    //                 // Report-specific endpoints
    //                 switch (this.reportType) {
    //                     case 'payroll':
    //                     case 'payroll':
    //                         url = `${this.apiBaseUrl}/payroll?${params.toString()}`;
    //                         break;
    //                     case 'attendance':
    //                         if (this.shiftType && this.shiftType !== 'all') {
    //     params.append('shiftType', this.shiftType);
    // }
    // url = `${this.apiBaseUrl}/attendance?${params.toString()}`;
    // break;
    //                     case 'leave':
    //                         url = `${this.apiBaseUrl}/leave?${params.toString()}`;
    //                         break;
    //                     case 'swaps':
    //                         url = `${this.apiBaseUrl}/swaps?${params.toString()}`;
    //                         break;
    //                     default:
    //                         throw new Error('Invalid report type');
    //                 }

    //                 const response = await fetch(url, {
    //                     headers: {
    //                         'Content-Type': 'application/json',
    //                     }
    //                 });

    //                 if (!response.ok) {
    //                     const error = await response.json();
    //                     throw new Error(error.message || 'Failed to fetch report data');
    //                 }

    //                 this.reportData = await response.json();

    //                 // Process data based on report type
    //                 switch (this.reportType) {
    //                     case 'payroll':
    //                         this.processPayrollData(this.reportData);
    //                         break;
    //                     case 'attendance':
    //                         this.processAttendanceData(this.reportData);
    //                         break;
    //                     case 'leave':
    //                         this.processLeaveData(this.reportData);
    //                         break;
    //                     case 'swaps':
    //                         this.processSwapsData(this.reportData);
    //                         break;
    //                 }

    //                 this.$nextTick(() => {
    //                     this.initCharts();
    //                 });
    //                 this.saveReportToStorage();
    //             } catch (error) {
    //                 console.error('Error generating report:', error);
    //                 alert(`Failed to generate report: ${error.message}`);
    //             } finally {
    //                 this.isLoading = false;
    //             }
    //         },
            // processPayrollData(data) {
            //     this.payrollTableData = data.map(item => {
            //         // Use the actual base hours from payroll record
            //         const basePay = item.base_hours * item.base_hourly_rate;

            //         // Use the actual overtime hours from payroll record
            //         const overtimePay = item.overtime_hours * item.overtime_hourly_rate;

            //         return {
            //             employee: `${item.employee_name} (EMP-${item.employee_id})`,
            //             role: item.role,
            //             baseSalary: `R${basePay.toFixed(2)}`,
            //             overtime: `R${overtimePay.toFixed(2)}`,
            //             netPay: `R${(basePay + overtimePay).toFixed(2)}`, // Sum of base + overtime
            //             workedHours: item.base_hours
            //         };
            //     });

            //     this.payrollTotal = `R${data.reduce((sum, item) =>
            //         sum + (item.base_hours * item.base_hourly_rate) + (item.overtime_hours * item.overtime_hourly_rate), 0).toFixed(2)}`;
            // },

            async generateReport(isAutoGenerate = false) {
    // Don't show loading spinner for auto-generations to avoid UI flickering
    if (!isAutoGenerate) {
        this.isLoading = true;
    }
    
    this.reportData = null;

    try {
        let url = '';
        const params = new URLSearchParams();

        // Common parameters
        if (this.startDate) params.append('startDate', this.startDate);
        if (this.endDate) params.append('endDate', this.endDate);
        if (this.employeeId && this.employeeId !== 'all') {
            params.append('employeeId', this.employeeId);
        }

        // Report-specific endpoints
        switch (this.reportType) {
            case 'payroll':
                url = `${this.apiBaseUrl}/payroll?${params.toString()}`;
                break;
            case 'attendance':
                if (this.shiftType && this.shiftType !== 'all') {
                    params.append('shiftType', this.shiftType);
                }
                url = `${this.apiBaseUrl}/attendance?${params.toString()}`;
                break;
            case 'leave':
                url = `${this.apiBaseUrl}/leave?${params.toString()}`;
                break;
            case 'swaps':
                url = `${this.apiBaseUrl}/swaps?${params.toString()}`;
                break;
            default:
                throw new Error('Invalid report type');
        }

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch report data');
        }

        this.reportData = await response.json();

        // Process data based on report type
        switch (this.reportType) {
            case 'payroll':
                this.processPayrollData(this.reportData);
                break;
            case 'attendance':
                this.processAttendanceData(this.reportData);
                break;
            case 'leave':
                this.processLeaveData(this.reportData);
                break;
            case 'swaps':
                this.processSwapsData(this.reportData);
                break;
        }

        this.$nextTick(() => {
            this.initCharts();
        });
        this.saveReportToStorage();
        
    } catch (error) {
        console.error('Error generating report:', error);
        // Only show alert for manual generations, not auto-generations
        if (!isAutoGenerate) {
            alert(`Failed to generate report: ${error.message}`);
        }
    } finally {
        this.isLoading = false;
    }
},
            
            processPayrollData(data) {
    this.payrollTableData = data.map(item => {
        const basePay = item.base_hours * item.base_hourly_rate;
        const overtimePay = item.overtime_hours * item.overtime_hourly_rate;
        
        return {
            employee: `${item.employee_name} (EMP-${item.employee_id})`,
            role: item.role,
            baseSalary: `R${basePay.toFixed(2)}`,
            overtime: `R${overtimePay.toFixed(2)}`,
            netPay: `R${(basePay + overtimePay).toFixed(2)}`,
            paymentDate: this.formatDate(item.payment_date), // Add formatted date
            rawPaymentDate: item.payment_date, // Keep raw date for sorting
            workedHours: item.base_hours,
            baseHours: item.base_hours,
            overtimeHours: item.overtime_hours
        };
    });

    // Sort by payment date (newest first)
    this.payrollTableData.sort((a, b) => new Date(b.rawPaymentDate) - new Date(a.rawPaymentDate));

    this.payrollTotal = `R${data.reduce((sum, item) =>
        sum + (item.base_hours * item.base_hourly_rate) + (item.overtime_hours * item.overtime_hourly_rate), 0).toFixed(2)}`;
},

            // processSwapsData(data) {
            //     this.swapsTableData = data.map(item => {
            //         const requestDate = new Date(item.request_date_time);
            //         const approvalDate = item.approval_date_time ? new Date(item.approval_date_time) : null;

            //         return {
            //             originalEmployee: `${item.original_employee_name} (EMP-${item.original_employee_id})`,
            //             swapEmployee: `${item.requesting_employee_name} (EMP-${item.requesting_employee_id})`,
            //             originalShift: `${this.formatTime(item.original_start_time)} - ${this.formatTime(item.original_end_time)}`,
            //             originalDate: this.formatDate(item.original_date),
            //             swapShift: `${this.formatTime(item.requested_start_time)} - ${this.formatTime(item.requested_end_time)}`,
            //             swapDate: this.formatDate(item.requested_date),
            //             requestDate: this.formatDateTime(item.request_date_time),
            //             approvalDate: approvalDate ? this.formatDateTime(item.approval_date_time) : 'N/A',
            //             status: item.status_,
            //             daysToApproval: approvalDate ?
            //                 Math.round((approvalDate - requestDate) / (1000 * 60 * 60 * 24)) : 'N/A',
            //             approvedBy: item.approving_employee_name || 'N/A'
            //         };
            //     }).sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
            // },

            processSwapsData(data) {
    this.swapsTableData = data.map(item => {
        const requestDate = new Date(item.request_date_time);
        const approvalDate = item.approval_date_time ? new Date(item.approval_date_time) : null;

        return {
            originalEmployee: `${item.original_employee_name} (EMP-${item.original_employee_id})`,
            swapEmployee: `${item.taking_employee_name} (EMP-${item.taking_employee_id})`,
            originalShift: `${this.formatTime(item.original_start_time)} - ${this.formatTime(item.original_end_time)}`,
            originalDate: this.formatDate(item.original_date),
            swapShift: `${this.formatTime(item.requested_start_time)} - ${this.formatTime(item.requested_end_time)}`,
            swapDate: this.formatDate(item.requested_date),
            requestDate: this.formatDateTime(item.request_date_time),
            approvalDate: approvalDate ? this.formatDateTime(item.approval_date_time) : 'N/A',
            status: item.status_,
            daysToApproval: approvalDate ?
                Math.round((approvalDate - requestDate) / (1000 * 60 * 60 * 24)) : 'N/A',
            approvedBy: item.approving_employee_name || 'N/A'
        };
    }).sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
},
            processAttendanceData(data) {
    // Group attendance by employee
    const employeeAttendance = {};

    data.forEach(item => {
        if (!employeeAttendance[item.employee_id]) {
            employeeAttendance[item.employee_id] = {
                employee: `${item.employee_name} (EMP-${item.employee_id})`,
                shiftsScheduled: 0,
                shiftsWorked: 0,
                absences: 0,
                totalHours: 0,
                normalShifts: 0,
                overtimeShifts: 0
            };
        }

        employeeAttendance[item.employee_id].shiftsScheduled++;
        
        // Count shift types
        if (item.shift_type === 'normal') {
            employeeAttendance[item.employee_id].normalShifts++;
        } else {
            employeeAttendance[item.employee_id].overtimeShifts++;
        }

        if (item.status_ === 'completed') {
            employeeAttendance[item.employee_id].shiftsWorked++;
            if (item.hours_scheduled) {
                employeeAttendance[item.employee_id].totalHours += parseFloat(item.hours_scheduled);
            }
        } else {
            employeeAttendance[item.employee_id].absences++;
        }
    });

    // Convert to array and calculate percentages
    this.attendanceTableData = Object.values(employeeAttendance).map(item => ({
        employee: item.employee,
        shiftsScheduled: item.shiftsScheduled,
        shiftsWorked: item.shiftsWorked,
        absences: item.absences,
        totalHours: item.totalHours.toFixed(2),
        normalShifts: item.normalShifts,
        overtimeShifts: item.overtimeShifts,
        attendancePercentage: ((item.shiftsWorked / item.shiftsScheduled) * 100).toFixed(1) + '%'
    }));
},

            // processLeaveData(data) {
            //     this.leaveTableData = data.map(item => ({
            //         employee: `${item.employee_name} (EMP-${item.employee_id})`,
            //         leaveType: item.leave_type,
            //         startDate: this.formatDate(item.start_date),
            //         endDate: this.formatDate(item.end_date),
            //         daysTaken: item.days_taken,
            //         status: item.status_
            //     }));
            // },

            processLeaveData(data) {
    this.leaveTableData = data.map(item => ({
        employee: `${item.employee_name} (EMP-${item.employee_id})`,
        leaveType: item.leave_type,
        startDate: this.formatDate(item.start_date),
        endDate: this.formatDate(item.end_date),
        daysTaken: item.days_taken,
        status: item.status_,
        rawStartDate: item.start_date // Add for sorting
    })).sort((a, b) => new Date(b.rawStartDate) - new Date(a.rawStartDate)); // Sort by date descending
},

            formatDateTime(datetimeString) {
                const options = {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                };
                return new Date(datetimeString).toLocaleDateString(undefined, options);
            },

            initCharts() {
                // Destroy existing charts first
                Object.values(this.chartInstances).forEach(chart => {
                    if (chart) chart.destroy();
                });
                this.chartInstances = {};

                if (!this.reportData || this.reportData.length === 0) return;

                // Use setTimeout to ensure DOM is ready
                setTimeout(() => {


                    switch (this.reportType) {
                        case 'payroll':
                            this.initPayrollCharts();
                            break;
                        case 'attendance':
                            this.initAttendanceCharts();
                            break;
                        case 'leave':
                            this.initLeaveCharts();
                            break;
                        case 'swaps':
                            this.initSwapsCharts();
                            break;
                    }
                }, 100);
            },
//             initPayrollCharts() {
//                 const payrollCtx = document.getElementById('payrollChart');
//                 const payrollPieCtx = document.getElementById('payrollPieChart');

//                 if (!payrollCtx || !payrollPieCtx) {
//                     console.error('Chart canvases not found');
//                     return;
//                 }

//                 // Bar Chart
//                 this.chartInstances.payrollChart = new Chart(payrollCtx.getContext('2d'), {
//                     type: 'bar',
//                     data: {
//                         labels: this.reportData.map(item =>
//                             `${item.employee_name} (EMP-${item.employee_id})`),
//                         datasets: [{
//                             label: 'Total Pay',
//                             data: this.reportData.map(item => parseFloat(item.total_amount)),
//                             backgroundColor: 'rgba(255, 187, 0, 0.7)',
//                             borderColor: 'rgba(255, 187, 0, 1)',
//                             borderWidth: 1
//                         }]
//                     },

//                     options: {
//                         responsive: true,
//                         plugins: {
//                             legend: { display: false },
//                             title: {
//                                 display: true,
//                                 text: 'Employee Payroll',
//                                 color: '#fff'
//                             }
//                         },
//                         scales: {
//                             y: {
//                                 beginAtZero: true,
//                                 ticks: { color: '#fff' },
//                                 grid: { color: 'rgba(255,255,255,0.1)' },
//                                 title: {  
//                                     display: true,
//                                     text: 'Amount (R)',
//                                     color: '#fff'
//                                 }
//                             },
//                             x: {
//                                 ticks: {
//                                     color: '#fff',
//                                     maxRotation: 45,
//                                     minRotation: 45
//                                 },
//                                 title: {  
//                                     display: true,
//                                     text: 'Employees',
//                                     color: '#fff'
//                                 }
//                             }
//                         }
//                     }
//                 });

//                 // Pie Chart
//                 const basePay = this.reportData.reduce((sum, item) =>
//                     sum + (item.base_hours * item.base_hourly_rate), 0);
//                 const overtimePay = this.reportData.reduce((sum, item) =>
//                     sum + (item.overtime_hours * item.overtime_hourly_rate), 0);

//                 this.chartInstances.payrollPieChart = new Chart(payrollPieCtx.getContext('2d'), {
//                     type: 'doughnut',
//                     data: {
//                         labels: ['Base Salary', 'Overtime'],
//                         datasets: [{
//                             data: [basePay, overtimePay],
//                             backgroundColor: [
//                                 'rgba(0, 200, 83, 0.7)',
//                                 'rgba(244, 67, 54, 0.7)'
//                             ],
//                             borderWidth: 0
//                         }]
//                     },
//                     options: {
//                         responsive: true,
//                         plugins: {
//                             legend: {
//                                 position: 'bottom',
//                                 labels: {
//                                     color: '#fff',
//                                     font: { size: 12 }
//                                 }
//                             }
//                         },
//                         cutout: '65%'
//                     }
//                 });

                
// const payrollInsight = document.createElement('div');
// payrollInsight.className = 'insights-panel';
// payrollInsight.innerHTML = `
//     <button class="insights-toggle" onclick="this.classList.toggle('collapsed'); 
//         this.nextElementSibling.classList.toggle('show')">
//         <span><i class="fas fa-lightbulb me-2"></i>Payroll Insights</span>
//         <i class="fas fa-chevron-down"></i>
//     </button>
//     <div class="insights-content">
//         <ul>
//             <li>Total payroll cost: ${this.payrollTotal}</li>
//             <li>Overtime accounts for ${((overtimePay/(basePay+overtimePay)*100).toFixed(1))}% of total payroll</li>
//             <li>Consider reviewing overtime trends for cost optimization opportunities</li>
//             ${basePay > overtimePay*3 ? '<li>Overtime costs are within healthy limits (less than 25% of base pay)</li>' : 
//               '<li class="text-warning">Overtime costs are high (more than 25% of base pay). Consider hiring additional staff.</li>'}
//         </ul>
//     </div>
// `;
// payrollPieCtx.closest('.bg-secondary').appendChild(payrollInsight);
//             },


// initPayrollCharts() {
//     const payrollCtx = document.getElementById('payrollChart');
//     const payrollPieCtx = document.getElementById('payrollPieChart');

//     if (!payrollCtx || !payrollPieCtx) {
//         console.error('Chart canvases not found');
//         return;
//     }

//     // Group data by payment date for better visualization
//     const dataByDate = {};
//     this.reportData.forEach(item => {
//         const dateKey = this.formatDate(item.payment_date);
//         if (!dataByDate[dateKey]) {
//             dataByDate[dateKey] = {
//                 total: 0,
//                 basePay: 0,
//                 overtimePay: 0,
//                 employees: []
//             };
//         }
//         const basePay = item.base_hours * item.base_hourly_rate;
//         const overtimePay = item.overtime_hours * item.overtime_hourly_rate;
        
//         dataByDate[dateKey].total += basePay + overtimePay;
//         dataByDate[dateKey].basePay += basePay;
//         dataByDate[dateKey].overtimePay += overtimePay;
//         dataByDate[dateKey].employees.push(item.employee_name);
//     });

//     const dates = Object.keys(dataByDate).sort((a, b) => new Date(a) - new Date(b));

//     // Bar Chart - Payroll by Date
//     this.chartInstances.payrollChart = new Chart(payrollCtx.getContext('2d'), {
//         type: 'bar',
//         data: {
//             labels: dates,
//             datasets: [
//                 {
//                     label: 'Base Salary',
//                     data: dates.map(date => dataByDate[date].basePay),
//                     backgroundColor: 'rgba(54, 162, 235, 0.7)',
//                     borderColor: 'rgba(54, 162, 235, 1)',
//                     borderWidth: 1
//                 },
//                 {
//                     label: 'Overtime',
//                     data: dates.map(date => dataByDate[date].overtimePay),
//                     backgroundColor: 'rgba(255, 99, 132, 0.7)',
//                     borderColor: 'rgba(255, 99, 132, 1)',
//                     borderWidth: 1
//                 }
//             ]
//         },
//         options: {
//             responsive: true,
//             plugins: {
//                 legend: { 
//                     display: true,
//                     labels: { color: '#fff' }
//                 },
//                 title: {
//                     display: true,
//                     text: 'Payroll by Payment Date',
//                     color: '#fff'
//                 },
//                 tooltip: {
//                     callbacks: {
//                         afterTitle: function(context) {
//                             const date = context[0].label;
//                             const employees = dataByDate[date].employees;
//                             return `Employees: ${employees.join(', ')}`;
//                         },
//                         label: function(context) {
//                             const datasetLabel = context.dataset.label || '';
//                             const value = context.parsed.y;
//                             return `${datasetLabel}: R${value.toFixed(2)}`;
//                         },
//                         footer: function(context) {
//                             const date = context[0].label;
//                             const total = dataByDate[date].total;
//                             return `Total: R${total.toFixed(2)}`;
//                         }
//                     }
//                 }
//             },
//             scales: {
//                 y: {
//                     beginAtZero: true,
//                     ticks: { 
//                         color: '#fff',
//                         callback: function(value) {
//                             return 'R' + value;
//                         }
//                     },
//                     grid: { color: 'rgba(255,255,255,0.1)' },
//                     title: {  
//                         display: true,
//                         text: 'Amount (R)',
//                         color: '#fff'
//                     }
//                 },
//                 x: {
//                     ticks: {
//                         color: '#fff',
//                         maxRotation: 45,
//                         minRotation: 45
//                     },
//                     title: {  
//                         display: true,
//                         text: 'Payment Dates',
//                         color: '#fff'
//                     }
//                 }
//             }
//         }
//     });

//     // Pie Chart (unchanged)
//     const basePay = this.reportData.reduce((sum, item) =>
//         sum + (item.base_hours * item.base_hourly_rate), 0);
//     const overtimePay = this.reportData.reduce((sum, item) =>
//         sum + (item.overtime_hours * item.overtime_hourly_rate), 0);

//     this.chartInstances.payrollPieChart = new Chart(payrollPieCtx.getContext('2d'), {
//         type: 'doughnut',
//         data: {
//             labels: ['Base Salary', 'Overtime'],
//             datasets: [{
//                 data: [basePay, overtimePay],
//                 backgroundColor: [
//                     'rgba(54, 162, 235, 0.7)',
//                     'rgba(255, 99, 132, 0.7)'
//                 ],
//                 borderWidth: 0
//             }]
//         },
//         options: {
//             responsive: true,
//             plugins: {
//                 legend: {
//                     position: 'bottom',
//                     labels: {
//                         color: '#fff',
//                         font: { size: 12 }
//                     }
//                 },
//                 tooltip: {
//                     callbacks: {
//                         label: function(context) {
//                             const label = context.label || '';
//                             const value = context.parsed;
//                             const total = context.dataset.data.reduce((a, b) => a + b, 0);
//                             const percentage = Math.round((value / total) * 100);
//                             return `${label}: R${value.toFixed(2)} (${percentage}%)`;
//                         }
//                     }
//                 }
//             },
//             cutout: '65%'
//         }
//     });
// },

initPayrollCharts() {
    const payrollCtx = document.getElementById('payrollChart');
    const payrollPieCtx = document.getElementById('payrollPieChart');

    if (!payrollCtx || !payrollPieCtx) {
        console.error('Chart canvases not found');
        return;
    }

    // Determine chart type based on employee filter
    const showEmployeeComparison = this.employeeId === 'all';
    
    let chartConfig;
    
    if (showEmployeeComparison) {
        // Employee Comparison Chart (when "All Employees" is selected)
        chartConfig = this.createEmployeeComparisonChart();
    } else {
        // Date-based Chart (when specific employee is selected)
        chartConfig = this.createDateBasedChart();
    }

    // Bar Chart
    this.chartInstances.payrollChart = new Chart(payrollCtx.getContext('2d'), chartConfig.barChart);

    // Pie Chart (same for both views)
    const basePay = this.reportData.reduce((sum, item) =>
        sum + (item.base_hours * item.base_hourly_rate), 0);
    const overtimePay = this.reportData.reduce((sum, item) =>
        sum + (item.overtime_hours * item.overtime_hourly_rate), 0);

    this.chartInstances.payrollPieChart = new Chart(payrollPieCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Base Salary', 'Overtime'],
            datasets: [{
                data: [basePay, overtimePay],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 99, 132, 0.7)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#fff',
                        font: { size: 12 }
                    }
                },
                title: {
                    display: true,
                    text: showEmployeeComparison ? 'Total Payroll Distribution' : 'Employee Pay Distribution',
                    color: '#fff'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: R${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });

    // Update insights panel
    this.updatePayrollInsights(showEmployeeComparison);
},

createEmployeeComparisonChart() {
    // Group data by employee for comparison
    const employeeData = {};
    this.reportData.forEach(item => {
        const employeeKey = `${item.employee_name} (EMP-${item.employee_id})`;
        if (!employeeData[employeeKey]) {
            employeeData[employeeKey] = {
                total: 0,
                basePay: 0,
                overtimePay: 0,
                paymentDates: new Set()
            };
        }
        
        const basePay = item.base_hours * item.base_hourly_rate;
        const overtimePay = item.overtime_hours * item.overtime_hourly_rate;
        
        employeeData[employeeKey].total += basePay + overtimePay;
        employeeData[employeeKey].basePay += basePay;
        employeeData[employeeKey].overtimePay += overtimePay;
        employeeData[employeeKey].paymentDates.add(item.payment_date);
    });

    // Sort employees by total pay (descending)
    const sortedEmployees = Object.entries(employeeData)
        .sort(([,a], [,b]) => b.total - a.total)
        .slice(0, 15); // Limit to top 15 employees for readability

    return {
        barChart: {
            type: 'bar',
            data: {
                labels: sortedEmployees.map(([employee]) => 
                    employee.split(' ')[0] + '...' // Show abbreviated names
                ),
                datasets: [
                    {
                        label: 'Base Salary',
                        data: sortedEmployees.map(([, data]) => data.basePay),
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Overtime',
                        data: sortedEmployees.map(([, data]) => data.overtimePay),
                        backgroundColor: 'rgba(255, 99, 132, 0.7)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        display: true,
                        labels: { color: '#fff' }
                    },
                    title: {
                        display: true,
                        text: 'Employee Pay Comparison',
                        color: '#fff'
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const fullName = sortedEmployees[context[0].dataIndex][0];
                                return fullName;
                            },
                            afterTitle: function(context) {
                                const employeeKey = sortedEmployees[context[0].dataIndex][0];
                                const dates = Array.from(employeeData[employeeKey].paymentDates)
                                    .sort()
                                    .map(date => new Date(date).toLocaleDateString());
                                return `Payment Dates: ${dates.join(', ')}`;
                            },
                            label: function(context) {
                                const datasetLabel = context.dataset.label || '';
                                const value = context.parsed.y;
                                return `${datasetLabel}: R${value.toFixed(2)}`;
                            },
                            footer: function(context) {
                                const employeeKey = sortedEmployees[context[0].dataIndex][0];
                                const total = employeeData[employeeKey].total;
                                return `Total: R${total.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            color: '#fff',
                            callback: function(value) {
                                return 'R' + value;
                            }
                        },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        title: {  
                            display: true,
                            text: 'Amount (R)',
                            color: '#fff'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#fff',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        title: {  
                            display: true,
                            text: 'Employees',
                            color: '#fff'
                        }
                    }
                }
            }
        }
    };
},

createDateBasedChart() {
    // Group data by payment date for specific employee
    const dataByDate = {};
    this.reportData.forEach(item => {
        const dateKey = this.formatDate(item.payment_date);
        if (!dataByDate[dateKey]) {
            dataByDate[dateKey] = {
                total: 0,
                basePay: 0,
                overtimePay: 0
            };
        }
        
        const basePay = item.base_hours * item.base_hourly_rate;
        const overtimePay = item.overtime_hours * item.overtime_hourly_rate;
        
        dataByDate[dateKey].total += basePay + overtimePay;
        dataByDate[dateKey].basePay += basePay;
        dataByDate[dateKey].overtimePay += overtimePay;
    });

    const dates = Object.keys(dataByDate).sort((a, b) => new Date(a) - new Date(b));

    return {
        barChart: {
            type: 'bar',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Base Salary',
                        data: dates.map(date => dataByDate[date].basePay),
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Overtime',
                        data: dates.map(date => dataByDate[date].overtimePay),
                        backgroundColor: 'rgba(255, 99, 132, 0.7)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        display: true,
                        labels: { color: '#fff' }
                    },
                    title: {
                        display: true,
                        text: 'Payroll Timeline',
                        color: '#fff'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const datasetLabel = context.dataset.label || '';
                                const value = context.parsed.y;
                                return `${datasetLabel}: R${value.toFixed(2)}`;
                            },
                            footer: function(context) {
                                const date = context[0].label;
                                const total = dataByDate[date].total;
                                return `Total: R${total.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            color: '#fff',
                            callback: function(value) {
                                return 'R' + value;
                            }
                        },
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        title: {  
                            display: true,
                            text: 'Amount (R)',
                            color: '#fff'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#fff',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        title: {  
                            display: true,
                            text: 'Payment Dates',
                            color: '#fff'
                        }
                    }
                }
            }
        }
    };
},

updatePayrollInsights(showEmployeeComparison) {
    // Remove existing insights
    const existingInsights = document.querySelector('.insights-panel');
    if (existingInsights) {
        existingInsights.remove();
    }

    const payrollPieCtx = document.getElementById('payrollPieChart');
    if (!payrollPieCtx) return;

    const basePay = this.reportData.reduce((sum, item) =>
        sum + (item.base_hours * item.base_hourly_rate), 0);
    const overtimePay = this.reportData.reduce((sum, item) =>
        sum + (item.overtime_hours * item.overtime_hourly_rate), 0);
    const totalPay = basePay + overtimePay;

    const payrollInsight = document.createElement('div');
    payrollInsight.className = 'insights-panel';
    
    if (showEmployeeComparison) {
        // Employee comparison insights
        const employeeCount = new Set(this.reportData.map(item => item.employee_id)).size;
        const avgPayPerEmployee = totalPay / employeeCount;
        
        payrollInsight.innerHTML = `
            <button class="insights-toggle" onclick="this.classList.toggle('collapsed'); 
                this.nextElementSibling.classList.toggle('show')">
                <span><i class="fas fa-lightbulb me-2"></i>Payroll Insights</span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="insights-content">
                <ul>
                    <li>Total payroll for ${employeeCount} employees: ${this.payrollTotal}</li>
                    <li>Average pay per employee: R${avgPayPerEmployee.toFixed(2)}</li>
                    <li>Overtime accounts for ${((overtimePay/totalPay)*100).toFixed(1)}% of total payroll</li>
                    ${overtimePay > basePay * 0.3 ? 
                      '<li class="text-warning">High overtime costs detected (>30% of base pay)</li>' : 
                      '<li>Overtime costs are within normal limits</li>'}
                    <li>Date range covered: ${this.formattedDateRange}</li>
                </ul>
            </div>
        `;
    } else {
        // Single employee insights
        const employee = this.reportData[0];
        const employeeName = `${employee.employee_name} `;
        const paymentDates = new Set(this.reportData.map(item => item.payment_date)).size;
        
        payrollInsight.innerHTML = `
            <button class="insights-toggle" onclick="this.classList.toggle('collapsed'); 
                this.nextElementSibling.classList.toggle('show')">
                <span><i class="fas fa-lightbulb me-2"></i>Payroll Insights - ${employeeName}</span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="insights-content">
                <ul>
                    <li>Total pay for ${paymentDates} payment period(s): ${this.payrollTotal}</li>
                    <li>Base hours worked: ${this.reportData.reduce((sum, item) => sum + parseFloat(item.base_hours), 0).toFixed(1)}</li>
                    <li>Overtime hours worked: ${this.reportData.reduce((sum, item) => sum + parseFloat(item.overtime_hours), 0).toFixed(1)}</li>
                    <li>Overtime accounts for ${((overtimePay/totalPay)*100).toFixed(1)}% of total pay</li>
                    <li>Date range: ${this.formattedDateRange}</li>
                </ul>
            </div>
        `;
    }

    payrollPieCtx.closest('.bg-secondary').appendChild(payrollInsight);
},

initAttendanceCharts() {
                const attendanceCtx = document.getElementById('attendanceChart');
                const attendanceGaugeCtx = document.getElementById('attendanceGauge');

                if (!attendanceCtx || !attendanceGaugeCtx) return;

                // Process attendance data
                const statusCounts = {
                    completed: 0,
                    missed: 0
                };

                this.reportData.forEach(record => {
                    statusCounts[record.status_] = (statusCounts[record.status_] || 0) + 1;
                });

                // Line Chart - Attendance Trend
                const dates = [...new Set(this.reportData.map(item =>
                    new Date(item.date).toLocaleDateString()))].sort();

                const completedData = dates.map(date => {
                    return this.reportData.filter(item =>
                        new Date(item.date).toLocaleDateString() === date &&
                        item.status_ === 'completed'
                    ).length;
                });

                this.chartInstances.attendanceChart = new Chart(attendanceCtx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: dates,
                        datasets: [{
                            label: 'Completed Shifts',
                            data: completedData,
                            borderColor: 'rgba(0, 200, 83, 1)',
                            backgroundColor: 'rgba(0, 200, 83, 0.1)',
                            tension: 0.3,
                            fill: true
                        }]
                    },

                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false },
                            title: {
                                display: true,
                                text: 'Daily Shift Completion',
                                color: '#fff'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { color: '#fff' },
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                title: {  
                                    display: true,
                                    text: 'Number of Shifts',
                                    color: '#fff'
                                }
                            },
                            x: {
                                ticks: {
                                    color: '#fff',
                                    maxRotation: 45,
                                    minRotation: 45
                                },
                                title: {  
                                    display: true,
                                    text: 'Date',
                                    color: '#fff'
                                }
                            }
                        }
                    }
                });

                // Gauge Chart - Attendance Summary
                const totalRecords = this.reportData.length;
                const attendanceRate = totalRecords > 0 ?
                    (statusCounts.completed / totalRecords * 100).toFixed(1) : 0;

                this.chartInstances.attendanceGauge = new Chart(attendanceGaugeCtx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Completed', 'Missed'],
                        datasets: [{
                            data: [attendanceRate, 100 - attendanceRate],
                            backgroundColor: [
                                'rgba(0, 200, 83, 0.7)',
                                'rgba(244, 67, 54, 0.7)'
                            ],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        circumference: 180,
                        rotation: -90,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { color: '#fff' }
                            },
                            title: {
                                display: true,
                                text: `${attendanceRate}% Completion`,
                                color: '#fff',
                                position: 'bottom'
                            }
                        },
                        cutout: '70%'
                    }
                })
                
                const attendanceInsight = document.createElement('div');
attendanceInsight.className = 'insights-panel';
attendanceInsight.innerHTML = `
    <button class="insights-toggle" onclick="this.classList.toggle('collapsed'); 
        this.nextElementSibling.classList.toggle('show')">
        <span><i class="fas fa-calendar-check me-2"></i>Attendance Insights</span>
        <i class="fas fa-chevron-down"></i>
    </button>
    <div class="insights-content">
        <ul>
            <li>Overall attendance rate: ${attendanceRate}%</li>
            <li>${statusCounts.completed} shifts completed, ${statusCounts.missed || 0} shifts missed</li>
            ${attendanceRate > 90 ? '<li>Excellent attendance rate! Keep up the good work.</li>' : 
              attendanceRate > 75 ? '<li class="text-warning">Attendance could be improved. Consider following up with employees.</li>' : 
              '<li class="text-danger">Low attendance rate. Immediate action recommended.</li>'}
            ${completedData.some((val, i, arr) => val < arr[0]*0.7) ? 
              '<li>Notice: Some days show significantly lower attendance than others</li>' : ''}
            ${this.shiftType === 'overtime' ? '<li>Overtime shift completion rate: ' + 
              (this.reportData.filter(r => r.status_ === 'completed').length / this.reportData.length * 100).toFixed(1) + '%</li>' : ''}
        </ul>
    </div>
`;
attendanceGaugeCtx.closest('.bg-secondary').appendChild(attendanceInsight);
            },

//             initLeaveCharts() {
//                 const leaveTrendCtx = document.getElementById('leaveTrendChart');
//                 const leaveTypeCtx = document.getElementById('leaveTypeChart');

//                 if (!leaveTrendCtx || !leaveTypeCtx) return;

//                 // Process leave data
//                 const leaveByMonth = {};
//                 const leaveByType = {};

//                 this.reportData.forEach(record => {
//                     const month = new Date(record.start_date).toLocaleString('default', { month: 'short' });
//                     leaveByMonth[month] = (leaveByMonth[month] || 0) + record.days_taken;

//                     if (!leaveByType[record.leave_type]) {
//                         leaveByType[record.leave_type] = 0;
//                     }
//                     leaveByType[record.leave_type] += record.days_taken;
//                 });

//                 // Line Chart - Leave Trend
//                 this.chartInstances.leaveTrendChart = new Chart(leaveTrendCtx.getContext('2d'), {
//                     type: 'line',
//                     data: {
//                         labels: Object.keys(leaveByMonth),
//                         datasets: [{
//                             label: 'Days Taken',
//                             data: Object.values(leaveByMonth),
//                             borderColor: 'rgba(33, 150, 243, 1)',
//                             backgroundColor: 'rgba(33, 150, 243, 0.1)',
//                             tension: 0.3,
//                             fill: true
//                         }]
//                     },
//                     options: {
//                         responsive: true,
//                         plugins: {
//                             legend: { display: false },
//                             title: {
//                                 display: true,
//                                 text: 'Monthly Leave Trend',
//                                 color: '#fff'
//                             }
//                         },
//                         scales: {
//                             y: {
//                                 beginAtZero: true,
//                                 ticks: { color: '#fff' },
//                                 grid: { color: 'rgba(255,255,255,0.1)' },
//                                 title: {  
//                                     display: true,
//                                     text: 'Days Taken',
//                                     color: '#fff'
//                                 }
//                             },
//                             x: {
//                                 ticks: { color: '#fff' },
//                                 title: {  
//                                     display: true,
//                                     text: 'Month',
//                                     color: '#fff'
//                                 }
//                             }
//                         }
//                     }
//                 });

//                 // Bar Chart - Leave by Type
//                 this.chartInstances.leaveTypeChart = new Chart(leaveTypeCtx.getContext('2d'), {
//                     type: 'bar',
//                     data: {
//                         labels: Object.keys(leaveByType),
//                         datasets: [{
//                             label: 'Days Taken',
//                             data: Object.values(leaveByType),
//                             backgroundColor: [
//                                 'rgba(255, 152, 0, 0.7)',
//                                 'rgba(156, 39, 176, 0.7)',
//                                 'rgba(76, 175, 80, 0.7)'
//                             ],
//                             borderColor: [
//                                 'rgba(255, 152, 0, 1)',
//                                 'rgba(156, 39, 176, 1)',
//                                 'rgba(76, 175, 80, 1)'
//                             ],
//                             borderWidth: 1
//                         }]
//                     },
//                     options: {
//                         responsive: true,
//                         plugins: {
//                             legend: { display: false },
//                             title: {
//                                 display: true,
//                                 text: 'Leave by Type',
//                                 color: '#fff'
//                             }
//                         },
//                         scales: {
//                             y: {
//                                 beginAtZero: true,
//                                 ticks: { color: '#fff' },
//                                 grid: { color: 'rgba(255,255,255,0.1)' }
//                             },
//                             x: {
//                                 ticks: { color: '#fff' }
//                             }
//                         }
//                     }
//                 });
//                 const leaveInsight = document.createElement('div');
// leaveInsight.className = 'insights-panel';
// leaveInsight.innerHTML = `
//     <button class="insights-toggle" onclick="this.classList.toggle('collapsed'); 
//         this.nextElementSibling.classList.toggle('show')">
//         <span><i class="fas fa-sign-out-alt me-2"></i>Leave Insights</span>
//         <i class="fas fa-chevron-down"></i>
//     </button>
//     <div class="insights-content">
//         <ul>
//             <li>Total leave days taken: ${Object.values(leaveByMonth).reduce((a,b) => a+b, 0)}</li>
//             <li>Most common leave type: ${Object.entries(leaveByType).sort((a,b) => b[1]-a[1])[0][0]}</li>
//             <li>Approval rate: ${(this.reportData.filter(l => l.status_ === 'approved').length / this.reportData.length * 100).toFixed(1)}%</li>
//             ${Object.values(leaveByMonth).some(m => m > 15) ? 
//               '<li class="text-warning">Notice: Some months have unusually high leave days</li>' : ''}
//             ${Object.entries(leaveByType).find(t => t[0].toLowerCase().includes('sick')) && 
//              Object.entries(leaveByType).find(t => t[0].toLowerCase().includes('sick'))[1] > 10 ?
//               '<li>Consider reviewing sick leave patterns for potential health initiatives</li>' : ''}
//             ${this.employeeId !== 'all' ? 
//               `<li>This employee has taken ${this.reportData.reduce((sum, item) => sum + item.days_taken, 0)} leave days in this period</li>` : ''}
//         </ul>
//     </div>
// `;
// leaveTypeCtx.closest('.bg-secondary').appendChild(leaveInsight);
                
//             },

initLeaveCharts() {
    const leaveTrendCtx = document.getElementById('leaveTrendChart');
    const leaveTypeCtx = document.getElementById('leaveTypeChart');

    if (!leaveTrendCtx || !leaveTypeCtx) return;

    // Process leave data with proper chronological ordering
    const leaveByMonth = {};
    const leaveByType = {};

    this.reportData.forEach(record => {
        const date = new Date(record.start_date);
        const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        
        if (!leaveByMonth[monthYear]) {
            leaveByMonth[monthYear] = {
                label: monthName,
                days: 0,
                timestamp: date.getTime()
            };
        }
        leaveByMonth[monthYear].days += record.days_taken;

        if (!leaveByType[record.leave_type]) {
            leaveByType[record.leave_type] = 0;
        }
        leaveByType[record.leave_type] += record.days_taken;
    });

    // Sort months chronologically
    const sortedMonths = Object.entries(leaveByMonth)
        .sort(([,a], [,b]) => a.timestamp - b.timestamp) // Ascending order
        .map(([_, data]) => data);

    // Line Chart - Leave Trend (chronological order)
    this.chartInstances.leaveTrendChart = new Chart(leaveTrendCtx.getContext('2d'), {
        type: 'line',
        data: {
            labels: sortedMonths.map(month => month.label),
            datasets: [{
                label: 'Days Taken',
                data: sortedMonths.map(month => month.days),
                borderColor: 'rgba(33, 150, 243, 1)',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: 'rgba(33, 150, 243, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { 
                    display: false 
                },
                title: {
                    display: true,
                    text: 'Monthly Leave Trend',
                    color: '#fff'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Days Taken: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#fff',
                        stepSize: 1
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    title: {  
                        display: true,
                        text: 'Days Taken',
                        color: '#fff'
                    }
                },
                x: {
                    ticks: { 
                        color: '#fff'
                    },
                    title: {  
                        display: true,
                        text: 'Month',
                        color: '#fff'
                    }
                }
            }
        }
    });

    // Bar Chart - Leave by Type (unchanged)
    this.chartInstances.leaveTypeChart = new Chart(leaveTypeCtx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(leaveByType),
            datasets: [{
                label: 'Days Taken',
                data: Object.values(leaveByType),
                backgroundColor: [
                    'rgba(255, 152, 0, 0.7)',
                    'rgba(156, 39, 176, 0.7)',
                    'rgba(76, 175, 80, 0.7)',
                    'rgba(244, 67, 54, 0.7)',
                    'rgba(33, 150, 243, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 152, 0, 1)',
                    'rgba(156, 39, 176, 1)',
                    'rgba(76, 175, 80, 1)',
                    'rgba(244, 67, 54, 1)',
                    'rgba(33, 150, 243, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Leave by Type',
                    color: '#fff'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#fff',
                        stepSize: 1
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#fff' }
                }
            }
        }
    });

    // Update insights panel with proper month ordering
    this.updateLeaveInsights(sortedMonths, leaveByType);
},

updateLeaveInsights(monthsData, leaveByType) {
    // Remove existing insights
    const existingInsights = document.querySelector('.insights-panel');
    if (existingInsights) {
        existingInsights.remove();
    }

    const leaveTypeCtx = document.getElementById('leaveTypeChart');
    if (!leaveTypeCtx) return;

    const totalDays = monthsData.reduce((sum, month) => sum + month.days, 0);
    const approvedCount = this.reportData.filter(l => l.status_ === 'approved').length;
    const totalCount = this.reportData.length;
    const approvalRate = totalCount > 0 ? (approvedCount / totalCount * 100).toFixed(1) : 0;

    // Find trends
    const recentMonths = monthsData.slice(-6); // Last 6 months
    const avgRecent = recentMonths.reduce((sum, month) => sum + month.days, 0) / recentMonths.length;
    const hasIncreasingTrend = monthsData.length >= 3 && 
        monthsData[monthsData.length - 1].days > monthsData[monthsData.length - 2].days;

    const leaveInsight = document.createElement('div');
    leaveInsight.className = 'insights-panel';
    leaveInsight.innerHTML = `
        <button class="insights-toggle" onclick="this.classList.toggle('collapsed'); 
            this.nextElementSibling.classList.toggle('show')">
            <span><i class="fas fa-sign-out-alt me-2"></i>Leave Insights</span>
            <i class="fas fa-chevron-down"></i>
        </button>
        <div class="insights-content">
            <ul>
                <li>Total leave days taken: ${totalDays}</li>
                <li>Covering ${monthsData.length} month(s) from ${monthsData[0]?.label || 'N/A'} to ${monthsData[monthsData.length - 1]?.label || 'N/A'}</li>
                <li>Most common leave type: ${Object.entries(leaveByType).sort((a,b) => b[1]-a[1])[0]?.[0] || 'N/A'}</li>
                <li>Approval rate: ${approvalRate}%</li>
                ${hasIncreasingTrend ? '<li class="text-warning">Trend: Leave usage is increasing in recent months</li>' : ''}
                ${avgRecent > 10 ? '<li class="text-info">Recent average: ' + avgRecent.toFixed(1) + ' days per month</li>' : ''}
                ${this.employeeId !== 'all' ? 
                  `<li>This employee has taken ${this.reportData.reduce((sum, item) => sum + item.days_taken, 0)} leave days in this period</li>` : 
                  `<li>Average per employee: ${(totalDays / new Set(this.reportData.map(item => item.employee_id)).size).toFixed(1)} days</li>`}
            </ul>
        </div>
    `;
    leaveTypeCtx.closest('.bg-secondary').appendChild(leaveInsight);
},

initSwapsCharts() {
    // Clear existing charts first
    if (this.chartInstances.swapsStatusChart) {
        this.chartInstances.swapsStatusChart.destroy();
    }
    if (this.chartInstances.swapsEmployeesChart) {
        this.chartInstances.swapsEmployeesChart.destroy();
    }
    if (this.chartInstances.swapsWeekdayChart) {
        this.chartInstances.swapsWeekdayChart.destroy();
    }

    // Ensure we have data
    if (!this.reportData || this.reportData.length === 0) return;

    // Process data
    const swapsByStatus = {
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0
    };
    
    const swapsByEmployee = {};
    const swapsByWeekday = {
        'Monday': 0,
        'Tuesday': 0,
        'Wednesday': 0,
        'Thursday': 0,
        'Friday': 0,
        'Saturday': 0,
        'Sunday': 0
    };
    
    this.reportData.forEach(record => {
        swapsByStatus[record.status_] = (swapsByStatus[record.status_] || 0) + 1;
        
        const originalEmp = record.original_employee_name.split(' ')[0]; // First name only
        const takingEmp = record.taking_employee_name.split(' ')[0]; // First name only
        // const empKey = `${record.original_employee_name} ↔ ${record.requesting_employee_name}`;
        const empKey = `${originalEmp} ↔ ${takingEmp}`;
        swapsByEmployee[empKey] = (swapsByEmployee[empKey] || 0) + 1;
        
        const swapDate = new Date(record.request_date_time);
        const dayName = swapDate.toLocaleDateString('en-US', { weekday: 'long' });
        swapsByWeekday[dayName] = (swapsByWeekday[dayName] || 0) + 1;
    });

    // Create or update chart container
    let container = document.getElementById('swapsChartContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'swapsChartContainer';
        container.innerHTML = `
            <ul class="nav nav-tabs mb-3" id="swapsChartTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="status-tab" data-bs-toggle="tab" 
                            data-bs-target="#status-chart" type="button" role="tab" 
                            aria-controls="status-chart" aria-selected="true">
                        By Status
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="employees-tab" data-bs-toggle="tab" 
                            data-bs-target="#employees-chart" type="button" role="tab" 
                            aria-controls="employees-chart" aria-selected="false">
                        By Employee Pair
                    </button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="weekday-tab" data-bs-toggle="tab" 
                            data-bs-target="#weekday-chart" type="button" role="tab" 
                            aria-controls="weekday-chart" aria-selected="false">
                        By Weekday
                    </button>
                </li>
            </ul>
            <div class="tab-content">
                <div class="tab-pane fade show active" id="status-chart" role="tabpanel" aria-labelledby="status-tab">
                    <div class="chart-container" style="position: relative; height:300px;">
                        <canvas id="swapsStatusChart"></canvas>
                    </div>
                </div>
                <div class="tab-pane fade" id="employees-chart" role="tabpanel" aria-labelledby="employees-tab">
                    <div class="chart-container" style="position: relative; height:400px;">
                        <canvas id="swapsEmployeesChart"></canvas>
                    </div>
                </div>
                <div class="tab-pane fade" id="weekday-chart" role="tabpanel" aria-labelledby="weekday-tab">
                    <div class="chart-container" style="position: relative; height:300px;">
                        <canvas id="swapsWeekdayChart"></canvas>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('swapsChart').replaceWith(container);
    }

    // Status Chart (Doughnut)
    const statusCtx = document.getElementById('swapsStatusChart').getContext('2d');
    this.chartInstances.swapsStatusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
            datasets: [{
                data: [
                    swapsByStatus.pending,
                    swapsByStatus.approved,
                    swapsByStatus.rejected,
                    swapsByStatus.cancelled
                ],
                backgroundColor: [
                    'rgba(255, 152, 0, 0.7)',  // Pending
                    'rgba(76, 175, 80, 0.7)',   // Approved
                    'rgba(244, 67, 54, 0.7)',   // Rejected
                    'rgba(158, 158, 158, 0.7)'  // Cancelled
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#fff',
                        font: { size: 12 }
                    }
                },
                title: {
                    display: true,
                    text: 'Swap Requests by Status',
                    color: '#fff',
                    font: { size: 16 }
                }
            },
            cutout: '60%'
        }
    });

    // Employee Pairs Chart (Horizontal Bar)
    const employeesCtx = document.getElementById('swapsEmployeesChart').getContext('2d');
    const sortedEmployeePairs = Object.entries(swapsByEmployee)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    this.chartInstances.swapsEmployeesChart = new Chart(employeesCtx, {
        type: 'bar',
        data: {
            labels: sortedEmployeePairs.map(pair => pair[0]),
            datasets: [{
                label: 'Number of Swaps',
                data: sortedEmployeePairs.map(pair => pair[1]),
                backgroundColor: 'rgba(33, 150, 243, 0.7)',
                borderColor: 'rgba(33, 150, 243, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Top 10 Employee Swap Pairs',
                    color: '#fff',
                    font: { size: 16 }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#fff', font: { size: 10 } },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    beginAtZero: true,
                    ticks: { color: '#fff', stepSize: 1 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });

    // Weekday Chart (Radar)
    const weekdayCtx = document.getElementById('swapsWeekdayChart').getContext('2d');
    const weekdayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const orderedWeekdayData = weekdayOrder.map(day => swapsByWeekday[day]);
    
    this.chartInstances.swapsWeekdayChart = new Chart(weekdayCtx, {
        type: 'radar',
        data: {
            labels: weekdayOrder,
            datasets: [{
                label: 'Swap Requests',
                data: orderedWeekdayData,
                backgroundColor: 'rgba(156, 39, 176, 0.2)',
                borderColor: 'rgba(156, 39, 176, 1)',
                pointBackgroundColor: 'rgba(156, 39, 176, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(156, 39, 176, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Swap Requests by Weekday',
                    color: '#fff',
                    font: { size: 16 }
                }
            },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#fff', font: { size: 12 } },
                    ticks: { 
                        color: '#fff',
                        backdropColor: 'rgba(0, 0, 0, 0)',
                        stepSize: 1
                    }
                }
            }
        }
    });

    //initialize Bootstrap tabs if available (for swap charts erorrs)
    if (typeof bootstrap !== 'undefined') {
        const tabEls = document.querySelectorAll('#swapsChartTabs button[data-bs-toggle="tab"]');
        tabEls.forEach(tabEl => {
            new bootstrap.Tab(tabEl);
        });
    }
},
            // exportReport() {
            //     // Implement export functionality
            //     alert('Export functionality would be implemented here');
            // }

            

exportReport() {
    if (!this.reportData || this.reportData.length === 0) {
        alert('No data to export. Please generate a report first.');
        return;
    }

    switch (this.reportType) {
        case 'payroll':
            this.exportPayrollReport();
            break;
        case 'attendance':
            this.exportAttendanceReport();
            break;
        case 'leave':
            this.exportLeaveReport();
            break;
        case 'swaps':
            this.exportSwapsReport();
            break;
        default:
            alert('Export not available for this report type');
    }
},

// exportPayrollReport() {
//     const data = [
//         ['Employee', 'Role', 'Base Salary', 'Overtime', 'Net Pay', 'Base Hours', 'Overtime Hours'],
//         ...this.payrollTableData.map(item => [
//             item.employee,
//             item.role,
//             item.baseSalary,
//             item.overtime,
//             item.netPay,
//             parseFloat(item.baseSalary.replace('R', '') / this.reportData.find(d => 
//                 `${d.employee_name} (EMP-${d.employee_id})` === item.employee
//             ).base_hourly_rate,
//             parseFloat(item.overtime.replace('R', '') / this.reportData.find(d => 
//                 `${d.employee_name} (EMP-${d.employee_id})` === item.employee
//             ).overtime_hourly_rate
//         ])
//     ];

exportPayrollReport() {
    const data = [
        ['Employee', 'Role', 'Base Salary', 'Overtime', 'Net Pay', 'Base Hours', 'Overtime Hours'],
        ...this.payrollTableData.map(item => [
            item.employee,
            item.role,
            item.baseSalary,
            item.overtime,
            item.netPay,
            parseFloat(
                item.baseSalary.replace('R', '')
            ) / this.reportData.find(d => 
                `${d.employee_name} (EMP-${d.employee_id})` === item.employee
            ).base_hourly_rate,
            parseFloat(
                item.overtime.replace('R', '')
            ) / this.reportData.find(d => 
                `${d.employee_name} (EMP-${d.employee_id})` === item.employee
            ).overtime_hourly_rate
        ])
    ];

    //summary row
    data.push(['', '', '', '', this.payrollTotal, '', '']);

    this.generateExcel(
        data,
        `Payroll_Report_${this.startDate}_to_${this.endDate}`,
        'Payroll Report'
    );
},

exportAttendanceReport() {
    const data = [
        ['Employee', 'Normal Shifts', 'Overtime Shifts', 'Total Shifts Scheduled', 
         'Shifts Completed', 'Missed Shifts', 'Total Hours', 'Completion Rate'],
        ...this.attendanceTableData.map(item => [
            item.employee,
            item.normalShifts,
            item.overtimeShifts,
            item.shiftsScheduled,
            item.shiftsWorked,
            item.absences,
            item.totalHours,
            item.attendancePercentage
        ])
    ];

    this.generateExcel(
        data,
        `Attendance_Report_${this.startDate}_to_${this.endDate}`,
        'Attendance Report'
    );
},

exportLeaveReport() {
    const data = [
        ['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days Taken', 'Status'],
        ...this.leaveTableData.map(item => [
            item.employee,
            item.leaveType,
            item.startDate,
            item.endDate,
            item.daysTaken,
            item.status
        ])
    ];

    this.generateExcel(
        data,
        `Leave_Report_${this.startDate}_to_${this.endDate}`,
        'Leave Report'
    );
},

exportSwapsReport() {
    const data = [
        ['Requesting Employee', 'Taking Employee', 'Original Shift Date', 'Original Shift Time',
         'Requested Shift Date', 'Requested Shift Time', 'Requested On', 'Approved On',
         'Days to Approve', 'Approved By', 'Status'],
        ...this.swapsTableData.map(item => [
            item.originalEmployee,
            item.swapEmployee,
            item.originalDate,
            item.originalShift,
            item.swapDate,
            item.swapShift,
            item.requestDate,
            item.approvalDate,
            item.daysToApproval,
            item.approvedBy,
            item.status
        ])
    ];

    this.generateExcel(
        data,
        `Shift_Swaps_Report_${this.startDate}_to_${this.endDate}`,
        'Shift Swaps Report'
    );
},

generateExcel(data, fileName, sheetName) {
    //create workbook
    const wb = XLSX.utils.book_new();
    
    //convert data to worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    //add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    //generate Excel file
    XLSX.writeFile(wb, `${fileName}.xlsx`, {
        bookType: 'xlsx',
        type: 'array'
    });
},

//consistent date formatting in exports
formatDateForExport(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '-');
},

async exportAsPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Store report title in a variable accessible to callbacks
        const reportTitle = this.getReportTitle();
        
        // Set document properties
        doc.setProperties({
            title: `${reportTitle} Report ${this.startDate} to ${this.endDate}`,
            subject: 'Employee Report Data',
            author: 'Azania Reports',
            keywords: 'report, employees, data',
            creator: 'Azania HR System'
        });

        //header
        doc.setFontSize(24);
        doc.setTextColor(0, 100, 180);
        doc.setFont('helvetica', 'bold');
        doc.text('AZANIA', 105, 20, { align: 'center' });

        // report title
        doc.setFontSize(20);
        doc.setTextColor(40);
        doc.text(`${reportTitle.toUpperCase()} REPORT`, 105, 30, { align: 'center' });
        
        //date range
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date Range: ${this.formatDateForExport(this.startDate)} to ${this.formatDateForExport(this.endDate)}`, 
                105, 38, { align: 'center' });
        
        // report generation date
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 45, { align: 'center' });
        
        // horizontal line
        doc.setDrawColor(200, 200, 200);
        doc.line(15, 50, 195, 50);

        // table data based on report type
        let headers = [];
        let rows = [];
        let tableTitle = '';
        
        switch(this.reportType) {
            case 'payroll':
                headers = [['Employee', 'Role', 'Base Wage', 'Overtime', 'Net Pay']];
                rows = this.payrollTableData.map(row => [
                    row.employee,
                    row.role,
                    row.baseSalary,
                    row.overtime,
                    row.netPay
                ]);
                // Add total row
                rows.push(['', '', '', 'Total:', this.payrollTotal]);
                tableTitle = 'Payroll Details';
                break;
                
            case 'attendance':
                headers = [['Employee', 'Shifts Scheduled', 'Shifts Worked', 'Missed', 'Total Hours', 'Completion %']];
                rows = this.attendanceTableData.map(row => [
                    row.employee,
                    row.shiftsScheduled,
                    row.shiftsWorked,
                    row.absences,
                    row.totalHours,
                    row.attendancePercentage
                ]);
                tableTitle = 'Attendance Summary';
                break;
                
            case 'leave':
                headers = [['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days Taken', 'Status']];
                rows = this.leaveTableData.map(row => [
                    row.employee,
                    row.leaveType,
                    row.startDate,
                    row.endDate,
                    row.daysTaken,
                    row.status
                ]);
                tableTitle = 'Leave Records';
                break;
                
            case 'swaps':
                headers = [['Requesting', 'Taking', 'Original Shift', 'Requested Shift', 'Status']];
                rows = this.swapsTableData.map(row => [
                    row.originalEmployee,
                    row.swapEmployee,
                    `${row.originalDate} ${row.originalShift}`,
                    `${row.swapDate} ${row.swapShift}`,
                    row.status
                ]);
                tableTitle = 'Shift Swaps';
                break;
        }

        // table title
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(tableTitle, 15, 60);
        
        // Add table to PDF
        doc.autoTable({
            startY: 65,
            head: headers,
            body: rows,
            theme: 'grid',
            headStyles: {
                fillColor: [0, 100, 180],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 10
            },
            styles: {
                fontSize: 9,
                cellPadding: 3
            },
            margin: { top: 10 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 30, halign: 'right' },
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 30, halign: 'right' }
            },
            didDrawPage: function(data) {
                // Footer on each page
                doc.setFontSize(8);
                doc.setTextColor(150);
                const pageCount = doc.internal.getNumberOfPages();
                doc.text(
                    `Page ${data.pageNumber} of ${pageCount}`,
                    data.settings.margin.right,
                    doc.internal.pageSize.height - 10,
                    { align: 'right' }
                );
                doc.text(
                    `Confidential - Azania ${reportTitle} Report`,
                    data.settings.margin.left,
                    doc.internal.pageSize.height - 10,
                    { align: 'left' }
                );
            }
        });

        //final Y position after the table
        let finalY = doc.lastAutoTable.finalY || 65;
        
        // Add charts section title
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255); // White text for dark section
        doc.setFillColor(26, 26, 26); // Dark background
        doc.rect(15, finalY + 10, 180, 15, 'F');
        doc.text('Charts and Visualizations', 105, finalY + 20, { align: 'center' });
        finalY += 30;

        const chartElements = document.querySelectorAll('canvas');
        
        for (let i = 0; i < chartElements.length; i++) {
            const canvas = chartElements[i];
            
            try {
                // temporary container with dark background
                const tempContainer = document.createElement('div');
                tempContainer.style.position = 'fixed';
                tempContainer.style.left = '0';
                tempContainer.style.top = '0';
                tempContainer.style.width = canvas.width + 'px';
                tempContainer.style.height = canvas.height + 'px';
                tempContainer.style.backgroundColor = '#1a1a1a';
                tempContainer.style.padding = '20px';
                tempContainer.style.boxSizing = 'border-box';
                document.body.appendChild(tempContainer);
                
                // new canvas and draw the chart image
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                tempContainer.appendChild(tempCanvas);
                
                // Draw the original chart onto our new canvas
                const ctx = tempCanvas.getContext('2d');
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                ctx.drawImage(canvas, 0, 0);
                
                // Capture the temporary canvas
                const canvasImage = await html2canvas(tempCanvas, {
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    backgroundColor: '#1a1a1a',
                    allowTaint: true,
                    removeContainer: true
                });
                
                // Clean up
                document.body.removeChild(tempContainer);
                
                const imgData = canvasImage.toDataURL('image/png');
                const imgWidth = 180; // mm
                const imgHeight = (canvasImage.height * imgWidth) / canvasImage.width;
                
                // Check if we need a new page
                if (finalY + imgHeight > 250) {
                    doc.addPage();
                    finalY = 20;
                    
                    // Add header for new page
                    doc.setFontSize(14);
                    doc.text('Charts and Visualizations (continued)', 15, finalY);
                    finalY += 10;
                }
                
                // Add dark background rectangle
                doc.setFillColor(26, 26, 26);
                doc.rect(15, finalY + 5, imgWidth, imgHeight, 'F');
                
                // Add the chart image
                doc.addImage(imgData, 'PNG', 15, finalY + 5, imgWidth, imgHeight);
                finalY += imgHeight + 15;
                
            } catch (error) {
                console.error(`Error capturing chart ${i}:`, error);
                // Fallback: Try capturing the original canvas directly
                try {
                    const canvasImage = await html2canvas(canvas, {
                        scale: 2,
                        logging: false,
                        useCORS: true,
                        backgroundColor: '#1a1a1a'
                    });
                    
                    const imgData = canvasImage.toDataURL('image/png');
                    const imgWidth = 180;
                    const imgHeight = (canvasImage.height * imgWidth) / canvasImage.width;
                    
                    if (finalY + imgHeight > 250) {
                        doc.addPage();
                        finalY = 20;
                        doc.setFontSize(14);
                        doc.text('Charts and Visualizations (continued)', 15, finalY);
                        finalY += 10;
                    }
                    
                    doc.setFillColor(26, 26, 26);
                    doc.rect(15, finalY + 5, imgWidth, imgHeight, 'F');
                    doc.addImage(imgData, 'PNG', 15, finalY + 5, imgWidth, imgHeight);
                    finalY += imgHeight + 15;
                } catch (fallbackError) {
                    console.error(`Fallback capture failed for chart ${i}:`, fallbackError);
                }
            }
        }

        // Save the PDF
        doc.save(`${reportTitle}_Report_${this.startDate}_to_${this.endDate}.pdf`);
    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Please try again.');
    }
},

formatDateForExport(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
},

showExportOptions() {
    try {
        const modalId = 'exportModal-' + Date.now();
        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content bg-secondary">
                        <div class="modal-header border-0">
                            <h5 class="modal-title">Export Report</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Choose export format:</p>
                            <div class="d-grid gap-2">
                                <button class="btn btn-primary export-btn" data-type="excel">
                                    <i class="fas fa-file-excel me-2"></i>Export as Excel
                                </button>
                                <button class="btn btn-danger export-btn" data-type="pdf">
                                    <i class="fas fa-file-pdf me-2"></i>Export as PDF
                                </button>
                            </div>
                        </div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHTML;
        document.body.appendChild(modalDiv);
        
        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        const handleExport = (type) => {
            modal.hide();
            if (type === 'excel') {
                this.exportReport();
            } else {
                this.exportAsPDF();
            }
        };
        
        modalElement.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', () => handleExport(btn.dataset.type));
        });
        
        modalElement.addEventListener('hidden.bs.modal', () => {
            setTimeout(() => {
                if (document.body.contains(modalDiv)) {
                    document.body.removeChild(modalDiv);
                }
            }, 500);
        });
    } catch (error) {
        console.error('Error showing export options:', error);
        // Fallback to direct PDF export if modal fails
        this.exportAsPDF();
    }
},
    
       
    
    getReportTitle() {
        const titles = {
            payroll: 'Payroll',
            attendance: 'Attendance',
            leave: 'Leave',
            swaps: 'Shift Swaps'
        };
        return titles[this.reportType] || 'Report';
    },
    
    async addChartsToPDF(doc) {
        const chartElements = document.querySelectorAll('canvas');
        let yPosition = 40; // Start below the header
        
        for (let i = 0; i < chartElements.length; i++) {
            const canvas = chartElements[i];
            const canvasImage = await html2canvas(canvas, {
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true
            });
            
            const imgData = canvasImage.toDataURL('image/png');
            const imgWidth = 180; //in mm
            const imgHeight = (canvasImage.height * imgWidth) / canvasImage.width;
            
            // Add page if needed
            if (yPosition + imgHeight > 250) {
                doc.addPage();
                yPosition = 20;
            }
            
            doc.addImage(imgData, 'PNG', 15, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10;
        }
        
        return yPosition;
    },
    
    async addTableToPDF(doc) {
        const tableElement = document.querySelector('.report-section table');
        if (!tableElement) return;
        
        const tableImage = await html2canvas(tableElement, {
            scale: 1,
            logging: false,
            useCORS: true,
            allowTaint: true
        });
        
        const imgData = tableImage.toDataURL('image/png');
        const imgWidth = 180; // mm
        const imgHeight = (tableImage.height * imgWidth) / tableImage.width;
        
        // Check if we need a new page
        const currentY = doc.internal.pageSize.height - doc.internal.getCurrentPageInfo().pageHeight;
        if (currentY + imgHeight > 250) {
            doc.addPage();
        }
        
        doc.addImage(imgData, 'PNG', 15, currentY + 10, imgWidth, imgHeight);
    },
    
    showExportOptions() {
    try {
        // Create unique ID for the modal to prevent conflicts
        const modalId = 'exportModal-' + Date.now();
        
        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content bg-secondary">
                        <div class="modal-header border-0">
                            <h5 class="modal-title">Export Report</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Choose export format:</p>
                            <div class="d-grid gap-2">
                                <button class="btn btn-primary export-btn" data-type="excel">
                                    <i class="fas fa-file-excel me-2"></i>Export as Excel
                                </button>
                                <button class="btn btn-danger export-btn" data-type="pdf">
                                    <i class="fas fa-file-pdf me-2"></i>Export as PDF
                                </button>
                            </div>
                        </div>
                        <div class="modal-footer border-0">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Create and append modal
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHTML;
        document.body.appendChild(modalDiv);
        
        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement);
        
        // Handle export button clicks
        const handleExport = (type) => {
            modal.hide();
            if (type === 'excel') {
                this.exportReport();
            } else {
                this.exportAsPDF();
            }
            
            // remove after animation completes
            const removeModal = () => {
                if (modalDiv && document.body.contains(modalDiv)) {
                    document.body.removeChild(modalDiv);
                }
            };
            
            // Listen for when the modal is fully hidden
            modalElement.addEventListener('hidden.bs.modal', removeModal, { once: true });
            
            // Fallback in case hidden event doesn't fire
            setTimeout(removeModal, 500);
        };
        
        // Set up event listeners
        modalElement.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', () => handleExport(btn.dataset.type));
        });
        
        // Cleanup if modal is closed without exporting
        modalElement.addEventListener('hidden.bs.modal', () => {
            setTimeout(() => {
                if (document.body.contains(modalDiv)) {
                    document.body.removeChild(modalDiv);
                }
            }, 500);
        }, { once: true });
        
        // Show the modal
        modal.show();
        
    } catch (error) {
        console.error('Error showing export options:', error);
        // Fallback to direct PDF export if modal fails
        this.exportAsPDF();
    }
},
    
    // Modify the existing exportReport method to be called from the modal
    async exportReport() {
    if (!this.reportData || this.reportData.length === 0) {
        alert('No data to export. Please generate a report first.');
        return;
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Prepare data based on report type
    let data = [];
    let sheetName = '';
    let chartDefinition = null;
    
    switch (this.reportType) {
        case 'payroll':
            data = [
                ['AZANIA PAYROLL REPORT'],
                [`Date Range: ${this.formatDateForExport(this.startDate)} to ${this.formatDateForExport(this.endDate)}`],
                [''],
                ['Employee', 'Role', 'Base Wage', 'Overtime', 'Net Pay', 'Base Hours', 'Overtime Hours'],
                ...this.payrollTableData.map(item => [
                    item.employee,
                    item.role,
                    parseFloat(item.baseSalary.replace('R', '')),
                    parseFloat(item.overtime.replace('R', '')),
                    parseFloat(item.netPay.replace('R', '')),
                    parseFloat(item.baseSalary.replace('R', '')) / this.reportData.find(d => 
                        `${d.employee_name} (EMP-${d.employee_id})` === item.employee
                    ).base_hourly_rate,
                    parseFloat(item.overtime.replace('R', '')) / this.reportData.find(d => 
                        `${d.employee_name} (EMP-${d.employee_id})` === item.employee
                    ).overtime_hourly_rate
                ])
            ];
            // Add total row
            data.push(['', '', '', '', 
                this.payrollTableData.reduce((sum, item) => sum + parseFloat(item.netPay.replace('R', '')), 0, 0)]);
            sheetName = 'Payroll Report';
            
            // Define payroll chart
            chartDefinition = {
                type: 'bar',
                data: {
                    labels: this.payrollTableData.map(item => item.employee.split('(')[0].trim()),
                    datasets: [
                        { name: 'Base Wage', values: this.payrollTableData.map(item => parseFloat(item.baseSalary.replace('R', ''))) },
                        { name: 'Overtime', values: this.payrollTableData.map(item => parseFloat(item.overtime.replace('R', ''))) }
                    ]
                },
                title: 'Payroll Breakdown',
                position: 'A' + (data.length + 3)
            };
            break;

        case 'attendance':
            data = [
                ['AZANIA ATTENDANCE REPORT'],
                [`Date Range: ${this.formatDateForExport(this.startDate)} to ${this.formatDateForExport(this.endDate)}`],
                [''],
                ['Employee', 'Normal Shifts', 'Overtime Shifts', 'Shifts Scheduled', 'Shifts Worked', 'Missed Shifts', 'Total Hours', 'Completion %'],
                ...this.attendanceTableData.map(item => [
                    item.employee,
                    item.normalShifts,
                    item.overtimeShifts,
                    item.shiftsScheduled,
                    item.shiftsWorked,
                    item.absences,
                    item.totalHours,
                    parseFloat(item.attendancePercentage)
                ])
            ];
            sheetName = 'Attendance Report';
            
            // Define attendance chart
            chartDefinition = {
                type: 'column',
                data: {
                    labels: this.attendanceTableData.map(item => item.employee.split('(')[0].trim()),
                    datasets: [
                        { name: 'Shifts Worked', values: this.attendanceTableData.map(item => item.shiftsWorked) },
                        { name: 'Missed Shifts', values: this.attendanceTableData.map(item => item.absences) }
                    ]
                },
                title: 'Attendance Overview',
                position: 'A' + (data.length + 3)
            };
            break;

        // ... [similar implementations for other report types] ...
    }

    // Convert data to worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Apply styling
    if (!wb.SSF) wb.SSF = {};
    wb.SSF['yyyy-mm-dd'] = 'yyyy-mm-dd';
    
    // Define styles
    const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0070C0" } }, // Azania blue
        border: {
            top: { style: "thin", color: { rgb: "005A9E" } },
            bottom: { style: "thin", color: { rgb: "005A9E" } },
            left: { style: "thin", color: { rgb: "005A9E" } },
            right: { style: "thin", color: { rgb: "005A9E" } }
        }
    };
    
    const titleStyle = {
        font: { bold: true, size: 16, color: { rgb: "0070C0" } }
    };
    
    const dateStyle = {
        font: { italic: true, color: { rgb: "666666" } }
    };
    
    const totalStyle = {
        font: { bold: true },
        fill: { fgColor: { rgb: "D9E1F2" } }
    };
    
    // Apply styles to cells
    ws["A1"].s = titleStyle;
    ws["A2"].s = dateStyle;
    
    // Style headers (row 4)
    const headerRow = 4;
    Object.keys(ws).forEach(key => {
        if (key.match(/^[A-Z]+4$/)) {
            ws[key].s = headerStyle;
        }
    });
    
    // Style total row if exists
    if (this.reportType === 'payroll') {
        const totalRow = data.length;
        Object.keys(ws).forEach(key => {
            if (key.match(new RegExp(`^[A-Z]+${totalRow}$`))) {
                ws[key].s = totalStyle;
            }
        });
    }
    
    // Auto-size columns
    const cols = [];
    for (let i = 0; i < data[0].length; i++) {
        cols.push({ wch: Math.max(...data.map(row => row[i] ? String(row[i]).length : 0)) + 2 });
    }
    ws['!cols'] = cols;
    
    // Add charts using ExcelJS (if available)...not working 100%
    try {
        if (window.ExcelJS) {
            const excelBlob = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(excelBlob);
            
            const worksheet = workbook.getWorksheet(sheetName);
            
            if (chartDefinition) {
                const chart = worksheet.addChart(chartDefinition.type, chartDefinition.position);
                chart.title = chartDefinition.title;
                
                chartDefinition.data.datasets.forEach((dataset, i) => {
                    chart.addSeries({
                        name: dataset.name,
                        categories: `=${sheetName}!$${String.fromCharCode(65)}$${chartDefinition.data.labels.length + 4}:$${String.fromCharCode(65 + chartDefinition.data.labels.length - 1)}$${chartDefinition.data.labels.length + 4}`,
                        values: `=${sheetName}!$${String.fromCharCode(65 + i)}$${5}:$${String.fromCharCode(65 + i)}$${chartDefinition.data.labels.length + 4}`
                    });
                });
            }
            
            // Save the enhanced workbook
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `${sheetName}_${this.startDate}_to_${this.endDate}.xlsx`);
            return;
        }
    } catch (e) {
        console.log("ExcelJS not available, exporting without charts");
    }
    
    // Fallback to basic export if ExcelJS not available
    XLSX.writeFile(wb, `${sheetName}_${this.startDate}_to_${this.endDate}.xlsx`, {
        bookType: 'xlsx',
        type: 'array'
    });
}

        },
        computed: {
            formattedDateRange() {
                if (!this.startDate || !this.endDate) return '';
                const start = new Date(this.startDate).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short'
                });
                const end = new Date(this.endDate).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short'
                });
                return `${start} - ${end}`;
            },

            attendanceColumnToDim() {
                if (this.reportType !== 'attendance') return null;
                if (this.shiftType === 'normal') return 'overtimeShifts';
                if (this.shiftType === 'overtime') return 'normalShifts';
                return null;
            }
        },
    //     watch: {
    //         reportType() {
    //             this.generateReport();
    //         },

    //          employeeId() {
    //     // Regenerate charts when employee filter changes
    //     if (this.reportData && this.reportType === 'payroll') {
    //         this.$nextTick(() => {
    //             this.initCharts();
    //         });
    //     }
    // }

    //     }

    watch: {
    reportType() {
        this.generateReport(false);
    },
    employeeId(newVal, oldVal) {
        if (newVal !== oldVal && this.reportData) {
            setTimeout(() => {
                this.generateReport(true); // Auto-generation
            }, 300);
        }
    },
    employeeId: {
        handler(newVal, oldVal) {
            // Auto-generate report when employee filter changes, but wait a bit for user to finish selecting
            if (newVal !== oldVal && this.reportData) {
                setTimeout(() => {
                    this.generateReport();
                }, 300); // Small delay to ensure user has finished selecting
            }
        },
        immediate: false
    },
    startDate: {
        handler(newVal, oldVal) {
            if (newVal !== oldVal && this.reportData) {
                setTimeout(() => {
                    this.generateReport();
                }, 300);
            }
        },
        immediate: false
    },
    endDate: {
        handler(newVal, oldVal) {
            if (newVal !== oldVal && this.reportData) {
                setTimeout(() => {
                    this.generateReport();
                }, 300);
            }
        },
        immediate: false
    },
    shiftType: {
        handler(newVal, oldVal) {
            if (this.reportType === 'attendance' && newVal !== oldVal && this.reportData) {
                setTimeout(() => {
                    this.generateReport();
                }, 300);
            }
        },
        immediate: false
    }
}
    }).mount('#app');
});