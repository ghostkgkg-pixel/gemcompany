import subprocess
import json
import re
import os

class GeminiConnector:
    """
    Gemini CLI를 통해 LLM과 통신하는 커넥터 클래스
    """
    def __init__(self, binary=None, default_model=None):
        if binary is None:
            # 환경별 gemini 실행 파일 경로 설정
            self.binary = "gemini"
            # 윈도우 환경 등에서의 폴백(Fallback) 경로
            self.fallback_binary = r"C:\Users\Wilo_Gun\AppData\Roaming\npm\gemini.cmd"
        else:
            self.binary = binary
            self.fallback_binary = None
        # 기본 모델 설정 (gemini-3.1-flash-lite-preview 등)
        self.default_model = default_model or os.getenv("GEMINI_FAST_MODEL", "gemini-3.1-flash-lite-preview")

    def _execute(self, args, input_data=None, model=None, cwd=None):
        """
        Gemini CLI 명령어를 실행하고 결과를 반환
        """
        if "-m" not in args:
            args = ["-m", model or self.default_model] + args

        def run_with_binary(binary):
            workspace_dir = cwd
            if workspace_dir is None:
                # 전용 워크스페이스 디렉토리 설정 (node_modules 스캔 방지 등)
                workspace_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cli_workspace")
                if not os.path.exists(workspace_dir):
                    os.makedirs(workspace_dir)

            # 서브프로세스를 통해 CLI 실행
            process = subprocess.Popen(
                [binary] + args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=workspace_dir # Crucial: prevents scanning node_modules, etc.
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

    def send_prompt(self, prompt: str, model=None, cwd=None) -> str:
        """
        단순 텍스트 프롬프트를 전송하고 노이즈가 제거된 응답 반환
        """
        # 입력을 UTF-8 바이트로 인코딩하여 전송
        stdout = self._execute(["-p", ""], input_data=prompt.encode('utf-8'), model=model, cwd=cwd)
        
        # Surgical removal of known CLI noise patterns
        patterns = [
            r"Warning:.*$",
            r"Error:.*$",
            r"INFO:.*$",
            r"MCP issues detected.*$",
            r"Run /mcp list for status.*$",
            r"Ripgrep is not available.*$",
            r"256-color support not detected.*$"
        ]
        
        cleaned = stdout
        for pattern in patterns:
            cleaned = re.sub(pattern, "", cleaned, flags=re.MULTILINE | re.IGNORECASE)
        
        return cleaned.strip()

    def send_prompt_json(self, prompt: str, model=None, cwd=None) -> dict:
        """
        LLM으로부터 JSON 형식의 응답을 받아 파싱하여 반환
        """
        # 입력을 UTF-8 바이트로 인코딩하여 전송
        stdout = self._execute(["-p", ""], input_data=prompt.encode('utf-8'), model=model, cwd=cwd)
        
        # 1. Try to find markdown JSON block first (most reliable)
        md_match = re.search(r'```(?:json)?\s*(\{.*\}|\[.*\])\s*```', stdout, re.DOTALL)
        if md_match:
            try:
                res = json.loads(md_match.group(1))
                if isinstance(res, dict): return res
            except json.JSONDecodeError:
                pass
        
        # 2. Try to find the LAST curly brace block in the entire output
        # (CLI often prepends warnings, so the actual JSON is usually at the end)
        all_json_blocks = re.findall(r'(\{[\s\S]*\})', stdout)
        if all_json_blocks:
            # Try from the last block backwards
            for block in reversed(all_json_blocks):
                try:
                    # Clean the block itself from potential trailing garbage
                    # Search for the last '}' and cut there
                    end_idx = block.rfind('}')
                    if end_idx != -1:
                        candidate = block[:end_idx+1]
                        res = json.loads(candidate)
                        if isinstance(res, dict): return res
                except json.JSONDecodeError:
                    continue
        
        # 3. Fallback to cleaned text search
        cleaned = self.send_prompt(prompt, model=model, cwd=cwd)
        json_match = re.search(r'(\{[\s\S]*\})', cleaned)
        if json_match:
            try:
                res = json.loads(json_match.group(1))
                if isinstance(res, dict): return res
            except json.JSONDecodeError:
                pass
        
        # Final Fallback: if no dict found, but we have a valid response, return as thought
        return {"thought": cleaned, "speech": "시스템 응답을 해석하는 데 문제가 발생했습니다.", "action": "Idle"}
