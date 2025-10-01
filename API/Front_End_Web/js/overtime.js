//AUTHOR - SHAYZAAD
const { createApp } = Vue;
const API_BASE = 'http://localhost:3000/api/overtime';

createApp({
  data() {
    return {
      currentTime: new Date().toLocaleTimeString(),
      roles: [], //Available roles for overtime
      selectedRoles: [], //Roles selected for current overtime
      duration: 60, //Default overtime duration (minutes)
      qrImage: null, //Generated QR code image
      qrId: null, //Database ID of the QR code
      overtimeId: null, //Current overtime session ID
      expiration: null, //When the overtime expires
      extendMinutes: 30, //Default extension time
      showExtendModal: false, //Control extend modal visibility
      showEndModal: false, //Control end modal visibility
      proofImage: null, //Proof QR after ending overtime
      proofQRId: null, //Proof QR ID for tracking
      proofExpiration: null, //When proof QR expires
      isLoading: false, //Loading state for buttons
      errorMessage: null, //Error display
      statusCheckInterval: null, //Interval for checking session status
      proofCheckInterval: null, //Interval for checking proof QR status
      expirationCountdown: null, //Countdown timer
      proofCountdown: null, //Proof QR countdown timer
      timeRemaining: null, //Formatted time remaining
      proofTimeRemaining: null, //Formatted proof time remaining
      qrExpiration: null //For clock in expiration
    };
  },
  computed: {
    //Convert duration to readable format
    formattedDuration() {
      const hours = Math.floor(this.duration / 60);
      const minutes = this.duration % 60;
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    },

    //Expose roles to template
    availableRoles() {
      return this.roles;
    },

    //Check if we have an active session
    currentSession() {
      return this.overtimeId !== null;
    },

    isQRExpired() {
      return this.qrExpiration && new Date() > new Date(this.qrExpiration);
    }
  },

  methods: {
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
      if (this.qrImage) {
        return 'Overtime Session Active';
      }
      
      if (this.proofImage) {
        return 'Overtime Proof QR Available';
      }
      
      return 'No Active Overtime Sessions';
    },
    
    //Determine the CSS class for status styling
    getStatusClass() {
      if (this.qrImage || this.proofImage) {
        return 'status-active';
      }
      return 'status-waiting';
    },
    //Fetch available roles from server
    async fetchRoles() {
      try {
        const response = await fetch('http://localhost:3000/api/roles');
        if (!response.ok) {
          throw new Error('Failed to fetch roles');
        }
        this.roles = await response.json();
      } catch (error) {
        console.error('Error fetching roles:', error);
        this.errorMessage = 'Failed to load roles';
      }
    },
    
    //Generate new overtime QR code
    async generateQR() {
      if (!this.selectedRoles.length || this.duration > 180 || this.duration < 60) {
        this.errorMessage = 'Please select at least one role and set the duration';
        return;
      }
      
      this.isLoading = true;
      this.errorMessage = null;
      
      try {
        const response = await fetch(`${API_BASE}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roles: this.selectedRoles,
            duration: this.duration
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate QR code');
        }
        
        //All data brought in from the API
        const data = await response.json();
        this.qrImage = data.qrImage;
        this.qrId = data.qrId;
        this.overtimeId = data.overtimeId;
        this.expiration = new Date(data.expiration).toLocaleString();
        this.qrExpiration = new Date(data.qrExpiration).toLocaleString();
        
        //Start monitoring the session status
        this.startStatusMonitoring();
        //this.startCountdown(new Date(data.expiration));

        //Save the session to local storage
        this.saveSession()
        
      } catch (error) {
        console.error('QR generation failed:', error);
        this.errorMessage = error.message;
      } finally {
        this.isLoading = false;
      }
    },
    
    //Start monitoring session status
    startStatusMonitoring() {
      //Clear any existing interval to avoid duplicate timers
      if (this.statusCheckInterval) {
        clearInterval(this.statusCheckInterval);
      }
      
      //Stary new interval, checked every second
      this.statusCheckInterval = setInterval(() => {
        this.checkSessionStatus();
      }, 1000);
    },
    
    //Check if session is still active
    async checkSessionStatus() {
      if (!this.overtimeId) return;
      
      try {
        const response = await fetch(`${API_BASE}/status/${this.overtimeId}`);
        
        if (!response.ok) {
          console.error('Failed to check session status');
          return;
        }
        
        const data = await response.json();

        //Check if QR has expired - NEW
        if (this.qrExpiration && new Date() > new Date(this.qrExpiration)) {
          this.qrImage = null;
          this.qrId = null;
          //this.qrExpiration = null;
          this.saveSession(); //Persist the changes
        }
        
        //If session is completed, show proof QR
        if (data.status === 'completed' && data.proofImage) {
          this.handleSessionCompleted(data.proofImage, data.proofQRId, data.proofExpiration);
        }
        //Handle full session expiration
        else if (data.status === 'expired') {
          this.resetSession();
          this.errorMessage = 'Overtime session has expired.';
        }
        
        //If session expired but no proof QR, session ended unexpectedly
        if (data.status === 'expired' || data.status === 'completed') {
          this.stopStatusMonitoring();
          if (data.status === 'expired') {
          this.qrImage = null;
          }
        }
        
      } catch (error) {
        console.error('Error checking session status:', error);
      }
    },
    
    //Handle when session is completed
    handleSessionCompleted(proofImage, proofQRId, proofExpiration) {
      this.proofImage = proofImage;
      this.proofQRId = proofQRId;
      this.proofExpiration = proofExpiration;
      this.qrImage = null;
      this.qrId = null;
      this.overtimeId = null;
      this.expiration = null;
      this.stopStatusMonitoring();
      this.stopCountdown();

      //Save session to local storage
      this.saveSession();
      
      //Start monitoring proof QR expiration
      if (proofExpiration) {
        this.startProofMonitoring();
        //this.startProofCountdown(new Date(proofExpiration));
      }
    },
    
    //Stop status monitoring
    stopStatusMonitoring() {
      if (this.statusCheckInterval) {
        clearInterval(this.statusCheckInterval);
        this.statusCheckInterval = null;
      }
    },
    
    //Start monitoring proof QR status
    startProofMonitoring() {
      //Clear any existing interval
      if (this.proofCheckInterval) {
        clearInterval(this.proofCheckInterval);
      }
      
      //Check every second for proof QR
      this.proofCheckInterval = setInterval(() => {
        this.checkProofStatus();
      }, 1000);
    },
    
    //Check if proof QR is still active
    async checkProofStatus() {
      if (!this.proofQRId) return;
      
      try {
        const response = await fetch(`${API_BASE}/proof-status/${this.proofQRId}`);
        
        if (!response.ok) {
          console.error('Failed to check proof status');
          return;
        }
        
        const data = await response.json();
        
        //If proof QR has expired, reset everything
        if (data.status === 'expired') {
          this.handleProofExpired();
        }
        
      } catch (error) {
        console.error('Error checking proof status:', error);
      }
    },
    
    //Handle when proof QR expires
    handleProofExpired() {
    this.clearSession();
    this.resetSession();
    this.errorMessage = 'Proof QR code has expired. Session completed.';
    },
    
    //Stop proof monitoring
    stopProofMonitoring() {
      if (this.proofCheckInterval) {
        clearInterval(this.proofCheckInterval);
        this.proofCheckInterval = null;
      }
    },
    
    //Start countdown timer
    // startCountdown(expirationDate) {
    //   this.stopCountdown(); //Clear any existing countdown
      
    //   this.expirationCountdown = setInterval(() => {
    //     const now = new Date().getTime();
    //     const expiry = expirationDate.getTime();
    //     const timeLeft = expiry - now;
        
    //     if (timeLeft <= 0) {
    //       this.timeRemaining = 'EXPIRED';
    //       this.stopCountdown();
    //       // Force check status when countdown reaches zero
    //       this.checkSessionStatus();
    //     } else {
    //       const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    //       const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    //       const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
          
    //       this.timeRemaining = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    //     }
    //   }, 1000);
    // },
    
    //Stop countdown timer
    stopCountdown() {
      if (this.expirationCountdown) {
        clearInterval(this.expirationCountdown);
        this.expirationCountdown = null;
      }
      this.timeRemaining = null;
    },
    
    //Start proof QR countdown timer
    // startProofCountdown(expirationDate) {
    //   this.stopProofCountdown(); // Clear any existing countdown
      
    //   this.proofCountdown = setInterval(() => {
    //     const now = new Date().getTime();
    //     const expiry = expirationDate.getTime();
    //     const timeLeft = expiry - now;
        
    //     if (timeLeft <= 0) {
    //       this.proofTimeRemaining = 'EXPIRED';
    //       this.stopProofCountdown();
    //       // Force check proof status when countdown reaches zero
    //       this.checkProofStatus();
    //     } else {
    //       const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    //       const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    //       const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
          
    //       this.proofTimeRemaining = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    //     }
    //   }, 1000);
    // },
    
    //Stop proof countdown timer
    stopProofCountdown() {
      if (this.proofCountdown) {
        clearInterval(this.proofCountdown);
        this.proofCountdown = null;
      }
      this.proofTimeRemaining = null;
    },
    
    //Open the extend overtime modal
    openExtendModal() {
      this.showExtendModal = true;
    },
    
    //Close the extend modal
    closeExtendModal() {
      this.showExtendModal = false;
    },
    
    //Request overtime extension from server
    async extendOvertime() {
      if (!this.extendMinutes || this.extendMinutes > 60) {
        this.errorMessage = 'Please enter valid extension time (max 1 hour)';
        return;
      }
      
      this.isLoading = true;
      this.errorMessage = null;
      
      try {
        const response = await fetch(`${API_BASE}/extend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            overtimeId: this.overtimeId,
            additionalMinutes: this.extendMinutes
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to extend overtime');
        }
        
        const data = await response.json();
        this.expiration = new Date(data.newExpiration).toLocaleString();
        
        //Update the duration to reflect the new total duration
        this.duration += this.extendMinutes;
        
        //Restart countdown with new expiration time
        //this.startCountdown(new Date(data.newExpiration));

        //Save new session to local storage after making edits
        this.saveSession()
        
        this.closeExtendModal();
      } catch (error) {
        console.error('Extension failed:', error);
        this.errorMessage = error.message;
      } finally {
        this.isLoading = false;
      }
    },
    
    //Open the end overtime modal
    openEndModal() {
      this.showEndModal = true;
    },
    
    //Close the end modal
    closeEndModal() {
      this.showEndModal = false;
    },
    
    //End the current overtime session
    async endOvertime() {
      this.isLoading = true;
      this.errorMessage = null;
      
      try {
        const response = await fetch(`${API_BASE}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ overtimeId: this.overtimeId })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to end overtime');
        }
        
        const data = await response.json();
        this.proofImage = data.proofImage;
        this.proofQRId = data.proofQRId;
        this.proofExpiration = new Date(data.proofExpiration).toLocaleString();
        this.qrImage = null;
        this.qrId = null;
        this.overtimeId = null;
        this.expiration = null;
        this.stopStatusMonitoring();
        this.stopCountdown();

        //Save session to local storage after ending overtime
        this.saveSession()
        
        this.closeEndModal();

        //Start monitoring proof QR expiration
        if (data.proofExpiration) {
          this.startProofMonitoring();
          //this.startProofCountdown(new Date(data.proofExpiration));
        }
        
      } catch (error) {
        console.error('End overtime failed:', error);
        this.errorMessage = error.message;
      } finally {
        this.isLoading = false;
      }
    },
    
    //Reset all overtime session data
    resetSession() {
      this.qrImage = null;
      this.qrId = null;
      this.overtimeId = null;
      this.expiration = null;
      this.proofImage = null;
      this.proofQRId = null;
      this.proofExpiration = null;
      this.selectedRoles = [];
      this.duration = 60; 
      this.errorMessage = null;
      this.stopStatusMonitoring();
      this.stopCountdown();
      this.stopProofMonitoring();
      this.stopProofCountdown();
    },

    //Save current session to localStorage
    saveSession() {
      const sessionData = {
        overtimeId: this.overtimeId,
        qrImage: this.qrImage,
        qrId: this.qrId,
        qrExpiration: this.qrExpiration,
        expiration: this.expiration,
        proofImage: this.proofImage,
        proofQRId: this.proofQRId,
        proofExpiration: this.proofExpiration,
        selectedRoles: this.selectedRoles,
        duration: this.duration
      };
      localStorage.setItem('overtimeSession', JSON.stringify(sessionData));
    },

    //Load session from localStorage
    loadSession() {
      const savedSession = localStorage.getItem('overtimeSession');
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        
        //Restore properties
        Object.keys(sessionData).forEach(key => {
          this[key] = sessionData[key];
        });
        
        //Restart monitoring if needed
        if (this.overtimeId) {
          this.startStatusMonitoring();
        }
        if (this.proofQRId) {
          this.startProofMonitoring();
        }
      }
    },

    //Clear session from localStorage
    clearSession() {
      localStorage.removeItem('overtimeSession');
    }
  },
  
  //Fetch roles when component loads
  mounted() {
    this.fetchRoles();
    setInterval(() => {
        this.updateCurrentTime();
      }, 1000);
    //Load saved session on startup
    this.loadSession();
  },
  
  //Cleanup intervals when component is destroyed
  beforeUnmount() {
    this.stopStatusMonitoring();
    this.stopCountdown();
    this.stopProofMonitoring();
    this.stopProofCountdown();
  }
}).mount('#overtime-app');