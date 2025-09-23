// Author: Katlego Mmadi / Yatin Fakir - Updated for profile integration
document.addEventListener("DOMContentLoaded", () => {
  // Initialize navbar
  const navbarContainer = document.getElementById("navbar-container");
  if (navbarContainer) {
    navbarContainer.innerHTML = `
      <nav class="navbar navbar-expand bg-secondary navbar-dark sticky-top px-4 py-0">
        <a href="index.html" class="navbar-brand d-flex d-lg-none me-4">
          <h2 class="text-primary mb-0"><i class="fa fa-user-tie"></i></h2>
        </a>
        <a href="#" class="sidebar-toggler flex-shrink-0">
          <i class="fa fa-bars"></i>
        </a>
        <div class="navbar-nav align-items-center ms-auto">
          <!-- Messages dropdown -->
          <div class="nav-item dropdown me-3">
            <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown">
              <i class="fa fa-envelope me-lg-2"></i>
              <span class="d-none d-lg-inline-flex">Messages</span>
              <!-- START: Unread messages count badge -->
              <span id="messageCount" class="badge bg-success ms-1" style="font-size: 0.75rem; display: none;">0</span>
              <!-- END: Unread messages count badge -->
            </a>
            <div class="dropdown-menu dropdown-menu-end bg-secondary border-0 rounded-0 rounded-bottom m-0" style="width: 350px;">
              <div id="recent-messages" class="overflow-auto" style="max-height: 400px;">
                <div class="text-center py-3">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                </div>
              </div>
              <hr class="dropdown-divider m-0">
              <a href="message-employee.html" class="dropdown-item text-center">See all messages</a>
            </div>
          </div>

          <!-- Notification dropdown -->
          <div class="nav-item dropdown">
            <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown">
              <i class="fa fa-bell me-lg-2"></i>
              <span class="d-none d-lg-inline-flex">Notifications</span>
              <span id="notificationCount" class="badge bg-danger ms-1" style="font-size: 0.75rem; display: none;">0</span>
            </a>
            <div class="dropdown-menu dropdown-menu-end bg-secondary border-0 rounded-0 rounded-bottom m-0" style="width: 350px;">
              <div id="recent-notifications" class="overflow-auto" style="max-height: 400px;">
                <div class="text-center py-3">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                </div>
              </div>
              <hr class="dropdown-divider m-0">
              <a href="ViewAllNotifications.html" class="dropdown-item text-center">See all notifications</a>
            </div>
          </div>

          <!-- User dropdown -->
          <div class="nav-item dropdown">
            <a href="#" class="nav-link dropdown-toggle" data-bs-toggle="dropdown">
              <img class="rounded-circle me-lg-2" src="img/user.jpg" alt="" style="width: 40px; height: 40px" />
              <span class="d-none d-lg-inline-flex" id="nav-profile-name">Admin User</span>
            </a>
            <div class="dropdown-menu dropdown-menu-end bg-secondary border-0 rounded-0 rounded-bottom m-0">
              <a href="my-profile.html" class="dropdown-item">My Profile</a>
              <a href="#" class="dropdown-item" id="logoutBtn">Log Out</a>
            </div>
          </div>
        </div>
      </nav>
    `;

    // Initialize systems
    initializeNotificationSystem();
    initializeMessageSystem();
    setupSidebarToggle();
    setupLogoutButton();
    
    // Update user data in navbar and sidebar
    updateUserData();
  }
});

// Create a broadcast channel for real-time updates
const notificationChannel = new BroadcastChannel('notificationChannel');
const messageChannel = new BroadcastChannel('messageChannel');

// In components.js, update the updateUserData function:
// In components.js, update the updateUserData function
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
    localStorage.removeItem('user'); // Added: Remove user data
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

// START: Message System
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
    if (!employeeId) {
      console.warn("No employeeId found for messages");
      const container = document.getElementById('recent-messages');
      if (container) {
        container.innerHTML = `<div class="px-3 py-2 text-center text-muted">Please log in to view messages</div>`;
      }
      return;
    }

    const response = await fetch(`http://localhost:3000/api/messages/recent/${employeeId}`);
    if (!response.ok) throw new Error('Failed to fetch recent messages');

    const messages = await response.json();
    const container = document.getElementById('recent-messages');
    if (!container) return;

    if (!messages || messages.length === 0) {
      container.innerHTML = `<div class="px-3 py-2 text-center text-muted">No messages</div>`;
      return;
    }

    container.innerHTML = messages.map((msg, i) => `
      <a href="message-employee.html?employeeId=${msg.other_employee_id}" class="dropdown-item ${msg.read_status === 'unread' ? 'bg-dark' : ''}">
        <div class="d-flex align-items-center">
          <img src="img/user.jpg" class="rounded-circle me-2" style="width: 30px; height: 30px;" alt="">
          <div class="flex-grow-1">
            <h6 class="fw-normal mb-0">${msg.other_employee_name}</h6>
            <small class="text-muted">${truncateMessage(msg.content, 40)}</small>
          </div>
          <small class="text-muted">${formatTime(msg.sent_time)}</small>
        </div>
        ${i < messages.length - 1 ? '<hr class="dropdown-divider m-0">' : ''}
      </a>
    `).join('');
  } catch (error) {
    console.error('Message load error:', error);
    const container = document.getElementById('recent-messages');
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
    if (!employeeId) {
      console.warn("No employeeId found for message count");
      return;
    }

    const response = await fetch(`http://localhost:3000/api/messages/unread/count/${employeeId}`);
    if (!response.ok) throw new Error('Failed to fetch message count');

    const data = await response.json();
    const badge = document.getElementById('messageCount');
    if (badge) {
      badge.textContent = data.unreadCount;
      badge.style.display = data.unreadCount > 0 ? 'inline-block' : 'none';
    }
  } catch (error) {
    console.error('Message count update error:', error);
    // Hide badge on error
    const badge = document.getElementById('messageCount');
    if (badge) badge.style.display = 'none';
  }
}

function truncateMessage(message, maxLength) {
  if (!message) return '';
  return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
}
// END: Message System

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
        <a href="#" class="dropdown-item ${n.read_status === 'unread' ? 'bg-dark' : ''}">
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

function setupSidebarToggle() {
  const sidebarToggler = document.querySelector(".sidebar-toggler");
  const sidebar = document.querySelector(".sidebar");
  const content = document.querySelector(".content");

  if (sidebarToggler && sidebar && content) {
    sidebarToggler.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      content.classList.toggle("open");
    });
  }
}

// Add this CSS to fix notification dropdown
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
`;

// Add the styles to the document
const style = document.createElement('style');
style.textContent = notificationStyles;
document.head.appendChild(style);