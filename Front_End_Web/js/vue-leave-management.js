document.addEventListener('DOMContentLoaded', () => {
  const { createApp } = Vue;

  createApp({
    data() {
      return {
        leaveRequests: [],
        employeeDetails: null,
        employeeModal: null // We'll store the Bootstrap modal instance here
      };
    },
    mounted() {
      this.fetchLeaveRequests();
      // Initialize modal after Vue has mounted the DOM
      this.$nextTick(() => {
        const modalElement = document.getElementById('employeeLeaveModal');
        if (modalElement) {
          this.employeeModal = new bootstrap.Modal(modalElement);
        }
      });
    },
    methods: {
      async fetchLeaveRequests() {
        try {
          const response = await fetch('http://localhost:3000/api/leave/all');
          this.leaveRequests = await response.json();
        } catch (err) {
          console.error('Failed to fetch leave requests:', err);
        }
      },
      
      async fetchEmployeeLeaveHistory(employeeId) {
        try {
          const response = await fetch(`http://localhost:3000/api/leave/my/${employeeId}`);
          return await response.json();
        } catch (err) {
          console.error('Failed to fetch employee leave history:', err);
          return [];
        }
      },
      
      async showEmployeeLeaveHistory(employee) {
        try {
          this.employeeDetails = {
            ...employee,
            leaveHistory: await this.fetchEmployeeLeaveHistory(employee.employee_id)
          };
          
          // Show the modal
          if (this.employeeModal) {
            this.employeeModal.show();
          }
        } catch (err) {
          console.error('Error showing employee leave history:', err);
        }
      },

      async respondToLeave(leaveId, action) {
        try {
          const response = await fetch('http://localhost:3000/api/leave/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leave_id: leaveId, action })
          });

          if (response.ok) {
            alert(`Leave request ${action}!`);
            this.fetchLeaveRequests();
          } else {
            alert('Failed to update leave request.');
          }
        } catch (err) {
          console.error('Error:', err);
        }
      },
      
      formatDate(dateString) {
        if (!dateString || dateString.startsWith('0000-00-00')) {
          return "None";
        }
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB');
      },

      calculateDaysRemaining(request) {
        const maxDays = request.max_days_per_year || 0;
        const daysRequested = request.days_requested || 0;
        const remaining = maxDays - daysRequested;
        return `${remaining}/${maxDays}`;
      }
    }
  }).mount('#vue-leave-requests');
});