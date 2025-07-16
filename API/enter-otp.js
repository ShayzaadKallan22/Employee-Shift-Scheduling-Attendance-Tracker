// enter-otp.js
//Author: Katlego Mmadi
document.addEventListener('DOMContentLoaded', function() {
  const otpInputs = document.querySelectorAll('.otp-input');
  const otpButton = document.getElementById('otp-button');
  const resendButton = document.getElementById('resend-button');
  const email = new URLSearchParams(window.location.search).get('email');

  // Set email display if available
  if (email) {
    document.getElementById('otp-email').textContent = `Code sent to ${email}`;
  }

  // OTP input handling
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      // Only allow numeric input
      if (value && !/^\d+$/.test(value)) {
        e.target.value = '';
        return;
      }
      
      if (value.length === 1 && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
      
      const otp = Array.from(otpInputs).map(i => i.value).join('');
      otpButton.disabled = otp.length !== 6;
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });

  // OTP form submission
  document.getElementById('otp-submit-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const otp = Array.from(otpInputs).map(i => i.value).join('');
    
    if (!email) {
      showToast('Error', 'Email not found. Please start the process again.', true);
      setTimeout(() => window.location.href = 'forgot-password.html', 2000);
      return;
    }

    otpButton.disabled = true;
    otpButton.innerHTML = '<div class="loading"><div class="spinner"></div>Verifying...</div>';

    try {
      const response = await axios.post("/api/verify-otp", { email, otp });
      
      showToast('Success', response.data.message);
      
      // Redirect to reset password page with token
      setTimeout(() => {
        window.location.href = `reset-password.html?email=${encodeURIComponent(email)}&token=${response.data.resetToken}`;
      }, 1500);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to verify OTP';
      showToast('Error', errorMsg, true);
      otpButton.disabled = false;
      otpButton.innerHTML = 'Verify Code';
      
      // Clear inputs if error is "Invalid OTP"
      if (errorMsg.includes('Invalid OTP')) {
        otpInputs.forEach(input => input.value = '');
        otpInputs[0].focus();
      }
    }
  });

  // Resend code function
  resendButton.addEventListener('click', async function() {
    if (!email) {
      showToast('Error', 'Email not found. Please start the process again.', true);
      setTimeout(() => window.location.href = 'forgot-password.html', 2000);
      return;
    }

    resendButton.disabled = true;
    resendButton.innerHTML = '<div class="loading"><div class="spinner"></div>Sending...</div>';

    try {
      const response = await axios.post("/api/forgot-password", { email });
      showToast('Success', 'New verification code sent to your email');
    } catch (err) {
      showToast('Error', err.response?.data?.error || 'Failed to resend code', true);
    } finally {
      setTimeout(() => {
        resendButton.disabled = false;
        resendButton.innerHTML = 'Resend Code';
      }, 30000); // 30 second cooldown
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
