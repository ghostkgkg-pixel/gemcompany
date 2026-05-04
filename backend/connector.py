import subprocess
import json
import re
import os

class GeminiConnector:
    def __init__(self, binary=None):
        if binary is None:
            # Try to find gemini in common locations or use default
            self.binary = "gemini"
            # Hardcoded absolute path for this specific environment as a fallback
            self.fallback_binary = r"C:\Users\Wilo_Gun\AppData\Roaming\npm\gemini.cmd"
        else:
            self.binary = binary
            self.fallback_binary = None

    def _execute(self, args, input_data=None):
        if "-m" not in args:
            args = ["-m", "gemini-2.5-flash"] + args

        def run_with_binary(binary):
            # Using Popen to allow future real-time streaming capabilities
            process = subprocess.Popen(
                [binary] + args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            stdout_bytes, stderr_bytes = process.communicate(input=input_data)
            
            if process.returncode != 0:
                raise subprocess.CalledProcessError(
                    process.returncode, 
                    [binary] + args, 
                    output=stdout_bytes, 
                    stderr=stderr_bytes
                )
                
            try:
                return stdout_bytes.decode('utf-8')
            except UnicodeDecodeError:
                return stdout_bytes.decode('cp949', errors='replace')

        try:
            return run_with_binary(self.binary)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            if self.fallback_binary and self.binary != self.fallback_binary:
                try:
                    return run_with_binary(self.fallback_binary)
                except Exception as e2:
                    raise e2
            raise e

    def send_prompt(self, prompt: str) -> str:
        # Encode input as UTF-8 bytes for stdin
        stdout = self._execute(["-p", ""], input_data=prompt.encode('utf-8'))
        
        # Surgical removal of known CLI noise patterns
        patterns = [
            r"^Warning:.*$",
            r"^Error:.*$",
            r"^INFO:.*$",
            r"^MCP issues detected.*$",
            r"^Ripgrep is not available.*$",
            r"^256-color support not detected.*$"
        ]
        
        cleaned = stdout
        for pattern in patterns:
            cleaned = re.sub(pattern, "", cleaned, flags=re.MULTILINE | re.IGNORECASE)
        
        return cleaned.strip()

    def send_prompt_json(self, prompt: str) -> dict:
        # Encode input as UTF-8 bytes for stdin
        stdout = self._execute(["-p", ""], input_data=prompt.encode('utf-8'))
        
        # 1. Try to find markdown JSON block first (most reliable)
        md_match = re.search(r'```json\s*(\{.*\}|\[.*\])\s*```', stdout, re.DOTALL)
        if md_match:
            try:
                res = json.loads(md_match.group(1))
                if isinstance(res, dict): return res
            except json.JSONDecodeError:
                pass
        
        # 2. Try to find any JSON-like block in cleaned output
        cleaned = self.send_prompt(prompt)
        # Try greedy match first
        json_match = re.search(r'(\{.*\}|\[.*\])', cleaned, re.DOTALL)
        if json_match:
            try:
                res = json.loads(json_match.group(1))
                if isinstance(res, dict): return res
            except json.JSONDecodeError:
                # If greedy fails, try non-greedy candidates
                candidates = re.findall(r'(\{.*?\}|\[.*?\])', cleaned, re.DOTALL)
                for cand in candidates:
                    try:
                        res = json.loads(cand)
                        if isinstance(res, dict): return res
                    except json.JSONDecodeError:
                        continue
        
        # Fallback: if no dict found, but we have a valid response, return as thought
        return {"thought": cleaned, "speech": "시스템 응답을 해석하는 데 문제가 발생했습니다.", "action": "Idle"}
