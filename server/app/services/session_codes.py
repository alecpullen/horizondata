import random
import string


def generate_session_code() -> str:
    """Generate a unique 6-character session code (uppercase alphanumeric)."""
    from app.services.database import get_db
    from app.models.session import ObservationSession

    MAX_ATTEMPTS = 20
    for _ in range(MAX_ATTEMPTS):
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        with get_db() as db:
            exists = db.query(ObservationSession).filter(
                ObservationSession.session_code == code,
                ObservationSession.status == "active",
            ).first()
            if not exists:
                return code
    raise RuntimeError("Failed to generate a unique session code after maximum attempts")
