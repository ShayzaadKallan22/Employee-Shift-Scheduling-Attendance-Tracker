// Yatin
document.addEventListener('DOMContentLoaded', () => {
  const { createApp } = Vue;

  createApp({
    data() {
      return {
        leaveRequests: [],
        employeeDetails: null,
        employeeModal: null,
        isLoading: true,
        eventDetails: {},
        calendar: null,
        calendarModal: null,
        standbyData: {},
        loadingStandby: {},
        loadingEvents: {},
        rejectingLeaveId: null,
        rejectionReason: '',
        customRejectionMessage: '',
        rejectionReasons: [],
        standbyDetails: {
          employee: '',
          available: 0,
          total: 0,
          employees: []
        },
        standbyModal: null,
        showStandbyModal: false
      };
    },
    mounted() {
      console.log('Vue mounted, methods:', Object.keys(this.$options.methods));
      this.calendarModal = new bootstrap.Modal(document.getElementById('calendarModal'));
      this.fetchLeaveRequests();
      this.$nextTick(() => {
        const modalElement = document.getElementById('employeeLeaveModal');
        if (modalElement) {
          this.employeeModal = new bootstrap.Modal(modalElement);
        }

        //Initialize the standby modal
        const standbyModalElement = document.getElementById('standbyModal');
        if (standbyModalElement) {
          this.standbyModal = new bootstrap.Modal(standbyModalElement);
        }

        //Initialize tooltips
        this.tooltipList = [];
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        this.tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
          return new bootstrap.Tooltip(tooltipTriggerEl);
        });
      });
    },
    watch: {
      leaveRequests() {
        this.$nextTick(() => {
          if (this.tooltipList) {
            this.tooltipList.forEach(tooltip => tooltip.dispose());
          }

          const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
          this.tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
          });
        });
      }
    },
    methods: {

      async fetchLeaveRequests() {
        this.isLoading = true;
        try {
          const response = await fetch('http://localhost:3000/api/leave/all');
          const data = await response.json();
          console.log('Fetched leave requests:', data);
          this.leaveRequests = data;

          //Create an array of promises for event fetching
          const eventFetchPromises = this.leaveRequests.map(request => {
            if (request.has_events) {
              return this.fetchEventDetails(
                request.employee_id,
                request.start_date,
                request.end_date
              );
            }
            return Promise.resolve();
          });

          //Wait for all event data to be fetched
          await Promise.all(eventFetchPromises);

          //Pre-load standby data for all requests with a delay
          this.leaveRequests.forEach((request, index) => {
            setTimeout(() => {
              this.loadStandbyData(request);
            }, index * 300);
          });
        } catch (err) {
          console.error('Failed to fetch leave requests:', err);
          this.leaveRequests = [];
        } finally {
          this.isLoading = false;
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

          if (this.employeeModal) {
            this.employeeModal.show();
          }
        } catch (err) {
          console.error('Error showing employee leave history:', err);
        }
      },


      async respondToLeave(leaveId, action, rejectionReason = '', customMessage = '') {
        try {
          //Get manager ID from localStorage
          const userData = localStorage.getItem('user');
          let manager_id = null;

          if (userData) {
            try {
              const user = JSON.parse(userData);
              manager_id = user.id;
              console.log('Using manager ID from localStorage:', manager_id);
            } catch (e) {
              console.error('Error parsing user data:', e);
            }
          }

          const requestBody = {
            leave_id: leaveId,
            action,
            rejection_reason: rejectionReason,
            custom_message: customMessage
          };

          //Add manager_id to the request if available
          if (manager_id) {
            requestBody.manager_id = manager_id;
          }

          const response = await fetch('http://localhost:3000/api/leave/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            this.showToast(`Leave request ${action === 'approved' ? 'approved' : 'rejected'} successfully!`, 'success');
            this.fetchLeaveRequests();
          } else {
            this.showToast('Failed to update leave request. Please try again.', 'error');
          }
        } catch (err) {
          console.error('Error:', err);
          this.showToast('An error occurred. Please check your connection.', 'error');
        }
      },

      //method to show rejection modal
      showRejectionModal(request) {
        this.rejectingLeaveId = request.leave_id;
        this.rejectionReason = '';
        this.customRejectionMessage = '';

        //Auto-detect possible rejection reasons
        this.autoDetectRejectionReasons(request);

        //Show rejection modal
        const rejectionModal = new bootstrap.Modal(document.getElementById('rejectionModal'));
        rejectionModal.show();
      },

      //Auto-detect rejection reasons based on leave request analysis
      autoDetectRejectionReasons(request) {
        const reasons = [];

        //Check for events
        const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
        const events = this.eventDetails[key];
        if (events && events.length > 0) {
          reasons.push({
            value: 'event_conflict',
            text: `Event Conflict (${events.length} events scheduled during leave)`,
            description: 'Employee has important events scheduled during this period'
          });
        }

        //Check standby availability
        const leaveId = request.leave_id;
        const standby = this.standbyData[leaveId];
        if (standby) {
          if (standby.available === 0 && standby.total > 0) {
            reasons.push({
              value: 'insufficient_standby',
              text: `Insufficient Standby (0/${standby.total} available)`,
              description: 'No standby staff available to cover this period'
            });
          } else if (standby.available < 2) { //Threshold for low availability
            reasons.push({
              value: 'insufficient_standby',
              text: `Low Standby Availability (${standby.available}/${standby.total} available)`,
              description: 'Limited standby staff available'
            });
          }
        }

        //Check if it's a peak period
        if (this.isPeakPeriod(request.start_date, request.end_date)) {
          reasons.push({
            value: 'peak_period',
            text: 'Peak Business Period',
            description: 'Leave falls during high-demand business period'
          });
        }

        //Check leave balance
        if (request.used_days && request.max_days_per_year) {
          const remaining = request.max_days_per_year - request.used_days;
          const requestedDays = request.days_requested ||
            (new Date(request.end_date) - new Date(request.start_date)) / (1000 * 60 * 60 * 24) + 1;

          if (remaining < requestedDays) {
            reasons.push({
              value: 'insufficient_leave_balance',
              text: `Insufficient Leave Balance (${remaining}/${requestedDays} days available)`,
              description: 'Employee does not have enough leave days remaining'
            });
          }
        }

        reasons.push({
          value: 'other',
          text: 'Other Reason',
          description: 'Specify custom reason below'
        });

        this.rejectionReasons = reasons;
      },

      //Helper method to check peak periods
      isPeakPeriod(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        //Check if period includes weekend
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
          const day = date.getDay();
          if (day === 0 || day === 6) { //Saturday or Sunday
            return true;
          }
        }

        return false;
      },


      submitRejection() {
        if (!this.rejectionReason && this.rejectionReason !== 'other') {
          this.showToast('Please select a rejection reason', 'error');
          return;
        }

        if (this.rejectionReason === 'other' && !this.customRejectionMessage.trim()) {
          this.showToast('Please provide a reason for rejection', 'error');
          return;
        }

        this.respondToLeave(
          this.rejectingLeaveId,
          'rejected',
          this.rejectionReason,
          this.customRejectionMessage
        );

        //Close modal
        const rejectionModal = bootstrap.Modal.getInstance(document.getElementById('rejectionModal'));
        rejectionModal.hide();
      },

      //Toast notification method
      showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toastId = 'toast-' + Date.now();
        const icon = type === 'success' ? 'fa-check-circle' :
          type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

        const toastHTML = `
      <div id="${toastId}" class="toast custom-toast toast-${type} toast-enter" role="alert">
        <div class="toast-header bg-transparent border-bottom-0">
          <i class="fas ${icon} toast-icon text-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'}"></i>
          <strong class="me-auto">Leave Management</strong>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
        <div class="toast-progress"></div>
      </div>
    `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);

        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
          autohide: true,
          delay: 3000
        });

        toast.show();

        //Remove toast from DOM after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
          toastElement.classList.remove('toast-enter');
          toastElement.classList.add('toast-exit');

          setTimeout(() => {
            if (toastElement.parentNode) {
              toastElement.parentNode.removeChild(toastElement);
            }
          }, 5000);
        });
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
        const daysRequested = request.days_requested ||
          (new Date(request.end_date) - new Date(request.start_date)) / (1000 * 60 * 60 * 24) + 1;
        const usedDays = request.used_days || 0;

        const remaining = maxDays - usedDays;
        return `${remaining}/${maxDays}`;
      },
      async checkForEvents(employeeId, startDate, endDate) {
        try {
          const response = await fetch(
            `http://localhost:3000/api/events/check-leave?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`
          );
          return await response.json();
        } catch (err) {
          console.error('Error checking for events:', err);
          return { hasEvents: false, events: [] };
        }
      },

      async fetchEventDetails(employeeId, startDate, endDate) {
        return new Promise(async (resolve, reject) => {
          const key = `${employeeId}-${startDate}-${endDate}`;
          this.loadingEvents[key] = true;

          try {
            console.log(`Fetching events for employee ${employeeId} from ${startDate} to ${endDate}`);
            const response = await fetch(
              `http://localhost:3000/api/events/check-leave?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`
            );

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Raw events data from API:', data);

            const processedEvents = data.events.map(event => {
              const startDate = new Date(event.start_date);
              const endDate = new Date(event.end_date);
              const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

              return {
                ...event,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                durationDays,
                allDates: this.getDateRangeArray(startDate, endDate)
              };
            });

            console.log('Processed events:', processedEvents);
            this.eventDetails[key] = processedEvents;
            resolve(processedEvents);
          } catch (err) {
            console.error('Error fetching event details:', err);
            this.eventDetails[key] = [];
            reject(err);
          } finally {
            this.loadingEvents[key] = false;
          }
        });
      },

      getDateRangeArray(startDate, endDate) {
        const dates = [];
        let currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
          dates.push(new Date(currentDate).toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
      },
      getEventTooltip(employeeId, startDate, endDate) {
        const key = `${employeeId}-${startDate}-${endDate}`;
        const events = this.eventDetails[key] || [];

        if (events.length === 0) return '';
        //added icons for style 
        return events.map(event =>
          `${event.event_name}\n` +
          `📅 ${event.start_date} to ${event.end_date}\n` +
          `⏰ ${event.start_time} - ${event.end_time}\n` +
          `📍 ${event.location || 'No location'}\n` +
          `📝 ${event.description || 'No description'}\n`
        ).join('\n\n');
      },


      showCalendar(request) {
        try {
          this.currentRequest = request;
          const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
          this.currentEvents = this.eventDetails[key] || [];

          //Store the leave period dates
          this.leaveStartDate = new Date(request.start_date);
          this.leaveEndDate = new Date(request.end_date);

          // this.currentDate = new Date();
          this.currentDate = new Date(request.start_date);
          this.renderSimpleCalendar();

          if (!this.calendarModal) {
            this.calendarModal = new bootstrap.Modal(document.getElementById('calendarModal'));
          }

          // modal title to show the leave period
          const modalTitle = document.getElementById('calendarModalTitle');
          if (modalTitle) {
            modalTitle.textContent = `Events during Leave: ${this.formatDate(request.start_date)} to ${this.formatDate(request.end_date)}`;
          }

          this.calendarModal.show();
        } catch (error) {
          console.error('Error showing calendar:', error);
        }
      },

      renderSimpleCalendar() {
        console.log('Rendering calendar for month:', this.currentDate.getMonth() + 1);

        const calendarEl = document.getElementById('eventCalendar');
        calendarEl.innerHTML = '';

        //map of all event days
        const eventDaysMap = {};
        this.currentEvents.forEach(event => {
          event.allDates.forEach(date => {
            if (!eventDaysMap[date]) {
              eventDaysMap[date] = [];
            }
            eventDaysMap[date].push(event);
          });
        });

        console.log('Event days map:', eventDaysMap);

        //Current month info
        const month = this.currentDate.getMonth();
        const year = this.currentDate.getFullYear();
        const monthName = this.currentDate.toLocaleString('default', { month: 'long' });
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        // calendar container
        const calendarContainer = document.createElement('div');
        calendarContainer.className = 'simple-calendar';

        //Month header with navigation
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.innerHTML = `
    <div class="month-navigation">
      <button class="btn btn-sm btn-outline-secondary prev-month" title="Previous month">
        <i class="fas fa-chevron-left"></i>
      </button>
      <h5 class="month-title">${monthName} ${year}</h5>
      <button class="btn btn-sm btn-outline-secondary next-month" title="Next month">
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
    <div class="day-names">
      ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day =>
          `<span class="day-name">${day}</span>`
        ).join('')}
    </div>
  `;
        calendarContainer.appendChild(header);

        //Navigation event listeners
        header.querySelector('.prev-month').addEventListener('click', () => {
          this.currentDate.setMonth(this.currentDate.getMonth() - 1);
          this.renderSimpleCalendar();
        });

        header.querySelector('.next-month').addEventListener('click', () => {
          this.currentDate.setMonth(this.currentDate.getMonth() + 1);
          this.renderSimpleCalendar();
        });

        //Calculate days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        //Create days grid
        const daysGrid = document.createElement('div');
        daysGrid.className = 'calendar-days';

        // empty cells for days before start
        for (let i = 0; i < firstDay; i++) {
          daysGrid.appendChild(this.createDayCell(''));
        }

        // actual days
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const currentDateObj = new Date(year, month, day);
          const dayEvents = eventDaysMap[dateStr] || [];
          const isToday = isCurrentMonth && day === today.getDate();

          //Check if this day is within the requested leave period
          const isLeaveDay = this.isDateInLeavePeriod(currentDateObj);

          const dayCell = this.createDayCell(day, dayEvents.length, isToday, isLeaveDay);

          dayCell.addEventListener('click', () => {
            if (dayEvents.length > 0) {
              const eventDetails = dayEvents.map(event =>
                `Event: ${event.event_name}\n` +
                `Date Range: ${event.start_date} to ${event.end_date}\n` +
                `Time: ${event.start_time} - ${event.end_time}\n` +
                `Location: ${event.location || 'No location'}\n` +
                `Description: ${event.description || 'No description'}\n` +
                `Role: ${event.role || 'Not specified'}\n\n`
              ).join('');

              document.getElementById('eventDetails').value = eventDetails;
            } else {
              document.getElementById('eventDetails').value =
                `No events scheduled for ${dateStr}`;
            }
          });

          daysGrid.appendChild(dayCell);
        }

        calendarContainer.appendChild(daysGrid);
        calendarEl.appendChild(calendarContainer);

        //Clear details when changing months
        document.getElementById('eventDetails').value = 'Select a date to view event details';


        const legend = document.createElement('div');
        legend.className = 'calendar-legend';
        legend.innerHTML = `
  <div class="legend-item">
    <div class="legend-color legend-leave"></div>
    <span>Requested Leave</span>
  </div>
  <div class="legend-item">
    <div class="legend-color legend-event"></div>
    <span>Scheduled Event</span>
  </div>
  <div class="legend-item">
    <div class="legend-color legend-today"></div>
    <span>Today</span>
  </div>
`;

        calendarContainer.appendChild(legend);
      },

      isDateInLeavePeriod(date) {
        if (!this.leaveStartDate || !this.leaveEndDate) return false;

        //Normalize dates to compare without time
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        const startDate = new Date(this.leaveStartDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(this.leaveEndDate);
        endDate.setHours(0, 0, 0, 0);

        return checkDate >= startDate && checkDate <= endDate;
      },

      createDayCell(day, eventCount = 0, isToday = false, isLeaveDay = false) {
        const cell = document.createElement('div');
        cell.className = `calendar-day ${eventCount > 0 ? 'has-event' : ''} ${isToday ? 'today' : ''} ${isLeaveDay ? 'leave-day' : ''} ${!day ? 'empty' : ''}`;

        if (day) {
          cell.innerHTML = `
      <span class="day-number">${day}</span>
      ${this.renderEventIndicators(eventCount)}
    `;

          // tooltip for leave days
          if (isLeaveDay) {
            cell.title = 'Requested leave day';
          }
        }

        return cell;
      },

      renderEventIndicators(count) {
        if (count <= 0) return '';

        const dotCount = Math.min(count, 3);
        const dots = Array(dotCount).fill('<span class="event-dot"></span>').join('');

        return `
          <div class="event-indicators">
            ${dots}
            ${count > 3 ? `<span class="event-more">+${count - 3}</span>` : ''}
          </div>
        `;
      },
      //Standby methods
      async loadStandbyData(request) {
        const leaveId = request.leave_id;

        //If we already have data for this request, don't fetch again
        if (this.standbyData[leaveId]) {
          return;
        }

        //Set loading state
        this.loadingStandby[leaveId] = true;

        try {
          const response = await fetch('http://localhost:3000/api/leave/check-standby', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: request.employee_id,
              start_date: request.start_date,
              end_date: request.end_date
            })
          });

          if (response.ok) {
            const data = await response.json();
            // Store the data by leave_id
            this.standbyData[leaveId] = {
              available: data.available,
              total: data.total
            };
          }
        } catch (err) {
          console.error('Error fetching standby data for leave', leaveId, err);
        } finally {
          this.loadingStandby[leaveId] = false;
        }
      },
      getStandbyInfo(request) {
        const leaveId = request.leave_id;
        const standby = this.standbyData[leaveId];
        const isLoading = this.loadingStandby[leaveId];

        //If loading, show loading message
        if (isLoading) {
          return 'Checking availability...';
        }

        //If no data yet, trigger loading
        if (!standby) {
          this.loadStandbyData(request);
          return 'Click to check availability';
        }

        const available = standby.available;
        const total = standby.total;

        if (total === 0) {
          return 'No standby employees for this role';
        }

        if (available === 0) {
          return 'No standby available (all on leave)';
        }

        return `${available}/${total} standby available`;
      },
      getStandbyClass(request) {
        const leaveId = request.leave_id;
        const standby = this.standbyData[leaveId];
        const isLoading = this.loadingStandby[leaveId];

        //If loading or no data yet
        if (isLoading || !standby) {
          return 'text-muted';
        }

        const available = standby.available;
        const total = standby.total;

        if (total === 0) {
          return 'text-warning';
        }

        if (available === 0) {
          return 'text-danger';
        }

        return 'text-success';
      },



      async showStandbyDetails(request) {
        try {
          const response = await fetch('http://localhost:3000/api/leave/check-standby', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: request.employee_id,
              start_date: request.start_date,
              end_date: request.end_date
            })
          });

          if (response.ok) {
            const data = await response.json();

            //Update standbyDetails with the response data
            this.standbyDetails = {
              employee: `${request.first_name} ${request.last_name}`,
              available: data.available,
              total: data.total,
              employees: data.standbyEmployees || []
            };

            // update our local storage
            const leaveId = request.leave_id;
            this.standbyData[leaveId] = {
              available: data.available,
              total: data.total
            };

            //Show the modal using Bootstrap
            const modalElement = document.getElementById('standbyModal');
            if (modalElement) {
              const modal = new bootstrap.Modal(modalElement);
              modal.show();
            }
          }
        } catch (err) {
          console.error('Error fetching standby details:', err);
        }
      },


      generateRecommendation(request) {
        //Check for events using our eventDetails data
        const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
        const events = this.eventDetails[key];
        const hasEvents = events && events.length > 0;
        const eventCount = hasEvents ? events.length : 0;

        const daysRequested = request.days_requested;

        //Get standby data
        const leaveId = request.leave_id;
        const standby = this.standbyData[leaveId];
        const isLoading = this.loadingStandby[leaveId];

        if (isLoading) {
          return 'Analyzing request... 🔄';
        }

        if (!standby) {
          return 'Click standby info to analyze availability';
        }

        const availableStandby = standby.available;
        const totalStandby = standby.total;

        //Decision logic
        if (hasEvents && availableStandby === 0) {
          return `❌ REJECT: Employee is scheduled for ${eventCount} event(s) during leave period and no standby available.`;
        }

        if (hasEvents && availableStandby > 0) {
          return `⚠️ ATTENTION: Employee has ${eventCount} event(s) but ${availableStandby} standby available.`;
        }

        if (!hasEvents && availableStandby === 0 && totalStandby > 0) {
          return `⚠️ ATTENTION: No events scheduled but all ${totalStandby} standby employees are unavailable. Ensure coverage can be managed.`;
        }

        if (!hasEvents && availableStandby > 0) {
          return `✅ APPROVE: No events scheduled and ${availableStandby}/${totalStandby} standby employees available.`;
        }

        if (!hasEvents && totalStandby === 0) {
          return `⚠️ ATTENTION: No events scheduled but no standby employees for this role. Ensure department can operate with reduced staff.`;
        }

        return 'Review required: Unable to generate recommendation.';
      },

      getRecommendationClass(request) {
        //Check for events using our eventDetails data
        const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
        const events = this.eventDetails[key];
        const hasEvents = events && events.length > 0;

        //Get standby data
        const leaveId = request.leave_id;
        const standby = this.standbyData[leaveId];

        if (!standby) {
          return 'text-info';
        }

        const availableStandby = standby.available;

        if (hasEvents && availableStandby === 0) {
          return 'text-danger';
        }

        if ((hasEvents && availableStandby > 0) || (!hasEvents && availableStandby === 0)) {
          return 'text-warning';
        }

        if (!hasEvents && availableStandby > 0) {
          return 'text-success';
        }

        return 'text-info';
      },

      hasEventsDuringLeave(request) {
        const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
        const events = this.eventDetails[key];
        return events && events.length > 0;
      },


      getEventDetails(request) {
        const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;

        //Check if events are still loading
        if (this.loadingEvents[key]) {
          return 'Checking for events...';
        }

        const events = this.eventDetails[key];

        if (!events || events.length === 0) {
          return 'No events scheduled during this period.';
        }

        const eventNames = events.map(event => event.event_name);
        return `Conflicting events: ${eventNames.join(', ')}`;
      },


    }
  }).mount('#vue-leave-requests');
});