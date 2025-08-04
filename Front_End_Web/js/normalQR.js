//AUTHOR - SHAYZAAD

const { createApp } = Vue;
const API_BASE = 'http://ifmprojv1-production.up.railway.app/api/normal-qr';

createApp({
  data() {
    return {
      normalQR: null, //Store the current normal QR code image data
      proofQR: null,  //Store the current proof QR code image data  
      expiration: null, //Store the expiration time for the normal QR code
      proofExpiration: null, //Store the expiration time for the proof QR code
      timeRemaining: null, //Display formatted time remaining for normal QR
      proofTimeRemaining: null, //Display formatted time remaining for proof QR
      currentTime: new Date().toLocaleTimeString(), //Current system time displayed in the UI
      loading: false, //Flag to prevent multiple simultaneous API calls
      lastFetchTime: null //Track when we last fetched QR data
    };
  },
  methods: {
    //Fetch the normal clock-in QR code from the server
    async fetchNormalQR() {
      //Prevent multiple simultaneous requests
      if (this.loading) return;
      
      try {
        this.loading = true;
        const response = await fetch(`${API_BASE}/current`);
        const data = await response.json();
        
        if (data.normalQR) {
          //Only update if we received a new QR code or don't have one currently
          if (!this.normalQR || this.normalQR !== data.normalQR.image) {
            this.normalQR = data.normalQR.image;
            this.expiration = new Date(data.normalQR.expiration).toLocaleString();
            //this.startCountdown();
          }
        } else {
          //Clear QR data if none is available
          this.normalQR = null;
         // this.stopCountdown();
        }
        
        //Record when we last successfully fetched data
        this.lastFetchTime = new Date();
      } catch (error) {
        console.error('Error fetching normal QR:', error);
        //Clear QR data on error to prevent displaying stale information
        this.normalQR = null;
      } finally {
        //Always reset loading state regardless of success or failure
        this.loading = false;
      }
    },
    
    //Fetch the proof clock-out QR code from the server
    async fetchProofQR() {
      try {
        const response = await fetch(`${API_BASE}/proof/current`);
        const data = await response.json();
        
        if (data.proofQR) {
          //Only update if we received a new proof QR code or don't have one currently
          if (!this.proofQR || this.proofQR !== data.proofQR.image) {
            this.proofQR = data.proofQR.image;
            this.proofExpiration = new Date(data.proofQR.expiration).toLocaleString();
           // this.startProofCountdown();
          }
        } else {
          //Clear proof QR data if none is available
          this.proofQR = null;
         // this.stopProofCountdown();
        }
      } catch (error) {
        console.error('Error fetching proof QR:', error);
        //Clear proof QR data on error to prevent displaying stale information
        this.proofQR = null;
      }
    },
    
    //Update the current time display
    updateCurrentTime() {
      this.currentTime = new Date().toLocaleTimeString();
    },
    
    //Format a date object into a readable string
    formatDate(date) {
      return date.toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    },
    
    //Determine the status text to display based on available QR codes
    getStatusText() {
      if (this.normalQR) {
        return 'Clock-in QR Available';
      }
      
      if (this.proofQR) {
        return 'Proof QR Available';
      }
      
      return 'Waiting for shift time';
    },
    
    //Determine the CSS class for status styling
    getStatusClass() {
      if (this.normalQR || this.proofQR) {
        return 'status-active';
      }
      return 'status-waiting';
    },
    
    //Get placeholder text for normal QR section when no QR is available
    getPlaceholderText() {
      if (this.normalQR) {
        return 'QR Code Loading...';
      }
      return 'QR will appear at shift start time';
    },

    //Get placeholder text for proof QR section when no QR is available
    getProofPlaceholderText() {
      if (this.proofQR) {
        return 'QR Code Loading...';
      }
      return 'QR will appear at shift end time';
    }
  },
  
  //Lifecycle hook that runs when the component is mounted to the DOM
  mounted() {
    //Initial data fetch when app loads
    this.fetchNormalQR();
    this.fetchProofQR();
    
    //Update the current time display every second
    setInterval(() => {
      this.updateCurrentTime();
    }, 1000);
    
    //Check for new QR codes every 5 seconds to keep data fresh
    setInterval(() => {
      this.fetchNormalQR();
      this.fetchProofQR();
    }, 5000);
 
    //Hide the loading spinner after component is fully mounted
    setTimeout(() => {
      const spinner = document.getElementById('spinner');
      if (spinner) {
        spinner.classList.remove('show');
      }
    }, 500);
  },
  
}).mount('#normal-qr-app');