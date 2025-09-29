document.addEventListener('DOMContentLoaded', () => {
  const { createApp } = Vue;

  createApp({
    data() {
      return {
        events: [],
        availableStaff: [],
        eventStaff: [],
        shiftDetails: [],
    currentEmployee: null,
    shiftModal: null,
        currentEvent: {
          event_id: null,
          event_name: '',
          description: '',
          start_date: '',
          end_date: '',
          start_time: '17:00',
          end_time: '02:00',
          location: 'Night Lounge',
          expected_attendance: null,
          organizer_id: null,
          requiredRoles: []
        },
        isLoading: true,
        dateError: {
      start: '',
      end: ''
    },
        saving: false,
        isEditing: false,
        eventModal: null,
        staffModal: null,
        // Calendar properties
        currentDate: new Date(),
        selectedDate: null,
        calendarDays: [],
        selectedDateEvents: [],
        // Available roles for events
        // availableRoles: [
        //   { value: 'bartender', label: 'Bartender' },
        //   { value: 'sparkler_girl', label: 'Sparkler Girl' },
        //   { value: 'waiter', label: 'Waiter' },
        //   { value: 'cleaner', label: 'Cleaner' },
        //   { value: 'bouncer', label: 'Bouncer' },
        //   { value: 'runner', label: 'Runner' },
        //   { value: 'leader', label: 'Leader' }
        // ]
        
availableRoles: [
  { value: 1, label: 'Bartender' },
  { value: 2, label: 'Sparkler Girl' },
  { value: 3, label: 'Waiter' },
  { value: 4, label: 'Cleaner' },
  { value: 5, label: 'Bouncer' },
  { value: 6, label: 'Runners' }
  // { value: 7, label: 'Leader' }
]
      };
    },
    computed: {
      calendarMonth() {
        return this.currentDate.toLocaleString('default', { month: 'long' });
      },
      calendarYear() {
        return this.currentDate.getFullYear();
      },
      selectedDateFormatted() {
        if (!this.selectedDate) return '';
        return this.selectedDate.toLocaleDateString('en-GB', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
    },
    mounted() {
      this.eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
      this.staffModal = new bootstrap.Modal(document.getElementById('staffModal'));
      this.shiftModal = new bootstrap.Modal(document.getElementById('shiftDetailsModal'));
      this.fetchEvents();
      
      // Get current user ID from localStorage or session
      const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        this.currentEvent.organizer_id = user.employee_id;
      } else {
        // Fallback: try to get from cookie or prompt user
        console.warn('No user data found in storage');
        // For demo purposes, set a default organizer ID
        this.currentEvent.organizer_id = 1; // Default admin user
      }
      
      // Initialize calendar
      this.generateCalendar();
    },
    methods: {

      
// async viewEmployeeShifts(employeeId) {
//   try {
//     const response = await fetch(`http://localhost:3000/api/employee/${employeeId}/shifts`);
//     if (response.ok) {
//       const shifts = await response.json();
      
//       // Filter shifts to only show those during the event
//       const eventShifts = shifts.filter(shift => {
//         const shiftDate = new Date(shift.date_);
//         const eventStart = new Date(this.currentEvent.start_date);
//         const eventEnd = new Date(this.currentEvent.end_date);
//         return shiftDate >= eventStart && shiftDate <= eventEnd;
//       });
      
//       if (eventShifts.length > 0) {
//         let shiftInfo = `Shifts during event:\n`;
//         eventShifts.forEach(shift => {
//           shiftInfo += `${shift.date_}: ${shift.start_time} - ${shift.end_time}\n`;
//         });
//         alert(shiftInfo);
//       } else {
//         alert('No shifts scheduled during event dates');
//       }
//     }
//   } catch (err) {
//     console.error('Error fetching employee shifts:', err);
//     alert('Error loading shift information');
//   }
// },

    // Fix the mapping function - make sure it matches EXACTLY the enum values

async viewEmployeeShifts(employeeId) {
    try {
      const response = await fetch(`http://localhost:3000/api/employee/${employeeId}/shifts`);
      if (response.ok) {
        const shifts = await response.json();
        
        // Filter shifts to only show those during the event
        const eventShifts = shifts.filter(shift => {
          const shiftDate = new Date(shift.date_);
          const eventStart = new Date(this.currentEvent.start_date);
          const eventEnd = new Date(this.currentEvent.end_date);
          return shiftDate >= eventStart && shiftDate <= eventEnd;
        });
        
        if (eventShifts.length > 0) {
          let shiftInfo = `Shifts during event:\n`;
          eventShifts.forEach(shift => {
            shiftInfo += `${shift.date_}: ${shift.start_time} - ${shift.end_time}\n`;
          });
          this.showToast(shiftInfo, 'info');
        } else {
          this.showToast('No shifts scheduled during event dates', 'warning');
        }
      } else {
        this.showToast('Error loading shift information', 'error');
      }
    } catch (err) {
      console.error('Error fetching employee shifts:', err);
      this.showToast('Error loading shift information', 'error');
    }
  },

    mapRoleTitleToEnum(roleTitle) {
  const mapping = {
    'Bartender': 'bartender',
    'Sparkler Girl': 'sparkler_girl', // MUST match exactly 'sparkler_girl'
    'Waiter': 'waiter',
    'Cleaner': 'cleaner',
    'Bouncer': 'bouncer',
    'Runners': 'runner'  // MUST match exactly 'runner' (singular)
    // 'Leader': 'leader'    // MUST match exactly 'leader'
  };
  
  const mappedValue = mapping[roleTitle];
  console.log('Mapping:', roleTitle, '->', mappedValue);
  
  if (!mappedValue) {
    console.error('No mapping found for role:', roleTitle);
    return 'waiter'; // default fallback
  }
  
  return mappedValue;
},

      validateDateInput(type) {
    this.dateError[type] = '';
    
    if (!this.currentEvent.start_date || !this.currentEvent.end_date) return;
    
    const startDate = new Date(this.currentEvent.start_date);
    const endDate = new Date(this.currentEvent.end_date);
    
    if (type === 'start' && endDate < startDate) {
      this.currentEvent.end_date = this.currentEvent.start_date;
    }
    
    // Check for closed days
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) {
        this.dateError[type] = 'Includes closed days (Tue, Wed, Thu)';
        break;
      }
    }
    
    // Check duration
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays > 7) {
      this.dateError.end = 'Event cannot span more than 7 days';
    }
  },
  
  getMinDate() {
    return new Date().toISOString().split('T')[0];
  },

  
// async checkForNewNotifications() {
//   try {
//     const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
//     if (userData) {
//       const user = JSON.parse(userData);
//       const response = await fetch(`http://localhost:3000/api/employee/${user.employee_id}/event-notifications`);
      
//       if (response.ok) {
//         const notifications = await response.json();
//         const unreadCount = notifications.filter(n => n.read_status === 'unread').length;
        
//         // Update UI with notification count
//         this.unreadNotifications = unreadCount;
//       }
//     }
//   } catch (err) {
//     console.error('Error checking notifications:', err);
//   }
// },

// In vue-event-management.js
async checkForNewNotifications() {
  try {
    const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      const response = await fetch(`http://localhost:3000/api/employee/${user.employee_id}/event-notifications`);
      
      if (response.ok) {
        const notifications = await response.json();
        const unreadCount = notifications.filter(n => n.read_status === 'unread').length;
        
        // Update UI with notification count
        this.unreadNotifications = unreadCount;
        
        // Show toast for unread notifications
        const newNotifications = notifications.filter(n => n.read_status === 'unread');
        if (newNotifications.length > 0) {
          // Show only the latest notification to avoid spam
          const latestNotification = newNotifications[0];
          this.showToast(latestNotification.message, 'info');
        }
      }
    }
  } catch (err) {
    console.error('Error checking notifications:', err);
  }
},

async fetchEvents() {
  this.isLoading = true;
  console.log('Starting fetchEvents');
  try {
    const response = await fetch('http://localhost:3000/api');
    console.log('API response status:', response.status);
    
    if (response.ok) {
      this.events = await response.json();
      console.log('Fetched events:', this.events);
      
      // For each event, fetch the number of assigned staff and required roles
      for (let event of this.events) {
        console.log('Processing event:', event.event_name);

        console.log('Fetched events with required_roles:', this.events.map(e => ({
        event_name: e.event_name,
        required_roles: e.required_roles
      })));
        
        const staffResponse = await fetch(`http://localhost:3000/api/${event.event_id}/staff-count`);
        if (staffResponse.ok) {
          const data = await staffResponse.json();
          event.assigned_staff = data.count;
          console.log('Staff count for event', event.event_name, ':', data.count);
        }
        
        // Fetch required roles for this event
        const rolesResponse = await fetch(`http://localhost:3000/api/${event.event_id}/roles`);
        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json();
          // event.required_roles = rolesData.roles;
          event.required_roles = (rolesData.roles || []).filter(roleId => roleId !== null);
          console.log('Roles for event', event.event_name, 'roles:', rolesData.roles);
        } else {
          event.required_roles = [];
          console.log('No roles found for event', event.event_name);
        }
      }
      
      // Regenerate calendar with events
      console.log('Calling generateCalendar with', this.events.length, 'events');
      this.generateCalendar();
      
    } else {
      console.error('Failed to fetch events, status:', response.status);
      this.events = [];
      this.generateCalendar();
    }
  } catch (err) {
    console.error('Failed to fetch events:', err);
    this.events = [];
    this.generateCalendar();
  } finally {
    this.isLoading = false;
    console.log('Finished fetchEvents');
  }
},
      
      async fetchEventStaff(eventId) {
        try {
          const response = await fetch(`http://localhost:3000/api/${eventId}/staff`);
          if (response.ok) {
            return await response.json();
          } else {
            console.error('Failed to fetch event staff');
            return [];
          }
        } catch (err) {
          console.error('Failed to fetch event staff:', err);
          return [];
        }
      },
      
      showCreateEventModal() {
        this.isEditing = false;
        this.resetCurrentEvent();
        this.eventModal.show();
      },
      
    async editEvent(event) {
  this.isEditing = true;
  this.currentEvent = { ...event };
  
  // Fetch required roles for this event
  try {
    const rolesResponse = await fetch(`http://localhost:3000/api/${event.event_id}/required-roles`);
    if (rolesResponse.ok) {
      const rolesData = await rolesResponse.json();
      this.currentEvent.requiredRoles = rolesData.map(role => role.role_id.toString());
    } else {
      this.currentEvent.requiredRoles = [];
    }
  } catch (err) {
    console.error('Failed to fetch required roles:', err);
    this.currentEvent.requiredRoles = [];
  }
  
  this.eventModal.show();
},
      
      async viewEventStaff(event) {
        this.currentEvent = { ...event };
        this.eventStaff = await this.fetchEventStaff(event.event_id);
        this.staffModal.show();
      },
      
      resetCurrentEvent() {
        this.currentEvent = {
          event_id: null,
          event_name: '',
          description: '',
          start_date: '',
          end_date: '',
          start_time: '17:00',
          end_time: '02:00',
          location: 'Night Lounge',
          expected_attendance: null,
          organizer_id: this.currentEvent.organizer_id,
          requiredRoles: []
        };
      },
      
// validateEventDates(eventData) {
//   const startDate = new Date(eventData.start_date);
//   const endDate = new Date(eventData.end_date);
  
//   // Check if event spans more than 7 days
//   const diffTime = Math.abs(endDate - startDate);
//   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
//   if (diffDays > 7) {
//     alert('Event cannot span more than 7 days');
//     return false;
//   }
  
//   // Check for closed days
//   for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
//     const dayOfWeek = date.getDay();
    
//     if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) { // Tue, Wed, Thu
//       alert('Night Lounge is closed on Tuesdays, Wednesdays, and Thursdays. Please choose different dates.');
//       return false;
//     }
//   }
  
//   return true;
// },

//       async saveEvent() {
//   this.saving = true;
//   try {
//     const url = this.isEditing 
//       ? `http://localhost:3000/api/events/${this.currentEvent.event_id}`
//       : 'http://localhost:3000/api/events';
    
//     const method = this.isEditing ? 'PUT' : 'POST';
    
//     // Get user data
//     const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
//     let organizerId = this.currentEvent.organizer_id || 1;
    
//     if (userData) {
//       const user = JSON.parse(userData);
//       organizerId = user.employee_id || user.id || organizerId;
//     }
    
//     const eventData = {
//       event_name: this.currentEvent.event_name || '',
//       description: this.currentEvent.description || '',
//       start_date: this.currentEvent.start_date || null,
//       end_date: this.currentEvent.end_date || null,
//       start_time: this.currentEvent.start_time || null,
//       end_time: this.currentEvent.end_time || null,
//       location: this.currentEvent.location || 'Night Lounge',
//       expected_attendance: this.currentEvent.expected_attendance || null,
//       organizer_id: organizerId,
//       // roleIds: this.currentEvent.requiredRoles
//       roleIds: this.currentEvent.requiredRoles.map(id => parseInt(id))
//     };

//     // Validate dates before sending to server
//     if (!this.validateEventDates(eventData)) {
//       this.saving = false;
//       return;
//     }
    
//     const response = await fetch(url, {
//       method: method,
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(eventData)
//     });
    
//     if (response.ok) {
//       const result = await response.json();
//       const eventId = this.isEditing ? this.currentEvent.event_id : result.event_id;
      
//       // Assign staff by role using the new endpoint
//       if (this.currentEvent.requiredRoles && this.currentEvent.requiredRoles.length > 0) {
//         await fetch(`http://localhost:3000/api/${eventId}/assign-by-role`, {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({ roleIds: this.currentEvent.requiredRoles })
//         });
//       }
      
//       alert(`Event ${this.isEditing ? 'updated' : 'created'} successfully!`);
//       this.eventModal.hide();
//       await this.fetchEvents();
      
//     } else {
//       const errorText = await response.text();
//       alert('Failed to save event: ' + errorText);
//     }
//   } catch (err) {
//     console.error('Error saving event:', err);
//     alert('Error saving event: ' + err.message);
//   } finally {
//     this.saving = false;
//   }
// },
      

validateEventDates(eventData) {
    const startDate = new Date(eventData.start_date);
    const endDate = new Date(eventData.end_date);
    
    // Check if event spans more than 7 days
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (diffDays > 7) {
      this.showToast('Event cannot span more than 7 days', 'warning');
      return false;
    }
    
    // Check for closed days
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) { // Tue, Wed, Thu
        this.showToast('Night Lounge is closed on Tuesdays, Wednesdays, and Thursdays. Please choose different dates.', 'warning');
        return false;
      }
    }
    
    return true;
  },

