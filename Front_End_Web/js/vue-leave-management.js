// leave-management.js
document.addEventListener('DOMContentLoaded', () => {
  const { createApp } = Vue;

  createApp({
    data() {
      return {
        leaveRequests: [] //--> populated from API
      };
    },
    mounted() {
      this.fetchLeaveRequests();
    },
    methods: {
      //fetch all leave requests
      async fetchLeaveRequests() {
        try {
          const response = await fetch('https://ifmprojv1-production.up.railway.app/api/leave/all');
          this.leaveRequests = await response.json();
        } catch (err) {
          console.error('Failed to fetch leave requests:', err);
        }
      },
      // Approve/Reject a request
      async respondToLeave(leaveId, action) {
        try {
          const response = await fetch('https://ifmprojv1-production.up.railway.app/api/leave/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leave_id: leaveId, action })
          });

          if (response.ok) {
            alert(`Leave request ${action}!`);
            this.fetchLeaveRequests(); // Refresh the list
          } else {
            alert('Failed to update leave request.');
          }
        } catch (err) {
          console.error('Error:', err);
        }
      },
      //Helper: Format date as "DD-MM-YYYY"
      formatDate(dateString) {
        if (!dateString || dateString.startsWith('0000-00-00')) {
          return "None";
        }
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB');
      },

      //Calculate remaining leave days

      calculateDaysRemaining(request) {
        const maxDays = request.max_days_per_year || 0;
        const daysRequested = request.days_requested || 0;
        const remaining = maxDays - daysRequested;
        return `${remaining}/${maxDays}`;
      }
    }
  }).mount('#vue-leave-requests');
});