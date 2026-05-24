from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask import current_app

RESET_SALT = 'password-reset-salt'
VERIFY_SALT = 'email-verify-salt'


def generate_reset_token(user):
    """Generate a signed, time-limited password-reset token.

    Embeds the last 16 chars of the user's current password hash so the token
    is automatically invalidated once the password changes.
    """
    s = URLSafeTimedSerializer(current_app.config['JWT_SECRET_KEY'])
    return s.dumps({'email': user.email, 'ph': user.hashed_password[-16:]}, salt=RESET_SALT)


def verify_reset_token(token, max_age=3600):
    """Verify a password-reset token.

    Returns (email, ph_fragment) on success.
    Raises ValueError('expired') or ValueError('invalid') on failure.
    """
    s = URLSafeTimedSerializer(current_app.config['JWT_SECRET_KEY'])
    try:
        data = s.loads(token, salt=RESET_SALT, max_age=max_age)
        return data['email'], data['ph']
    except SignatureExpired:
        raise ValueError('expired')
    except (BadSignature, KeyError):
        raise ValueError('invalid')


def generate_verify_token(user):
    """Generate a signed, time-limited email-verification token."""
    s = URLSafeTimedSerializer(current_app.config['JWT_SECRET_KEY'])
    return s.dumps(user.email, salt=VERIFY_SALT)


def verify_email_token(token, max_age=86400):
    """Verify an email-verification token.

    Returns the user's email on success.
    Raises ValueError('expired') or ValueError('invalid') on failure.
    """
    s = URLSafeTimedSerializer(current_app.config['JWT_SECRET_KEY'])
    try:
        return s.loads(token, salt=VERIFY_SALT, max_age=max_age)
    except SignatureExpired:
        raise ValueError('expired')
    except BadSignature:
        raise ValueError('invalid')
