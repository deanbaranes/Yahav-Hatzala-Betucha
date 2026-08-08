"""
Shared rate limiter instance.

Both main.py (middleware) and auth.py (decorators) import from here,
ensuring a single Limiter instance is used across the application.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
