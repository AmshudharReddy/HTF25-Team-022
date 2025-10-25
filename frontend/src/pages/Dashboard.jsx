// Dashboard.jsx - Enhanced Voice Code Assistant Dashboard
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [code, setCode] = useState('# Start coding with your voice!\n# Say "create a function" or "add a for loop"');
  const [language, setLanguage] = useState('python');
  const [commandHistory, setCommandHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const languageRef = useRef('python'); // Ref to hold current language to avoid stale closures
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Initial code snippets for each language
  const initialCodeSnippets = {
    python: '# Start coding with your voice!\n# Say "create a function" or "add a for loop"',
    javascript: '// Start coding with your voice!\n// Say "create a function" or "add a for loop"',
    java: '// Start coding with your voice!\npublic class VoiceCode {\n    public static void main(String[] args) {\n        // Say "create a function" or "add a for loop"\n    }\n}',
    cpp: '// Start coding with your voice!\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Say "create a function" or "add a for loop"\n    return 0;\n}'
  };

  // Update language ref whenever language state changes
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    const name = localStorage.getItem('userName');
    setUserName(name || 'User');

    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        console.log('SpeechRecognition onresult:', event.results);
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        console.log('Final:', finalTranscript, 'Interim:', interimTranscript);
        setTranscript(interimTranscript || finalTranscript);

        if (finalTranscript) {
          const currentLang = languageRef.current; // Use ref for current language
          console.log('Processing final transcript:', finalTranscript, 'with language:', currentLang);
          generateCode(finalTranscript.trim(), currentLang).catch(err => {
            console.error('generateCode failed:', err);
            setError('Failed to generate code: ' + err.message);
            processVoiceCommand(finalTranscript.trim(), currentLang);
          });
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('SpeechRecognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        console.log('SpeechRecognition ended');
        setIsRecording(false);
      };

      console.log('SpeechRecognition initialized');
    } else {
      console.error('SpeechRecognition not supported');
      setError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
    }

    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []); // Removed language from dependencies

  const generateCode = async (prompt, currentLanguage) => {
    if (!prompt) {
      console.warn('No prompt provided');
      setError('No voice input detected');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      console.log('Sending fetch to:', '/api/generate-code', 'with prompt:', prompt, 'language:', currentLanguage);
      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, language: currentLanguage })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Server error:', res.status, text);
        throw new Error(`Server error: ${res.status} ${text}`);
      }

      const data = await res.json();
      console.log('Server response:', data);
      if (data && data.code) {
        setCode(prev => (prev && !prev.endsWith('\n') ? prev + '\n\n' + data.code : data.code));
        setCommandHistory(prev => [...prev, { command: prompt, timestamp: new Date() }].slice(-5));
      } else {
        throw new Error('Invalid response from server: no code field');
      }
    } catch (err) {
      console.error('generateCode error:', err);
      setError('Failed to generate code: ' + err.message);
      throw err;
    } finally {
      setTimeout(() => setIsProcessing(false), 300);
    }
  };

  const processVoiceCommand = (command, currentLanguage) => {
    setIsProcessing(true);
    const lowerCommand = command.toLowerCase();
    setCommandHistory(prev => [...prev, { command, timestamp: new Date() }].slice(-5));

    let newCode = code;

    if (lowerCommand.includes('create function') || lowerCommand.includes('define function')) {
      const functionName = extractName(lowerCommand, 'function') || 'myFunction';
      if (currentLanguage === 'python') {
        newCode += `\n\ndef ${functionName}():\n    pass\n`;
      } else if (currentLanguage === 'javascript') {
        newCode += `\n\nfunction ${functionName}() {\n    // TODO\n}\n`;
      } else if (currentLanguage === 'java') {
        newCode += `\n\npublic void ${functionName}() {\n    // TODO\n}\n`;
      } else if (currentLanguage === 'cpp') {
        newCode += `\n\nvoid ${functionName}() {\n    // TODO\n}\n`;
      }
    } else if (lowerCommand.includes('for loop')) {
      if (currentLanguage === 'python') {
        newCode += `\n\nfor i in range(10):\n    print(i)\n`;
      } else if (currentLanguage === 'javascript') {
        newCode += `\n\nfor (let i = 0; i < 10; i++) {\n    console.log(i);\n}\n`;
      } else if (currentLanguage === 'java') {
        newCode += `\n\nfor (int i = 0; i < 10; i++) {\n    System.out.println(i);\n}\n`;
      } else if (currentLanguage === 'cpp') {
        newCode += `\n\nfor (int i = 0; i < 10; i++) {\n    std::cout << i << std::endl;\n}\n`;
      }
    } else if (lowerCommand.includes('print') || lowerCommand.includes('console log')) {
      const message = extractQuotedText(lowerCommand) || 'Hello World';
      if (currentLanguage === 'python') {
        newCode += `\nprint("${message}")\n`;
      } else if (currentLanguage === 'javascript') {
        newCode += `\nconsole.log("${message}");\n`;
      } else if (currentLanguage === 'java') {
        newCode += `\nSystem.out.println("${message}");\n`;
      } else if (currentLanguage === 'cpp') {
        newCode += `\nstd::cout << "${message}" << std::endl;\n`;
      }
    } else if (lowerCommand.includes('comment')) {
      const comment = lowerCommand.replace(/.*comment\s*/i, '');
      if (currentLanguage === 'python') {
        newCode += `\n# ${comment}\n`;
      } else {
        newCode += `\n// ${comment}\n`;
      }
    } else if (lowerCommand.includes('clear') || lowerCommand.includes('reset')) {
      newCode = initialCodeSnippets[currentLanguage];
    } else if (lowerCommand.includes('if statement')) {
      if (currentLanguage === 'python') {
        newCode += `\n\nif condition:\n    pass\n`;
      } else if (currentLanguage === 'javascript') {
        newCode += `\n\nif (condition) {\n    // TODO\n}\n`;
      } else if (currentLanguage === 'java') {
        newCode += `\n\nif (condition) {\n    // TODO\n}\n`;
      } else if (currentLanguage === 'cpp') {
        newCode += `\n\nif (condition) {\n    // TODO\n}\n`;
      }
    }

    setCode(newCode);
    setTimeout(() => setIsProcessing(false), 500);
  };

  const extractName = (text, keyword) => {
    const regex = new RegExp(`${keyword}\\s+(\\w+)`, 'i');
    const match = text.match(regex);
    return match ? match[1] : null;
  };

  const extractQuotedText = (text) => {
    const match = text.match(/"([^"]*)"/);
    return match ? match[1] : null;
  };

  const startRecording = () => {
    if (recognitionRef.current) {
      console.log('Starting speech recognition, language:', languageRef.current);
      setIsRecording(true);
      setTranscript('');
      setError(null);
      recognitionRef.current.start();
    } else {
      setError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      console.log('Stopping speech recognition');
      setIsRecording(false);
      recognitionRef.current.stop();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    navigate('/login');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  };

  const downloadCode = () => {
    const extension = language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'java' ? 'java' : 'cpp';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voicecode.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setCode(initialCodeSnippets[newLanguage]);
    console.log('Language changed to:', newLanguage);
    // Stop and restart recognition if active
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setTimeout(() => {
        recognitionRef.current.start();
        console.log('Restarted speech recognition for language:', newLanguage);
      }, 100);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <svg className="logo-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
            </svg>
            <h1 className="logo-title">VoiceCode</h1>
          </div>

          <div className="user-section">
            <span className="welcome-text">Welcome, {userName}!</span>
            <button onClick={handleLogout} className="logout-btn">
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Voice Control Panel */}
        <div className="voice-control-panel">
          <div className="control-header">
            <h2 className="control-title">Voice Assistant</h2>
            <div className="status-indicator">
              <span className={`status-dot ${isRecording ? 'recording' : ''}`}></span>
              <span className="status-text">
                {isRecording ? 'Listening...' : isProcessing ? 'Processing...' : 'Ready'}
              </span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message" style={{ color: 'red', margin: '10px 0' }}>
              {error}
            </div>
          )}

          {/* Recording Button */}
          <div className="recording-section">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`record-btn ${isRecording ? 'recording' : ''}`}
            >
              <svg className="mic-icon-large" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
              <span className="record-text">{isRecording ? 'Stop Recording' : 'Start Voice Command'}</span>
            </button>
          </div>

          {/* Transcript Display */}
          <div className="transcript-box">
            <div className="transcript-label">Live Transcript:</div>
            <div className="transcript-content">
              {transcript || 'Your voice commands will appear here...'}
            </div>
          </div>

          {/* Command History */}
          <div className="command-history">
            <h3 className="history-title">Recent Commands</h3>
            <div className="history-list">
              {commandHistory.length > 0 ? (
                commandHistory.map((item, index) => (
                  <div key={index} className="history-item">
                    <svg className="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <span>{item.command}</span>
                  </div>
                ))
              ) : (
                <p className="history-empty">No commands yet. Start speaking!</p>
              )}
            </div>
          </div>
        </div>

        {/* Code Editor Section */}
        <div className="code-editor-section">
          <div className="editor-header">
            <div className="editor-tabs">
              <button
                className={`tab ${language === 'python' ? 'active' : ''}`}
                onClick={() => handleLanguageChange('python')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                </svg>
                Python
              </button>
              <button
                className={`tab ${language === 'javascript' ? 'active' : ''}`}
                onClick={() => handleLanguageChange('javascript')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                </svg>
                JavaScript
              </button>
              <button
                className={`tab ${language === 'java' ? 'active' : ''}`}
                onClick={() => handleLanguageChange('java')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                </svg>
                Java
              </button>
              <button
                className={`tab ${language === 'cpp' ? 'active' : ''}`}
                onClick={() => handleLanguageChange('cpp')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                </svg>
                C++
              </button>
            </div>

            <div className="editor-actions">
              <button onClick={copyCode} className="action-btn" title="Copy Code">
                <svg className="action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              </button>
              <button onClick={downloadCode} className="action-btn" title="Download Code">
                <svg className="action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
              </button>
            </div>
          </div>

          <textarea
            className="code-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck="false"
          />

          {/* Voice Commands Help */}
          <div className="commands-help">
            <h4 className="help-title">Try these voice commands:</h4>
            <div className="commands-grid">
              <span className="command-chip">"Create function myFunc"</span>
              <span className="command-chip">"Add a for loop"</span>
              <span className="command-chip">"Print hello world"</span>
              <span className="command-chip">"Add if statement"</span>
              <span className="command-chip">"Comment this is a test"</span>
              <span className="command-chip">"Clear code"</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;