// async saveEvent() {
//   this.saving = true;
//   try {
//     const url = this.isEditing 
//       // ? `http://localhost:3000/api/events/${this.currentEvent.event_id}`
//       ? `http://localhost:3000/api/${this.currentEvent.event_id}`
//       : 'http://localhost:3000/api/events';
    
//     const method = this.isEditing ? 'PUT' : 'POST';
    
//     // Get user data
//     const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
//     let organizerId = this.currentEvent.organizer_id || 1;
    
//     if (userData) {
//       const user = JSON.parse(userData);
//       organizerId = user.employee_id || user.id || organizerId;
//     }
    
//     // Convert role IDs to role titles for the mapping
//     const roleTitles = this.currentEvent.requiredRoles.map(roleId => {
//       const role = this.availableRoles.find(r => r.value === roleId);
//       return role ? role.label : null;
//     }).filter(title => title !== null);

//     const eventData = {
//       event_name: this.currentEvent.event_name || '',
//       description: this.currentEvent.description || '',
//       start_date: this.currentEvent.start_date || null,
//       end_date: this.currentEvent.end_date || null,
//       start_time: this.currentEvent.start_time || null,
//       end_time: this.currentEvent.end_time || null,
//       location: this.currentEvent.location || 'Night Lounge',
//       expected_attendance: this.currentEvent.expected_attendance || null,
//       organizer_id: organizerId,
//       // roleIds: this.currentEvent.requiredRoles
//       roleIds: this.currentEvent.requiredRoles.map(id => parseInt(id))
//     };

