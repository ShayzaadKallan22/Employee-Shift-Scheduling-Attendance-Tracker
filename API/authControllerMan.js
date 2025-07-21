const bcrypt = require('bcryptjs');
const pool = require('./db');

const login = async (req, res) => {
  try {
    if (!req.body) {
      console.log('Request body is undefined');
      return res.status(400).json({ error: 'Request body is missing' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Missing email or password:', { email, password });
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [user] = await pool.query('SELECT * FROM t_employee WHERE email = ?', [email]);
    console.log('User query result:', user);

    if (!user || user.length === 0) {
      console.log('No user found for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user[0].password_hash);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user[0].type_ !== 'manager') {
      console.log('Non-manager attempted login:', email, user[0].type_);
      return res.status(403).json({ error: 'Access denied: Only managers can log in' });
    }

    req.session.user = {
      id: user[0].employee_id,
      email: user[0].email,
      type_: user[0].type_
    };

    res.cookie('employeeId', user[0].employee_id, {
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({
      message: 'Logged in successfully',
      user: {
        id: user[0].employee_id,
        email: user[0].email,
        type_: user[0].type_
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

const register = async (req, res) => {
  res.status(501).json({ error: 'Register not implemented' });
};

//authController.js 
const logout = async (req, res) => {
  try {
    //Clear the session without waiting too long
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        //Still respond successfully to ensure client redirects
        return res.json({ 
          success: true,
          message: 'Logged out (session may not have cleared completely)' 
        });
      }
      
      //Clear the cookies
      res.clearCookie('employeeId');
      res.clearCookie('connect.sid');
      
      return res.json({ 
        success: true,
        message: 'Logged out successfully' 
      });
    });
  } catch (err) {
    console.error('Logout error:', err);
    //Still respond successfully to ensure client redirects
    return res.json({ 
      success: true,
      message: 'Logged out (with possible server errors)' 
    });
  }
};
module.exports = { login, register, logout };