// Author: Katlego Mmadi
document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const email = localStorage.getItem('resetEmail');

  if (newPassword !== confirmPassword) {
    return alert('Passwords do not match');
  }

  try {
    const res = await axios.post('http://localhost:3000/api/web/reset-password', {
      email,
      newPassword
    }, {
      withCredentials: true
    });

    alert(res.data.message || 'Password reset successful');
    localStorage.removeItem('resetEmail');
    window.location.href = 'signin.html';
  } catch (err) {
    console.error(err);
    alert(err.response?.data?.error || 'Failed to reset password');
  }
});