//     // Validate dates before sending to server
//     if (!this.validateEventDates(eventData)) {
//       this.saving = false;
//       return;
//     }
    
//     const response = await fetch(url, {
//       method: method,
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(eventData)
//     });
    
//     if (response.ok) {
//       const result = await response.json();
//       const eventId = this.isEditing ? this.currentEvent.event_id : result.event_id;
      
//       // // Assign staff using role titles (which will be mapped to enum values)
//       // if (roleTitles.length > 0) {
//       //   await this.assignAllStaffByRole(eventId, roleTitles);
//       // }

//       // In saveEvent method, replace the staff assignment part with:
// if (this.currentEvent.requiredRoles && this.currentEvent.requiredRoles.length > 0) {
//   await this.assignAllStaffByRole(eventId, this.currentEvent.requiredRoles);
// }
      
//       alert(`Event ${this.isEditing ? 'updated' : 'created'} successfully!`);
//       this.eventModal.hide();
//       await this.fetchEvents();
      
//     } else {
//       const errorText = await response.text();
//       alert('Failed to save event: ' + errorText);
//     }
//   } catch (err) {
//     console.error('Error saving event:', err);
//     alert('Error saving event: ' + err.message);
//   } finally {
//     this.saving = false;
//   }
// },      


async saveEvent() {
    this.saving = true;
    try {
      const url = this.isEditing 
        ? `http://localhost:3000/api/${this.currentEvent.event_id}`
        : 'http://localhost:3000/api/events';
      
      const method = this.isEditing ? 'PUT' : 'POST';
      
      // Get user data
      const userData = localStorage.getItem('user') || sessionStorage.getItem('user');
      let organizerId = this.currentEvent.organizer_id || 1;
      
      if (userData) {
        const user = JSON.parse(userData);
        organizerId = user.employee_id || user.id || organizerId;
      }
      
      // Convert role IDs to role titles for the mapping
      const roleTitles = this.currentEvent.requiredRoles.map(roleId => {
        const role = this.availableRoles.find(r => r.value === roleId);
        return role ? role.label : null;
      }).filter(title => title !== null);

      const eventData = {
        event_name: this.currentEvent.event_name || '',
        description: this.currentEvent.description || '',
        start_date: this.currentEvent.start_date || null,
        end_date: this.currentEvent.end_date || null,
        start_time: this.currentEvent.start_time || null,
        end_time: this.currentEvent.end_time || null,
        location: this.currentEvent.location || 'Night Lounge',
        expected_attendance: this.currentEvent.expected_attendance || null,
        organizer_id: organizerId,
        roleIds: this.currentEvent.requiredRoles.map(id => parseInt(id))
      };

      // Validate dates before sending to server
      if (!this.validateEventDates(eventData)) {
        this.saving = false;
        return;
      }
      
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      
      if (response.ok) {
        const result = await response.json();
        const eventId = this.isEditing ? this.currentEvent.event_id : result.event_id;
        
        // Assign staff by role
        if (this.currentEvent.requiredRoles && this.currentEvent.requiredRoles.length > 0) {
          await this.assignAllStaffByRole(eventId, this.currentEvent.requiredRoles);
        }
        
        this.showToast(`Event ${this.isEditing ? 'updated' : 'created'} successfully!`, 'success');
        this.eventModal.hide();
        await this.fetchEvents();
        
      } else {
        const errorText = await response.text();
        this.showToast(`Failed to save event: ${errorText}`, 'error');
      }
    } catch (err) {
      console.error('Error saving event:', err);
      this.showToast(`Error saving event: ${err.message}`, 'error');
    } finally {
      this.saving = false;
    }
  },

