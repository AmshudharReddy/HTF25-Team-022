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
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const name = localStorage.getItem('userName');
    setUserName(name || 'User');

    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
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

        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
          processVoiceCommand(finalTranscript.trim());
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
    }
  }, []);

  const processVoiceCommand = (command) => {
    setIsProcessing(true);
    const lowerCommand = command.toLowerCase();

    // Add to command history
    setCommandHistory(prev => [...prev, { command, timestamp: new Date() }].slice(-5));

    // Simple command processing
    let newCode = code;

    if (lowerCommand.includes('create function') || lowerCommand.includes('define function')) {
      const functionName = extractName(lowerCommand, 'function') || 'myFunction';
      if (language === 'python') {
        newCode += `\n\ndef ${functionName}():\n    pass\n`;
      } else if (language === 'javascript') {
        newCode += `\n\nfunction ${functionName}() {\n    // TODO\n}\n`;
      }
    } else if (lowerCommand.includes('for loop')) {
      if (language === 'python') {
        newCode += `\n\nfor i in range(10):\n    print(i)\n`;
      } else if (language === 'javascript') {
        newCode += `\n\nfor (let i = 0; i < 10; i++) {\n    console.log(i);\n}\n`;
      }
    } else if (lowerCommand.includes('print') || lowerCommand.includes('console log')) {
      const message = extractQuotedText(lowerCommand) || 'Hello World';
      if (language === 'python') {
        newCode += `\nprint("${message}")\n`;
      } else if (language === 'javascript') {
        newCode += `\nconsole.log("${message}");\n`;
      }
    } else if (lowerCommand.includes('comment')) {
      const comment = lowerCommand.replace(/.*comment\s*/i, '');
      if (language === 'python') {
        newCode += `\n# ${comment}\n`;
      } else if (language === 'javascript') {
        newCode += `\n// ${comment}\n`;
      }
    } else if (lowerCommand.includes('clear') || lowerCommand.includes('reset')) {
      newCode = '# Code cleared\n';
    } else if (lowerCommand.includes('if statement')) {
      if (language === 'python') {
        newCode += `\n\nif condition:\n    pass\n`;
      } else if (language === 'javascript') {
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
      setIsRecording(true);
      setTranscript('');
      recognitionRef.current.start();
    } else {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
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
    const extension = language === 'python' ? 'py' : 'js';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voicecode.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
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
                onClick={() => setLanguage('python')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                </svg>
                Python
              </button>
              <button 
                className={`tab ${language === 'javascript' ? 'active' : ''}`}
                onClick={() => setLanguage('javascript')}
              >
                <svg className="tab-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
                </svg>
                JavaScript
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