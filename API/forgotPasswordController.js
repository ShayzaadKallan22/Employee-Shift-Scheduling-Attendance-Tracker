/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const bcrypt = require('bcryptjs');     //For hashing the password 
const db = require('./db');
const nodemailer = require('nodemailer');   //For the reset_token transporter and to allow gmail services.

//Handle forgot password 
exports.forgotPassword = async (req , res) =>{

    const {email} = req.body;
     console.log("HERE?")
    if(!email) return res.status(400).json({message: 'Email is missing and required.'});

    //Get the employee with the entered email.
    try {
    const [user] = await db.query('SELECT * FROM t_employee WHERE email = ?', [email]);
    
    if (!user || user.length === 0) {
      return res.status(200).json({ message: 'If the email exists, a reset token has been sent.' });
    }
    //Generate the password reset token.
    const resetToken = Math.random().toString(36).substring(2, 12);
    //Insert into the db.
    await db.query('UPDATE t_employee SET reset_token = ? WHERE email = ?', [resetToken, email]);
    
    //Reset token transporter.
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'mayydayy11@gmail.com',   //Company or business email address.
        pass: 'gogi wltc mzcm rvgo',    //Mail app password.
      },
    });
    
    const mailOptions = {
      from: 'mayydayy11@gmail.com',   //Company email.
      to: email,        //employee email.
      subject: 'Password Reset Request',
      text: `Use this token to reset your password: ${resetToken}`, //Generated reset token.
    };

    await transporter.sendMail(mailOptions);   //Use the transporter to send the mail.

    return res.status(200).json({ message: 'If the email exists, a reset token has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

//Reset passsword 
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
   console.log("HERE?")
  //Check if the reset token and the new password are valid.
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Please enter reset token and new password, they are required.' });
  }

  try {
    const [user] = await db.query('SELECT * FROM t_employee WHERE reset_token = ?', [token]);

    if (!user || user.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }
    
    //Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await db.query('UPDATE t_employee SET password_hash = ?, reset_token = NULL WHERE reset_token = ?', [hashedPassword, token]);
    
    return res.status(200).json({ message: 'Password reset successfully.' });

  } catch (err) {
    console.error('Error resetting password:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
};
