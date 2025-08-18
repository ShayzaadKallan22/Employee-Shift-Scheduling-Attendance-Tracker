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
        calendarModal: null
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

        //initializing tooltips
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
          this.leaveRequests = await response.json();

          this.leaveRequests.forEach(request => {
            if (request.has_events) {
              this.fetchEventDetails(
                request.employee_id,
                request.start_date,
                request.end_date
              );
            }
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
          const response = await fetch(`https://ifmprojv1-production.up.railway.app/api/leave/my/${employeeId}`);
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
      async respondToLeave(leaveId, action) {
        try {
          const response = await fetch('https://ifmprojv1-production.up.railway.app/api/leave/respond', {
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
      // async fetchEventDetails(employeeId, startDate, endDate) {
      //   try {
      //     const response = await fetch(
      //       `http://localhost:3000/api/events/check-leave?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`
      //     );
      //     const data = await response.json();
      //     this.eventDetails[`${employeeId}-${startDate}-${endDate}`] = data.events;
      //   } catch (err) {
      //     console.error('Error fetching event details:', err);
      //   }
      // },

    async fetchEventDetails(employeeId, startDate, endDate) {
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
    
    //process dates and add helper properties
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
    this.eventDetails[`${employeeId}-${startDate}-${endDate}`] = processedEvents;
    
  } catch (err) {
    console.error('Error fetching event details:', err);
    this.eventDetails[`${employeeId}-${startDate}-${endDate}`] = [];
  }
},

//helper method to get all dates in range
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

        // return events.map(e =>
        //   `${e.event_name} (${new Date(e.start_date).toLocaleDateString()})`
        // ).join('\n');
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
      
      this.currentDate = new Date();
      this.renderSimpleCalendar();
      
      if (!this.calendarModal) {
        this.calendarModal = new bootstrap.Modal(document.getElementById('calendarModal'));
      }
      this.calendarModal.show();
    } catch (error) {
      console.error('Error showing calendar:', error);
    }
  },

  // renderSimpleCalendar() {
  //   const calendarEl = document.getElementById('eventCalendar');
  //   calendarEl.innerHTML = '';
    
  //   // Create event date map
  //   const eventMap = {};
  //   this.currentEvents.forEach(event => {
  //     const dateStr = event.start_date.split('T')[0];
  //     eventMap[dateStr] = event;
  //   });

  //   // Current display month info
  //   const month = this.currentDate.getMonth();
  //   const year = this.currentDate.getFullYear();
  //   const monthName = this.currentDate.toLocaleString('default', { month: 'long' });
  //   const today = new Date();
  //   const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    
  //   // Create calendar container
  //   const calendarContainer = document.createElement('div');
  //   calendarContainer.className = 'simple-calendar';
    
  //   // Month header with navigation
  //   const header = document.createElement('div');
  //   header.className = 'calendar-header';
  //   header.innerHTML = `
  //     <div class="month-navigation">
  //       <button class="btn btn-sm btn-outline-secondary prev-month" title="Previous month">
  //         <i class="fas fa-chevron-left"></i>
  //       </button>
  //       <h5 class="month-title">${monthName} ${year}</h5>
  //       <button class="btn btn-sm btn-outline-secondary next-month" title="Next month">
  //         <i class="fas fa-chevron-right"></i>
  //       </button>
  //     </div>
  //     <div class="day-names">
  //       ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => 
  //         `<span class="day-name">${day}</span>`
  //       ).join('')}
  //     </div>
  //   `;
  //   calendarContainer.appendChild(header);
    
  //   // Navigation event listeners
  //   header.querySelector('.prev-month').addEventListener('click', () => {
  //     this.currentDate.setMonth(this.currentDate.getMonth() - 1);
  //     this.renderSimpleCalendar();
  //   });
    
  //   header.querySelector('.next-month').addEventListener('click', () => {
  //     this.currentDate.setMonth(this.currentDate.getMonth() + 1);
  //     this.renderSimpleCalendar();
  //   });
    
  //   // Calculate days
  //   const firstDay = new Date(year, month, 1).getDay();
  //   const daysInMonth = new Date(year, month + 1, 0).getDate();
    
  //   // Create days grid
  //   const daysGrid = document.createElement('div');
  //   daysGrid.className = 'calendar-days';
    
  //   // Add empty cells for days before start
  //   for (let i = 0; i < firstDay; i++) {
  //     daysGrid.appendChild(this.createDayCell(''));
  //   }
    
  //   // Add actual days
  //   for (let day = 1; day <= daysInMonth; day++) {
  //     const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  //     const hasEvent = eventMap[dateStr];
  //     const isToday = isCurrentMonth && day === today.getDate();
      
  //     const dayCell = this.createDayCell(day, hasEvent, isToday);
  //     dayCell.addEventListener('click', () => {
  //       if (hasEvent) {
  //         const event = eventMap[dateStr];
  //         document.getElementById('eventDetails').value = 
  //           `Event: ${event.event_name}\n` +
  //           `Date: ${dateStr}\n` +
  //           `Time: ${event.start_time} - ${event.end_time}\n` +
  //           `Location: ${event.location || 'No location'}\n` +
  //           `Description: ${event.description || 'No description'}`;
  //       } else {
  //         document.getElementById('eventDetails').value = 
  //           `No events scheduled for ${dateStr}`;
  //       }
  //     });
  //     daysGrid.appendChild(dayCell);
  //   }
    
  //   calendarContainer.appendChild(daysGrid);
  //   calendarEl.appendChild(calendarContainer);
    
  //   // Clear details when changing months
  //   document.getElementById('eventDetails').value = 'Select a date to view event details';
  // },

  renderSimpleCalendar() {
  console.log('Rendering calendar for month:', this.currentDate.getMonth() + 1);
  
  const calendarEl = document.getElementById('eventCalendar');
  calendarEl.innerHTML = '';
  
  //create a map of all event days
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

  //current month info
  const month = this.currentDate.getMonth();
  const year = this.currentDate.getFullYear();
  const monthName = this.currentDate.toLocaleString('default', { month: 'long' });
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  
  //create calendar container
  const calendarContainer = document.createElement('div');
  calendarContainer.className = 'simple-calendar';
  
  //month header with navigation
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
  
  //navigation event listeners
  header.querySelector('.prev-month').addEventListener('click', () => {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.renderSimpleCalendar();
  });
  
  header.querySelector('.next-month').addEventListener('click', () => {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.renderSimpleCalendar();
  });
  
  //calculate days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  //create days grid
  const daysGrid = document.createElement('div');
  daysGrid.className = 'calendar-days';
  
  //add empty cells for days before start
  for (let i = 0; i < firstDay; i++) {
    daysGrid.appendChild(this.createDayCell(''));
  }
  
  //add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = eventDaysMap[dateStr] || [];
    const isToday = isCurrentMonth && day === today.getDate();
    
    const dayCell = this.createDayCell(day, dayEvents.length, isToday);
    
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
  
  //clear details when changing months
  document.getElementById('eventDetails').value = 'Select a date to view event details';
},
  
  createDayCell(day, eventCount = 0, isToday = false) {
  const cell = document.createElement('div');
  cell.className = `calendar-day ${eventCount > 0 ? 'has-event' : ''} ${isToday ? 'today' : ''} ${!day ? 'empty' : ''}`;
  
  if (day) {
    cell.innerHTML = `
      <span class="day-number">${day}</span>
      ${this.renderEventIndicators(eventCount)}
    `;
  }
  
  return cell;
},

renderEventIndicators(count) {
  if (count <= 0) return '';
  
  //show up to 3 dots, with special case for many events
  const dotCount = Math.min(count, 3);
  const dots = Array(dotCount).fill('<span class="event-dot"></span>').join('');
  
  return `
    <div class="event-indicators">
      ${dots}
      ${count > 3 ? `<span class="event-more">+${count - 3}</span>` : ''}
    </div>
  `;
}}
  }).mount('#vue-leave-requests');
});