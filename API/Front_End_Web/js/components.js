// Author: Katlego Mmadi / Yatin Fakir - Updated for hardcoded navbar
document.addEventListener("DOMContentLoaded", () => {
  // Initialize systems for hardcoded navbar
  initializeNotificationSystem();
  initializeMessageSystem();
  setupLogoutButton();
  updateNavbarWidth();
  // Update user data in navbar and sidebar
  updateUserData();
});

// Create a broadcast channel for real-time updates
const notificationChannel = new BroadcastChannel('notificationChannel');
const messageChannel = new BroadcastChannel('messageChannel');

// Update user data in navbar and sidebar
async function updateUserData() {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      
      let firstName = user.first_name;
      let lastName = user.last_name;
      
      // If names are missing, fetch them from the API
      if (!firstName || !lastName) {
        try {
          const response = await fetch(`http://localhost:3000/api/manager/profile/${user.id}`);
          if (response.ok) {
            const managerProfile = await response.json();
            firstName = managerProfile.first_name;
            lastName = managerProfile.last_name;
            
            // Update localStorage with the complete data
            localStorage.setItem('user', JSON.stringify({
              ...user,
              first_name: firstName,
              last_name: lastName
            }));
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
      
      // Update navbar profile name
      const navProfileName = document.getElementById('nav-profile-name');
      if (navProfileName && firstName && lastName) {
        navProfileName.textContent = `${firstName} ${lastName}`;
      }
      
      // Update sidebar profile name if exists
      const sidebarProfileName = document.getElementById('profile-name');
      if (sidebarProfileName && firstName && lastName) {
        sidebarProfileName.textContent = `${firstName} ${lastName}`;
        sidebarProfileName.innerHTML = `<a href="my-profile.html" style="color: inherit; text-decoration: none;">${firstName} ${lastName}</a>`;
      }
      
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
  } else {
    console.warn('No user data found in localStorage');
  }
}

function setupLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    localStorage.removeItem('token');
    localStorage.removeItem('employeeId');
    localStorage.removeItem('user');
    sessionStorage.clear();

    if (window.notificationRefreshInterval) {
      clearInterval(window.notificationRefreshInterval);
    }
    
    if (window.messageRefreshInterval) {
      clearInterval(window.messageRefreshInterval);
    }

    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      window.location.href = '/signin.html?logout=success&t=' + Date.now();
    } catch (error) {
      console.log('Logout API call failed, proceeding anyway:', error);
      window.location.href = '/signin.html?logout=success&t=' + Date.now();
    }
  });
}

// Notification System
function initializeNotificationSystem() {
  loadRecentNotifications();
  updateNotificationCount();

  // Polling as a fallback (every 30 seconds)
  window.notificationRefreshInterval = setInterval(() => {
    loadRecentNotifications();
    updateNotificationCount();
  }, 30000);

  // Listen for real-time updates from the broadcast channel
  notificationChannel.onmessage = (event) => {
    if (event.data.type === 'update') {
      updateNotificationCount();
      loadRecentNotifications();
    }
  };
}

// Message System
function initializeMessageSystem() {
  loadRecentMessages();
  updateMessageCount();

  // Polling as a fallback (every 5 seconds)
  window.messageRefreshInterval = setInterval(() => {
    loadRecentMessages();
    updateMessageCount();
  }, 5000);

  // Listen for real-time updates from the broadcast channel
  messageChannel.onmessage = (event) => {
    if (event.data.type === 'update') {
      updateMessageCount();
      loadRecentMessages();
    }
  };
}

async function loadRecentMessages() {
  try {
    const employeeId = getEmployeeId();
    const container = document.getElementById('recent-messages');

    // Check for employeeId
    if (!employeeId) {
      console.warn("No employeeId found for messages");
      if (container) {
        container.innerHTML = `<div class="px-3 py-2 text-center text-muted">Please log in to view messages</div>`;
      }
      return;
    }

    // Check for container
    if (!container) {
      console.warn("No recent-messages container found");
      return;
    }

    // Fetch messages
    const response = await fetch(`http://localhost:3000/api/messages/recent/${employeeId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch recent messages: ${response.status} ${response.statusText}`);
    }

    const messages = await response.json();
    console.log("Fetched messages:", messages); // Debug: Log API response

    // Handle empty or invalid response
    if (!messages || messages.length === 0) {
      container.innerHTML = `<div class="px-3 py-2 text-center text-muted">No messages</div>`;
      return;
    }

    // Render messages
    container.innerHTML = messages.map((msg, i) => {
      // Use 'message' field, fallback to 'content' or indicate missing field
      const messageText = msg.message || msg.content || "Message content unavailable";
      return `
        <a href="ViewAllMessages.html" class="dropdown-item ${msg.read_status === 'unread' ? 'bg-dark' : ''}">
          <h6 class="fw-normal mb-0">${truncateMessage(messageText, 50)}</h6>
          <small>${formatTime(msg.sent_time)}</small>
          ${i < messages.length - 1 ? '<hr class="dropdown-divider m-0">' : ''}
        </a>
      `;
    }).join('');

  } catch (error) {
    console.error('Message load error:', error);
    if (container) {
      container.innerHTML = `
        <div class="px-3 py-2 text-center text-danger">
          Failed to load messages
        </div>
      `;
    }
  }
}

