//AUTHOR - SHAYZAAD
const { createApp } = Vue;

createApp({
    data() {
        return {
            todaysShifts: []
        };
    },

    mounted() {
        this.fetchTodaysShifts();
    },

    methods: {
        //Fetch today's shifts specifically
        async fetchTodaysShifts() {
            try {
                const response = await fetch('https://ifmprojv1-production.up.railway.app/shifts/todays');
                this.todaysShifts = await response.json();
            } catch (err) {
                console.error('Failed to fetch today\'s shifts:', err);
            }
        },

        //Format date with day name for shift cards
        formatShiftDateWithDay(dateString) {
            if (!dateString) return "N/A";
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
    },

    computed: {
        //Only show first 3 shifts for the dashboard preview
        previewShifts() {
            return this.todaysShifts.slice(0, 3);
        }
    }
}).mount('#todaysShiftsApp');