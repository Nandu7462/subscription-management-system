from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from fastapi import HTTPException, Request

# Per-process development guard. Deploy behind a shared edge limiter for multiple API replicas.
_attempts = defaultdict(deque)
_lock = Lock()


def auth_limit(request: Request):
    key = request.client.host if request.client else "unknown"
    now = monotonic()
    with _lock:
        for address in list(_attempts):
            if not _attempts[address] or _attempts[address][-1] <= now - 60:
                del _attempts[address]
        attempts = _attempts[key]
        while attempts and attempts[0] <= now - 60:
            attempts.popleft()
        if len(attempts) >= 20:
            raise HTTPException(429, "Too many attempts; retry after 60 seconds", headers={"Retry-After": "60"})
        attempts.append(now)
