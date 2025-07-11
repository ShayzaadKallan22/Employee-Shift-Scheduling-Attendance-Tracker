document.addEventListener('DOMContentLoaded', () => {
    const { createApp } = Vue;

    createApp({
        data() {
            return {
                manager: null,
                loading: true,
                error: null,
                // Hardcoded manager ID for now (John Smith from the database)
                managerId: 1
            };
        },
        mounted() {
            this.fetchManagerProfile();
        },
        methods: {
            async fetchManagerProfile() {
                try {
                    const response = await fetch(`http://localhost:3000/api/manager/profile/${this.managerId}`);
                    if (!response.ok) throw new Error('Failed to fetch profile');
                    
                    this.manager = await response.json();
                    
                    // Update the profile name in the navbar and sidebar
                    document.getElementById('profile-name').textContent = `${this.manager.first_name} ${this.manager.last_name}`;
                    document.getElementById('nav-profile-name').textContent = `${this.manager.first_name} ${this.manager.last_name}`;
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