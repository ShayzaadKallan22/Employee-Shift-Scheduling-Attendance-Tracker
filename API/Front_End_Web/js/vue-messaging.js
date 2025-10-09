// Yatin
const app = {
    createApp: function (config) {
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
                    lastPollTime: null,
                    // Shift cancellation properties
                    cancellations: [],
                    showResponseModal: false,
                    responseNotes: '',
                    activeCancellation: null,
                    responseAction: null
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
                //Avatar methods
                getEmployeeAvatar(employee) {
                    if (!employee) return '';
                    const firstLetter = employee.first_name ? employee.first_name.charAt(0).toUpperCase() : '?';
                    return firstLetter;
                },

                getEmployeeInitials(employee) {
                    if (!employee) return '?';
                    const first = employee.first_name ? employee.first_name.charAt(0).toUpperCase() : '';
                    const last = employee.last_name ? employee.last_name.charAt(0).toUpperCase() : '';
                    return first + last;
                },

            
                async fetchEmployees() {
                    try {
                        this.loading = true;
                        const response = await fetch('http://localhost:3000/api/employees');
                        if (!response.ok) throw new Error('Failed to fetch employees');

                        this.employees = await response.json();

                        // Get cancellation counts for each employee
                        for (const employee of this.employees) {
                            const cancelResponse = await fetch(
                                `http://localhost:3000/api/messages/cancellation-count/${employee.employee_id}`
                            );
                            if (cancelResponse.ok) {
                                const countData = await cancelResponse.json();
                                employee.cancellation_count = countData.count || 0;
                            }
                        }

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
                                `http://localhost:3000/api/messages/conversation/${this.currentUser.employee_id}/${employee.employee_id}?limit=1`
                            );
                            if (response.ok) {
                                const messages = await response.json();
                                if (messages && messages.length > 0) {
                                    const lastMessage = messages[messages.length - 1];
                                    employee.last_message = {
                                        content: lastMessage.content,
                                        time: lastMessage.sent_time,
                                        is_unread: lastMessage.read_status === 'unread' && lastMessage.receiver_id == this.currentUser.employee_id
                                    };
                                } else {
                                    employee.last_message = null;
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
                        //Clear messages first
                        this.messages = [];
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

                    try {
                        //Fetch both regular messages and cancellations in parallel
                        const [messagesResponse, cancellationsResponse] = await Promise.all([
                            fetch(`http://localhost:3000/api/messages/conversation/${this.currentUser.employee_id}/${this.selectedEmployee.employee_id}`),
                            fetch(`http://localhost:3000/api/messages/cancellations/${this.selectedEmployee.employee_id}`)
                        ]);

                        if (!messagesResponse.ok) throw new Error('Failed to fetch messages');

                        //Get text messages
                        const allMessages = (await messagesResponse.json()).filter(msg => msg !== null && msg !== undefined);
                        console.log('ALL MESSAGES FROM API:', allMessages);

                        const textMessages = allMessages.filter(msg => !msg.type || msg.type === 'text');

                        //Get cancellation messages
                        let cancellationMessages = [];
                        if (cancellationsResponse.ok) {
                            const cancellations = await cancellationsResponse.json();
                            console.log('CANCELLATIONS FROM API:', cancellations);

                            cancellationMessages = cancellations.map(cancellation => {
                                if (!cancellation) return null;

                                return {
                                    type: 'cancellation',
                                    message_id: `cancellation_${cancellation.cancellation_id}`, // Create unique ID
                                    cancellation_id: cancellation.cancellation_id,
                                    shift_date: cancellation.shift_date,
                                    start_time: cancellation.start_time,
                                    end_time: cancellation.end_time,
                                    reason: cancellation.reason,
                                    status: cancellation.status_,
                                    response_notes: cancellation.response_notes,
                                    sent_time: cancellation.requested_at,
                                    sender_id: this.selectedEmployee.employee_id,
                                    notes: cancellation.notes,
                                    
                                    sender_first_name: this.selectedEmployee.first_name,
                                    sender_last_name: this.selectedEmployee.last_name,
                                    receiver_id: this.currentUser.employee_id
                                };
                            }).filter(msg => msg !== null);
                        }

                        console.log('TEXT MESSAGES:', textMessages);
                        console.log('CANCELLATION MESSAGES:', cancellationMessages);

                        //Combine and sort all messages by time
                        this.messages = [...textMessages, ...cancellationMessages].sort((a, b) =>
                            new Date(a.sent_time) - new Date(b.sent_time)
                        );

                        //Check for unread text messages
                        const potentialUnread = textMessages.filter(m => {
                            const isUnread = Number(m.receiver_id) === Number(this.currentUser.employee_id) && m.read_status === 'unread';
                            console.log(`Message ${m.message_id}: receiver=${m.receiver_id}, currentUser=${this.currentUser.employee_id}, read_status=${m.read_status}, isUnread=${isUnread}`);
                            return isUnread;
                        });

                        console.log('POTENTIAL UNREAD MESSAGES:', potentialUnread);

                        const unreadIds = potentialUnread.map(m => m.message_id).filter(id => id !== undefined);
                        console.log('UNREAD IDs TO MARK:', unreadIds);

                        if (unreadIds.length > 0) {
                            console.log('Attempting to mark messages as read...');
                            const markReadResponse = await fetch('http://localhost:3000/api/messages/mark-read', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ message_ids: unreadIds })
                            });

                            console.log('Mark read response status:', markReadResponse.status);

                            if (markReadResponse.ok) {
                                console.log('Successfully marked messages as read');
                                //Update local state for text messages only
                                this.messages.forEach(msg => {
                                    if (unreadIds.includes(msg.message_id)) {
                                        msg.read_status = 'read';
                                    }
                                });
                            } else {
                                console.error('Failed to mark messages as read:', await markReadResponse.text());
                            }
                        } else {
                            console.log('No unread messages found to mark as read');
                        }

                        this.scrollToBottom();

                    } catch (err) {
                        console.error('Error fetching messages:', err);
                        this.error = err.message;
                    }
                },

                async fetchCancellations() {
                    if (!this.selectedEmployee) return;

                    try {
                        const response = await fetch(
                            `http://localhost:3000/api/messages/cancellations/${this.selectedEmployee.employee_id}`
                        );

                        if (response.ok) {
                            const cancellations = await response.json();
                            console.log('Fetched cancellations:', cancellations);

                            //Add cancellation messages to conversation
                            cancellations.forEach(cancellation => {
                                if (!cancellation) return;

                                //Check if this cancellation already exists in messages
                                const existingMsgIndex = this.messages.findIndex(m =>
                                    m && m.cancellation_id === cancellation.cancellation_id
                                );

                                if (existingMsgIndex === -1) {
                                    //Create a new cancellation message
                                    const cancellationMessage = {
                                        type: 'cancellation',
                                        cancellation_id: cancellation.cancellation_id,
                                        shift_date: cancellation.shift_date,
                                        start_time: cancellation.start_time,
                                        end_time: cancellation.end_time,
                                        reason: cancellation.reason,
                                        status: cancellation.status_,
                                        response_notes: cancellation.response_notes,
                                        sent_time: cancellation.requested_at,
                                        sender_id: this.selectedEmployee.employee_id,
                                        notes: cancellation.notes
                                    };

                                    console.log('Adding cancellation message:', cancellationMessage);
                                    this.messages.push(cancellationMessage);
                                }
                            });

                            //Sort messages by time
                            this.messages.sort((a, b) => new Date(a.sent_time) - new Date(b.sent_time));
                        }
                    } catch (err) {
                        console.error('Error fetching cancellations:', err);
                    }
                },

                backToList() {
                    this.selectedEmployee = null;
                    this.messages = [];
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

                    // add to UI
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
                        const response = await fetch('http://localhost:3000/api/messages/send', {
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
                    if (!timeString) return '';

                    try {
                        const date = new Date(timeString);
                        const now = new Date();
                        const diffInHours = (now - date) / (1000 * 60 * 60);
                        const diffInDays = diffInHours / 24;

                        //For today's messages, show time only
                        if (diffInDays < 1) {
                            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }
                        //For yesterday's messages, show "Yesterday + time"
                        else if (diffInDays < 2) {
                            return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        }
                        //For older messages (within 7 days), show day + time
                        else if (diffInDays < 7) {
                            return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        }
                        //For very old messages, show date + time
                        else {
                            return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        }
                    } catch (e) {
                        console.error('Error formatting time:', e);
                        return '';
                    }
                },

                //Shift cancellation methods
                approveCancellation(cancellation) {
                    this.activeCancellation = cancellation;
                    this.showResponseModal = true;
                    this.responseAction = 'approve';
                },

                denyCancellation(cancellation) {
                    this.activeCancellation = cancellation;
                    this.showResponseModal = true;
                    this.responseAction = 'deny';
                },

                async submitCancellationResponse() {
                    if (!this.activeCancellation || !this.responseNotes) return;

                    const status = this.responseAction === 'approve' ? 'approved' : 'rejected';
                    await this.processCancellationResponse(
                        this.activeCancellation.cancellation_id,
                        status,
                        this.responseNotes
                    );

                    //Reset modal
                    this.showResponseModal = false;
                    this.responseNotes = '';
                    this.activeCancellation = null;
                    this.responseAction = null;
                },

                async processCancellationResponse(cancellationId, status, responseNotes) {
                    try {
                        const response = await fetch('http://localhost:3000/api/messages/cancellation-response', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                cancellation_id: cancellationId,
                                status_: status,
                                response_notes: responseNotes,
                                manager_id: this.currentUser.employee_id
                            })
                        });

                        if (response.ok) {
                            //Update local cancellation status
                            const cancellation = this.messages.find(m =>
                                m && m.cancellation_id === cancellationId
                            );

                            if (cancellation) {
                                cancellation.status = status;
                                cancellation.response_notes = responseNotes;

                                //Refresh messages to see the response
                                await this.fetchMessages();
                            }
                        }
                    } catch (err) {
                        console.error('Error processing cancellation response:', err);
                        this.error = 'Failed to process cancellation';
                        setTimeout(() => this.error = null, 5000);
                    }
                },

                formatDate(dateString) {
                    if (!dateString) return 'N/A';

                    try {
                        const date = new Date(dateString);
                        return date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    } catch (e) {
                        console.error('Error formatting date:', e);
                        return 'Invalid date';
                    }
                },

                async debugFetchCancellations() {
                    try {
                        console.log('Debug: Fetching cancellations for employee:', this.selectedEmployee.employee_id);

                        const response = await fetch(
                            `http://localhost:3000/api/messages/cancellations/${this.selectedEmployee.employee_id}`
                        );

                        console.log('Debug: API response status:', response.status);

                        if (response.ok) {
                            const cancellations = await response.json();
                            console.log('Debug: Cancellations data:', cancellations);

                            const specificCancellation = cancellations.find(c => c.cancellation_id === 1);
                            console.log('Debug: Specific cancellation (ID: 1):', specificCancellation);

                            return cancellations;
                        } else {
                            console.error('Debug: API error:', await response.text());
                        }
                    } catch (err) {
                        console.error('Debug: Error fetching cancellations:', err);
                    }
                }
            }
        });
    }
};

//export for HTML to use
window.MessageApp = app;