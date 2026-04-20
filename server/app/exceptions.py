from sqlalchemy.exc import SQLAlchemyError, IntegrityError, DBAPIError

class DatabaseError(Exception):
    pass

class IntegrityError(DatabaseError):
    pass

class DatabaseConnectionError(DatabaseError):
    pass

class QueryError(DatabaseError):
    pass