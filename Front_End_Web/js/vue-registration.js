// js/registration-vue.js
document.addEventListener('DOMContentLoaded', () => {
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
                    mac_address: ''
                },
                termsChecked: false,
                isSubmitting: false,
                alert: {
                    message: '',
                    type: ''
                }
            };
        },
        methods: {
            async handleSubmit() {
                this.formData.mac_address = this.formData.mac_address.trim().toUpperCase();
                
                const macRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/;
                if (!macRegex.test(this.formData.mac_address)) {
                    this.showAlert('Please enter valid MAC address format: 00:1A:2B:3C:4D:5E', 'danger');
                    return;
                }
                
                if (!this.termsChecked) {
                    this.showAlert('Please confirm all information is correct', 'danger');
                    return;
                }
                
                try {
                    this.isSubmitting = true;
                    const response = await fetch('https://ifmprojv1-production.up.railway.app/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(this.formData)
                    });
                    
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Registration failed');
                    
                    this.showAlert(`Success! Temporary password: ${data.temporaryPassword}`, 'success');
                    this.resetForm();
                } catch (error) {
                    console.error('Registration error:', error);
                    this.showAlert(`Failed: ${error.message}`, 'danger');
                } finally {
                    this.isSubmitting = false;
                }
            },
            showAlert(message, type) {
                this.alert = { message, type };
                if (type !== 'success') setTimeout(this.clearAlert, 5000);
            },
            clearAlert() {
                this.alert = { message: '', type: '' };
            },
            resetForm() {
                this.formData = {
                    first_name: '',
                    last_name: '',
                    email: '',
                    phone_number: '',
                    type_: '',
                    role_id: '',
                    mac_address: ''
                };
                this.termsChecked = false;
            }
        }
    }).mount('#vue-registration-form');
});