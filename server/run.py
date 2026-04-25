# run.py
import os
from dotenv import load_dotenv

# Load environment variables from .env file in the same directory as run.py
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

from app import create_app

app = create_app()

if __name__ == "__main__":
    host  = os.getenv("FLASK_HOST", "127.0.0.1")
    port  = int(os.getenv("PORT", 8080))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"

    app.run(host=host, port=port, debug=debug, use_reloader=False)