async function updateMessageCount() {
  try {
    const employeeId = getEmployeeId();
    const badge = document.getElementById('messageCount');

    // Check for employeeId
    if (!employeeId) {
      console.warn("No employeeId found for message count");
      if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
      }
      return;
    }

    // Check for badge element
    if (!badge) {
      console.warn("No messageCount badge element found");
      return;
    }

    // Fetch unread count
    const response = await fetch(`http://localhost:3000/api/messages/unread/count/${employeeId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch message count: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Fetched unread message count:", data); // Debug: Log API response

    // Update badge
    const unreadCount = data.unreadCount || 0; // Fallback to 0 if field is missing
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';

  } catch (error) {
    console.error('Message count update error:', error);
    const badge = document.getElementById('messageCount');
    if (badge) {
      badge.textContent = '0'; // Fallback to 0 on error
      badge.style.display = 'none';
    }
  }
}
function truncateMessage(message, maxLength) {
  if (!message) return '';
  return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
}

function getEmployeeId() {
  let id = localStorage.getItem("employeeId");
  if (id) return id;

  const match = document.cookie.match(/(?:^|;\s*)employeeId=([^;]*)/);
  return match ? match[1] : null;
}

async function loadRecentNotifications() {
  try {
    const employeeId = getEmployeeId();
    const container = document.getElementById('recent-notifications');
    
    if (!employeeId) {
      console.warn("No employeeId found");
      if (container) {
        container.innerHTML = `<div class="px-3 py-2 text-center text-muted">Please log in to view notifications</div>`;
      }
      return;
    }

    const response = await fetch(`http://localhost:3000/api/manager-notifications/unread/latest?employeeId=${employeeId}`);
    if (!response.ok) throw new Error('Failed to fetch notifications');

    const notifications = await response.json();
    if (!container) return;

    container.innerHTML = notifications.length ?
      notifications.map((n, i) => `
        <a href="ViewAllNotifications.html" class="dropdown-item ${n.read_status === 'unread' ? 'bg-dark' : ''}">
          <h6 class="fw-normal mb-0">${n.message}</h6>
          <small>${formatTime(n.sent_time)}</small>
          ${i < notifications.length - 1 ? '<hr class="dropdown-divider m-0">' : ''}
        </a>
      `).join('') :
      `<div class="px-3 py-2 text-center text-muted">No notifications</div>`;
  } catch (error) {
    console.error('Notification load error:', error);
    const container = document.getElementById('recent-notifications');
    if (container) {
      container.innerHTML = `
        <div class="px-3 py-2 text-center text-danger">
          Failed to load notifications
        </div>
      `;
    }
  }
}

async function updateNotificationCount() {
  try {
    const employeeId = getEmployeeId();
    if (!employeeId) {
      console.warn("No employeeId found");
      return;
    }

    const response = await fetch(`http://localhost:3000/api/manager-notifications/unread/count?employeeId=${employeeId}`);
    if (!response.ok) throw new Error('Failed to fetch count');

    const data = await response.json();
    const badge = document.getElementById('notificationCount');
    if (badge) {
      badge.textContent = data.unreadCount;
      badge.style.display = data.unreadCount > 0 ? 'inline-block' : 'none';
    }
  } catch (error) {
    console.error('Count update error:', error);
  }
}

// Utility functions
function formatTime(timeString) {
  if (!timeString) return '';
  try {
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}



// Simple navbar width update
function updateNavbarWidth() {
  const navbarContainer = document.getElementById("navbar-container");
  const sidebar = document.querySelector('.sidebar');
  
  if (navbarContainer && sidebar) {
    const isSidebarOpen = !sidebar.classList.contains('open');
    
    if (isSidebarOpen) {
      navbarContainer.style.width = 'calc(100% - 250px)';
    } else {
      navbarContainer.style.width = '100%';
    }
  }
}

// Add the notification dropdown styles
const notificationStyles = `
    .navbar-nav .dropdown-menu {
        max-width: 350px !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
    }
    
    #recent-notifications {
        max-width: 100% !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
    }
    
    #recent-notifications .dropdown-item {
        white-space: normal !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        text-overflow: unset !important;
        max-width: 100% !important;
    }
    
    #recent-notifications .dropdown-item h6 {
        white-space: normal !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        max-width: 100% !important;
    }
    
    #recent-notifications::-webkit-scrollbar {
        width: 8px;
    }
    
    #recent-notifications::-webkit-scrollbar-track {
        background: #2a2e38;
    }
    
    #recent-notifications::-webkit-scrollbar-thumb {
        background: #4b5563;
        border-radius: 4px;
    }
    
    #recent-notifications::-webkit-scrollbar-thumb:hover {
        background: #6b7280;
    }
    
    /* Navbar width adjustment */
    #navbar-container {
        width: calc(100% - 250px);
        transition: width 0.5s ease;
    }
    
    .content.open #navbar-container {
        width: 100%;
    }
    
    @media (max-width: 991.98px) {
        #navbar-container {
            width: 100%;
        }
    }
`;

// Add the styles to the document
const style = document.createElement('style');
style.textContent = notificationStyles;
document.head.appendChild(style);