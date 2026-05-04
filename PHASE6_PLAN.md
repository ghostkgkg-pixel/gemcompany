# [Phase 6] Gem-Graph-Memory 구축 계획서 (승인됨)

이 문서는 Obsidian의 시각적 링크 기능과 Memento의 구조적 기억 기능을 융합하여, Gem Company 에이전트들의 장기적이고 유기적인 지식 체계를 구축하기 위한 공식 가이드입니다.

## 1. 아키텍처 개요
- **Backend (Memento Style)**: SQLite 기반의 Entity-Relation 그래프 DB 엔진.
- **Frontend (Obsidian Style)**: `react-force-graph-2d`를 활용한 인터랙티브 지식 시각화.
- **Agent Integration**: 작업 결과물을 노드와 관계(Link)로 자동 변환하여 저장.

## 2. 상세 데이터 모델
- **Entity (노드)**: Agent, File, Concept, Task.
- **Relation (관계)**: CREATED_BY, REFERENCES, OBSERVED.

## 3. 구축 단계
1. **[Backend]** `backend/memory_graph/` 모듈 구축 및 SQLite 연동.
2. **[Frontend]** `KnowledgeGraph.tsx` 시각화 컴포넌트 개발 및 통합.
3. **[Integration]** 에이전트의 작업 응답을 지식 그래프에 실시간으로 기록.

## 4. 최종 목표
- 에이전트가 과거의 협업 경험과 산출물 사이의 관계를 이해하고, 이를 바탕으로 더 지능적인 의사결정을 내리는 것.
