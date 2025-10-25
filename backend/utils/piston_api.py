import requests

PISTON_API_URL = "https://emkc.org/api/v2/piston/execute"

def execute_code(language: str, code: str, inputs: str = ""):
    """
    Executes code using Piston API and returns output, errors, and logs.
    Supports stdin input for programs requiring user input.
    """
    payload = {
        "language": language.lower(),
        "version": "*",  # Automatically use the latest version
        "files": [{"name": f"main.{get_file_extension(language)}", "content": code}],
        "stdin": inputs.strip() if inputs else ""  # Pass user input if provided
    }

    try:
        response = requests.post(PISTON_API_URL, json=payload, timeout=15)
        response.raise_for_status()
        data = response.json()

        run_data = data.get("run", {})

        return {
            "stdout": run_data.get("stdout", ""),
            "stderr": run_data.get("stderr", ""),
            "output": run_data.get("output", ""),
            "code": run_data.get("code", 0),
            "logs": f"Execution successful for {language}"
        }

    except requests.exceptions.RequestException as e:
        return {"error": f"API request failed: {e}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}


def get_file_extension(language: str) -> str:
    """
    Maps language names to common file extensions for better handling.
    """
    mapping = {
        "python": "py",
        "cpp": "cpp",
        "c": "c",
        "java": "java",
        "javascript": "js",
        "go": "go",
        "rust": "rs"
    }
    return mapping.get(language.lower(), "txt")