async saveEventRoles(eventId, roles) {
        try {
          const response = await fetch(`http://localhost:3000/api/${eventId}/roles`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ roles })
          });
          
          if (!response.ok) {
            console.error('Failed to save event roles');
          }
        } catch (err) {
          console.error('Error saving event roles:', err);
        }
      },
      
// async assignAllStaffByRole(eventId, roles) {
//   console.log('=== START: assignAllStaffByRole ===');
//   console.log('Event ID:', eventId);
//   console.log('Selected roles:', roles);
  
//   try {
//     // Map frontend role names to API expected values
//     const roleMap = {
//       'Bartender': 'bartender',
//       'Sparkler Girl': 'sparkler_girl',
//       'Waiter': 'waiter', 
//       'Cleaner': 'cleaner',
//       'Bouncer': 'bouncer',
//       'Runner': 'runner',
//       'Manager': 'manager'
//     };
    
//     // First, remove all existing staff assignments
//     console.log('Removing existing staff assignments...');
//     const deleteResponse = await fetch(`http://localhost:3000/api/${eventId}/staff`, {
//       method: 'DELETE'
//     });
//     console.log('Delete response status:', deleteResponse.status);
    
//     if (roles.length === 0) {
//       console.log('No roles selected, skipping staff assignment');
//       return;
//     }

