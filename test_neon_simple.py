import os
import sys

# Load .env manually
with open('server/.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip('"'))

from sqlalchemy import create_engine
from sqlalchemy.sql import text

DATABASE_URL = os.getenv('SQLALCHEMY_DATABASE_URL')
print(f'Trying to connect to NEON...')

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

with engine.connect() as conn:
    result = conn.execute(text('SELECT 1 as test'))
    value = result.scalar()
    print(f'Connection successful! Test value: {value}')
    print('✅ NEON PostgreSQL integration is working!')