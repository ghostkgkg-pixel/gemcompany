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
                args = ["-m", "gemini-3.1-pro-preview"] + args
            
            # Use shell=True only if necessary, but here we try to be robust with encoding
            result = subprocess.run(
                [self.binary] + args,
                input=input_data,
                capture_output=True,
                text=True,
                check=True,
                encoding='utf-8', # Default to UTF-8
                errors='replace'   # Don't crash on decoding errors
            )
            return result.stdout
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
                # Same logic for fallback binary
                try:
                    result = subprocess.run(
                        [self.fallback_binary] + args,
                        input=input_data,
                        capture_output=True,
                        text=True,
                        check=True,
                        encoding='utf-8',
                        errors='replace'
                    )
                    return result.stdout
                except UnicodeDecodeError:
                    result = subprocess.run(
                        [self.fallback_binary] + args,
                        input=input_data,
                        capture_output=True,
                        text=True,
                        check=True,
                        encoding='cp949',
                        errors='replace'
                    )
                    return result.stdout
                except Exception as e2:
                    raise e2
            raise e

    def send_prompt(self, prompt: str) -> str:
        # Use -p "" and send the actual prompt via stdin to avoid Windows command line encoding issues.
        # This is the most robust way to handle non-ASCII characters on Windows CLI.
        stdout = self._execute(["-p", ""], input_data=prompt)
        # Clean up output - remove common agent warnings if they leaked to stdout
        # We use regex to remove them surgically as they might be on the same line as the response
        markers = [
            r"Warning: Windows 10 detected\..*?best experience\.",
            r"Ripgrep is not available\..*?GrepTool\.",
            r"MCP issues detected\..*?status\."
        ]
        clean_stdout = stdout
        for marker in markers:
            clean_stdout = re.sub(marker, "", clean_stdout, flags=re.DOTALL)
        
        return clean_stdout.strip()

    def send_prompt_json(self, prompt: str) -> dict:
        # Use -p "" and send the actual prompt via stdin to avoid Windows command line encoding issues.
        stdout = self._execute(["-p", ""], input_data=prompt)
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