//     // Then assign all staff with the selected roles
//     for (const frontendRole of roles) {
//       const apiRole = roleMap[frontendRole] || frontendRole.toLowerCase();
//       console.log('Processing role:', frontendRole, '-> API role:', apiRole);
      
//       // Get employees with this role
//       const apiUrl = `http://localhost:3000/api/employees/role/${apiRole}`;
//       console.log('Calling API:', apiUrl);
      
//       const response = await fetch(apiUrl);
//       console.log('API response status:', response.status);
      
//       if (response.ok) {
//         const employees = await response.json();
//         console.log('Employees found:', employees.length, employees);
        
//         if (employees.length === 0) {
//           console.log('No employees found for role:', apiRole);
//           continue;
//         }
        
//         for (const employee of employees) {
//           console.log('Assigning employee:', employee.employee_id, employee.first_name, employee.last_name);
          
//           const assignUrl = `http://localhost:3000/api/${eventId}/staff/${employee.employee_id}`;
//           console.log('Calling assign API:', assignUrl);
          
//           const assignResponse = await fetch(assignUrl, {
//             method: 'POST',
//             headers: {
//               'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({ role: frontendRole })
//           });
          
//           console.log('Assign response status:', assignResponse.status);
          
//           if (assignResponse.ok) {
//             console.log('✓ Successfully assigned employee', employee.employee_id);
//           } else {
//             const errorText = await assignResponse.text();
//             console.error('✗ Failed to assign employee:', errorText);
//           }
//         }
//       } else {
//         const errorText = await response.text();
//         console.error('✗ Failed to fetch employees for role:', errorText);
//       }
//     }
//   } catch (err) {
//     console.error('Error in assignAllStaffByRole:', err);
//   }
//   console.log('=== END: assignAllStaffByRole ===');
// },
      
