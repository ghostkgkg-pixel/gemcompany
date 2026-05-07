import heapq

class AStar:
    """
    A* 길찾기 알고리즘 클래스
    그리드 기반의 맵에서 최적의 경로를 탐색함
    """
    def __init__(self, width, height, obstacles):
        self.width = width
        self.height = height
        self.obstacles = set(obstacles) # 장애물 좌표 (x, y) 튜플 세트

    def heuristic(self, a, b):
        """
        두 지점 사이의 예상 거리 계산 (Manhattan distance)
        """
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def get_neighbors(self, node):
        """
        현재 위치에서 이동 가능한 인접 타일 목록 반환
        """
        (x, y) = node
        # 상하좌우 4방향 탐색
        results = [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]
        # 맵 경계 내에 있고 장애물이 없는 타일만 필터링
        results = [
            (nx, ny) for (nx, ny) in results 
            if 0 <= nx < self.width and 0 <= ny < self.height and (nx, ny) not in self.obstacles
        ]
        return results

    def find_path(self, start, goal):
        """
        시작 지점에서 목표 지점까지의 최단 경로 탐색
        """
        if start == goal:
            return [start]
        if goal in self.obstacles:
            return None # 목표 지점이 장애물인 경우 경로 없음

        frontier = []
        heapq.heappush(frontier, (0, start)) # 우선순위 큐 초기화
        came_from = {start: None}           # 경로 역추적용 딕셔너리
        cost_so_far = {start: 0}            # 시작점에서 현재까지의 실제 이동 비용

        while frontier:
            current = heapq.heappop(frontier)[1]

            if current == goal:
                break # 목표 도달

            for next_node in self.get_neighbors(current):
                new_cost = cost_so_far[current] + 1
                # 새로운 경로가 기존보다 효율적인 경우 업데이트
                if next_node not in cost_so_far or new_cost < cost_so_far[next_node]:
                    cost_so_far[next_node] = new_cost
                    priority = new_cost + self.heuristic(goal, next_node)
                    heapq.heappush(frontier, (priority, next_node))
                    came_from[next_node] = current

        if goal not in came_from:
            return None # 경로를 찾을 수 없는 경우

        # 역추적을 통한 경로 재구성
        path = []
        current = goal
        while current != start:
            path.append(current)
            current = came_from[current]
        path.reverse()
        return path
