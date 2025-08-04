// Front_End/registration.js
document.addEventListener('DOMContentLoaded', function() {
    const registrationForm = document.querySelector('form');
    
    registrationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form values
        const formData = {
            first_name: document.getElementById('firstName').value.trim(),
            last_name: document.getElementById('lastName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone_number: document.getElementById('phone').value.trim(),
            type_: document.getElementById('userType').value,
            role_id: document.getElementById('role').value,
            mac_address: document.getElementById('macAddress').value.trim().toUpperCase()
        };
        
        // Validate MAC address format
        const macRegex = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/;
        if (!macRegex.test(formData.mac_address)) {
            showAlert('Please enter a valid MAC address in the format: 00:1A:2B:3C:4D:5E', 'danger');
            return;
        }
        
        // Validate terms checkbox
        if (!document.getElementById('termsCheck').checked) {
            showAlert('Please confirm that all information is correct', 'danger');
            return;
        }
        
        try {
            // Show loading state
            const submitButton = registrationForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Registering...';
            
            // Send data to API
            const response = await fetch('http://ifmprojv1-production.up.railway.app/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }
            
            // Registration successful
            showAlert(`Employee registered successfully! Temporary password: ${data.temporaryPassword}`, 'success');
            
            // Reset form
            registrationForm.reset();
            
        } catch (error) {
            console.error('Registration error:', error);
            showAlert(`Registration failed: ${error.message}`, 'danger');
        } finally {
            // Reset button state
            const submitButton = registrationForm.querySelector('button[type="submit"]');
            submitButton.disabled = false;
            submitButton.textContent = 'Register Employee';
        }
    });
    
    // Function to show alert messages
    function showAlert(message, type) {
        // Remove any existing alerts
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        // Create new alert
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} mt-3`;
        alertDiv.textContent = message;
        
        // Add close button for success messages
        if (type === 'success') {
            alertDiv.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" style="float: right;"></button>
            `;
        }
        
        // Insert after the form
        const formContainer = document.querySelector('.bg-secondary.rounded.h-100.p-4');
        formContainer.appendChild(alertDiv);
        
        // Remove after 5 seconds (only for non-success messages)
        if (type !== 'success') {
            setTimeout(() => {
                alertDiv.remove();
            }, 5000);
        }
    }
});