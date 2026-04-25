import random
import string


def generate_session_code() -> str:
    """Generate a unique 6-character session code (uppercase alphanumeric)."""
    from app.services.database import get_db
    from app.models.session import ObservationSession

    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        with get_db() as db:
            exists = db.query(ObservationSession).filter(
                ObservationSession.session_code == code,
                ObservationSession.status == "active",
            ).first()
            if not exists:
                return code
