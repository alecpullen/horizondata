"""
Email service — reads all SMTP config from system_settings at send time.

When email_enabled is 'false' (the default), every send function returns
silently without touching the network. Flip the toggle in the admin UI
once a mail server is available.
"""

import smtplib
import logging
from email.mime.text import MIMEText

from app.services.database import get_db
from app.models.setting import SystemSetting

logger = logging.getLogger(__name__)

_EMAIL_KEYS = [
    'email_enabled', 'smtp_host', 'smtp_port', 'smtp_use_tls',
    'smtp_user', 'smtp_password', 'mail_from', 'frontend_url',
]


def _get_cfg():
    with get_db() as db:
        rows = db.query(SystemSetting).filter(SystemSetting.key.in_(_EMAIL_KEYS)).all()
    return {r.key: r.value for r in rows}


def _send(to, subject, body, cfg):
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = cfg.get('mail_from') or 'noreply@horizon.edu.au'
    msg['To'] = to

    host = cfg.get('smtp_host') or 'localhost'
    port = int(cfg.get('smtp_port') or 587)
    use_tls = cfg.get('smtp_use_tls', 'true').lower() == 'true'
    username = cfg.get('smtp_user') or ''
    password = cfg.get('smtp_password') or ''

    with smtplib.SMTP(host, port) as srv:
        if use_tls:
            srv.starttls()
        if username and password:
            srv.login(username, password)
        srv.send_message(msg)


def send_password_reset_email(user, token):
    cfg = _get_cfg()
    if cfg.get('email_enabled', 'false').lower() != 'true':
        logger.debug('Email disabled — skipping password reset email for %s', user.email)
        return

    frontend_url = cfg.get('frontend_url') or 'http://localhost:5173'
    reset_url = f"{frontend_url}/reset-password?token={token}"
    body = (
        f"Hi {user.username},\n\n"
        f"Click the link below to reset your Horizon Data password:\n\n"
        f"  {reset_url}\n\n"
        f"This link expires in 1 hour. If you did not request a password reset, "
        f"you can safely ignore this email."
    )
    _send(user.email, 'Reset your Horizon Data password', body, cfg)
    logger.info('Password reset email sent to %s', user.email)


def send_verification_email(user, token):
    cfg = _get_cfg()
    if cfg.get('email_enabled', 'false').lower() != 'true':
        logger.debug('Email disabled — skipping verification email for %s', user.email)
        return

    frontend_url = cfg.get('frontend_url') or 'http://localhost:5173'
    verify_url = f"{frontend_url}/verify-email?token={token}"
    body = (
        f"Hi {user.username},\n\n"
        f"Click the link below to verify your Horizon Data email address:\n\n"
        f"  {verify_url}\n\n"
        f"This link expires in 24 hours."
    )
    _send(user.email, 'Verify your Horizon Data email', body, cfg)
    logger.info('Verification email sent to %s', user.email)
