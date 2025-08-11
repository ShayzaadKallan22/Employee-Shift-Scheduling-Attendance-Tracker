//Author : Katlego Mmadi
document.getElementById('email-submit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('Form submitted'); // Debug

  const email = document.getElementById('email').value;
  const messageDiv = document.getElementById('toast');
  console.log('Email entered:', email); // Debug

  try {
    const response = await fetch('https://ifmprojv1-production.up.railway.app/api/web/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    console.log('Fetch response:', response.status, response.statusText); // Debug

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `Request failed: ${response.status}`);

    messageDiv.textContent = data.message;
    messageDiv.classList.add('show');
    messageDiv.classList.remove('error');
    localStorage.setItem('resetEmail', email);
    console.log('OTP request successful, redirecting...'); // Debug

    setTimeout(() => {
      window.location.href = 'enter-otp.html';
    }, 2000);
  } catch (error) {
    messageDiv.textContent = error.message || 'An error occurred';
    messageDiv.classList.add('show', 'error');
    console.error('Error:', error);
    setTimeout(() => {
      messageDiv.classList.remove('show', 'error');
    }, 3000);
  }
});