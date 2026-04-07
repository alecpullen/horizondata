# run.py
import os
from app import create_app
from flask_cors import CORS

app = create_app()

if __name__ == "__main__":
    host  = os.getenv("FLASK_HOST", "127.0.0.1")
    port  = int(os.getenv("PORT", 8080))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"

    cors_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")

    CORS(
        app,
        resources={
            r"/api/*":     {"origins": cors_origins,
                            "methods": ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
                            "allow_headers": ["Content-Type","Authorization"]},
            r"/weather/*": {"origins": cors_origins,
                            "methods": ["GET","OPTIONS"],
                            "allow_headers": ["Content-Type","Authorization"]},
            r"/telescope/*": {"origins": cors_origins,
                              "methods": ["GET","POST","OPTIONS"],
                              "allow_headers": ["Content-Type","Authorization"]},
        },
        supports_credentials=True,
    )
    
    # Note: /api/captures/* is already covered by /api/* pattern above

    app.run(host=host, port=port, debug=debug, use_reloader=False)
