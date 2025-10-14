// Yatin
document.addEventListener('DOMContentLoaded', () => {
    const { createApp } = Vue;

    createApp({
        data() {
            return {
                manager: null,
                loading: true,
                error: null,
                managerId: null
            };
        },
        mounted() {
            //Get manager ID from localStorage
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    this.managerId = user.id;
                    this.fetchManagerProfile();
                } catch (e) {
                    this.error = "Invalid user data";
                    this.loading = false;
                }
            } else {
                this.error = "No user logged in";
                this.loading = false;
                // Redirect to login if no user data
                window.location.href = 'signin.html';
            }
        },
        methods: {
            async fetchManagerProfile() {
                try {
                    const response = await fetch(`http://localhost:3000/api/manager/profile/${this.managerId}`);
                    if (!response.ok) throw new Error('Failed to fetch profile');
                    
                    this.manager = await response.json();
                    
                    // update the profile name elements only if they exist
                    const profileNameElement = document.getElementById('profile-name');
                    if (profileNameElement) {
                        profileNameElement.textContent = `${this.manager.first_name} ${this.manager.last_name}`;
                    }
                    
                    const navProfileName = document.getElementById('nav-profile-name');
                    if (navProfileName) {
                        navProfileName.textContent = `${this.manager.first_name} ${this.manager.last_name}`;
                    }
                } catch (err) {
                    console.error('Error fetching profile:', err);
                    this.error = err.message;
                } finally {
                    this.loading = false;
                }
            },
            formatDate(dateString) {
                if (!dateString) return 'N/A';
                return new Date(dateString).toLocaleDateString('en-GB');
            }
        }
    }).mount('#vue-profile');
});