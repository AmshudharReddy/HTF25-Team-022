import { useState } from "react";

function App() {
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();
      setResponse(data.message || JSON.stringify(data));
    } catch (err) {
      console.error(err);
      setResponse("Error: Could not connect to backend.");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Command Sender</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter a command"
          style={{
            padding: "0.5rem",
            width: "300px",
            marginRight: "0.5rem",
          }}
        />
        <button type="submit" style={{ padding: "0.5rem 1rem" }}>
          Send
        </button>
      </form>

      <div style={{ marginTop: "1rem" }}>
        <h3>Response:</h3>
        <pre>{response}</pre>
      </div>
    </div>
  );
}

export default App;
