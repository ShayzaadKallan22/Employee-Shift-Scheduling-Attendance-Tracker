const bcrypt = require('bcryptjs');

(async () => {
  const plainPassword = 'SecurePassword123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);
  console.log('Hashed password:', hash);
})();