// Yatin
document.addEventListener('DOMContentLoaded', function () {
    const { createApp } = Vue;

    createApp({
        data() {
            return {
                currentDate: new Date(),
                calendarDays: [],
                events: [],
                selectedDate: null,
                selectedDateEvents: [],
                isLoading: true
            };
        },
        computed: {
            calendarMonth() {
                return this.currentDate.toLocaleString('default', { month: 'long' });
            },
            calendarYear() {
                return this.currentDate.getFullYear();
            },
            selectedDateFormatted() {
                if (!this.selectedDate) return '';
                return this.selectedDate.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
        },
        mounted() {
            this.fetchEvents();
        },
        methods: {
            async fetchEvents() {
                this.isLoading = true;
                console.log('Starting fetchEvents for calendar');
                try {
                    const response = await fetch('http://localhost:3000/api');
                    console.log('API response status:', response.status);

                    if (response.ok) {
                        this.events = await response.json();
                        console.log('Fetched events:', this.events.length);
                        this.generateCalendar();
                    } else {
                        console.error('Failed to fetch events, status:', response.status);
                        this.events = [];
                        this.generateCalendar();
                    }
                } catch (err) {
                    console.error('Failed to fetch events:', err);
                    this.events = [];
                    this.generateCalendar();
                } finally {
                    this.isLoading = false;
                    console.log('Finished fetchEvents for calendar');
                }
            },
            generateCalendar() {
                console.log('Generating calendar with', this.events.length, 'events');
                const year = this.currentDate.getFullYear();
                const month = this.currentDate.getMonth();

                //Get first day of month and last day of month
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);

                console.log('Calendar range:', firstDay, 'to', lastDay);

                //Get days in previous month to show
                const daysInPrevMonth = firstDay.getDay();

                //Get total days in month
                const daysInMonth = lastDay.getDate();

                //Create calendar days array
                this.calendarDays = [];

                //Add previous month's days
                const prevMonthLastDay = new Date(year, month, 0).getDate();
                for (let i = 0; i < daysInPrevMonth; i++) {
                    this.calendarDays.push({
                        id: `prev-${i}`,
                        date: prevMonthLastDay - daysInPrevMonth + i + 1,
                        isEmpty: true
                    });
                }

                //Add current month's days
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                for (let i = 1; i <= daysInMonth; i++) {
                    const date = new Date(year, month, i);
                    date.setHours(0, 0, 0, 0);

                    //Check if this date has events
                    const eventsOnDate = this.events.filter(event => {
                        if (!event.start_date || !event.end_date) {
                            console.log('Event missing dates:', event);
                            return false;
                        }

                        const eventStart = new Date(event.start_date);
                        const eventEnd = new Date(event.end_date);
                        eventStart.setHours(0, 0, 0, 0);
                        eventEnd.setHours(0, 0, 0, 0);
                        return date >= eventStart && date <= eventEnd;
                    });

                    console.log('Date', date, 'has', eventsOnDate.length, 'events');

                    const isSelected = this.selectedDate && date.getTime() === this.selectedDate.getTime();

                    this.calendarDays.push({
                        id: `current-${i}`,
                        date: i,
                        isEmpty: false,
                        isToday: date.getTime() === today.getTime(),
                        hasEvents: eventsOnDate.length > 0,
                        eventsCount: eventsOnDate.length,
                        isSelected: isSelected,
                        dateObj: date
                    });
                }

                //Add next month's days to complete the grid (42 cells total)
                const totalCells = 42; //6 rows x 7 columns
                const remainingCells = totalCells - this.calendarDays.length;
                for (let i = 1; i <= remainingCells; i++) {
                    this.calendarDays.push({
                        id: `next-${i}`,
                        date: i,
                        isEmpty: true
                    });
                }
            },
            prevMonth() {
                this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
                this.generateCalendar();
                this.selectedDate = null;
                this.selectedDateEvents = [];
            },
            nextMonth() {
                this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
                this.generateCalendar();
                this.selectedDate = null;
                this.selectedDateEvents = [];
            },
            selectDate(day) {
                if (day.isEmpty) return;

                this.selectedDate = day.dateObj;

                //Find events on this date
                this.selectedDateEvents = this.events.filter(event => {
                    if (!event.start_date || !event.end_date) return false;

                    const eventStart = new Date(event.start_date);
                    const eventEnd = new Date(event.end_date);
                    eventStart.setHours(0, 0, 0, 0);
                    eventEnd.setHours(0, 0, 0, 0);
                    return this.selectedDate >= eventStart && this.selectedDate <= eventEnd;
                });

                //Update calendar to show selected date
                this.generateCalendar();

                //Show the modal
                const modal = new bootstrap.Modal(document.getElementById('dateEventsModal'));
                modal.show();
            },
            redirectToEvents() {
                window.location.href = 'events.html';
            }
        }
    }).mount('#calendar-app');
});