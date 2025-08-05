//Author: Katlego Mmadi
console.log("login.js loaded");
document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const button = document.getElementById('submit-button');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');

  emailError.style.display = 'none';
  passwordError.style.display = 'none';

  if (!email) {
    emailError.style.display = 'block';
    return;
  }
  if (!password) {
    passwordError.style.display = 'block';
    return;
  }

  button.disabled = true;
  button.innerHTML = '<div class="loading"><div class="spinner"></div>Signing in...</div>';

  try {
    console.log("Sending request to http://localhost:3000/api/login with email:", email);
    const response = await axios.post('http://localhost:3000/api/login', {
      email,
      password
    }, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log("Response:", response.data);

    const { user, message } = response.data;

    if (user.type_ !== 'manager') {
      throw new Error('Access denied: Only managers can log in');
    }

    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('employeeId', user.id);
    console.log("User ID:", user.id, "Type:", user.type_);

    //alert(message || 'Login successful');
    window.location.href = 'index.html'; // Redirect to index.html 
  } catch (err) {
    console.error("Network Error Details:", {
      message: err.message,
      response: err.response ? {
        status: err.response.status,
        data: err.response.data
      } : null,
      config: err.config
    });
    const errorMessage = err.response?.data?.error || err.message || 'Login failed';
    alert(errorMessage);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Sign In';
  }
});