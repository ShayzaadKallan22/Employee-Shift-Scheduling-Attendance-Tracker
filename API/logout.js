function logout() {
  // Clear storage
  localStorage.removeItem('token');
  localStorage.removeItem('employeeId');
  
  // Absolute path redirect
  window.location.href = '/signin.html';
}