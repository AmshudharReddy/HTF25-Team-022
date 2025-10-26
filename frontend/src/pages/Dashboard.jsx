import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [code, setCode] = useState(
    '# Start coding with your voice!\nname = input("Enter your name: ")\nprint(f"Hello, {name}!")'
  );
  const [language, setLanguage] = useState("python");
  const [commandHistory, setCommandHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [currentInput, setCurrentInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [inputQueue, setInputQueue] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const languageRef = useRef("python");
  const codeRef = useRef(code);

  const initialCodeSnippets = {
    python:
      '# Start coding with your voice!\nname = input("Enter your name: ")\nprint(f"Hello, {name}!")',
    javascript:
      '// Start coding with your voice!\nconsole.log("Hello World!");',
    java: 'import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        System.out.print("Enter your name: ");\n        String name = scanner.nextLine();\n        System.out.println("Hello, " + name + "!");\n        scanner.close();\n    }\n}',
    cpp: '#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string name;\n    cout << "Enter your name: ";\n    getline(cin, name);\n    cout << "Hello, " << name << "!" << endl;\n    return 0;\n}',
  };

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalHistory]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (awaitingInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [awaitingInput]);

  useEffect(() => {
    if (isChatOpen && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [isChatOpen]);

  useEffect(() => {
    const name = localStorage.getItem("userName");
    setUserName(name || "User");

    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(interimTranscript || finalTranscript);

        if (finalTranscript) {
          const lowerTranscript = finalTranscript.toLowerCase().trim();
          const currentLang = languageRef.current;
          const currentCode = codeRef.current;

          if (
            lowerTranscript.includes("debug") ||
            lowerTranscript.includes("fix") ||
            lowerTranscript.includes("error")
          ) {
            let errorDesc = finalTranscript;
            if (lowerTranscript.includes("debug")) {
              errorDesc = finalTranscript.replace(/debug/i, "").trim();
            } else if (lowerTranscript.includes("fix")) {
              errorDesc = finalTranscript.replace(/fix/i, "").trim();
            } else if (lowerTranscript.includes("error")) {
              errorDesc = finalTranscript.replace(/error/i, "").trim();
            }
            errorDesc = errorDesc || "Fix any errors in the code";
            debugCode(errorDesc, currentLang, currentCode);
            return;
          }

          generateCode(finalTranscript.trim(), currentLang).catch((err) => {
            processVoiceCommand(finalTranscript.trim(), currentLang);
          });
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const debugCode = async (errorDescription, currentLanguage, currentCode) => {
    if (!currentCode || !errorDescription) {
      addToTerminal(
        "Error: No code or description provided for debugging.",
        "error"
      );
      return;
    }

    try {
      setIsProcessing(true);
      addToTerminal(
        "🔍 Debugging code... (Error: " + errorDescription + ")",
        "system"
      );

      const res = await fetch("http://localhost:5000/api/debug-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          errorDescription,
          language: currentLanguage,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error("Server error: " + res.status + " - " + errorText);
      }

      const data = await res.json();

      if (data && data.fixedCode) {
        setCode(data.fixedCode);
        addToTerminal("✅ Debugging complete! Fixed code applied.", "success");
        addToTerminal("─".repeat(60), "divider");
        setCommandHistory((prev) =>
          [
            ...prev,
            { command: "Debug: " + errorDescription, timestamp: new Date() },
          ].slice(-5)
        );
      } else {
        throw new Error("No fixed code returned from server");
      }
    } catch (err) {
      console.error("debugCode error:", err);
      addToTerminal("❌ Debugging failed: " + err.message, "error");
      addToTerminal("─".repeat(60), "divider");
      addToTerminal(
        '💡 Tip: Run the code to see the exact error, then describe it (e.g., "fix the NameError").',
        "system"
      );
    } finally {
      setTimeout(() => setIsProcessing(false), 300);
    }
  };

  const addToTerminal = (content, type = "output") => {
    setTerminalHistory((prev) => [
      ...prev,
      { content, type, timestamp: Date.now() },
    ]);
  };

  const generateCode = async (prompt, currentLanguage) => {
    if (!prompt) return;

    try {
      setIsProcessing(true);
      const res = await fetch("http://localhost:5000/api/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language: currentLanguage }),
      });

      if (!res.ok) throw new Error("Server error: " + res.status);

      const data = await res.json();
      if (data && data.code) {
        setCode((prev) =>
          prev && !prev.endsWith("\n") ? prev + "\n\n" + data.code : data.code
        );
        setCommandHistory((prev) =>
          [...prev, { command: prompt, timestamp: new Date() }].slice(-5)
        );
      }
    } catch (err) {
      console.error("generateCode error:", err);
      throw err;
    } finally {
      setTimeout(() => setIsProcessing(false), 300);
    }
  };

  const processVoiceCommand = (command, currentLanguage) => {
    setIsProcessing(true);
    const lowerCommand = command.toLowerCase();
    setCommandHistory((prev) =>
      [...prev, { command, timestamp: new Date() }].slice(-5)
    );

    let newCode = code;

    if (lowerCommand.includes("run code") || lowerCommand.includes("execute")) {
      executeCode();
      setIsProcessing(false);
      return;
    }

    if (lowerCommand.includes("clear terminal")) {
      setTerminalHistory([]);
      setIsProcessing(false);
      return;
    }

    if (
      lowerCommand.includes("create function") ||
      lowerCommand.includes("define function")
    ) {
      const functionName =
        extractName(lowerCommand, "function") || "myFunction";
      if (currentLanguage === "python") {
        newCode += "\n\ndef " + functionName + "():\n    pass\n";
      } else if (currentLanguage === "javascript") {
        newCode += "\n\nfunction " + functionName + "() {\n    // TODO\n}\n";
      } else if (currentLanguage === "java") {
        newCode += "\n\npublic void " + functionName + "() {\n    // TODO\n}\n";
      } else if (currentLanguage === "cpp") {
        newCode += "\n\nvoid " + functionName + "() {\n    // TODO\n}\n";
      }
    } else if (lowerCommand.includes("for loop")) {
      if (currentLanguage === "python") {
        newCode += "\n\nfor i in range(10):\n    print(i)\n";
      } else if (currentLanguage === "javascript") {
        newCode +=
          "\n\nfor (let i = 0; i < 10; i++) {\n    console.log(i);\n}\n";
      } else if (currentLanguage === "java") {
        newCode +=
          "\n\nfor (int i = 0; i < 10; i++) {\n    System.out.println(i);\n}\n";
      } else if (currentLanguage === "cpp") {
        newCode +=
          "\n\nfor (int i = 0; i < 10; i++) {\n    std::cout << i << std::endl;\n}\n";
      }
    } else if (
      lowerCommand.includes("print") ||
      lowerCommand.includes("console log")
    ) {
      const message = extractQuotedText(lowerCommand) || "Hello World";
      if (currentLanguage === "python") {
        newCode += '\nprint("' + message + '")\n';
      } else if (currentLanguage === "javascript") {
        newCode += '\nconsole.log("' + message + '");\n';
      } else if (currentLanguage === "java") {
        newCode += '\nSystem.out.println("' + message + '");\n';
      } else if (currentLanguage === "cpp") {
        newCode += '\nstd::cout << "' + message + '" << std::endl;\n';
      }
    } else if (lowerCommand.includes("comment")) {
      const comment = lowerCommand.replace(/.*comment\s*/i, "");
      if (currentLanguage === "python") {
        newCode += "\n# " + comment + "\n";
      } else {
        newCode += "\n// " + comment + "\n";
      }
    } else if (
      lowerCommand.includes("clear") ||
      lowerCommand.includes("reset")
    ) {
      newCode = initialCodeSnippets[currentLanguage];
    } else if (lowerCommand.includes("if statement")) {
      if (currentLanguage === "python") {
        newCode += "\n\nif condition:\n    pass\n";
      } else if (currentLanguage === "javascript") {
        newCode += "\n\nif (condition) {\n    // TODO\n}\n";
      } else if (currentLanguage === "java") {
        newCode += "\n\nif (condition) {\n    // TODO\n}\n";
      } else if (currentLanguage === "cpp") {
        newCode += "\n\nif (condition) {\n    // TODO\n}\n";
      }
    }

    setCode(newCode);
    setTimeout(() => setIsProcessing(false), 500);
  };

  const extractName = (text, keyword) => {
    const regex = new RegExp(keyword + "\\s+(\\w+)", "i");
    const match = text.match(regex);
    return match ? match[1] : null;
  };

  const extractQuotedText = (text) => {
    const match = text.match(/"([^"]*)"/);
    return match ? match[1] : null;
  };

  const executeCode = async () => {
    setIsExecuting(true);
    setAwaitingInput(false);
    setCurrentInput("");
    setInputQueue([]);

    addToTerminal("$ Running " + language + " code...", "system");
    addToTerminal("─".repeat(60), "divider");

    const requiresInput =
      code.includes("input(") ||
      code.includes("scanf") ||
      code.includes("Scanner") ||
      code.includes("cin >>") ||
      code.includes("getline");

    if (requiresInput) {
      if (language === "python" && code.includes("input(")) {
        const match = code.match(/input\(["'](.+?)["']\)/);
        const prompt = match ? match[1] : "Enter input:";
        addToTerminal(prompt + " ", "prompt");
      } else if (language === "java" && code.includes("Scanner")) {
        addToTerminal("Enter input: ", "prompt");
      } else if (
        language === "cpp" &&
        (code.includes("cin") || code.includes("getline"))
      ) {
        addToTerminal("Enter input: ", "prompt");
      } else {
        addToTerminal("Enter input: ", "prompt");
      }
      setAwaitingInput(true);
      setIsExecuting(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code,
          inputs: "",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.success) {
          const outputText =
            result.output ||
            result.stdout ||
            "Program executed successfully with no output.";
          addToTerminal(outputText, "output");
          addToTerminal("─".repeat(60), "divider");
          addToTerminal(
            "✓ Execution completed successfully (exit code: " +
              result.exitCode +
              ")",
            "success"
          );
        } else {
          const errorText =
            result.stderr || result.output || "Execution failed";
          addToTerminal(errorText, "error");
          addToTerminal("─".repeat(60), "divider");
          addToTerminal(
            "✗ Execution failed (exit code: " + result.exitCode + ")",
            "error"
          );
        }
      } else {
        addToTerminal(result.error || "Failed to execute code", "error");
        addToTerminal("─".repeat(60), "divider");
        addToTerminal("✗ Execution failed", "error");
      }
    } catch (err) {
      addToTerminal("Network error: " + err.message, "error");
      addToTerminal("─".repeat(60), "divider");
      addToTerminal("✗ Execution failed", "error");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTerminalInput = async (e) => {
    if (e.key === "Enter" && awaitingInput && currentInput.trim()) {
      e.preventDefault();
      const input = currentInput.trim();

      addToTerminal(input, "input");

      const newInputQueue = [...inputQueue, input];
      setInputQueue(newInputQueue);

      setCurrentInput("");
      setAwaitingInput(false);

      await executeWithInputs(newInputQueue);
    }
  };

  const executeWithInputs = async (allInputs) => {
    setIsExecuting(true);

    const inputString = allInputs.join("\n");

    addToTerminal("⏳ Processing...", "system");

    try {
      const response = await fetch("http://localhost:5000/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code,
          inputs: inputString,
        }),
      });

      const result = await response.json();

      setTerminalHistory((prev) =>
        prev.filter((entry) => entry.content !== "⏳ Processing...")
      );

      if (response.ok) {
        const inputCount =
          (code.match(/input\(/g) || []).length +
          (code.match(/Scanner.*nextLine/g) || []).length +
          (code.match(/cin\s*>>/g) || []).length +
          (code.match(/getline/g) || []).length;

        if (allInputs.length < inputCount) {
          addToTerminal("Enter next input: ", "prompt");
          setAwaitingInput(true);
          setIsExecuting(false);
        } else {
          if (result.success) {
            const outputText =
              result.output ||
              result.stdout ||
              "Program executed successfully.";
            addToTerminal(outputText, "output");
            addToTerminal("─".repeat(60), "divider");
            addToTerminal(
              "✓ Execution completed successfully (exit code: " +
                result.exitCode +
                ")",
              "success"
            );
          } else {
            const errorText =
              result.stderr || result.output || "Execution failed";
            addToTerminal(errorText, "error");
            addToTerminal("─".repeat(60), "divider");
            addToTerminal(
              "✗ Execution failed (exit code: " + result.exitCode + ")",
              "error"
            );
          }
          setIsExecuting(false);
        }
      } else {
        addToTerminal(result.error || "Failed to execute code", "error");
        addToTerminal("─".repeat(60), "divider");
        addToTerminal("✗ Execution failed", "error");
        setIsExecuting(false);
      }
    } catch (err) {
      setTerminalHistory((prev) =>
        prev.filter((entry) => entry.content !== "⏳ Processing...")
      );
      addToTerminal("Runtime Error: " + err.message, "error");
      addToTerminal("─".repeat(60), "divider");
      addToTerminal("✗ Execution failed", "error");
      setIsExecuting(false);
    }
  };

  const startRecording = () => {
    if (recognitionRef.current) {
      setIsRecording(true);
      setTranscript("");
      recognitionRef.current.start();
    } else {
      alert(
        "Speech recognition is not supported in your browser. Please use Chrome or Edge."
      );
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      setIsRecording(false);
      recognitionRef.current.stop();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    navigate("/login");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    addToTerminal("✓ Code copied to clipboard!", "system");
  };

  const downloadCode = () => {
    const extension =
      language === "python"
        ? "py"
        : language === "javascript"
        ? "js"
        : language === "java"
        ? "java"
        : "cpp";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voicecode." + extension;
    a.click();
    URL.revokeObjectURL(url);
    addToTerminal("✓ Downloaded as voicecode." + extension, "system");
  };

  const clearTerminal = () => {
    setTerminalHistory([]);
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setCode(initialCodeSnippets[newLanguage]);
    setTerminalHistory([]);
    setInputQueue([]);
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setTimeout(() => {
        recognitionRef.current.start();
      }, 100);
    }
  };

  const handleChatSubmit = async (e) => {
    if (e.key === "Enter" && chatInput.trim()) {
      e.preventDefault();
      const userMessage = chatInput.trim();
      setChatMessages((prev) => [
        ...prev,
        { text: userMessage, type: "user", timestamp: Date.now() },
      ]);
      setChatInput("");

      try {
        const res = await fetch("http://localhost:5000/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, language, code }), // Include code in the request
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            "Chat server error: " + res.status + " - " + errorText
          );
        }

        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          { text: data.response, type: "bot", timestamp: Date.now() },
        ]);
      } catch (err) {
        console.error("Chat error:", err);
        setChatMessages((prev) => [
          ...prev,
          {
            text: "Error: " + err.message,
            type: "error",
            timestamp: Date.now(),
          },
        ]);
      }
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <svg
              className="logo-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              ></path>
            </svg>
            <h1 className="logo-title">VoiceCode Terminal</h1>
          </div>

          <div className="user-section">
            <span className="welcome-text">Welcome, {userName}!</span>
            <button onClick={handleLogout} className="logout-btn">
              <svg
                className="btn-icon"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                ></path>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="voice-control-panel">
          <div className="control-header">
            <h2 className="control-title">Voice Assistant</h2>
            <div className="status-indicator">
              <span
                className={"status-dot " + (isRecording ? "recording" : "")}
              ></span>
              <span className="status-text">
                {isRecording
                  ? "Listening..."
                  : isProcessing
                  ? "Processing..."
                  : "Ready"}
              </span>
            </div>
          </div>

          <div className="recording-section">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={"record-btn " + (isRecording ? "recording" : "")}
            >
              <svg
                className="mic-icon-large"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                ></path>
              </svg>
              <span className="record-text">
                {isRecording ? "Stop Recording" : "Start Voice Command"}
              </span>
            </button>
          </div>

          <div className="transcript-box">
            <div className="transcript-label">Live Transcript:</div>
            <div className="transcript-content">
              {transcript || "Your voice commands will appear here..."}
            </div>
          </div>

          <div className="command-history">
            <h3 className="history-title">Recent Commands</h3>
            <div className="history-list">
              {commandHistory.length > 0 ? (
                commandHistory.map((item, index) => (
                  <div key={index} className="history-item">
                    <svg
                      className="check-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    <span>{item.command}</span>
                  </div>
                ))
              ) : (
                <p className="history-empty">
                  No commands yet. Start speaking!
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="code-editor-section">
          <div className="editor-header">
            <div className="editor-tabs">
              {["python", "javascript", "java", "cpp"].map((lang) => (
                <button
                  key={lang}
                  className={"tab " + (language === lang ? "active" : "")}
                  onClick={() => handleLanguageChange(lang)}
                >
                  <svg
                    className="tab-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    ></path>
                  </svg>
                  {lang === "cpp"
                    ? "C++"
                    : lang.charAt(0).toUpperCase() + lang.slice(1)}
                </button>
              ))}
            </div>

            <div className="editor-actions">
              <button
                onClick={executeCode}
                className="run-btn"
                disabled={isExecuting || awaitingInput}
                title="Run Code"
              >
                <svg
                  className="action-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  ></path>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                {isExecuting ? "Running..." : "Run"}
              </button>
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="action-btn"
                title="Open Chat"
              >
                <svg
                  className="action-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  ></path>
                </svg>
              </button>
              <button
                onClick={copyCode}
                className="action-btn"
                title="Copy Code"
              >
                <svg
                  className="action-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  ></path>
                </svg>
              </button>
              <button
                onClick={downloadCode}
                className="action-btn"
                title="Download Code"
              >
                <svg
                  className="action-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  ></path>
                </svg>
              </button>
            </div>
          </div>

          <div className="editor-workspace">
            <textarea
              className="code-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck="false"
              placeholder="Write your code here or use voice commands..."
            />

            <div className="terminal-output-panel">
              <div className="terminal-header">
                <h3 className="terminal-title">
                  <svg
                    className="terminal-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    ></path>
                  </svg>
                  Terminal
                  {awaitingInput && (
                    <span className="awaiting-input-badge">
                      (waiting for input)
                    </span>
                  )}
                </h3>
                {terminalHistory.length > 0 && (
                  <button
                    onClick={clearTerminal}
                    className="clear-terminal-btn"
                    title="Clear Terminal"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="terminal-content">
                {terminalHistory.length === 0 && !isExecuting ? (
                  <div className="terminal-empty">
                    <svg
                      className="empty-terminal-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                    <p className="empty-terminal-text">
                      Terminal ready. Click "Run" to execute your code.
                    </p>
                    <p className="empty-terminal-subtext">
                      Input will be requested here when needed
                    </p>
                  </div>
                ) : (
                  <>
                    {terminalHistory.map((entry, index) => (
                      <div
                        key={index}
                        className={"terminal-line terminal-" + entry.type}
                      >
                        {entry.type === "prompt" && (
                          <span className="terminal-prompt-arrow">› </span>
                        )}
                        {entry.type === "system" &&
                        entry.content === "⏳ Processing..." ? (
                          <span className="processing-indicator">
                            <span className="spinner-small"></span>
                            {entry.content}
                          </span>
                        ) : (
                          entry.content
                        )}
                      </div>
                    ))}
                    {awaitingInput && (
                      <div className="terminal-input-line">
                        <span className="terminal-input-arrow">› </span>
                        <input
                          ref={inputRef}
                          type="text"
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          onKeyPress={handleTerminalInput}
                          className="terminal-input-field"
                          placeholder="Type input and press Enter..."
                          autoFocus
                        />
                      </div>
                    )}
                    <div ref={terminalEndRef} />
                  </>
                )}
              </div>
            </div>
          </div>

          {isChatOpen && (
            <div className="chat-popup">
              <div className="chat-header">
                <h3 className="chat-title">
                  <svg
                    className="chat-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    ></path>
                  </svg>
                  Code Assistant
                </h3>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="close-chat-btn"
                  title="Close Chat"
                >
                  <svg
                    className="action-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>
              <div className="chat-content">
                {chatMessages.length === 0 ? (
                  <div className="chat-empty">
                    <p>Ask me anything about your code!</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`chat-message chat-${msg.type}`}
                    >
                      <div className="chat-bubble">
                        {msg.text.split("\n").map((line, i) => {
                          // Handle bullet points starting with '*'
                          if (line.trim().startsWith("*")) {
                            const content = line.replace(/^\*\s*/, "").trim();
                            const parts = content
                              .split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/)
                              .map((part, j) => {
                                if (
                                  part.startsWith("**") &&
                                  part.endsWith("**")
                                ) {
                                  return (
                                    <strong key={j}>{part.slice(2, -2)}</strong>
                                  );
                                } else if (
                                  part.startsWith("`") &&
                                  part.endsWith("`")
                                ) {
                                  return (
                                    <code key={j} className="inline-code">
                                      {part.slice(1, -1)}
                                    </code>
                                  );
                                } else if (
                                  part.startsWith("_") &&
                                  part.endsWith("_")
                                ) {
                                  return <em key={j}>{part.slice(1, -1)}</em>;
                                }
                                return part;
                              });
                            return (
                              <div key={i} className="chat-bullet">
                                <span className="bullet-point">•</span>
                                <span className="bullet-content">{parts}</span>
                              </div>
                            );
                          }
                          // Handle standalone code blocks
                          if (line.trim().startsWith("```")) {
                            const codeLines = [];
                            let j = i + 1;
                            while (
                              j < msg.text.split("\n").length &&
                              !msg.text.split("\n")[j].trim().endsWith("```")
                            ) {
                              codeLines.push(msg.text.split("\n")[j]);
                              j++;
                            }
                            i = j; // Skip past the code block
                            return (
                              <pre key={i} className="code-block">
                                <code>{codeLines.join("\n")}</code>
                              </pre>
                            );
                          }
                          // Handle regular text with bold and inline code
                          const parts = line
                            .split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/)
                            .map((part, j) => {
                              if (
                                part.startsWith("**") &&
                                part.endsWith("**")
                              ) {
                                return (
                                  <strong key={j}>{part.slice(2, -2)}</strong>
                                );
                              } else if (
                                part.startsWith("`") &&
                                part.endsWith("`")
                              ) {
                                return (
                                  <code key={j} className="inline-code">
                                    {part.slice(1, -1)}
                                  </code>
                                );
                              } else if (
                                part.startsWith("_") &&
                                part.endsWith("_")
                              ) {
                                return <em key={j}>{part.slice(1, -1)}</em>;
                              }
                              return part;
                            });
                          return (
                            <p key={i} className="chat-text">
                              {parts}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-line">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleChatSubmit}
                  className="chat-input-field"
                  placeholder="Type your question..."
                />
              </div>
            </div>
          )}

          <div className="commands-help">
            <h4 className="help-title">Try these voice commands:</h4>
            <div className="commands-grid">
              <span className="command-chip">"Create function myFunc"</span>
              <span className="command-chip">"Add a for loop"</span>
              <span className="command-chip">"Print hello world"</span>
              <span className="command-chip">"Add if statement"</span>
              <span className="command-chip">"Run code"</span>
              <span className="command-chip">"Clear terminal"</span>
              <span className="command-chip">"Debug [error description]"</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
