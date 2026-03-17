/**
 * Authentication API endpoints
 * Login, registration, and token management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database/db');
const { generateToken, authenticateToken } = require('../middleware/auth');

// ==================== LOGIN ====================

router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Missing credentials',
        message: 'Username and password required'
      });
    }

    // Get user from database
    const result = await db.query(
      `SELECT id, username, password_hash, full_name, role, worker_id, is_active 
       FROM users 
       WHERE username = $1 AND is_active = true`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }

    // Check role if specified
    if (role && user.role !== role) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `Not authorized as ${role}`
      });
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate token
    const token = generateToken(user);

    // Log login
    await db.query(
      `INSERT INTO audit_log (user_id, action, ip_address, user_agent)
       VALUES ($1, 'LOGIN', $2, $3)`,
      [user.id, req.ip, req.get('user-agent')]
    );

    // Remove sensitive data
    delete user.password_hash;

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        worker_id: user.worker_id
      }
    });

  } catch (error) {
    req.logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== REGISTER (Admin only) ====================

router.post('/register', authenticateToken, async (req, res) => {
  try {
    // Only admin can register new users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { 
      username, 
      password, 
      full_name, 
      email, 
      role, 
      worker_id, 
      phone 
    } = req.body;

    // Validation
    if (!username || !password || !full_name || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existing = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await db.query(
      `INSERT INTO users 
       (username, password_hash, full_name, email, role, worker_id, phone, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, full_name, email, role, worker_id, created_at`,
      [username, passwordHash, full_name, email, role, worker_id, phone, req.user.id]
    );

    // Log registration
    await db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, 'REGISTER_USER', 'users', $2, $3)`,
      [req.user.id, result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    res.status(201).json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    req.logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ==================== VERIFY TOKEN ====================

router.post('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// ==================== LOGOUT ====================

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Log logout
    await db.query(
      `INSERT INTO audit_log (user_id, action, ip_address, user_agent)
       VALUES ($1, 'LOGOUT', $2, $3)`,
      [req.user.id, req.ip, req.get('user-agent')]
    );

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    req.logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ==================== CHANGE PASSWORD ====================

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Missing passwords' });
    }

    // Get user with password hash
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const user = result.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(new_password, salt);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    // Log password change
    await db.query(
      `INSERT INTO audit_log (user_id, action, ip_address)
       VALUES ($1, 'CHANGE_PASSWORD', $2)`,
      [req.user.id, req.ip]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    req.logger.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ==================== REFRESH TOKEN ====================

router.post('/refresh', authenticateToken, (req, res) => {
  try {
    const newToken = generateToken(req.user);

    res.json({
      success: true,
      token: newToken
    });

  } catch (error) {
    req.logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ==================== GET CURRENT USER ====================

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, full_name, email, role, worker_id, phone, 
              created_at, last_login, is_active
       FROM users 
       WHERE id = $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    req.logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ==================== FORGOT PASSWORD (simplified) ====================

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const result = await db.query(
      'SELECT id, username FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length > 0) {
      // In production, send email with reset link
      // For demo, just log it
      req.logger.info(`Password reset requested for ${email}`);
      
      // Generate reset token (simplified)
      const resetToken = Buffer.from(`${result.rows[0].id}-${Date.now()}`).toString('base64');
      
      // Store reset token (would need reset_tokens table)
      // await db.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'1 hour\')', [result.rows[0].id, resetToken]);
    }

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If email exists, password reset instructions will be sent'
    });

  } catch (error) {
    req.logger.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

module.exports = router;