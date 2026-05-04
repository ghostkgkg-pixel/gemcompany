import time

class DataCache:
    def __init__(self):
        self.cache = {}
        self.ttl = 300

    def set(self, key, value):
        self.cache[key] = {'value': value, 'timestamp': time.time()}

    def get(self, key):
        if key in self.cache:
            if time.time() - self.cache[key]['timestamp'] < self.ttl:
                return self.cache[key]['value']
            else:
                del self.cache[key]
        return None

if __name__ == '__main__':
    print('Caching module initialized.')