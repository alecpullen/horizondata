from sqlalchemy.exc import SQLAlchemyError, DBAPIError

class DatabaseError(Exception):
    pass

class DBIntegrityError(DatabaseError):
    """Raised when a database integrity constraint is violated."""
    pass

class DatabaseConnectionError(DatabaseError):
    pass

class QueryError(DatabaseError):
    pass