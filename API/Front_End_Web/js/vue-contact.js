// Yatin
document.addEventListener('DOMContentLoaded', () => {
    const { createApp } = Vue;

    createApp({
        data() {
            return {
                employees: [],
                filteredEmployees: [],
                selectedEmployee: null,
                searchQuery: '',
                loading: true,
                error: null
            };
        },
        mounted() {
            this.fetchEmployees();
        },
        methods: {
            async fetchEmployees() {
                try {
                    const response = await fetch('http://localhost:3000/api/employees');
                    if (!response.ok) throw new Error('Failed to fetch employees');
                    
                    this.employees = await response.json();
                    this.filteredEmployees = [...this.employees];
                } catch (err) {
                    console.error('Error fetching employees:', err);
                    this.error = err.message;
                } finally {
                    this.loading = false;
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
            selectEmployee(employee) {
                this.selectedEmployee = employee;
            },
            callEmployee() {
                //In a real app, this would initiate a phone call...decide whether to keep or not
                alert(`Calling ${this.selectedEmployee.phone_number}`);
                
                //For actual calling capability (on mobile devices):
                // window.location.href = `tel:${this.selectedEmployee.phone_number}`;
            },
            emailEmployee() {
                //Open default email client
                window.location.href = `mailto:${this.selectedEmployee.email}`;
            }
        }
    }).mount('#vue-contact');
});