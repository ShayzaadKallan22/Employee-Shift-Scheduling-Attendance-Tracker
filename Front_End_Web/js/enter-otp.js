//Author : Katlego Mmadi
document.addEventListener('DOMContentLoaded', function() {
    const otpInputs = document.querySelectorAll('.otp-input');
    const verifyButton = document.getElementById('otp-button');
    const resendButton = document.getElementById('resend-button');
    const toast = document.getElementById('toast');
    const email = localStorage.getItem('resetEmail') || sessionStorage.getItem('resetEmail');

    console.log('Email loaded:', email); // Debug

    if (!email) {
        showToast('Email session expired. Please restart password reset.', 'error');
        setTimeout(() => window.location.href = 'forgot-password.html', 3000);
        return;
    }

    document.getElementById('otp-email').textContent = `Code sent to ${email}`;

    // OTP Input Handling
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            input.value = input.value.replace(/\D/g, '');
            if (input.value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            verifyButton.disabled = [...otpInputs].some(i => !i.value);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });

    // Form Submission
    document.getElementById('otp-submit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Combine OTP digits
  const code = Array.from(otpInputs)
    .map(input => input.value)
    .join('');

  console.log("Submitting OTP:", { email, code }); // Debug log

  try {
    const response = await fetch('https://ifmprojv1-production.up.railway.app/api/web/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
      credentials: 'include'
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || "OTP verification failed");
    }

    alert("OTP verified successfully!");
    window.location.href = 'reset-password.html';
  } catch (error) {
    console.error("OTP Error:", error);
    alert(error.message || "Invalid OTP");
  }
});

    // Toast function
    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = 'toast show';
        if (type === 'error') toast.classList.add('error');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 5000);
    }
});