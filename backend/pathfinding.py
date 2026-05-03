import heapq

class AStar:
    def __init__(self, width, height, obstacles):
        self.width = width
        self.height = height
        self.obstacles = set(obstacles) # List of (x, y) tuples

    def heuristic(self, a, b):
        # Manhattan distance
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def get_neighbors(self, node):
        (x, y) = node
        results = [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]
        # Filter boundaries and obstacles
        results = [
            (nx, ny) for (nx, ny) in results 
            if 0 <= nx < self.width and 0 <= ny < self.height and (nx, ny) not in self.obstacles
        ]
        return results

    def find_path(self, start, goal):
        if start == goal:
            return [start]
        if goal in self.obstacles:
            return None

        frontier = []
        heapq.heappush(frontier, (0, start))
        came_from = {start: None}
        cost_so_far = {start: 0}

        while frontier:
            current = heapq.heappop(frontier)[1]

            if current == goal:
                break

            for next_node in self.get_neighbors(current):
                new_cost = cost_so_far[current] + 1
                if next_node not in cost_so_far or new_cost < cost_so_far[next_node]:
                    cost_so_far[next_node] = new_cost
                    priority = new_cost + self.heuristic(goal, next_node)
                    heapq.heappush(frontier, (priority, next_node))
                    came_from[next_node] = current

        if goal not in came_from:
            return None

        # Reconstruct path
        path = []
        current = goal
        while current != start:
            path.append(current)
            current = came_from[current]
        path.reverse()
        return path
