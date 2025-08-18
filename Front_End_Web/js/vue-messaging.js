const app = {
    createApp: function(config) {
        return Vue.createApp({
            data() {
                //get employee ID from cookie or JWT token
                const getEmployeeId = () => {
                    //try to get from cookie
                    const cookieValue = document.cookie
                        .split('; ')
                        .find(row => row.startsWith('employeeId='))
                        ?.split('=')[1];
                    
                    if (cookieValue) return cookieValue;

                    //try to get from localStorage (fallback)
                    return localStorage.getItem('employeeId') || null;
                };

                const employeeId = getEmployeeId();
                
                return {
                    employees: [],
                    filteredEmployees: [],
                    selectedEmployee: null,
                    messages: [],
                    newMessage: '',
                    searchQuery: '',
                    loading: true,
                    error: null,
                    currentUser: {
                        employee_id: employeeId,
                        first_name: 'Manager', //default name if we can't get from server
                        last_name: ''
                    },
                    pollingInterval: null,
                    lastPollTime: null
                };
            },
            async created() {
                //if we have an employee ID, try to fetch their details
                if (this.currentUser.employee_id) {
                    try {
                        const response = await fetch(`http://localhost:3000/api/employees/${this.currentUser.employee_id}`);
                        if (response.ok) {
                            const userData = await response.json();
                            this.currentUser = {
                                ...this.currentUser,
                                first_name: userData.first_name,
                                last_name: userData.last_name
                            };
                        }
                    } catch (err) {
                        console.error('Error fetching user details:', err);
                    }
                }
            },
            mounted() {
                if (!this.currentUser.employee_id) {
                    this.error = 'Please log in to use messaging';
                    return;
                }
                this.fetchEmployees();
                this.startPolling();
                
                //check for employee ID in URL
                const urlParams = new URLSearchParams(window.location.search);
                const employeeId = urlParams.get('employeeId');
                if (employeeId) {
                    const employee = this.employees.find(e => e.employee_id == employeeId);
                    if (employee) {
                        this.selectEmployee(employee);
                    }
                }
            },
            methods: {
                async fetchEmployees() {
                    try {
                        this.loading = true;
                        const response = await fetch('https://ifmprojv1-production.up.railway.app/api/employees');
                        if (!response.ok) throw new Error('Failed to fetch employees');

                        this.employees = await response.json();
                        this.filteredEmployees = [...this.employees];
                        await this.fetchLastMessages();
                    } catch (err) {
                        console.error('Error fetching employees:', err);
                        this.error = err.message;
                    } finally {
                        this.loading = false;
                    }
                },
                async fetchLastMessages() {
                    try {
                        for (const employee of this.employees) {
                            const response = await fetch(
                                `https://ifmprojv1-production.up.railway.app/api/messages/conversation/${this.currentUser.employee_id}/${employee.employee_id}?limit=1`
                            );
                            if (response.ok) {
                                const [lastMessage] = await response.json();
                                if (lastMessage) {
                                    employee.last_message = lastMessage.sent_time;
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching last messages:', err);
                    }
                },
                filterEmployees() {
                    if (!this.searchQuery) {
                        this.filteredEmployees = [...this.employees];
                        return;
                    }

                    const query = this.searchQuery.toLowerCase();
                    this.filteredEmployees = this.employees.filter(employee =>
                        employee.first_name.toLowerCase().includes(query) ||
                        employee.last_name.toLowerCase().includes(query) ||
                        employee.email.toLowerCase().includes(query) ||
                        employee.phone_number.includes(query) ||
                        employee.role_title.toLowerCase().includes(query)
                    );
                },
                async selectEmployee(employee) {
                    this.selectedEmployee = employee;
                    this.loading = true;
                    try {
                        await this.fetchMessages();
                    } catch (err) {
                        console.error('Error fetching messages:', err);
                        this.error = err.message;
                    } finally {
                        this.loading = false;
                    }
                },
                async fetchMessages() {
                    if (!this.selectedEmployee) return;
                    
                    const response = await fetch(
                        `https://ifmprojv1-production.up.railway.app/api/messages/conversation/${this.currentUser.employee_id}/${this.selectedEmployee.employee_id}`
                    );
                    if (!response.ok) throw new Error('Failed to fetch messages');

                    this.messages = await response.json();
                    this.lastPollTime = new Date().toISOString();
                    this.scrollToBottom();

                    //mark messages as read
                    const unreadIds = this.messages
                        .filter(m => m.receiver_id === this.currentUser.employee_id && m.read_status === 'unread')
                        .map(m => m.message_id);

                    if (unreadIds.length > 0) {
                        await fetch('https://ifmprojv1-production.up.railway.app/api/messages/mark-read', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message_ids: unreadIds })
                        });
                    }
                },
                backToList() {
                    this.selectedEmployee = null;
                    this.messages = [];
                    //remove employeeId from URL
                    window.history.pushState({}, document.title, window.location.pathname);
                },
                async sendMessage() {
                    if (!this.newMessage.trim() || !this.selectedEmployee) return;

                    const tempId = Date.now();
                    const messageData = {
                        sender_id: this.currentUser.employee_id,
                        receiver_id: this.selectedEmployee.employee_id,
                        content: this.newMessage.trim()
                    };

                    //optimistically add to UI
                    const tempMessage = {
                        ...messageData,
                        temp_id: tempId,
                        sent_time: new Date().toISOString(),
                        read_status: 'unread',
                        sender_first_name: this.currentUser.first_name,
                        sender_last_name: this.currentUser.last_name,
                        receiver_first_name: this.selectedEmployee.first_name,
                        receiver_last_name: this.selectedEmployee.last_name
                    };
                    this.messages.push(tempMessage);
                    this.newMessage = '';
                    this.scrollToBottom();

                    try {
                        const response = await fetch('https://ifmprojv1-production.up.railway.app/api/messages/send', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(messageData)
                        });

                        if (!response.ok) throw new Error('Failed to send message');
                        
                        const sentMessage = await response.json();
                        //replace temporary message with real one
                        const index = this.messages.findIndex(m => m.temp_id === tempId);
                        if (index !== -1) {
                            this.messages.splice(index, 1, sentMessage);
                        }
                    } catch (err) {
                        console.error('Error sending message:', err);
                        //remove optimistic message
                        const index = this.messages.findIndex(m => m.temp_id === tempId);
                        if (index !== -1) this.messages.splice(index, 1);
                        
                        this.error = 'Failed to send message. Please try again.';
                        setTimeout(() => this.error = null, 5000);
                    }
                },
                startPolling() {
                    //clear existing interval if any
                    if (this.pollingInterval) {
                        clearInterval(this.pollingInterval);
                    }

                    //poll every 5 seconds
                    this.pollingInterval = setInterval(() => {
                        if (this.selectedEmployee) {
                            this.fetchMessages();
                        } else {
                            this.fetchLastMessages();
                        }
                    }, 5000);
                },
                scrollToBottom() {
                    this.$nextTick(() => {
                        const container = this.$refs.messageContainer;
                        if (container) {
                            container.scrollTop = container.scrollHeight;
                        }
                    });
                },
                formatTime(timeString) {
                    const date = new Date(timeString);
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
            }
        });
    }
};

//export for HTML to use
window.MessageApp = app;