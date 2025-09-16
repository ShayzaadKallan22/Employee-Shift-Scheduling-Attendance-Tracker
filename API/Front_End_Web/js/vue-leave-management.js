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
        // Add these properties with proper initialization
        standbyData: {},
        loadingStandby: {},
        loadingEvents: {},
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

        // Initialize the standby modal
        const standbyModalElement = document.getElementById('standbyModal');
        if (standbyModalElement) {
          this.standbyModal = new bootstrap.Modal(standbyModalElement);
        }

        // Initialize tooltips
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
      // async fetchLeaveRequests() {
      //   this.isLoading = true;
      //   try {
      //     const response = await fetch('http://localhost:3000/api/leave/all');
      //     this.leaveRequests = await response.json();

      //     this.leaveRequests.forEach(request => {
      //       if (request.has_events) {
      //         this.fetchEventDetails(
      //           request.employee_id,
      //           request.start_date,
      //           request.end_date
      //         );
      //       }
      //     });
      //   } catch (err) {
      //     console.error('Failed to fetch leave requests:', err);
      //     this.leaveRequests = [];
      //   } finally {
      //     this.isLoading = false;
      //   }
      // },
      
//       async fetchLeaveRequests() {
//   this.isLoading = true;
//   try {
//     const response = await fetch('http://localhost:3000/api/leave/all');
//     const data = await response.json();
//     console.log('Fetched leave requests:', data);
//     this.leaveRequests = data;

//     // Pre-load standby data for all requests with a delay to avoid API overload
//     this.leaveRequests.forEach((request, index) => {
//       setTimeout(() => {
//         this.loadStandbyData(request);
//       }, index * 300); // Stagger requests by 300ms
      
//       if (request.has_events) {
//         this.fetchEventDetails(
//           request.employee_id,
//           request.start_date,
//           request.end_date
//         );
//       }
//     });
//   } catch (err) {
//     console.error('Failed to fetch leave requests:', err);
//     this.leaveRequests = [];
//   } finally {
//     this.isLoading = false;
//   }
// },

