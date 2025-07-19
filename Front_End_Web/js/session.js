//Author: Katlego Mmadi 
async function loadUnreadNotificationCount() {
  try {
    const user = localStorage.getItem("user"); // Check for user instead of token
    if (!user) {
      window.location.replace("/Front_End_Web/signin.html");
      return;
    }

    const employeeId = JSON.parse(user).id; // Get ID from stored user object
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
    const user = localStorage.getItem("user"); // Check for user instead of token
    if (!user) {
      window.location.replace("/Front_End_Web/signin.html");
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
              "Content-Type": "application/json",
            },
          });

          const result = await response.json();
          if (result.success) {
            localStorage.removeItem("user"); // Clear user data
            localStorage.removeItem("employeeId");
            window.location.replace("/Front_End_Web/signin.html");
          } else {
            alert("Logout failed. Please try again.");
          }
        } catch (err) {
          console.error("Logout error:", err);
          alert("An error occurred during logout.");
        }
      });
    }
  }, 100);
});