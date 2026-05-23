import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.services.database import engine, Base
from app.models.token_blocklist import TokenBlocklist

def create_table():
    print("Creating token_blocklist table...")
    Base.metadata.create_all(engine, tables=[TokenBlocklist.__table__])
    print("Done!")

if __name__ == "__main__":
    create_table()
