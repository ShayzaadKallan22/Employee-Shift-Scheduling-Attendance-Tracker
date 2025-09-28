// js/vue-registration.js
const { createApp } = Vue;

createApp({
    data() {
        return {
            formData: {
                first_name: '',
                last_name: '',
                email: '',
                phone_number: '',
                type_: '',
                role_id: '',
            },
            termsChecked: false,
            isSubmitting: false,
            alert: {
                message: '',
                type: ''
            },
            allRoles: [
                { value: 'bartender', label: 'Bartender' },
                { value: 'cleaner', label: 'Cleaner' },
                { value: 'bouncer', label: 'Bouncer' },
                { value: 'sparkler_girl', label: 'Sparkler Girl' },
                { value: 'runner', label: 'Runner' },
                { value: 'waiter', label: 'Waiter' },
                { value: 'leader', label: 'Leader' }
            ]
        }
    },
    computed: {
        availableRoles() {
            if (this.formData.type_ === 'manager') {
                // Only Leader role for managers
                return this.allRoles.filter(role => role.value === 'leader');
            } else if (this.formData.type_ === 'employee') {
                // All roles except Leader for employees
                return this.allRoles.filter(role => role.value !== 'leader');
            } else {
                // No user type selected, show no roles
                return [];
            }
        }
    },
    watch: {
        'formData.type_'(newType) {
            // Reset role selection when user type changes
            this.formData.role_id = '';
            
            // Auto-select Leader if Manager is selected
            if (newType === 'manager') {
                this.formData.role_id = 'leader';
            }
        }
    },
    methods: {
        async handleSubmit() {
            // Validate form
            if (!this.validateForm()) {
                return;
            }
            
            this.isSubmitting = true;
            this.clearAlert();
            
            try {
                // Send data to API
                const response = await fetch('http://localhost:3000/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(this.formData)
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Registration failed');
                }
                
                // Registration successful
                this.showAlert(`Employee registered successfully! Temporary password: ${data.temporaryPassword}`, 'success');
                
                // Reset form
                this.resetForm();
                
            } catch (error) {
                console.error('Registration error:', error);
                this.showAlert(`Registration failed: ${error.message}`, 'danger');
            } finally {
                this.isSubmitting = false;
            }
        },
        
        validateForm() {
            // Check required fields
            if (!this.formData.first_name.trim()) {
                this.showAlert('First name is required', 'danger');
                return false;
            }
            
            if (!this.formData.last_name.trim()) {
                this.showAlert('Last name is required', 'danger');
                return false;
            }
            
            if (!this.formData.email.trim()) {
                this.showAlert('Email is required', 'danger');
                return false;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(this.formData.email)) {
                this.showAlert('Please enter a valid email address', 'danger');
                return false;
            }
            
            if (!this.formData.phone_number.trim()) {
                this.showAlert('Phone number is required', 'danger');
                return false;
            }
            
            if (!this.formData.type_) {
                this.showAlert('User type is required', 'danger');
                return false;
            }
            
            if (!this.formData.role_id) {
                this.showAlert('Role is required', 'danger');
                return false;
            }
            
            if (!this.termsChecked) {
                this.showAlert('Please confirm that all information is correct', 'danger');
                return false;
            }
            
            return true;
        },
        
        showAlert(message, type) {
            this.alert.message = message;
            this.alert.type = type;
            
            // Auto-clear non-success alerts after 5 seconds
            if (type !== 'success') {
                setTimeout(() => {
                    this.clearAlert();
                }, 5000);
            }
        },
        
        clearAlert() {
            this.alert.message = '';
            this.alert.type = '';
        },
        
        resetForm() {
            this.formData = {
                first_name: '',
                last_name: '',
                email: '',
                phone_number: '',
                type_: '',
                role_id: '',
            };
            this.termsChecked = false;
        }
    }
}).mount('#vue-registration-form');