async assignAllStaffByRole(eventId, roleIds) {
  console.log('=== Using Role ID approach ===');
  console.log('Event ID:', eventId);
  console.log('Selected role IDs:', roleIds);
  
  try {
    // Use the new endpoint that accepts role IDs
    const assignResponse = await fetch(`http://localhost:3000/api/${eventId}/assign-by-role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roleIds: roleIds.map(id => parseInt(id)) })
    });
    
    console.log('Assign by role response status:', assignResponse.status);
    
    if (assignResponse.ok) {
      const result = await assignResponse.json();
      console.log('✓ Successfully assigned staff by roles:', result.message);
    } else {
      const errorText = await assignResponse.text();
      console.error('✗ Failed to assign staff by roles:', errorText);
    }
  } catch (err) {
    console.error('Error in assignAllStaffByRole:', err);
  }
},

async sendEventAssignmentNotifications(eventId) {
  try {
    const response = await fetch(`http://localhost:3000/api/${eventId}/assignment-notifications`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      console.error('Failed to send assignment notifications');
    }
  } catch (err) {
    console.error('Error sending assignment notifications:', err);
  }
},

// async assignAllStaffByRole(eventId, roleIds) {
//   console.log('=== Using Role ID approach ===');
//   console.log('Event ID:', eventId);
//   console.log('Selected role IDs:', roleIds);
  
//   try {
//     // Use the new endpoint that accepts role IDs
//     const assignResponse = await fetch(`http://localhost:3000/api/${eventId}/assign-by-role`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ roleIds: roleIds.map(id => parseInt(id)) })
//     });
    
//     console.log('Assign by role response status:', assignResponse.status);
    
//     if (assignResponse.ok) {
//       const result = await assignResponse.json();
//       console.log('✓ Successfully assigned staff by roles:', result.message);
//       this.showToast(`Staff assigned successfully: ${result.message}`, 'success');
//     } else {
//       const errorText = await assignResponse.text();
//       console.error('✗ Failed to assign staff by roles:', errorText);
//       this.showToast(`Failed to assign staff: ${errorText}`, 'error');
//     }
//   } catch (err) {
//     console.error('Error in assignAllStaffByRole:', err);
//     this.showToast('Error assigning staff to event', 'error');
//   }
// },

// async deleteEvent(eventId) {
//   if (!confirm('Are you sure you want to delete this event?')) {
//     return;
//   }
  
//   try {
//     const response = await fetch(`http://localhost:3000/api/${eventId}`, {
//       method: 'DELETE'
//     });
    
//     if (response.ok) {
//       alert('Event deleted successfully!');
//       // Refresh the events list and calendar
//       await this.fetchEvents(); // Add this line
//     } else {
//       alert('Failed to delete event');
//     }
//   } catch (err) {
//     console.error('Error deleting event:', err);
//     alert('Error deleting event');
//   }
// },
      
async deleteEvent(eventId) {
  // Create a custom confirmation dialog instead of using confirm()
  const confirmed = await this.showConfirmationDialog(
    'Delete Event', 
    'Are you sure you want to delete this event? This action cannot be undone.',
    'Delete',
    'Cancel'
  );
  
  if (!confirmed) return;
  
  try {
    const response = await fetch(`http://localhost:3000/api/${eventId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      this.showToast('Event deleted successfully!', 'success');
      
      // Close any open modals and remove backdrops
      this.closeAllModals();
      
      await this.fetchEvents();
    } else {
      this.showToast('Failed to delete event', 'error');
    }
  } catch (err) {
    console.error('Error deleting event:', err);
    this.showToast('Error deleting event', 'error');
  }
},

// Add this new method to close all modals and clean up backdrops
closeAllModals() {
  // Close all Bootstrap modals
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) {
      bsModal.hide();
    }
  });
  
  // Remove any lingering modal backdrops
  const backdrops = document.querySelectorAll('.modal-backdrop');
  backdrops.forEach(backdrop => {
    backdrop.remove();
  });
  
  // Remove modal-open class from body
  document.body.classList.remove('modal-open');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
},

  showConfirmationDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
      // Create modal HTML
      const modalId = 'confirmation-modal-' + Date.now();
      const modalHTML = `
        <div class="modal fade" id="${modalId}" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content bg-dark">
              <div class="modal-header">
                <h5 class="modal-title">${title}</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <p>${message}</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${cancelText}</button>
                <button type="button" class="btn btn-danger" id="${modalId}-confirm">${confirmText}</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add to DOM
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      const modalElement = document.getElementById(modalId);
      const modal = new bootstrap.Modal(modalElement);
      
      // Set up event listeners
      const confirmButton = document.getElementById(`${modalId}-confirm`);
      
      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };
      
      const handleCancel = () => {
        cleanup();
        resolve(false);
      };
      
      const cleanup = () => {
        confirmButton.removeEventListener('click', handleConfirm);
        modalElement.removeEventListener('hidden.bs.modal', handleCancel);
        modalElement.remove();
      };
      
      confirmButton.addEventListener('click', handleConfirm);
      modalElement.addEventListener('hidden.bs.modal', handleCancel);
      
      // Show modal
      modal.show();
    });
  },
      

