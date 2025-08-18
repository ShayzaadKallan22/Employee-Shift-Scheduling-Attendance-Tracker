//AUTHOR - SHAYZAAD

const { createApp } = Vue;
const API_BASE = 'https://ifmprojv1-production.up.railway.app/payroll';

createApp({
    data() {
        return {
            isLoading: true,  //Loading state to show/hide loading indicators across the app
            roleRates: [], //Array to store role-based hourly rates (base and overtime)
            employeeRates: [], //Array to store individual employee hourly rates (overrides role rates)
            paymentDetails: [], //Array containing detailed payment information for employees
            employeeSearchQuery: '',
            filteredEmployeeRates: [],
            roleSearchQuery: '',
            filteredRoleRates: [],

            //Summary statistics for the current payroll period
            payrollSummary: {
                totalBudgetUsed: 0,
                employeesPaid: 0,
                paymentDate: 'Loading...'
            },
            
            editingEmployee: null, //Currently selected employee for editing rates
            selectedDate: null, //Currently selected date for filtering payroll data
            flatpickrInstance: null, //Flatpickr calendar instance for date selection
            datePickerElement: null, //DOM element reference for the date picker input
            
            //Budget management properties
            globalBudget: 0,
            //editableBudget: 50000, //Temporary editable budget value used in the budget modal
            showBudgetModal: false, //Controls visibility of the budget editing modal
            showRoleModal: false,  //Modal visibility flags
            showEmployeeModal: false,  //Controls visibility of the employee rates editing modal
            budgetHistory: [],
            budgetStatusCache: {},

                budgetComparison: {
                currentBudget: 0,
                previousBudget: 0,
                adjustment: 0,
                adjustmentPercentage: 0,
                adjustmentReason: '',
                hasAdjustment: false
            },
            showBudgetDetailsModal: false,
        };
    },

    methods: {

         async fetchBudgetComparison(date) {
        try {
            const response = await fetch(`${API_BASE}/budget-comparison?date=${date}`);
            if (response.ok) {
                const data = await response.json();
                this.budgetComparison = data;
            } else {
                // Reset to default if no data
                this.budgetComparison = {
                    currentBudget: this.globalBudget,
                    previousBudget: this.globalBudget,
                    adjustment: 0,
                    adjustmentPercentage: 0,
                    adjustmentReason: 'No adjustment data available',
                    hasAdjustment: false
                };
            }
        } catch (error) {
            console.error('Error fetching budget comparison:', error);
            this.budgetComparison = {
                currentBudget: this.globalBudget,
                previousBudget: this.globalBudget,
                adjustment: 0,
                adjustmentPercentage: 0,
                adjustmentReason: 'Error loading adjustment data',
                hasAdjustment: false
            };
        }
    },

    //Open budget details modal
    openBudgetDetailsModal() {
        this.showBudgetDetailsModal = true;
    },

    //Close budget details modal
    closeBudgetDetailsModal() {
        this.showBudgetDetailsModal = false;
    },

    //Format adjustment with proper styling classes
    getAdjustmentClass() {
        if (!this.budgetComparison.hasAdjustment) return 'text-muted';
        return this.budgetComparison.adjustment > 0 ? 'text-success' : 'text-danger';
    },

    //Get adjustment icon
    getAdjustmentIcon() {
        if (!this.budgetComparison.hasAdjustment) return 'fa-minus';
        return this.budgetComparison.adjustment > 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    },

    //Format adjustment display text
    formatAdjustmentText() {
        if (!this.budgetComparison.hasAdjustment) return 'No Change';
        const sign = this.budgetComparison.adjustment > 0 ? '+' : '';
        return `${sign}${this.formatCurrency(this.budgetComparison.adjustment)} (${sign}${this.budgetComparison.adjustmentPercentage.toFixed(1)}%)`;
    },
        async fetchBudgetStatusForDate(dateString) {
            try {
                // Check cache first
                if (this.budgetStatusCache[dateString]) {
                    return this.budgetStatusCache[dateString];
                }

                const [paymentsResponse, budgetResponse] = await Promise.all([
                    fetch(`${API_BASE}/summary?date=${dateString}`),
                    fetch(`${API_BASE}/budget?date=${dateString}`)
                ]);

                let totalBudgetUsed = 0;
                let budget = 50000; // Default budget

                if (paymentsResponse.ok) {
                    const summaryData = await paymentsResponse.json();
                    totalBudgetUsed = summaryData.totalBudgetUsed || 0;
                }

                if (budgetResponse.ok) {
                    const budgetData = await budgetResponse.json();
                    budget = Math.max(10000, budgetData.budget || 50000);
                }

                const status = {
                    exceeded: totalBudgetUsed > budget,
                    totalUsed: totalBudgetUsed,
                    totalBudget: budget
                };

                // Cache the result
                this.budgetStatusCache[dateString] = status;
                return status;
            } catch (error) {
                console.error('Error fetching budget status for date:', dateString, error);
                return { exceeded: false, totalUsed: 0, totalBudget: 50000 };
            }
        },

        //4. ADDED THIS NEW METHOD to apply the visual indicators:
        async applyBudgetIndicators() {
            if (!this.flatpickrInstance) return;

            //Get all Tuesday dates visible in the calendar
            const calendar = document.querySelector('.flatpickr-calendar');
            if (!calendar) return;

            const dayElements = calendar.querySelectorAll('.flatpickr-day:not(.flatpickr-disabled)');
            
            for (const dayElement of dayElements) {
                const date = new Date(dayElement.dateObj);
                if (date.getDay() === 2) { // Only for Tuesdays
                    const dateString = moment(date).format('YYYY-MM-DD');
                    const status = await this.fetchBudgetStatusForDate(dateString);
                    
                    //Remove existing classes
                    dayElement.classList.remove('budget-exceeded', 'budget-ok');
                    
                    //Added appropriate class based on budget status
                    if (status.exceeded) {
                        dayElement.classList.add('budget-exceeded');
                    } else if (status.totalUsed > 0) { // Only show green if there was actual payroll
                        dayElement.classList.add('budget-ok');
                    }
                }
            }
        },

                //Added this method to fetch budget history:
        async fetchBudgetHistory() {
            try {
                const response = await fetch(`${API_BASE}/budget-history`);
                if (response.ok) {
                    this.budgetHistory = await response.json();
                }
            } catch (error) {
                console.error('Error fetching budget history:', error);
            }
        },

        filterRoles() {
            if (!this.roleSearchQuery) {
                this.filteredRoleRates = [...this.roleRates];
                return;
            }
            
            const query = this.roleSearchQuery.toLowerCase();
            this.filteredRoleRates = this.roleRates.filter(role => {
                return role.title.toLowerCase().includes(query);
            });
        },

         filterEmployees() {
            if (!this.employeeSearchQuery) {
                this.filteredEmployeeRates = [...this.employeeRates];
                return;
            }
            
            const query = this.employeeSearchQuery.toLowerCase();
            this.filteredEmployeeRates = this.employeeRates.filter(employee => {
                return (
                    employee.employee_name.toLowerCase().includes(query) ||
                    employee.role_title.toLowerCase().includes(query)
                );
            });
        },

        //Calculate most recent Tuesday
        //Fixed getMostRecentTuesday method - more explicit and debuggable
        getMostRecentTuesday() {
            const today = new Date();
            const dayOfWeek = today.getDay(); //0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
            
            console.log('Today is:', today.toDateString(), 'Day of week:', dayOfWeek);
            
            let daysToSubtract;
            switch (dayOfWeek) {
                case 0: //Sunday
                    daysToSubtract = 5; // Go back 5 days to Tuesday
                    break;
                case 1: //Monday  
                    daysToSubtract = 6; // Go back 6 days to Tuesday
                    break;
                case 2: //Tuesday
                    daysToSubtract = 0; // Today is Tuesday
                    break;
                default: //Wednesday through Saturday
                    daysToSubtract = dayOfWeek - 2; //Go back to this week's Tuesday
            }
            
            console.log('Days to subtract:', daysToSubtract);
            
            const mostRecentTuesday = new Date(today);
            mostRecentTuesday.setDate(today.getDate() - daysToSubtract);
            
            const result = mostRecentTuesday.toISOString().split('T')[0];
            console.log('Most recent Tuesday:', result);
            
            return result;
        },

        //Fetch all required data simultaneously using Promise.all
        async fetchAllData() {
            await Promise.all([
                this.fetchRoleRates(),
                this.fetchEmployeeRates(),
                this.fetchPaymentDetails(),
                this.fetchPayrollSummary()
            ]);
        },

        //Fetch role rates from API (base hourly rates for different job roles)
        async fetchRoleRates() {
            try {
                const response = await fetch(`${API_BASE}/roles`);
                if (response.ok) {
                    this.roleRates = await response.json();
                    this.filteredRoleRates = [...this.roleRates]; // Initialize filtered list
                } else {
                    console.error('Failed to fetch role rates');
                    this.roleRates = [];
                    this.filteredRoleRates = [];
                }
            } catch (error) {
                console.error('Error fetching role rates:', error);
                this.roleRates = [];
                this.filteredRoleRates = [];
            }
        },

        //Fetch employee rates from API (individual employee rate overrides)
        async fetchEmployeeRates() {
            try {
                const response = await fetch(`${API_BASE}/employees`);
                if (response.ok) {
                    this.employeeRates = await response.json();
                    this.filteredEmployeeRates = [...this.employeeRates]; // Initialize filtered list
                } else {
                    console.error('Failed to fetch employee rates');
                    this.employeeRates = [];
                    this.filteredEmployeeRates = [];
                }
            } catch (error) {
                console.error('Error fetching employee rates:', error);
                this.employeeRates = [];
                this.filteredEmployeeRates = [];
            }
        },

        //Fetch payment details from API (actual payment calculations for employees)
        async fetchPaymentDetails() {
            try {
                const response = await fetch(`${API_BASE}/payments`);
                if (response.ok) {
                    this.paymentDetails = await response.json();
                } else {
                    console.error('Failed to fetch payment details');
                    //Set empty array on failure to prevent UI errors
                    this.paymentDetails = [];
                }
            } catch (error) {
                console.error('Error fetching payment details:', error);
                //Set empty array on error to prevent UI errors
                this.paymentDetails = [];
            }
        },

        //Fetch payroll summary from API (totals and statistics for the current period)
        async fetchPayrollSummary() {
            try {
                const response = await fetch(`${API_BASE}/summary`);
                if (response.ok) {
                    const data = await response.json();
                    this.payrollSummary = {
                        totalBudgetUsed: data.totalBudgetUsed || 0,
                        employeesPaid: data.employeesPaid || 0,
                        paymentDate: data.paymentDate || 'Not available'
                    };
                } else {
                    console.error('Failed to fetch payroll summary');
                    //Set default values on failure
                    this.payrollSummary = {
                        totalBudgetUsed: 0,
                        employeesPaid: 0,
                        paymentDate: 'Error loading data'
                    };
                }
            } catch (error) {
                console.error('Error fetching payroll summary:', error);
                //Set default values on error
                this.payrollSummary = {
                    totalBudgetUsed: 0,
                    employeesPaid: 0,
                    paymentDate: 'Error loading data'
                };
            }
        },

        //Fetch payroll data for specific date (used when filtering by date)
        async fetchPayrollDataForDate(date) {
            this.isLoading = true;
             try {
        const formattedDate = moment(date).format('YYYY-MM-DD');
        
        const [paymentsResponse, summaryResponse] = await Promise.all([
            fetch(`${API_BASE}/payments?date=${formattedDate}`),
            fetch(`${API_BASE}/summary?date=${formattedDate}`),
            this.fetchBudgetForDate(formattedDate),
            this.fetchBudgetComparison(formattedDate) // Add this line
        ]);

                if (paymentsResponse.ok) {
                    this.paymentDetails = await paymentsResponse.json();
                } else {
                    console.error('Failed to fetch payment details for date:', date);
                    this.paymentDetails = [];
                }

                if (summaryResponse.ok) {
                    const summaryData = await summaryResponse.json();
                    this.payrollSummary = {
                        totalBudgetUsed: summaryData.totalBudgetUsed || 0,
                        employeesPaid: summaryData.employeesPaid || 0,
                        paymentDate: this.formatShiftDate(date),
                    };
                } else {
                    console.error('Failed to fetch payroll summary for date:', date);
                    //Keep the formatted date even if summary fails
                    this.payrollSummary.paymentDate = this.formatShiftDate(date);
                }
            } catch (error) {
                console.error('Error fetching payroll data for date:', error);
                //Reset to empty state on error
                this.paymentDetails = [];
                this.payrollSummary = {
                    totalBudgetUsed: 0,
                    employeesPaid: 0,
                    paymentDate: `Error loading data for ${this.formatShiftDate(date)}`
                };
            } finally {
                //Always turn off loading state regardless of success/failure
                this.isLoading = false;
            }
        },

        //fetch budget for a specific date:
        async fetchBudgetForDate(date) {
            try {
                const response = await fetch(`${API_BASE}/budget?date=${date}`);
                if (response.ok) {
                    const data = await response.json();
                    //Ensure budget is never negative
                    this.globalBudget = Math.max(10000, data.budget || 50000);
                }
            } catch (error) {
                console.error('Error fetching budget:', error);
                this.globalBudget = 10000; //Fallback to default
            }
        },

        //Format currency values using Rand
        formatCurrency(value) {
            if (value === null || value === undefined || isNaN(value)) {
                return 'R0.00';
            }
            return new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR'
            }).format(value);
        },

        //Format date strings from YYYY-MM-DD to DD-MM-YYYY for display
        formatShiftDate(dateString) {
            if (!dateString) return "N/A";
            const [day, month, year] = dateString.split('-');
            return `${day}-${month}-${year}`;
        },

        //Initialize Flatpickr datepicker with Tuesday-only selection
        initDatePicker() {
            //Clean up any existing instance to prevent memory leaks
            if (this.flatpickrInstance) {
                this.flatpickrInstance.destroy();
                this.flatpickrInstance = null;
            }

            //Get DOM reference to the date picker input element
            this.datePickerElement = document.getElementById('payrollDate');
            if (!this.datePickerElement) return;

            //Prepare default date - convert YYYY-MM-DD string to Date object for Flatpickr
            let defaultDate = null;
            if (this.selectedDate) {
                //Parse the date string correctly (month is 0-indexed in JavaScript Date)
                const dateParts = this.selectedDate.split('-');
                defaultDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
            }

            //Initialize Flatpickr with configuration optimized for payroll date selection
            this.flatpickrInstance = flatpickr(this.datePickerElement, {
                inline: false,
                static: true,
                position: 'auto', 
                dateFormat: "d-m-Y",
                defaultDate: defaultDate, //Use Date object instead of formatted string
                enable: [
                    (date) => date.getDay() === 2 //Only allow Tuesdays (payroll periods)
                ],
                onChange: (selectedDates) => {
                    if (selectedDates[0]) {
                        //Convert selected date back to YYYY-MM-DD format for internal use
                        this.selectedDate = moment(selectedDates[0]).format('YYYY-MM-DD');
                        this.fetchPayrollDataForDate(this.selectedDate);
                    }
                },
                
                onReady: () => {
                    //Force repositioning after initialization to ensure proper placement
                    setTimeout(() => {
                        if (this.flatpickrInstance) {
                            this.flatpickrInstance._positionCalendar();
                        }
                        //Apply budget indicators after calendar is ready
                        this.applyBudgetIndicators();
                    }, 100);
                },

                //ADDED THIS NEW CALLBACK to apply indicators when month changes
                onMonthChange: () => {
                    setTimeout(() => {
                        this.applyBudgetIndicators();
                    }, 100);
                },

                onYearChange: () => {
                    setTimeout(() => {
                        this.applyBudgetIndicators();
                    }, 100);
                }
            });
        },

        //Open datepicker with custom positioning logic
        openDatePicker() {
            if (this.flatpickrInstance) {
                this.flatpickrInstance.open();
                
                //Force repositioning after opening
                setTimeout(() => {
                    if (this.flatpickrInstance) {
                        this.flatpickrInstance._positionCalendar();
                        
                        //Custom positioning logic to ensure calendar appears in correct location
                        const inputRect = this.datePickerElement.getBoundingClientRect();
                        const calendar = document.querySelector('.flatpickr-calendar');
                        
                        if (calendar) {
                            //Position calendar below the input element
                            calendar.style.position = 'fixed';
                            calendar.style.top = `${inputRect.bottom + window.scrollY}px`;
                            calendar.style.left = `${inputRect.left + window.scrollX}px`;
                            calendar.style.zIndex = '99999';
                        }
                    }
                }, 10);
                setTimeout(() => {
                    this.applyBudgetIndicators();
                }, 200);
            }
        },

        //Clear date filter and return to showing all payroll data
        clearDateFilter() {
            this.selectedDate = null;
            if (this.flatpickrInstance) {
                this.flatpickrInstance.clear();
            }
            //Reload all data without date filtering
            this.fetchAllData();
        },

        //Save updated role rates to the database
        async saveRoleRates() {
            this.isLoading = true;
            try {
                //Prepare data for API by ensuring numeric values
                const updates = this.roleRates.map(role => ({
                    role_id: role.role_id,
                    base_hourly_rate: parseFloat(role.base_hourly_rate),
                    overtime_hourly_rate: parseFloat(role.overtime_hourly_rate)
                }));
                
                const response = await fetch(`${API_BASE}/roles`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updates)
                });
                
                if (response.ok) {
                    alert('Role rates updated successfully');
                    this.showRoleModal = false; //Close modal after successful update
                    //Refresh employee rates as they may be affected by role rate changes
                    await this.fetchEmployeeRates();
                    
                    //Refresh current view to show updated calculations
                    if (this.selectedDate) {
                        await this.fetchPayrollDataForDate(this.selectedDate);
                    } else {
                        await this.fetchPaymentDetails();
                    }
                } else {
                    throw new Error('Failed to update role rates');
                }
            } catch (error) {
                console.error('Error saving role rates:', error);
                alert('Failed to update role rates: ' + error.message);
            } finally {
                this.isLoading = false;
            }
        },

        //Save updated employee rates to the database
        async saveEmployeeRates() {
            this.isLoading = true;
            try {
                //Prepare data for API by ensuring numeric values
                const updates = this.employeeRates.map(employee => ({
                    employee_id: employee.employee_id,
                    base_hourly_rate: parseFloat(employee.base_hourly_rate),
                    overtime_hourly_rate: parseFloat(employee.overtime_hourly_rate)
                }));
                
                const response = await fetch(`${API_BASE}/employees`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updates)
                });
                
                if (response.ok) {
                    alert('Employee rates updated successfully');
                    this.showEmployeeModal = false; //Close modal after successful update
                    
                    //Refresh current view to show updated calculations
                    if (this.selectedDate) {
                        await this.fetchPayrollDataForDate(this.selectedDate);
                    } else {
                        await this.fetchPaymentDetails();
                    }
                } else {
                    throw new Error('Failed to update employee rates');
                }
            } catch (error) {
                console.error('Error saving employee rates:', error);
                alert('Failed to update employee rates: ' + error.message);
            } finally {
                this.isLoading = false;
            }
        },
        
        //Budget management methods
        //Open the budget editing modal with current budget value
        openBudgetModal() {
            this.editableBudget = this.globalBudget;
            this.showBudgetModal = true;
        },
        
        
        //saveBudget to use the API:
        // async saveBudget() {
        //     this.isLoading = true;
        //     try {
        //         const response = await fetch(`${API_BASE}/set-budget`, {
        //             method: 'POST',
        //             headers: {
        //                 'Content-Type': 'application/json'
        //             },
        //             body: JSON.stringify({
        //                 budget: this.editableBudget,
        //                 date: this.selectedDate || this.getMostRecentTuesday()
        //             })
        //         });
                
        //         if (response.ok) {
        //             // Refresh data to show updated budget
        //             if (this.selectedDate) {
        //                 await this.fetchPayrollDataForDate(this.selectedDate);
        //             } else {
        //                 await this.fetchPayrollSummary();
        //             }
        //             this.showBudgetModal = false;
        //         } else {
        //             throw new Error('Failed to update budget');
        //         }
        //     } catch (error) {
        //         console.error('Error saving budget:', error);
        //         alert('Failed to update budget: ' + error.message);
        //     } finally {
        //         this.isLoading = false;
        //     }
        // },
        
        //Close budget modal without saving changes
        closeBudgetModal() {
            this.showBudgetModal = false;
        }
    },

    //Component lifecycle hook - runs when component is mounted to DOM
    async mounted() {
        //Load saved budget from localStorage if available
        const savedBudget = localStorage.getItem('payrollBudget');
        if (savedBudget) {
            this.globalBudget = parseFloat(savedBudget);
        }
        
        try {
            //Set default date to most recent Tuesday for typical payroll workflow
            const mostRecentTuesday = this.getMostRecentTuesday();
            this.selectedDate = mostRecentTuesday;
            
            //Initialize datepicker BEFORE loading data to ensure proper DOM state
            this.$nextTick(() => {
                this.initDatePicker();
            });
            
            //Load payroll data for the default date
            await this.fetchPayrollDataForDate(mostRecentTuesday);
            
            //Load supplementary data (rates) in parallel for better performance
            await Promise.all([
                this.fetchRoleRates(),
                this.fetchEmployeeRates(),
                this.fetchBudgetForDate(mostRecentTuesday) 
            ]);

        } catch (error) {
            console.error('Error loading initial data:', error);
            //Fall back to loading all data if date-specific loading fails
            await this.fetchAllData();
        } finally {
            //Always turn off loading state when initial load is complete
            this.isLoading = false;
        }
    },

    //Component lifecycle hook - runs after DOM updates
    updated() {
        //Reinitialize datepicker after DOM updates to ensure it stays functional
        this.$nextTick(this.initDatePicker);
    },
    
    //Component lifecycle hook - runs before component is destroyed
    beforeUnmount() {
        //Clean up Flatpickr instance to prevent memory leaks
        if (this.flatpickrInstance) {
            this.flatpickrInstance.destroy();
            this.flatpickrInstance = null;
        }
    }
}).mount('#payroll-app');