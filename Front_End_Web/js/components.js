
// Author: Katlego Mmadi / Yatin Fakir
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
              <span class="d-none d-lg-inline-flex">Admin User</span>
            </a>
            <div class="dropdown-menu dropdown-menu-end bg-secondary border-0 rounded-0 rounded-bottom m-0">
              <a href="#" class="dropdown-item" id="logoutBtn">Log Out</a>
            </div>
          </div>
        </div>
      </nav>
      </div>
    `;

    // Initialize systems
    initializeNotificationSystem();
    setupSidebarToggle();
    setupLogoutButton();
  }
});

function setupLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // 1. Clear storage immediately
    localStorage.removeItem('token'); // Kept for backward compatibility, though not used
    localStorage.removeItem('employeeId');
    localStorage.removeItem('user');
    sessionStorage.clear();

    // 2. Clear any intervals
    if (window.notificationRefreshInterval) {
      clearInterval(window.notificationRefreshInterval);
    }

    // 3. Notify server to destroy session
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies for session
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Logout API call failed:', data);
      } else {
        console.log('Logout successful:', data.message);
      }
    } catch (error) {
      console.log('Logout API call failed, proceeding anyway:', error);
    }

    // 4. Force redirect to clear memory
    window.location.href = 'signin.html?logout=success&t=' + Date.now();
  });
}

// Notification System
function initializeNotificationSystem() {
  loadRecentNotifications();
  updateNotificationCount();
  window.notificationRefreshInterval = setInterval(() => {
    loadRecentNotifications();
    updateNotificationCount();
  }, 30000);
}

async function loadRecentNotifications() {
  try {

    const employeeId = localStorage.getItem('employeeId');
    if (!employeeId) throw new Error('No employee ID found in localStorage');
    
    const response = await fetch(`https://ifmprojv1-production.up.railway.app/api/manager-notifications/unread/latest?employeeId=${employeeId}`, {
      credentials: 'include' // Include cookies for session
    });
    if (!response.ok) throw new Error('Failed to fetch notifications');
    
    const notifications = await response.json();
    const container = document.getElementById('recent-notifications');

    container.innerHTML = notifications.length ? 
      notifications.map(n => `
        <a href="#" class="dropdown-item ${n.read_status === 'unread' ? 'bg-dark' : ''}">
          <div class="d-flex align-items-start">
            <div class="me-2">${getNotificationIcon(n.type)}</div>
            <div>
              <small class="text-truncate d-block" style="max-width: 280px;">${n.message}</small>
              <small class="text-muted">${formatTime(n.sent_time)}</small>
            </div>
          </div>
        </a>
      `).join('') : 
      `<div class="px-3 py-2 text-center text-muted">No notifications</div>`;
  } catch (error) {
    console.error('Notification load error:', error);
    document.getElementById('recent-notifications').innerHTML = `
      <div class="px-3 py-2 text-center text-danger">
        Failed to load notifications
      </div>
    `;
  }
}

async function updateNotificationCount() {
  try {

    const employeeId = localStorage.getItem('employeeId');
    if (!employeeId) throw new Error('No employee ID found in localStorage');
    
    const response = await fetch(`https://ifmprojv1-production.up.railway.app/api/manager-notifications/unread/count?employeeId=${employeeId}`, {
      credentials: 'include' // Include cookies for session
    });
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
  return timeString ? new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

function getNotificationIcon(type) {
  const icons = {
    leave_request: '📅',
    payroll: '💰',
    shift_swap: '🔄',
    system: '⚙',
    default: '🔔'
  };
  return icons[type] || icons.default;
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