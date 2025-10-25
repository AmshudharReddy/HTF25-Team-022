// server.js - Node.js Backend with Express, MongoDB, JWT, and Code Execution

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/voicecode', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
});

const User = mongoose.model('User', userSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this-in-production';
const JWT_EXPIRE = '7d';

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

// Language mapping for Piston API
const languageMapping = {
    'python': 'python',
    'javascript': 'javascript',
    'java': 'java',
    'cpp': 'c++',
    'c++': 'c++',
    'c': 'c',
    'go': 'go',
    'rust': 'rust',
    'ruby': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'typescript': 'typescript'
};

// ==================== CODE EXECUTION ROUTES ====================

// Execute Code using Piston API
app.post('/api/execute', async (req, res) => {
    try {
        const { language, code, inputs = '' } = req.body;

        if (!language || !code) {
            return res.status(400).json({ error: 'Language and code are required!' });
        }

        // Map language to Piston format
        const pistonLanguage = languageMapping[language.toLowerCase()] || language.toLowerCase();

        const payload = {
            language: pistonLanguage,
            version: '*', // Use latest version
            files: [
                {
                    name: 'main',
                    content: code
                }
            ],
            stdin: inputs
        };

        const response = await axios.post('https://emkc.org/api/v2/piston/execute', payload);
        const result = response.data;

        res.json({
            language: language,
            stdout: result.run?.stdout || '',
            stderr: result.run?.stderr || '',
            output: result.run?.output || '',
            exitCode: result.run?.code || 0,
            success: result.run?.code === 0 && !result.run?.stderr
        });

    } catch (error) {
        console.error('Code Execution Error:', error);
        res.status(500).json({ 
            error: 'Code execution failed', 
            details: error.message 
        });
    }
});

// Get supported languages
app.get('/api/languages', async (req, res) => {
    try {
        const response = await axios.get('https://emkc.org/api/v2/piston/runtimes');
        const languages = response.data.map(lang => ({
            language: lang.language,
            version: lang.version,
            aliases: lang.aliases
        }));
        res.json(languages);
    } catch (error) {
        console.error('Error fetching languages:', error);
        res.status(500).json({ error: 'Failed to fetch supported languages' });
    }
});

// ==================== AI CODE GENERATION ROUTE ====================

app.post('/api/generate-code', async (req, res) => {
    const { prompt, language = 'python' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

    if (!API_KEY) {
        console.error('GEMINI_API_KEY missing in environment');
        return res.status(500).json({ error: 'Server not configured: GEMINI_API_KEY missing' });
    }

    try {
        const systemInstruction = `You are a code generation assistant. Produce valid ${language} code only. Do not include explanations, metadata, or surrounding text. If you must include comments, keep them minimal.`;
        const userInstruction = `User request: ${prompt}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: `${systemInstruction}\n\n${userInstruction}`
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1024,
                candidateCount: 1
            }
        };

        const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`;

        const fetchRes = await axios.post(url, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        const json = fetchRes.data;
        let generated = '';
        if (json.candidates && json.candidates.length && json.candidates[0].content && json.candidates[0].content.parts) {
            generated = json.candidates[0].content.parts[0].text || '';
        } else {
            console.error('Unexpected API response:', json);
            return res.status(502).json({ error: 'Unexpected API response', details: JSON.stringify(json) });
        }

        // Extract code from Markdown if present
        const fenceMatch = generated.match(/```(?:\w*\n)?([\s\S]*?)```/);
        if (fenceMatch && fenceMatch[1]) {
            generated = fenceMatch[1].trim();
        } else {
            generated = generated.trim();
        }

        res.json({ code: generated });
    } catch (err) {
        console.error('Generation error:', err);
        res.status(500).json({ error: 'generation failed', details: err.message });
    }
});

// ==================== AUTH ROUTES ====================

// Signup Route
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required!' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters!' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered!' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        await newUser.save();

        // Generate token
        const token = generateToken(newUser._id);

        res.status(201).json({
            message: 'Account created successfully!',
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email
            }
        });

    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required!' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password!' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password!' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(200).json({
            message: 'Login successful!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error. Please try again.' });
    }
});

// Get User Profile (Protected Route)
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found!' });
        }
        res.json(user);
    } catch (error) {
        console.error('Profile Error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Update User Profile (Protected Route)
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found!' });
        }

        if (name) user.name = name;
        await user.save();

        res.json({
            message: 'Profile updated successfully!',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Change Password (Protected Route)
app.post('/api/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'All fields are required!' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters!' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found!' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect!' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: 'Password changed successfully!' });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Logout (Client-side: remove token)
app.post('/api/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully!' });
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'VoiceCode API is running!' });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;