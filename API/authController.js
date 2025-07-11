const bcrypt = require('bcryptjs');
const pool = require('./db');
const jwt = require('jsonwebtoken');

// Helper function to generate 6-digit password
const generatePassword = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Role name to ID mapping
const roleMap = {
    'bartender': 1,
    'sparkler_girl': 2,
    'waiter': 3,
    'cleaner': 4,
    'bouncer': 5,
    'runner': 6,
    'leader': 7
};

const register = async (req, res) => {
    try {
        let { first_name, last_name, email, phone_number, role_id, mac_address, type_ } = req.body;

        // Convert role name to ID if needed
        if (typeof role_id === 'string') {
            const roleKey = role_id.toLowerCase().replace(' ', '_');
            if (!roleMap[roleKey]) {
                return res.status(400).json({ message: 'Invalid role specified' });
            }
            role_id = roleMap[roleKey];
        }

        // Validate input
        if (!first_name || !last_name || !email || !phone_number || !role_id || !mac_address || !type_) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Validate type_ enum
        if (!['employee', 'manager'].includes(type_)) {
            return res.status(400).json({ message: 'Invalid employee type' });
        }

        // Validate MAC address format
        if (!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac_address)) {
            return res.status(400).json({ message: 'Invalid MAC address format' });
        }

        // Check if user exists
        const [existingUser] = await pool.query(
            'SELECT * FROM T_Employee WHERE email = ?', 
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Check if MAC address is registered
        const [existingDevice] = await pool.query(
            'SELECT * FROM T_Device WHERE mac_address = ?',
            [mac_address]
        );

        if (existingDevice.length > 0) {
            return res.status(400).json({ message: 'MAC address already registered' });
        }

        // Generate and hash password
        const generatedPassword = generatePassword();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(generatedPassword, salt);

        // Start transaction
        await pool.query('START TRANSACTION');

        try {
            // Create user with dynamic type_
            const [employeeResult] = await pool.query(
                'INSERT INTO T_Employee (first_name, last_name, email, phone_number, password_hash, status_, type_, role_id) VALUES (?, ?, ?, ?, ?, "active", ?, ?)',
                [first_name, last_name, email, phone_number, hashedPassword, type_, role_id]
            );

            const newEmployeeId = employeeResult.insertId;

            // Register device
            await pool.query(
                'INSERT INTO T_Device (mac_address, employee_id) VALUES (?, ?)',
                [mac_address, newEmployeeId]
            );

            // Commit transaction
            await pool.query('COMMIT');

            // Get the newly created user
            const [newUser] = await pool.query(`
                SELECT e.employee_id, e.first_name, e.last_name, e.email, e.type_, e.role_id, d.mac_address
                FROM T_Employee e
                LEFT JOIN T_Device d ON e.employee_id = d.employee_id
                WHERE e.employee_id = ?
            `, [newEmployeeId]);

            // Generate JWT token for the new user
            const token = jwt.sign(
                { 
                    id: newUser[0].employee_id,
                    email: newUser[0].email,
                    role_id: newUser[0].role_id
                }, 
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.status(201).json({
                user: {
                    employee_id: newUser[0].employee_id,
                    first_name: newUser[0].first_name,
                    last_name: newUser[0].last_name,
                    email: newUser[0].email,
                    type: newUser[0].type_,
                    role_id: newUser[0].role_id
                },
                device: {
                    mac_address: newUser[0].mac_address
                },
                temporaryPassword: generatedPassword,
                token
            });

        } catch (err) {
            await pool.query('ROLLBACK');
            throw err;
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check user exists
        const [user] = await pool.query(
            'SELECT * FROM T_Employee WHERE email = ?', 
            [email]
        );

        if (user.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user[0].password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user[0].employee_id,
                email: user[0].email,
                role_id: user[0].role_id 
            }, 
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ 
            message: 'Logged in successfully',
            token,
            user: {
                id: user[0].employee_id,
                email: user[0].email,
                role_id: user[0].role_id
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed', details: err.message });
    }
};

// authController.js
const logout = async (req, res) => {
  try {
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
};

module.exports = { register, login, logout };