async fetchLeaveRequests() {
  this.isLoading = true;
  try {
    const response = await fetch('http://localhost:3000/api/leave/all');
    const data = await response.json();
    console.log('Fetched leave requests:', data);
    this.leaveRequests = data;

    // Create an array of promises for event fetching
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

    // Wait for all event data to be fetched
    await Promise.all(eventFetchPromises);
    
    // Pre-load standby data for all requests with a delay
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
      //     console.log(`Fetching events for employee ${employeeId} from ${startDate} to ${endDate}`);
      //     const response = await fetch(
      //       `http://localhost:3000/api/events/check-leave?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`
      //     );

      //     if (!response.ok) {
      //       throw new Error(`HTTP error! status: ${response.status}`);
      //     }

      //     const data = await response.json();
      //     console.log('Raw events data from API:', data);

      //     const processedEvents = data.events.map(event => {
      //       const startDate = new Date(event.start_date);
      //       const endDate = new Date(event.end_date);
      //       const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

      //       return {
      //         ...event,
      //         start_date: startDate.toISOString().split('T')[0],
      //         end_date: endDate.toISOString().split('T')[0],
      //         durationDays,
      //         allDates: this.getDateRangeArray(startDate, endDate)
      //       };
      //     });

      //     console.log('Processed events:', processedEvents);
      //     this.eventDetails[`${employeeId}-${startDate}-${endDate}`] = processedEvents;

      //   } catch (err) {
      //     console.error('Error fetching event details:', err);
      //     this.eventDetails[`${employeeId}-${startDate}-${endDate}`] = [];
      //   }
      // },
      
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

        return events.map(event =>
          `${event.event_name}\n` +
          `📅 ${event.start_date} to ${event.end_date}\n` +
          `⏰ ${event.start_time} - ${event.end_time}\n` +
          `📍 ${event.location || 'No location'}\n` +
          `📝 ${event.description || 'No description'}\n`
        ).join('\n\n');
      },


// In the showCalendar method, update the modal title
showCalendar(request) {
  try {
    this.currentRequest = request;
    const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
    this.currentEvents = this.eventDetails[key] || [];
    
    // Store the leave period dates
    this.leaveStartDate = new Date(request.start_date);
    this.leaveEndDate = new Date(request.end_date);
    
    this.currentDate = new Date();
    this.renderSimpleCalendar();
    
    if (!this.calendarModal) {
      this.calendarModal = new bootstrap.Modal(document.getElementById('calendarModal'));
    }
    
    // Update the modal title to show the leave period
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
  
  // Create a map of all event days
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
  
  // Current month info
  const month = this.currentDate.getMonth();
  const year = this.currentDate.getFullYear();
  const monthName = this.currentDate.toLocaleString('default', { month: 'long' });
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  
  // Create calendar container
  const calendarContainer = document.createElement('div');
  calendarContainer.className = 'simple-calendar';
  
  // Month header with navigation
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
  
  // Navigation event listeners
  header.querySelector('.prev-month').addEventListener('click', () => {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.renderSimpleCalendar();
  });
  
  header.querySelector('.next-month').addEventListener('click', () => {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.renderSimpleCalendar();
  });
  
  // Calculate days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Create days grid
  const daysGrid = document.createElement('div');
  daysGrid.className = 'calendar-days';
  
  // Add empty cells for days before start
  for (let i = 0; i < firstDay; i++) {
    daysGrid.appendChild(this.createDayCell(''));
  }
  
  // Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentDateObj = new Date(year, month, day);
    const dayEvents = eventDaysMap[dateStr] || [];
    const isToday = isCurrentMonth && day === today.getDate();
    
    // Check if this day is within the requested leave period
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
  
  // Clear details when changing months
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
  
  // Normalize dates to compare without time
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
    
    // Add tooltip for leave days
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
      // Standby methods
      async loadStandbyData(request) {
        const leaveId = request.leave_id;
        
        // If we already have data for this request, don't fetch again
        if (this.standbyData[leaveId]) {
          return;
        }
        
        // Set loading state
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
        
        // If loading, show loading message
        if (isLoading) {
          return 'Checking availability...';
        }
        
        // If no data yet, trigger loading
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
        
        // If loading or no data yet
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
            
            // Update standbyDetails with the response data
            this.standbyDetails = {
              employee: `${request.first_name} ${request.last_name}`,
              available: data.available,
              total: data.total,
              employees: data.standbyEmployees || []
            };
            
            // Also update our local storage
            const leaveId = request.leave_id;
            this.standbyData[leaveId] = {
              available: data.available,
              total: data.total
            };
            
            // Show the modal using Bootstrap
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


  //     generateRecommendation(request) {
  //   const hasEvents = request.has_events;
  //   const eventNames = request.event_names ? request.event_names.split('; ') : [];
  //   const daysRequested = request.days_requested;
    
  //   // Get standby data
  //   const leaveId = request.leave_id;
  //   const standby = this.standbyData[leaveId];
  //   const isLoading = this.loadingStandby[leaveId];
    
  //   if (isLoading || !standby) {
  //     return 'Analyzing request...';
  //   }
    
  //   const availableStandby = standby.available;
  //   const totalStandby = standby.total;
    
  //   // Decision logic
  //   if (hasEvents && availableStandby === 0) {
  //     return `❌ REJECT: Employee is scheduled for ${eventNames.length} event(s) during leave period and no standby available.`;
  //   }
    
  //   if (hasEvents && availableStandby > 0) {
  //     return `⚠️ CONDITIONAL APPROVAL: Employee has ${eventNames.length} event(s) but ${availableStandby} standby available. Consider assigning events to standby staff.`;
  //   }
    
  //   if (!hasEvents && availableStandby === 0 && totalStandby > 0) {
  //     return `⚠️ CONDITIONAL APPROVAL: No events scheduled but all ${totalStandby} standby employees are unavailable. Ensure coverage can be managed.`;
  //   }
    
  //   if (!hasEvents && availableStandby > 0) {
  //     return `✅ APPROVE: No events scheduled and ${availableStandby}/${totalStandby} standby employees available.`;
  //   }
    
  //   if (!hasEvents && totalStandby === 0) {
  //     return `⚠️ CONDITIONAL APPROVAL: No events scheduled but no standby employees for this role. Ensure department can operate with reduced staff.`;
  //   }
    
  //   return 'Review required: Unable to generate recommendation.';
  // },
  
  // Update the generateRecommendation method to show loading state
generateRecommendation(request) {
  // Check for events using our eventDetails data
  const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
  const events = this.eventDetails[key];
  const hasEvents = events && events.length > 0;
  const eventCount = hasEvents ? events.length : 0;
  
  const daysRequested = request.days_requested;
  
  // Get standby data
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
  
  // Decision logic
  if (hasEvents && availableStandby === 0) {
    return `❌ REJECT: Employee is scheduled for ${eventCount} event(s) during leave period and no standby available.`;
  }
  
  if (hasEvents && availableStandby > 0) {
    return `⚠️ CONDITIONAL APPROVAL: Employee has ${eventCount} event(s) but ${availableStandby} standby available.`;
  }
  
  if (!hasEvents && availableStandby === 0 && totalStandby > 0) {
    return `⚠️ CONDITIONAL APPROVAL: No events scheduled but all ${totalStandby} standby employees are unavailable. Ensure coverage can be managed.`;
  }
  
  if (!hasEvents && availableStandby > 0) {
    return `✅ APPROVE: No events scheduled and ${availableStandby}/${totalStandby} standby employees available.`;
  }
  
  if (!hasEvents && totalStandby === 0) {
    return `⚠️ CONDITIONAL APPROVAL: No events scheduled but no standby employees for this role. Ensure department can operate with reduced staff.`;
  }
  
  return 'Review required: Unable to generate recommendation.';
},
  
 getRecommendationClass(request) {
  // Check for events using our eventDetails data
  const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
  const events = this.eventDetails[key];
  const hasEvents = events && events.length > 0;
  
  // Get standby data
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

  // Add this method to check if there are events for a request
hasEventsDuringLeave(request) {
  const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
  const events = this.eventDetails[key];
  return events && events.length > 0;
},

// // Update the getEventDetails method
// getEventDetails(request) {
//   const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
//   const events = this.eventDetails[key];
  
//   if (!events || events.length === 0) {
//     return 'No events scheduled during this period.';
//   }
  
//   const eventNames = events.map(event => event.event_name);
//   return `Conflicting events: ${eventNames.join(', ')}`;
// },
  
getEventDetails(request) {
  const key = `${request.employee_id}-${request.start_date}-${request.end_date}`;
  
  // Check if events are still loading
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