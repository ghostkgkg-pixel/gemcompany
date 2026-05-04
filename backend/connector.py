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
        try:
            if "-m" not in args:
                args = ["-m", "gemini-2.5-flash"] + args
            
            # Try to be robust with encoding. On Windows, the CLI might output CP949 or UTF-8.
            # We try UTF-8 first, then fallback.
            result = subprocess.run(
                [self.binary] + args,
                input=input_data,
                capture_output=True,
                text=False, # Use bytes to manually decode
                check=True
            )
            
            try:
                return result.stdout.decode('utf-8')
            except UnicodeDecodeError:
                return result.stdout.decode('cp949', errors='replace')
        except UnicodeDecodeError:
            # Fallback for Windows CP949 if UTF-8 fails
            result = subprocess.run(
                [self.binary] + args,
                input=input_data,
                capture_output=True,
                text=True,
                check=True,
                encoding='cp949',
                errors='replace'
            )
            return result.stdout
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            if self.fallback_binary and self.binary != self.fallback_binary:
                try:
                    result = subprocess.run(
                        [self.fallback_binary] + args,
                        input=input_data,
                        capture_output=True,
                        text=False,
                        check=True
                    )
                    try:
                        return result.stdout.decode('utf-8')
                    except UnicodeDecodeError:
                        return result.stdout.decode('cp949', errors='replace')
                except Exception as e2:
                    raise e2
            raise e

    def send_prompt(self, prompt: str) -> str:
        # Encode input as UTF-8 bytes for stdin
        stdout = self._execute(["-p", ""], input_data=prompt.encode('utf-8'))
        
        # Comprehensive cleanup of CLI noise
        lines = stdout.splitlines()
        clean_lines = []
        noise_keywords = ["detected", "experience", "Ripgrep", "MCP issues"]
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            # Skip lines that look like warnings or system messages
            if any(stripped.startswith(prefix) for prefix in ["Warning:", "Error:", "INFO:"]):
                continue
            if any(keyword in stripped for keyword in noise_keywords):
                continue
            clean_lines.append(line)
        
        return "\n".join(clean_lines).strip()

    def send_prompt_json(self, prompt: str) -> dict:
        # Encode input as UTF-8 bytes for stdin
        stdout = self._execute(["-p", ""], input_data=prompt.encode('utf-8'))
        # Find JSON block
        json_match = re.search(r'(\{.*\}|\[.*\])', stdout, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                raise ValueError(f"Failed to parse JSON from response: {stdout}")
        else:
            # Try parsing the whole thing if no block markers found
            try:
                # Remove warnings first
                cleaned = self.send_prompt(prompt)
                return json.loads(cleaned)
            except json.JSONDecodeError:
                raise ValueError(f"No valid JSON found in response: {stdout}")
