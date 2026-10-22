from flask import Flask
from flask_cors import CORS

from .extensions import db


def create_app(config=None):
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///cellscope.db"  # lands in instance/
    if config:
        app.config.update(config)  # tests pass an in-memory db here

    db.init_app(app)
    CORS(app)  # lets the Vite dev server call the API

    from .api import api_bp
    from .rpc import rpc_bp

    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(rpc_bp)

    with app.app_context():
        db.create_all()
    return app
