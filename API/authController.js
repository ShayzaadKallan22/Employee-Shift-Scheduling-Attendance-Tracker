
const bcrypt = require('bcryptjs');
const pool = require('./db');
const jwt = require('jsonwebtoken');

// Helper function to generate 6-digit password
const generatePassword = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Role name to ID mapping
const roleMap = {
    bartender: 1,
    sparkler_girl: 2,
    waiter: 3,
    cleaner: 4,
    bouncer: 5,
    runner: 6,
    leader: 7,
};

const register = async (req, res) => {
    try {
        let {
            first_name,
            last_name,
            email,
            phone_number,
            role_id,
            mac_address,
            type_,
        } = req.body;

        // Convert role name to ID if needed
        if (typeof role_id === 'string') {
            const roleKey = role_id.toLowerCase().replace(/ /g, '_');
            if (!roleMap[roleKey]) {
                return res.status(400).json({ message: 'Invalid role specified' });
            }
            role_id = roleMap[roleKey];
        }

        // Validate required fields
        if (!first_name || !last_name || !email || !phone_number || !role_id || !mac_address || !type_) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Validate type
        if (!['employee', 'manager'].includes(type_)) {
            return res.status(400).json({ message: 'Invalid employee type' });
        }

        // Validate MAC address format
        if (!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac_address)) {
            return res.status(400).json({ message: 'Invalid MAC address format' });
        }

        // Check if email already exists
        const [existingUser] = await pool.query(
            'SELECT * FROM T_Employee WHERE email = ?',
            [email]
        );
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Check if MAC address already registered
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
            const [employeeResult] = await pool.query(
                `INSERT INTO T_Employee 
                (first_name, last_name, email, phone_number, password_hash, status_, type_, role_id) 
                VALUES (?, ?, ?, ?, ?, "active", ?, ?)`,
                [first_name, last_name, email, phone_number, hashedPassword, type_, role_id]
            );

            const newEmployeeId = employeeResult.insertId;

            await pool.query(
                'INSERT INTO T_Device (mac_address, employee_id) VALUES (?, ?)',
                [mac_address, newEmployeeId]
            );

            await pool.query('COMMIT');

            const [newUser] = await pool.query(
                `SELECT e.employee_id, e.first_name, e.last_name, e.email, e.type_, e.role_id, d.mac_address
                 FROM T_Employee e
                 LEFT JOIN T_Device d ON e.employee_id = d.employee_id
                 WHERE e.employee_id = ?`,
                [newEmployeeId]
            );

            const token = jwt.sign(
                {
                    id: newUser[0].employee_id,
                    email: newUser[0].email,
                    role_id: newUser[0].role_id,
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            return res.status(201).json({
                user: {
                    employee_id: newUser[0].employee_id,
                    first_name: newUser[0].first_name,
                    last_name: newUser[0].last_name,
                    email: newUser[0].email,
                    type: newUser[0].type_,
                    role_id: newUser[0].role_id,
                },
                device: {
                    mac_address: newUser[0].mac_address,
                },
                temporaryPassword: generatedPassword,
                token,
            });
        } catch (err) {
            await pool.query('ROLLBACK');
            throw err;
        }
    } catch (err) {
        console.error('🛑 Registration error:', err.message);
        return res.status(500).json({ message: 'Server error during registration' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email, password: password ? '[provided]' : '[missing]' });

        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const [user] = await pool.query('SELECT * FROM t_employee WHERE email = ?', [email]);

       console.log('User found:', user.length > 0 ? `ID: ${user[0].employee_id}, Type: ${user[0].type_}` : 'No');

      

        if (user.length === 0) {
            console.log('No user found for email:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user[0].password_hash);
        console.log('Password match:', isMatch);

        if (!isMatch) {
            console.log('Password mismatch for email:', email);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user[0].type_ !== 'manager') {
            console.log('Non-manager attempted login:', email, user[0].type_);
            return res.status(403).json({ error: 'Access denied: Only managers can log in' });
        }

        const token = jwt.sign(
            {
                id: user[0].employee_id,
                email: user[0].email,
                role_id: user[0].role_id,
                type_: user[0].type_
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('employeeId', user[0].employee_id, {
  httpOnly: true,      // Prevents client-side JS from accessing it
  secure: false,       // Set to true if using HTTPS
  sameSite: 'Lax',     // Helps prevent CSRF
  maxAge: 24 * 60 * 60 * 1000 // 1 day
});


        console.log('Login successful for:', email);
        return res.json({
            message: 'Logged in successfully',
            token,
            user: {
                id: user[0].employee_id,
                email: user[0].email,
                role_id: user[0].role_id,
                type_: user[0].type_
            }
        });
    } catch (err) {
        console.error('🛑 Login error:', err.message || err);
        return res.status(500).json({ error: 'Login failed' });
    }
};

const logout = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "No token provided" });
        }

        const token = authHeader.split(" ")[1];

        // Decode token to get expiry
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) {
            return res.status(400).json({ error: "Invalid token" });
        }

        const expiresAt = new Date(decoded.exp * 1000); // Convert to ms

        await pool.query(
            "INSERT INTO T_BlacklistedToken (token, expires_at) VALUES (?, ?)",
            [token, expiresAt]
        );

        // Clear the cookie
        res.clearCookie('employeeId');

        

        return res.status(200).json({ success: true, message: "Logged out and token blacklisted" });
    } catch (err) {
        console.error("🛑 Logout error:", err.message);
        return res.status(500).json({ error: "Logout failed" });
    }
};


const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Check if token is blacklisted
    const [blacklisted] = await pool.query(
        "SELECT * FROM T_BlacklistedToken WHERE token = ? AND expires_at > NOW()",
        [token]
    );

    if (blacklisted.length > 0) {
        return res.status(401).json({ error: "Token has been revoked" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};


module.exports = { register, login, logout };