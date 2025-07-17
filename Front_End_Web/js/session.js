//Author: Katlego Mmadi
async function loadUnreadNotificationCount() {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; employeeId=`);
    if (parts.length !== 2) return;
    const employeeId = parts.pop().split(';').shift();

    const response = await fetch(`/api/manager-notifications/unread/count?employeeId=${employeeId}`);
    const data = await response.json();

    const countSpan = document.getElementById("notificationCount");
    if (countSpan && data.unreadCount > 0) {
      countSpan.textContent = data.unreadCount;
      countSpan.style.display = "inline-block";
    } else if (countSpan) {
      countSpan.style.display = "none";
    }
  } catch (err) {
    console.error("🔔 Failed to load unread notification count:", err);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.replace("/signin.html");
      return;
    }

    loadUnreadNotificationCount();

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const response = await fetch("/api/logout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const result = await response.json();
          if (result.success) {
            localStorage.clear();
            window.location.replace("/signin.html");
          } else {
            alert("Logout failed. Please try again.");
          }
        } catch (err) {
          console.error("Logout error:", err);
          alert("An error occurred during logout.");
        }
      });
    }
  }, 100); // Delay to ensure navbar is injected
});
