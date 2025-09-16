document.addEventListener('DOMContentLoaded', () => {
  const { createApp } = Vue;

  createApp({
    data() {
      return {
        employees: [],
        leaveTypes: [],
        loading: true,
        error: null,
        stats: {
          totalEmployees: 0,
          onLeaveToday: 0,
          pendingRequests: 0,
          leaveThisMonth: 0
        },
        chart: null
      };
    },
    mounted() {
      this.fetchLeaveData();
      this.fetchStats();
      this.fetchChartData();
    },
    methods: {
      async fetchLeaveData() {
        try {
          console.log("Fetching leave data...");
          this.loading = true;
          this.error = null;

          const [empResponse, typesResponse] = await Promise.all([
            fetch('http://localhost:3000/api/leave/employee-summary'),
            fetch('http://localhost:3000/api/leave/types')
          ]);

          if (!empResponse.ok) {
            const errorData = await empResponse.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch employee data');
          }

          if (!typesResponse.ok) {
            const errorData = await typesResponse.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch leave types');
          }

          this.employees = await empResponse.json();
          this.leaveTypes = await typesResponse.json();

          console.log("Data loaded successfully:", {
            employees: this.employees,
            leaveTypes: this.leaveTypes
          });

        } catch (err) {
          console.error('Error fetching leave data:', err);
          this.error = err.message;
        } finally {
          this.loading = false;
        }
      },
      
      async fetchStats() {
        try {
          const response = await fetch('http://localhost:3000/api/leave/stats');
          if (!response.ok) throw new Error('Failed to fetch stats');
          this.stats = await response.json();
        } catch (err) {
          console.error('Error fetching stats:', err);
        }
      },
      async fetchChartData() {
        try {
          const response = await fetch('http://localhost:3000/api/leave/chart-data');
          if (!response.ok) throw new Error('Failed to fetch chart data');
          const chartData = await response.json();

          this.initChart(chartData);
        } catch (err) {
          console.error('Error fetching chart data:', err);
        }
      },

      initChart(chartData) {
        const ctx = document.getElementById('leaveChart').getContext('2d');

        // Destroy previous chart if it exists
        if (this.chart) {
          this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: chartData.map(item => item.leave_type),
            datasets: [{
              label: 'Total Days Taken',
              data: chartData.map(item => item.total_days),
              backgroundColor: [
                'rgba(255, 99, 132, 0.7)',
                'rgba(54, 162, 235, 0.7)',
                'rgba(255, 206, 86, 0.7)'
              ],
              borderRadius: 5,
            }]
          },
          options: {
            animation: { duration: 1500 },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    return `${context.dataset.label}: ${context.raw} days`;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Days Taken',
                  font: {
                    weight: 'bold'
                  }
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Leave Types',
                  font: {
                    weight: 'bold'
                  }
                }
              }
            }
          }
        });
      },
      
      getRemainingDays(employee, typeId) {
        if (!employee.leave_balances) return 'N/A';
        
        const balance = employee.leave_balances.find(b => b.leave_type_id == typeId);
        if (!balance) return 'N/A';
        
        const remaining = balance.max_days - balance.used_days;
        return `${remaining}/${balance.max_days}`;
      },

      // getLeaveTypeName(typeId, request, employee) {
      //   if (!this.leaveTypes.length) return 'Loading...';
      //   const type = this.leaveTypes.find(t => t.leave_type_id == typeId);
      //   let typeName = type ? type.name_ : 'Unknown';
        
      //   // Always show clickable PDF icon for sick leave
      //   if (typeId == 2) {
      //     const hasNote = request.sick_note;
      //     const iconStyle = hasNote ? 
      //       'style="cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'scale(1)\'"' : 
      //       'style="cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'scale(1)\'"';
      //     typeName += ` <i class="fas fa-file-pdf ms-2 ${hasNote ? 'text-danger' : 'text-danger'}" 
      //                   ${iconStyle}
      //                   onclick="window.location.href='/view-sick-note.html?note=${encodeURIComponent(request.sick_note)}&employeeId=${employee.employee_id}&startDate=${request.start_date}&endDate=${request.end_date}&employeeName=${encodeURIComponent(employee.first_name + ' ' + employee.last_name)}&daysTaken=${request.days_taken || (new Date(request.end_date) - new Date(request.start_date)) / (1000 * 60 * 60 * 24) + 1}'"></i>`;
      //   }
        
      //   return typeName;
      // },

      getLeaveTypeName(typeId, request, employee) {
  if (!this.leaveTypes.length) return 'Loading...';
  const type = this.leaveTypes.find(t => t.leave_type_id == typeId);
  let typeName = type ? type.name_ : 'Unknown';
  
  // Always show clickable PDF icon for sick leave
  if (typeId == 2) {
    const hasNote = request.sick_note;
    const iconStyle = hasNote ? 
      'style="cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'scale(1)\'"' : 
      'style="cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.transform=\'scale(1.2)\'" onmouseout="this.style.transform=\'scale(1)\'"';
    
    // Use the Supabase URL directly from the database
    typeName += ` <i class="fas fa-file-pdf ms-2 ${hasNote ? 'text-danger' : 'text-danger'}" 
                  ${iconStyle}
                  onclick="window.location.href='/view-sick-note.html?note=${encodeURIComponent(request.sick_note)}&employeeId=${employee.employee_id}&startDate=${request.start_date}&endDate=${request.end_date}&employeeName=${encodeURIComponent(employee.first_name + ' ' + employee.last_name)}&daysTaken=${request.days_taken || (new Date(request.end_date) - new Date(request.start_date)) / (1000 * 60 * 60 * 24) + 1}'"></i>`;
  }
  
  return typeName;
},

      formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-GB');
      },

      hasSickNote(employee) {
        return employee.leave_requests?.some(
          req => req.leave_type_id == 2 && req.sick_note
        );
      },
      
      getSickNote(employee) {
        const sickLeave = employee.leave_requests?.find(
          req => req.leave_type_id == 2
        );
        return sickLeave?.sick_note || '';
      },
      
      getSickLeaveRequest(employee) {
        return employee.leave_requests?.find(
          req => req.leave_type_id == 2 // Sick leave type ID
        );
      },
    }
  }).mount('#vue-detailed-leave');
});