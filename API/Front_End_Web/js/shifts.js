//AUTHOR - SHAYZAAD
const { createApp } = Vue;

createApp({

    //Data Properties
    data(){
      return {
        shifts: [], //Original shift data from API
        filteredShifts: [], //Holds filtered results
        searchQuery: '', //Tracks search input text
        selectedFilter: '', //Tracks dropdown filter selection
        selectedDate: null //Stores selected date from picker
      };
    },

    //Lifecycle hook - Runs when the Vue component is added to the DOM
    mounted() {
      this.fetchAllShifts(); //Load data on component mount
      this.initDatePicker(); //Initialize date picker
    },

    //Methods
    methods:{
        //Fetch all the employee shifts
        async fetchAllShifts(){
            try {
                 const response = await fetch('http://localhost:3000/shifts/all');
                 this.shifts = await response.json();
                 this.filteredShifts = [...this.shifts]; //Copy to filtered array (shallow copy)
            } catch (err) {
                console.error('Failed to fetch employee shifts:', err);
            }
        },

        //Initialize weekend only date picker with behaviours
        initDatePicker() {
          this.flatpickrInstance = flatpickr("#weekendDatePicker", {
            inline: false, //Don't show calendar permanently
            static: false, //Position calendar relative to input
            mode: "single", //Allow selecting only one date
            dateFormat: "d-m-Y", //Date format - order
            enable: [
              (date) => {
                //Only allow Friday (5), Saturday (6), Sunday (0) and Monday(1)
                return [0, 1, 5, 6].includes(date.getDay());
              }
            ],

            //Converts selected date to YYYY-MM-DD format.
            onChange: (selectedDates) => {
              this.selectedDate = selectedDates[0] ? selectedDates[0].toISOString().split('T')[0] : null;
              this.applyFilters();
            },

            //Selects the days that are not disabled and makes them bold
            onReady: () => {
              //Style weekend days bold, to show they can be picked ONLY, selects all days that are not disabled
              document.querySelectorAll('.flatpickr-day:not(.disabled)').forEach(day => {
                day.style.fontWeight = 'bold';
              });
            }
          });
        },

        //Open date picker manually when clicked
        openDatePicker() {
          this.flatpickrInstance.open();
        },

        //Format date as DD/MM/YYYY (REMOVE?)
        formatDate(dateString) {
          if (!dateString) return "N/A";
          const date = new Date(dateString);
          return date.toLocaleDateString('en-ZA');
        },

        //Apply all filters
        applyFilters() {
          let filtered = [...this.shifts];

          //Search filter (name or role)
          if (this.searchQuery.trim()) {
            const searchTerm = this.searchQuery.toLowerCase().trim();
            filtered = filtered.filter(shift => 
              shift.employee_name.toLowerCase().includes(searchTerm) ||
              shift.role_title.toLowerCase().includes(searchTerm)
            );
          }

          //Date filter
          if (this.selectedDate) {
            const selectedDateStr = this.formatDateForComparison(this.selectedDate);
            filtered = filtered.filter(shift => {
              const shiftDateStr = this.formatDateForComparison(shift.date_);
              return shiftDateStr === selectedDateStr;
            });
          }

          //Status filter
          if (this.selectedFilter) {
            const today = new Date();
            today.setHours(0, 0, 0, 0); //Set to midnight (00:00:00) for comparison

            //Calculate date ranges for 31-day periods
            const thirtyOneDaysAgo = new Date(today);
            thirtyOneDaysAgo.setDate(today.getDate() - 31);
            
            const thirtyOneDaysFromNow = new Date(today);
            thirtyOneDaysFromNow.setDate(today.getDate() + 31);

            filtered = filtered.filter(shift => {
              const shiftDate = new Date(shift.date_);
              shiftDate.setHours(0, 0, 0, 0);

              //Switch case to check filter
              switch (this.selectedFilter) {
                case 'Previous Shift':
                  //Shifts from the last 31 days (excluding today)
                  return shiftDate >= thirtyOneDaysAgo && shiftDate < today;
                case "Today's Shifts":
                  return shiftDate.getTime() === today.getTime(); //Shifts today
                case 'Next Shift':
                  //Shifts for the next 31 days (excluding today)
                  return shiftDate > today && shiftDate <= thirtyOneDaysFromNow;
                default:
                  return true; //No filtering
              }
            });
          }

          this.filteredShifts = filtered;
        },

        //Helper method to format date selected for comparison
        formatDateForComparison(dateString) {
          if (!dateString) return '';
          const date = new Date(dateString);
          return date.toISOString().split('T')[0];
        },

        //Clear all filters
        clearFilters() {
          //Make all data properties null
          this.searchQuery = '';
          this.selectedFilter = '';
          this.selectedDate = null;
          
          //Clear the flatpickr input
          if (this.flatpickrInstance) {
            this.flatpickrInstance.clear();
          }
          
          //Reset to show all shifts
          this.filteredShifts = [...this.shifts];
        },

        //Format shift date for display in the card
        // formatShiftDate(dateString) {
        //     if (!dateString) return "N/A";
        //     const date = new Date(dateString);
        //     // Format as 'dd/mm/yyyy' first (en-ZA locale), then replace slashes with dashes
        //     return date.toLocaleDateString('en-ZA', {
        //       day: '2-digit',
        //       month: '2-digit',
        //       year: 'numeric'
        //   }).replace(/\//g, '-'); // Replace ALL slashes with dashes
        // },

         //Format shift date for display in the card
        formatShiftDateWithDay(dateString) {
          if (!dateString) return "N/A";
          const date = new Date(dateString);
          
          //Get the day name (e.g., "Tuesday")
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          
          //Format as 'dd-mm-yyyy' (using en-ZA locale and replace slashes)
          const formattedDate = date.toLocaleDateString('en-ZA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).replace(/\//g, '-');

          //Combine: "Tuesday, 25-12-2023"
          return `${dayName}, ${formattedDate}`;
        }
    },

    computed: {
      //Groups all emplpyees shifts 
      groupedShifts() {
        const groups = {};
        this.filteredShifts.forEach(shift => {
          if (!groups[shift.employee_name]) {
            groups[shift.employee_name] = {
              employee_name: shift.employee_name,
              role_title: shift.role_title,
              shifts: []
            };
          }
          groups[shift.employee_name].shifts.push(shift);
        });
        return Object.values(groups);
      }
  },

    //Sets up reactive watchers
    watch: {
        //Auto-apply when these change
        searchQuery() { this.applyFilters(); },
        selectedFilter() { this.applyFilters(); }
    }

}).mount(`#empCards`);