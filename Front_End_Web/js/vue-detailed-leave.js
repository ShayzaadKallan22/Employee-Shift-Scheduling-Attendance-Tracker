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

          const empResponse = await fetch('https://ifmprojv1-production.up.railway.app/api/leave/employee-summary');
          if (!empResponse.ok) throw new Error('Failed to fetch employee data');

          const typesResponse = await fetch('https://ifmprojv1-production.up.railway.app/api/leave/types');
          if (!typesResponse.ok) throw new Error('Failed to fetch leave types');

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
          const response = await fetch('https://ifmprojv1-production.up.railway.app/api/leave/stats');
          if (!response.ok) throw new Error('Failed to fetch stats');
          this.stats = await response.json();
        } catch (err) {
          console.error('Error fetching stats:', err);
        }
      },
      async fetchChartData() {
        try {
          const response = await fetch('https://ifmprojv1-production.up.railway.app/api/leave/chart-data');
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
        const type = this.leaveTypes.find(t => t.leave_type_id === typeId);
        if (!type) return 'N/A';

        const used = employee.leave_used?.find(u => u.leave_type_id === typeId)?.days || 0;
        return `${type.max_days_per_year - used}/${type.max_days_per_year}`;
      },
      getLeaveTypeName(typeId) {
        const type = this.leaveTypes.find(t => t.leave_type_id === typeId);
        return type ? type.name_ : 'Unknown';
      },
      formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-GB');
      }
    }
  }).mount('#vue-detailed-leave');
});