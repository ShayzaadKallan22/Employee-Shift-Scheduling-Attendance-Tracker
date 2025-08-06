//Author : Katlego Mmadi

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const OTP_EXPIRATION_MINUTES = 10; // OTP expires after 10 minutes

// In-memory store for tracking OTP requests (optional)
const otpRequests = new Map(); // { email: { otp: string, timestamp: number } }

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset OTP (Web)',
    text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes. If you requested another OTP, use the most recent one.`,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log('OTP email sent to:', email);
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send OTP email');
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  console.log('Received forgot-password request for:', email);
  
  try {
    const [user] = await req.db.query('SELECT * FROM t_employee WHERE email = ?', [email]);
    if (!user.length) {
      console.log('Email not found:', email);
      return res.status(404).json({ message: 'Email not found' });
    }

    const otp = generateOTP();
    await req.db.query(
      'UPDATE t_employee SET reset_token = ? WHERE email = ?', 
      [otp, email]
    );

    // Store timestamp in memory
    otpRequests.set(email, { 
      otp, 
      timestamp: Date.now() 
    });
    
    await sendOTPEmail(email, otp);
    res.status(200).json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const verifyOTP = async (req, res) => {
  // Debug: Log raw body and parsed body
  console.log('Raw body:', req.body);
  console.log('Parsed code:', req.body.code, 'Type:', typeof req.body.code);

 
  const { email, code: receivedOTP } = req.body || {};
  console.log('Verification Request:', { email, receivedOTP });

  try {
    const [user] = await req.db.query(
      'SELECT reset_token FROM t_employee WHERE email = ?', 
      [email]
    );
    
    if (!user.length) {
      return res.status(404).json({ message: 'Email not found' });
    }

    const storedOTP = user[0].reset_token?.toString().trim(); // Ensure string comparison
    console.log(`Comparing: Stored('${storedOTP}') vs Received('${receivedOTP}')`);

    if (!storedOTP || storedOTP !== receivedOTP) {
      return res.status(400).json({ 
        message: 'Invalid OTP',
        debug: { stored: storedOTP, received: receivedOTP }
      });
    }

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verification Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body; 
  console.log('Resetting password for:', email, 'with password:', newPassword ? '[exists]' : 'UNDEFINED');

  if (!newPassword) {
    return res.status(400).json({ message: 'Password is required' });
  }

  try {
    const [user] = await req.db.query('SELECT reset_token FROM t_employee WHERE email = ?', [email]);
    
    if (!user.length) {
      console.log('Email not found:', email);
      return res.status(404).json({ message: 'Email not found' });
    }

    if (!user[0].reset_token) {
      console.log('No valid OTP session for:', email);
      return res.status(400).json({ message: 'No valid OTP session found' });
    }

   
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    await req.db.query(
      'UPDATE t_employee SET password_hash = ?, reset_token = NULL WHERE email = ?', 
      [hashedPassword, email]
    );

    otpRequests.delete(email);
    console.log('Password reset successful for:', email);
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ 
      message: 'Failed to reset password',
      error: error.message 
    });
  }
};

module.exports = { forgotPassword, verifyOTP, resetPassword };