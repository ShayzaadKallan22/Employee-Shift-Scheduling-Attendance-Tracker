//Author: Katlego Mmadi
document.addEventListener('DOMContentLoaded', function() {
  const resetForm = document.getElementById('reset-password-form');
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');
  const token = urlParams.get('token');

  if (!email || !token) {
    showToast('Error', 'Invalid reset link. Please start the process again.', true);
    setTimeout(() => window.location.href = 'forgot-password.html', 2000);
    return;
  }

  resetForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      showToast('Error', 'Passwords do not match', true);
      return;
    }
    
    // Validate password length
    if (newPassword.length < 8) {
      showToast('Error', 'Password must be at least 8 characters', true);
      return;
    }

    const submitButton = document.getElementById('reset-button');
    submitButton.disabled = true;
    submitButton.innerHTML = '<div class="loading"><div class="spinner"></div>Resetting...</div>';

    try {
      const response = await axios.post("/api/reset-password", { 
        email, 
        token, 
        newPassword 
      });
      
      showToast('Success', response.data.message);
      setTimeout(() => window.location.href = 'signin.html', 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to reset password';
      showToast('Error', errorMsg, true);
      
      // If token is invalid or expired, redirect to forgot password
      if (errorMsg.includes('Invalid') || errorMsg.includes('expired')) {
        setTimeout(() => window.location.href = 'forgot-password.html', 2000);
      }
      
      submitButton.disabled = false;
      submitButton.innerHTML = 'Reset Password';
    }
  });
});

function showToast(title, description, isError = false) {
  const toast = document.getElementById('toast');
  toast.innerHTML = `<strong>${title}</strong><p>${description}</p>`;
  toast.className = `toast show ${isError ? 'error' : ''}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 5000);
}
