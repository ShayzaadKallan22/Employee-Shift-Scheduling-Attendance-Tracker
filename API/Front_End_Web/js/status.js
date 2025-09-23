//Author : Katlego Mmadi
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

  function fetchEmployeeShifts(empId) {
    return fetch(`http://localhost:3000/api/status/shifts/${empId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((shifts) => {
        const now = new Date();
        const sortedShifts = shifts.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

        // Convert shift times to Date objects for comparison
        const getShiftStartDateTime = (shift) => {
          const startDate = new Date(shift.start_date);
          const [hours, minutes] = shift.start_time.split(':');
          startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          return startDate;
        };

        const getShiftEndDateTime = (shift) => {
          const endDate = new Date(shift.end_date);
          const [hours, minutes] = shift.end_time.split(':');
          endDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          return endDate;
        };

        const currentShifts = sortedShifts.filter(s => {
          const startDateTime = getShiftStartDateTime(s);
          const endDateTime = getShiftEndDateTime(s);
          return startDateTime <= now && endDateTime >= now;
        });

        const futureShifts = sortedShifts.filter(s => {
          const startDateTime = getShiftStartDateTime(s);
          return startDateTime > now;
        });

        return {
          currShift: currentShifts.length > 0 ? currentShifts[0] : null,
          nextShift: futureShifts.length > 0 ? futureShifts[0] : null
        };
      })
      .catch((err) => {
        console.error("❌ Failed to fetch shifts:", err);
        return { currShift: null, nextShift: null };
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
      fetchEmployeeShifts(emp.id).then(({ currShift, nextShift }) => {
        const item = document.createElement("div");
        item.className = "list-group-item bg-transparent border-secondary d-flex justify-content-between align-items-center";
        item.style.cursor = "pointer";

        // Extract initials from name
        const nameParts = emp.name.split(' ');
        const initials = nameParts.length > 1 
          ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
          : nameParts[0][0] || 'X'; // Fallback to 'X' if no valid name

        // Determine shift to display (current preferred, next as fallback)
        const displayShift = currShift || nextShift;
        const shiftType = currShift ? 'Current' : 'Next';
        const shiftInfo = displayShift 
          ? `${shiftType} Shift: ${new Date(displayShift.start_date).toLocaleDateString()} ${displayShift.start_time} - ${displayShift.end_time} (${displayShift.status_})`
          : 'No upcoming shifts';

        // Check for alert: Current shift but status is not "Working"
        const hasCurrentShiftButNotWorking = currShift && emp.status !== "Working";
        const alertIcon = hasCurrentShiftButNotWorking ? '<i class="fa fa-exclamation-triangle text-warning me-1"></i>' : '';
        const workingCheckmark = emp.status === "Working" ? '<i class="fas fa-check-circle working-checkmark"></i>' : '';
        const onLeaveIcon = emp.status === "On Leave" ? '<i class="fas fa-bed on-leave-icon"></i>' : '';

        item.innerHTML = `
          <div class="d-flex align-items-center flex-grow-1">
            <div class="position-relative me-3">
              <div class="initials-avatar" style="background-color: #00a4e0 ; color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold;">
                ${initials.toUpperCase()}
              </div>
              <div class="bg-${
                emp.status === "Working" ? "success" : 
                emp.status === "On Leave" ? "warning" : "danger"
              } rounded-circle border border-2 border-white position-absolute end-0 bottom-0 p-1"></div>
            </div>
            <div class="flex-grow-1">
              <h6 class="mb-1">${emp.name} ${alertIcon} ${workingCheckmark} ${onLeaveIcon}</h6>
              <small class="text-muted d-block mb-1">${shiftInfo}</small>
              <small class="text-muted">${emp.role}</small>
            </div>
          </div>
          <div class="d-flex align-items-center button-badge-group">
            <button class="btn btn-sm btn-outline-primary" onclick="window.location.href='message-employee.html?employeeId=${emp.id}'">Message Employee</button>
            <span class="badge status-badge ${
              emp.status === "Working" ? "bg-success" :
              emp.status === "On Leave" ? "bg-warning text-dark" : "bg-danger"
            }">
              ${emp.status}
            </span>
          </div>
        `;

        // Add click event for shift details (optional log for now)
        item.addEventListener("click", () => {
          console.log(`Viewing detailed shifts for ${emp.name}`);
        });

        list.appendChild(item);
      });
    });
  }

  function handleSearch() {
    const searchTerm = document.getElementById("employeeSearch").value.toLowerCase();
    const selectedRole = document.getElementById("roleFilter").value;
    const selectedStatus = document.getElementById("statusFilter").value;
    const filtered = allEmployees.filter(emp => {
      const matchesName = emp.name.toLowerCase().includes(searchTerm) || emp.email.toLowerCase().includes(searchTerm);
      const matchesRole = selectedRole ? emp.role === selectedRole : true;
      const matchesStatus = selectedStatus ? emp.status === selectedStatus : true;
      return matchesName && matchesRole && matchesStatus;
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
  document.getElementById("statusFilter").addEventListener("change", handleSearch);
  document.getElementById("statusFilterButton").addEventListener("click", handleSearch);

  function populateRoleFilter() {
    fetch("http://localhost:3000/api/roles")
      .then(res => res.json())
      .then(roles => {
        const select = document.getElementById("roleFilter");
        select.innerHTML = '<option value="">All Roles</option>';
        roles.forEach(roleObj => {
          const role = roleObj.title; // Extract title from object
          const option = document.createElement("option");
          option.value = role;
          option.textContent = role;
          select.appendChild(option);
        });
      })
      .catch(err => console.error("❌ Failed to fetch roles:", err));
  }

  function populateStatusFilter() {
    const select = document.getElementById("statusFilter");
    select.innerHTML = '<option value="">All Statuses</option>';
    ["Working", "Not Working", "On Leave"].forEach(status => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      select.appendChild(option);
    });
  }

  function initPieChart(working, notWorking, onLeave, total) {
    if (chartInitialized) {
      window.pieChart.destroy();
    }
    const ctx = document.getElementById("statusPieChart").getContext("2d");
    window.pieChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Working", "Not Working", "On Leave"],
        datasets: [{
          data: [working, notWorking, onLeave],
          backgroundColor: ["rgba(0,200,83,0.8)", "rgba(244,67,54,0.8)", "rgba(255,152,0,0.8)"],
          borderColor: ["rgba(0,200,83,1)", "rgba(244,67,54,1)", "rgba(255,152,0,1)"],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#fff", font: { size: 14 } } },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || "";
                const value = context.raw || 0;
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
    chartInitialized = true;
  }

  function showError(message) {
    const list = document.getElementById("employeeStatusList");
    list.innerHTML = `<div class="alert alert-danger">${message}</div>`;
  }

  populateRoleFilter();
  populateStatusFilter();
  fetchAndDisplayEmployees();
});
