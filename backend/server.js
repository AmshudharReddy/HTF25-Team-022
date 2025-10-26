// server.js - Node.js Backend with Express, MongoDB, JWT, and Code Execution

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); 

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
const JWT_SECRET = process.env.JWT_SECRET;
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
// Updated Execute Code API Endpoint - Add this to your server.js

// Execute Code using Piston API (IMPROVED VERSION)
// Updated Execute Code API Endpoint - OPTIMIZED VERSION

// Execute Code using Piston API (OPTIMIZED)
app.post('/api/execute', async (req, res) => {
    try {
        const { language, code, inputs = '' } = req.body;

        // Validation
        if (!language || !code) {
            return res.status(400).json({ error: 'Language and code are required!' });
        }

        // Log request for debugging
        const startTime = Date.now();
        console.log('Execute request:', { 
            language, 
            codeLength: code.length, 
            hasInputs: !!inputs,
            inputsLength: inputs.length 
        });

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
            stdin: inputs,  // User input passed here
            compile_timeout: 10000,  // 10 seconds
            run_timeout: 3000,       // 3 seconds - reduced from default
            compile_memory_limit: -1,
            run_memory_limit: -1
        };

        // Call Piston API with timeout
        const response = await axios.post('https://emkc.org/api/v2/piston/execute', payload, {
            timeout: 10000  // 10 second timeout
        });
        const result = response.data;

        const executionTime = Date.now() - startTime;
        console.log('Execution time:', executionTime + 'ms');

        // Log Piston response for debugging
        console.log('Piston response:', {
            stdout: result.run?.stdout?.substring(0, 100) || '',
            stderr: result.run?.stderr?.substring(0, 100) || '',
            code: result.run?.code
        });

        // Better success detection
        const hasStdout = result.run?.stdout && result.run.stdout.length > 0;
        const hasOutput = result.run?.output && result.run.output.length > 0;
        const hasStderr = result.run?.stderr && result.run.stderr.length > 0;
        const exitCode = result.run?.code || 0;
        
        // Consider it successful if:
        // 1. Exit code is 0, OR
        // 2. There's stdout/output (even with warnings in stderr)
        const isSuccess = exitCode === 0 || (hasStdout || hasOutput);

        const responseData = {
            language: language,
            stdout: result.run?.stdout || '',
            stderr: result.run?.stderr || '',
            output: result.run?.output || '',
            exitCode: exitCode,
            success: isSuccess,
            executionTime: executionTime  // Add execution time
        };

        console.log('Sending response:', {
            success: responseData.success,
            exitCode: responseData.exitCode,
            hasOutput: !!(responseData.stdout || responseData.output),
            time: executionTime + 'ms'
        });

        res.json(responseData);

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error('Request timeout');
            res.status(504).json({
                error: 'Code execution timeout',
                details: 'The code took too long to execute (>10 seconds)'
            });
        } else {
            console.error('Code Execution Error:', error);
            res.status(500).json({
                error: 'Code execution failed',
                details: error.message
            });
        }
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
    const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

// ==================== AI CODE DEBUGGING ROUTE ====================
app.post('/api/debug-code', async (req, res) => {
  const { code, errorDescription, language = 'python' } = req.body;
  if (!code || !errorDescription) {
    return res.status(400).json({ error: 'Code and error description required' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!API_KEY) {
    console.error('GEMINI_API_KEY missing in environment');
    return res.status(500).json({ error: 'Server not configured: GEMINI_API_KEY missing' });
  }

  try {
    // Shortened system instruction to save tokens
    const systemInstruction = `Debug ${language} code. Fix the error described. Return ONLY the corrected code. Minimal changes. No explanations.`;
    const userInstruction = `Code:\n${code}\n\nError: ${errorDescription}`;

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
    //   generationConfig: {
    //     temperature: 0.1,  // Low for precise fixes
    //     maxOutputTokens: 512,  // Reduced to avoid MAX_TOKENS
    //     candidateCount: 1
    //   }
    };

    const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`;

    const fetchRes = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' }
    });

    const json = fetchRes.data;
    let fixedCode = '';
    if (json.candidates && json.candidates.length && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0].text) {
      fixedCode = json.candidates[0].content.parts[0].text || '';
    } else {
      // Improved handling for empty content (e.g., token limit)
      console.error('Unexpected/empty API response:', json);
      return res.status(502).json({ error: 'Debug API returned empty response (possible token limit). Try a shorter error description.', details: JSON.stringify(json) });
    }

    // Extract code from Markdown if present
    const fenceMatch = fixedCode.match(/```(?:\w*\n)?([\s\S]*?)```/);
    if (fenceMatch && fenceMatch[1]) {
      fixedCode = fenceMatch[1].trim();
    } else {
      fixedCode = fixedCode.trim();
    }

    // Fallback if still empty
    if (!fixedCode.trim()) {
      return res.status(500).json({ error: 'No fixed code generated. Try rephrasing the error.' });
    }

    res.json({ fixedCode });
  } catch (err) {
    console.error('Debug generation error:', err);
    res.status(500).json({ error: 'Debugging failed', details: err.message });
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