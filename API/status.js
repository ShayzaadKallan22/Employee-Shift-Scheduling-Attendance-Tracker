//Author: Katlego Mmadi
document.addEventListener("DOMContentLoaded", () => {
let allEmployees = [];
let chartInitialized = false;
  


function renderStaticMetrics(employees) {
  const workingCount = employees.filter(emp => emp.status === "Working").length;
  const notWorkingCount = employees.filter(emp => emp.status === "Not Working").length;
  const onLeaveCount = employees.filter(emp => emp.status === "On Leave").length;
  const totalCount = employees.length;

  document.getElementById("activeCount").innerHTML = `
    ${workingCount}<br>
    <small class="text-muted">${Math.round((workingCount / totalCount) * 100)}% of total</small>
  `;
  document.getElementById("inactiveCount").innerHTML = `
    ${notWorkingCount}<br>
    <small class="text-muted">${Math.round((notWorkingCount / totalCount) * 100)}% of total</small>
  `;
  document.getElementById("onLeaveCount").innerHTML = `
    ${onLeaveCount}<br>
    <small class="text-muted">${Math.round((onLeaveCount / totalCount) * 100)}% of total</small>
  `;

  initPieChart(workingCount, notWorkingCount, onLeaveCount, totalCount);
}


  // Fetch and display employees
function fetchAndDisplayEmployees() {
  fetch("/api/employees")
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      console.log("✅ Employees fetched:", data);
      allEmployees = data;
      renderStaticMetrics(data); // ← Only once
      updateDisplay(data);       // ← Initial list
    })
    .catch((err) => {
      console.error("❌ Failed to fetch employees:", err);
      showError(err.message);
    });
}

  // Update the display with filtered data
  function updateDisplay(employees) {

    // Render list
    const list = document.getElementById("employeeStatusList");
    list.innerHTML = "";

    if (employees.length === 0) {
      list.innerHTML = `
        <div class="alert alert-info">
          No employees match your search criteria.
        </div>
      `;
      return;
    }

    employees.forEach(emp => {
      const item = document.createElement("div");
      item.className = "list-group-item bg-transparent border-secondary d-flex justify-content-between align-items-center";
      item.innerHTML = `
        <div class="d-flex align-items-center">
          <div class="position-relative me-3">
            <img class="rounded-circle" src="img/user.jpg" alt="" style="width: 30px; height: 30px">
            <div class="bg-${
              emp.status === "Working" ? "success" : 
              emp.status === "On Leave" ? "warning" : "danger"
            } rounded-circle border border-2 border-white position-absolute end-0 bottom-0 p-1"></div>
          </div>
          <div>
            <h6 class="mb-0">${emp.name}</h6>
            <small class="text-muted">${emp.role}</small>
          </div>
        </div>
        <span class="badge ${
          emp.status === "Working" ? "bg-success" :
          emp.status === "On Leave" ? "bg-warning text-dark" : "bg-danger"
        }">
          ${emp.status}
        </span>
      `;
      list.appendChild(item);
    });

}

  // Error display function
  function showError(message) {
    const list = document.getElementById("employeeStatusList");
    list.innerHTML = `
      <div class="alert alert-danger">
        ${message}
      </div>
    `;
  }

  // Search functionality
function handleSearch() {
  const searchTerm = document.getElementById("employeeSearch").value.toLowerCase();
  const selectedRole = document.getElementById("roleFilter").value;

  const filtered = allEmployees.filter(emp => {
    const matchesName = emp.name.toLowerCase().includes(searchTerm) || emp.email.toLowerCase().includes(searchTerm);
    const matchesRole = selectedRole ? emp.role === selectedRole : true;
    return matchesName && matchesRole;
  });

  updateDisplay(filtered);
}

  // Initialize pie chart
  function initPieChart(working, notWorking, onLeave, total) {
    const ctx = document.getElementById("statusPieChart").getContext("2d");
    // Destroy previous chart if it exists
    if (window.employeePieChart) {
      window.employeePieChart.destroy();
    }
    
    window.employeePieChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Working", "Not Working", "On Leave"],
        datasets: [{
          data: [working, notWorking, onLeave],
          backgroundColor: [
            "rgba(0,200,83,0.8)",
            "rgba(244,67,54,0.8)",
            "rgba(255,152,0,0.8)"
          ],
          borderColor: [
            "rgba(0,200,83,1)",
            "rgba(244,67,54,1)",
            "rgba(255,152,0,1)"
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#fff",
              font: { size: 14 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  // Event listeners
  document.getElementById("searchButton").addEventListener("click", handleSearch);
  document.getElementById("employeeSearch").addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  });
  document.getElementById("roleFilterButton").addEventListener("click", handleSearch);

  // Initial load
  fetchAndDisplayEmployees();
});

function populateRoleFilter() {
  fetch('/api/roles')
    .then(res => res.json())
    .then(roles => {
      const roleFilter = document.getElementById('roleFilter');
      roleFilter.innerHTML = `<option value="">All Roles</option>`;
      roles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.title;
        option.textContent = role.title;
        roleFilter.appendChild(option);
      });
    })
    .catch(err => {
      console.error('❌ Failed to load roles:', err);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  populateRoleFilter();
  fetchAndDisplayEmployees();
});
