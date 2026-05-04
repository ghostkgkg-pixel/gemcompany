import time

def optimize_response(data_payload):
    """
    백엔드 API 응답 최적화 로직
    불필요한 데이터를 필터링하여 페이로드 크기를 줄입니다.
    """
    start_time = time.time()
    optimized_payload = {k: v for k, v in data_payload.items() if v is not None}
    end_time = time.time()
    
    print(f"Optimization complete in {end_time - start_time:.4f} seconds")
    return optimized_payload

if __name__ == '__main__':
    sample_data = {'id': 1, 'name': 'Alex', 'temporary_cache': None, 'status': 'active'}
    result = optimize_response(sample_data)
    print(f"Optimized Data: {result}")