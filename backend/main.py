from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from utils.piston_api import execute_code

app = FastAPI(
    title="Voice-Enabled Code Assistant API",
    description="Backend API to execute and debug code using Piston API",
    version="1.1"
)

# Request model
class CodeRequest(BaseModel):
    language: str
    code: str
    inputs: str = ""  # optional user input (stdin)

@app.get("/")
def root():
    return {"message": "Voice Code Assistant API is running 🚀"}

@app.post("/run")
def run_code(req: CodeRequest):
    """
    Execute user code in various languages (Python, C++, JS, etc.) with optional user input.
    """
    result = execute_code(req.language, req.code, req.inputs)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    return {
        "language": req.language,
        "stdout": result.get("stdout", ""),
        "stderr": result.get("stderr", ""),
        "output": result.get("output", ""),
        "exit_code": result.get("code", 0),
        "logs": result.get("logs", "Execution complete.")
    }