formatDate(dateString) {
        if (!dateString || dateString.startsWith('0000-00-00')) {
          return "None";
        }
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB');
      },
      
      // formatRoleName(role) {
      //   const roleMap = {
      //     'bartender': 'Bartender',
      //     'sparkler_girl': 'Sparkler Girl',
      //     'waiter': 'Waiter',
      //     'cleaner': 'Cleaner',
      //     'bouncer': 'Bouncer',
      //     'runner': 'Runner',
      //     'leader': 'Leader'
      //   };
      //   return roleMap[role] || role;
      // },

  formatRoleName(roleId) {
  if (roleId === null || roleId === undefined) {
    return 'No Role';
  }
  
  const id = parseInt(roleId);
  if (isNaN(id)) {
    return `Invalid Role ID: ${roleId}`;
  }
  
  const roleMap = {
    1: 'Bartender',
    2: 'Sparkler Girl',
    3: 'Waiter',
    4: 'Cleaner',
    5: 'Bouncer',
    6: 'Runners'
    // 7: 'Leader'
  };
  
  return roleMap[id] || `Unknown Role (ID: ${roleId})`;
},
      
      // Calendar methods
      generateCalendar() {
        console.log('Generating calendar with', this.events.length, 'events');
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Get first day of month and last day of month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        console.log('Calendar range:', firstDay, 'to', lastDay);
        
        // Get days in previous month to show
        const daysInPrevMonth = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Get total days in month
        const daysInMonth = lastDay.getDate();
        
        // Create calendar days array
        this.calendarDays = [];
        
        // Add previous month's days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = 0; i < daysInPrevMonth; i++) {
          this.calendarDays.push({
            id: `prev-${i}`,
            date: prevMonthLastDay - daysInPrevMonth + i + 1,
            isEmpty: true
          });
        }
        
        // Add current month's days
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(year, month, i);
          date.setHours(0, 0, 0, 0);

          const dayOfWeek = date.getDay();
    const isClosedDay = dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4;
          
          // Check if this date has events
          const eventsOnDate = this.events.filter(event => {

             if (!event.start_date || !event.end_date) {
        console.log('Event missing dates:', event);
        return false;
      }

            const eventStart = new Date(event.start_date);
            const eventEnd = new Date(event.end_date);
            eventStart.setHours(0, 0, 0, 0);
            eventEnd.setHours(0, 0, 0, 0);
            return date >= eventStart && date <= eventEnd;
          });

          console.log('Date', date, 'has', eventsOnDate.length, 'events');
          
          const isSelected = this.selectedDate && date.getTime() === this.selectedDate.getTime();
          
          this.calendarDays.push({
            id: `current-${i}`,
            date: i,
            isEmpty: false,
            isToday: date.getTime() === today.getTime(),
            hasEvents: eventsOnDate.length > 0,
            eventsCount: eventsOnDate.length,
            isSelected: isSelected,
            dateObj: date,
             isClosedDay: isClosedDay
          });
        }
        
        // Add next month's days to complete the grid (42 cells total)
        const totalCells = 42; // 6 rows x 7 columns
        const remainingCells = totalCells - this.calendarDays.length;
        for (let i = 1; i <= remainingCells; i++) {
          this.calendarDays.push({
            id: `next-${i}`,
            date: i,
            isEmpty: true
          });
        }
      },
      
      prevMonth() {
        this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
        this.generateCalendar();
        this.selectedDate = null;
        this.selectedDateEvents = [];
      },
      
      nextMonth() {
        this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
        this.generateCalendar();
        this.selectedDate = null;
        this.selectedDateEvents = [];
      },
      
      selectDate(day) {
        if (day.isEmpty) return;
        
        // Deselect if clicking the same date again
        if (this.selectedDate && day.dateObj.getTime() === this.selectedDate.getTime()) {
          this.selectedDate = null;
          this.selectedDateEvents = [];
          this.generateCalendar();
          return;
        }
        
        this.selectedDate = day.dateObj;
        
        // Find events on this date
        this.selectedDateEvents = this.events.filter(event => {
          const eventStart = new Date(event.start_date);
          const eventEnd = new Date(event.end_date);
          eventStart.setHours(0, 0, 0, 0);
          eventEnd.setHours(0, 0, 0, 0);
          return this.selectedDate >= eventStart && this.selectedDate <= eventEnd;
        });
        
        // Update calendar to show selected date
        this.generateCalendar();
      },
      
//       createEventForSelectedDate() {
//   if (!this.selectedDate) return;
  
//   const selectedDate = new Date(this.selectedDate);
//   const dayOfWeek = selectedDate.getDay();
  
