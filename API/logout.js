// Example: logout.js
function logout() {
  const token = localStorage.getItem('token'); // or however you're storing it

  localStorage.removeItem("token");
localStorage.removeItem("employeeId");

  fetch('/api/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      localStorage.removeItem('token'); // optional: clear token
      window.location.href = '/signin.html';
    }
  });
}