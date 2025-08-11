// Author: Katlego Mmadi
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

  function fetchAndDisplayEmployees() {
    fetch("http://localhost:3000/api/status/employees")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log("✅ Employees fetched:", data);
        allEmployees = data;
        renderStaticMetrics(data);
        updateDisplay(data);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch employees:", err);
        showError('Failed to fetch employees. Please try again later.');
      });
  }

  function updateDisplay(employees) {
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

  function showError(message) {
    const list = document.getElementById("employeeStatusList");
    list.innerHTML = `
      <div class="alert alert-danger">
        ${message}
      </div>
    `;
  }

function populateRoleFilter() {
  console.log("Starting populateRoleFilter");
  fetch('http://localhost:3000/api/status/roles')
    .then(res => {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    })
    .then(roles => {
      console.log("Roles received:", roles);
      const roleFilter = document.getElementById('roleFilter');
      roleFilter.innerHTML = '<option value="">All Roles</option>';
      
      // Ensure roles is an array
      if (Array.isArray(roles)) {
        roles.forEach(role => {
          const option = document.createElement('option');
          option.value = role; // This should now be a string
          option.textContent = role;
          roleFilter.appendChild(option);
        });
      } else {
        console.error('Received roles is not an array:', roles);
      }
    })
    .catch(err => {
      console.error('❌ Failed to load roles:', err);
      // Optionally show error to user
    });
}

  function handleSearch() {
    const searchTerm = document.getElementById("employeeSearch").value.toLowerCase();
    const selectedRole = document.getElementById("roleFilter").value;
    console.log("Selected Role:", selectedRole);
    console.log("Employee Roles:", allEmployees.map(emp => emp.role));
    const filtered = allEmployees.filter(emp => {
      const matchesName = emp.name.toLowerCase().includes(searchTerm) || emp.email.toLowerCase().includes(searchTerm);
      const matchesRole = selectedRole ? emp.role === selectedRole : true;
      return matchesName && matchesRole;
    });
    updateDisplay(filtered);
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  document.getElementById("searchButton").addEventListener("click", handleSearch);
  document.getElementById("employeeSearch").addEventListener("keyup", debounce((e) => {
    if (e.key === "Enter") {
      handleSearch();
    } else {
      handleSearch();
    }
  }, 300));
  document.getElementById("roleFilter").addEventListener("change", handleSearch);
  document.getElementById("roleFilterButton").addEventListener("click", handleSearch);

  populateRoleFilter();
  fetchAndDisplayEmployees();
});