//   // Check if selected date is a closed day
//   if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) {
//     alert('Night Lounge is closed on Tuesdays, Wednesdays, and Thursdays. Please choose a different date.');
//     return;
//   }
  
//   const dateStr = selectedDate.toISOString().split('T')[0];
//   this.currentEvent.start_date = dateStr;
//   this.currentEvent.end_date = dateStr;
  
//   // Set default times
//   this.currentEvent.start_time = '17:00';
//   this.currentEvent.end_time = '02:00';
  
//   this.showCreateEventModal();
// },

createEventForSelectedDate() {
    if (!this.selectedDate) return;
    
    const selectedDate = new Date(this.selectedDate);
    const dayOfWeek = selectedDate.getDay();
    
    // Check if selected date is a closed day
    if (dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4) {
      this.showToast('Night Lounge is closed on Tuesdays, Wednesdays, and Thursdays. Please choose a different date.', 'warning');
      return;
    }
    
    const dateStr = selectedDate.toISOString().split('T')[0];
    this.currentEvent.start_date = dateStr;
    this.currentEvent.end_date = dateStr;
    
    // Set default times
    this.currentEvent.start_time = '17:00';
    this.currentEvent.end_time = '02:00';
    
    this.showCreateEventModal();
  },

async viewEmployeeShifts(employeeId) {
    try {
      // Find employee name for the modal title
      const employee = this.eventStaff.find(emp => emp.employee_id === employeeId);
      this.currentEmployee = employee;
      
      const response = await fetch(`http://localhost:3000/api/employee/${employeeId}/shifts`);
      if (response.ok) {
        const shifts = await response.json();
        
        // Filter shifts to only show those during the event
        this.shiftDetails = shifts.filter(shift => {
          const shiftDate = new Date(shift.date_);
          const eventStart = new Date(this.currentEvent.start_date);
          const eventEnd = new Date(this.currentEvent.end_date);
          return shiftDate >= eventStart && shiftDate <= eventEnd;
        });
        
        // Show the modal
        this.$nextTick(() => {
          this.shiftModal.show();
        });
        
      } else {
        this.showError('Failed to load shift information');
      }
    } catch (err) {
      console.error('Error fetching employee shifts:', err);
      this.showError('Error loading shift information');
    }
  },
  
  formatShiftDate(dateString) {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toastId = 'toast-' + Date.now();
    const icon = type === 'success' ? 'fa-check-circle' : 
                type === 'error' ? 'fa-exclamation-circle' : 
                type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    const toastHTML = `
      <div id="${toastId}" class="toast custom-toast toast-${type} toast-enter" role="alert">
        <div class="toast-header bg-transparent border-bottom-0">
          <i class="fas ${icon} toast-icon text-${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'info'}"></i>
          <strong class="me-auto">Event Management</strong>
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

    // Remove toast from DOM after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.classList.remove('toast-enter');
      toastElement.classList.add('toast-exit');
      
      setTimeout(() => {
        if (toastElement.parentNode) {
          toastElement.parentNode.removeChild(toastElement);
        }
      }, 300);
    });
  },
  
  // showError(message) {
  //   // You can replace this with a more sophisticated notification system
  //   const errorDiv = document.createElement('div');
  //   errorDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed';
  //   errorDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  //   errorDiv.innerHTML = `
  //     <strong>Error!</strong> ${message}
  //     <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  //   `;
  //   document.body.appendChild(errorDiv);
    
  //   // Auto-remove after 5 seconds
  //   setTimeout(() => {
  //     if (errorDiv.parentNode) {
  //       errorDiv.parentNode.removeChild(errorDiv);
  //     }
  //   }, 5000);
  // },

  showError(message) {
    this.showToast(message, 'error');
  },
  
  // Add a method to format time if needed
  formatShiftTime(timeString) {
    if (!timeString) return 'Unknown Time';
    return timeString.substring(0, 5); // Remove seconds if present
  },

  formatEventDate(dateString) {
    if (!dateString || dateString.startsWith('0000-00-00')) {
      return "None";
    }
    
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return "Invalid Date";
      }
      
      return date.toLocaleDateString('en-GB', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      console.error('Error formatting date:', err, dateString);
      return "Invalid Date";
    }
  },
  
  formatEventDateRange(startDate, endDate) {
    if (!startDate || !endDate) return "Date not set";
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // If same day, show just one date
    if (start.toDateString() === end.toDateString()) {
      return this.formatEventDate(startDate);
    }
    
    // If different days, show range
    return `${this.formatEventDate(startDate)} - ${this.formatEventDate(endDate)}`;
  },
  
  // Your existing formatShiftDate method (keep this)
  formatShiftDate(dateString) {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
    }
  }).mount('#vue-event-management');
});