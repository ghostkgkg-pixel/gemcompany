from connector import GeminiConnector
import json

class PersonaManager:
    """
    에이전트의 성격(페르소나)과 능력치를 관리하는 클래스
    """
    def __init__(self, connector=None):
        self.connector = connector or GeminiConnector()
        # 에이전트의 4가지 핵심 능력치 키
        self.stats_keys = ["Intelligence", "Creativity", "Efficiency", "Social"]

    def analyze_persona(self, description: str) -> dict:
        """
        자연어 설명을 분석하여 이름과 능력치 정보가 담긴 JSON 객체 반환
        """
        prompt = (
            f"다음 페르소나 설명을 분석해주세요: \"{description}\".\n"
            f"1. 이름(Name): 설명에 이름이 있으면 추출하고, 없으면 자연스럽고 어울리는 이름을 생성하세요. "
            f"설명이 한국어면 한국어 이름을, 영어면 영어 이름을 생성하세요.\n"
            f"2. 점수(Scores): 지능(Intelligence), 창의성(Creativity), 효율성(Efficiency), 사교성(Social) 점수를 1-10 사이로 부여하세요.\n"
            "반드시 다음 키를 가진 JSON 객체만 반환하세요: 'Name', 'Intelligence', 'Creativity', 'Efficiency', 'Social'. "
            "이름은 특수문자 없이 깨끗한 문자열이어야 합니다."
        )
        try:
            # LLM으로부터 JSON 응답 수신
            result = self.connector.send_prompt_json(prompt)
            
            # 이름 데이터 정제 (리스트나 딕셔너리로 올 경우 대비)
            raw_name = result.get("Name", "Unknown Agent")
            if isinstance(raw_name, list) and len(raw_name) > 0:
                raw_name = str(raw_name[0])
            elif isinstance(raw_name, dict):
                raw_name = str(next(iter(raw_name.values())))
            
            sanitized_result = {
                "Name": str(raw_name).strip()
            }
            
            # 능력치 값 검증 및 범위 제한 (1-10)
            for key in self.stats_keys:
                val = result.get(key, 5)
                if isinstance(val, (int, float)):
                    sanitized_result[key] = max(1, min(10, int(val)))
                else:
                    sanitized_result[key] = 5
            return sanitized_result
        except Exception as e:
            # 분석 실패 시 기본값(폴백) 반환
            print(f"페르소나 분석 오류: {e}")
            fallback = {key: 5 for key in self.stats_keys}
            fallback["Name"] = "신입 요원"
            return fallback

    def recommend_tools(self, stats: dict) -> list:
        """
        에이전트의 능력치에 기반하여 적합한 도구(Tool) 추천
        """
        recommendations = []
        
        # 창의성이나 지능이 높으면 코드 실행 및 웹 검색 추천
        if stats.get("Creativity", 0) >= 7 or stats.get("Intelligence", 0) >= 7:
            recommendations.append("Code Execution")
            recommendations.append("Web Search")
        
        # 효율성이 높으면 파일 관리 도구 추천
        if stats.get("Efficiency", 0) >= 7:
            recommendations.append("File Management")
            
        # 사교성이 높으면 커뮤니케이션 도구 추천
        if stats.get("Social", 0) >= 7:
            recommendations.append("Email & Communication")

        # 추천 도구가 없을 경우의 기본 도구
        if not recommendations:
            recommendations = ["Web Search", "Note Taking"]
            
        return list(set(recommendations))
