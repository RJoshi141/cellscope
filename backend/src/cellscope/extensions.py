from flask_sqlalchemy import SQLAlchemy

# created unbound so the app factory can attach it (avoids circular imports)
db = SQLAlchemy()
