from sqlalchemy import and_, or_, desc, text
from server.app.models.user import User
from server.app.services.database import SessionLocal

def create_user(email: str, username: str, password_hash: str):
    with SessionLocal() as db:
        user = User(email=email, username=username, hashed_password=password_hash)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

def get_user_by_id(user_id: int):
    with SessionLocal() as db:
        return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(email: str):
    with SessionLocal() as db:
        return db.query(User).filter(User.email == email).first()

def get_users_by_username_partial(username: str):
    with SessionLocal() as db:
        return db.query(User).filter(
            User.username.ilike(f"%{username}%")
        ).order_by(User.username.asc()).all()

def get_active_users():
    with SessionLocal() as db:
        return db.query(User).filter(User.is_active == True).all()

def update_user_email(user_id: int, new_email: str):
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.email = new_email
            db.commit()
            db.refresh(user)
        return user

def delete_user(user_id: int):
    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.delete(user)
            db.commit()
            return True
        return False

def get_users_paginated(page: int = 1, page_size: int = 10):
    with SessionLocal() as db:
        offset = (page - 1) * page_size
        return db.query(User).offset(offset).limit(page_size).order_by(User.created_at.desc()).all()

def get_user_count():
    with SessionLocal() as db:
        return db.query(User).count()

def get_users_with_complex_filters(active_only=True, search_term=None, min_created=None):
    with SessionLocal() as db:
        query = db.query(User)
        
        if active_only:
            query = query.filter(User.is_active == True)
        
        if search_term:
            query = query.filter(
                or_(
                    User.username.ilike(f"%{search_term}%"),
                    User.email.ilike(f"%{search_term}%")
                )
            )
        
        if min_created:
            query = query.filter(User.created_at >= min_created)
        
        return query.order_by(desc(User.created_at)).all()

def execute_raw_query(sql: str, params: dict = None):
    with SessionLocal() as db:
        result = db.execute(text(sql), params or {})
        return result.fetchall()