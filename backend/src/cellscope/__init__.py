import os
from pathlib import Path

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .extensions import db


def database_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        if os.environ.get("VERCEL"):
            # no DB attached yet: /tmp is the only writable path on Vercel (resets on cold start)
            return "sqlite:////tmp/cellscope.db"
        # local dev: pin to backend/cellscope.db instead of Flask's instance-folder guess
        return f"sqlite:///{Path(__file__).resolve().parents[2] / 'cellscope.db'}"
    # Neon/Heroku style URLs -> SQLAlchemy's psycopg 3 driver
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def create_app(config=None):
    app = Flask(__name__)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=database_url(),
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True},  # serverless DBs drop idle connections
        SEED_DEMO=True,
    )
    if config:
        app.config.update(config)  # tests pass an in-memory db here

    db.init_app(app)
    CORS(app)

    from .api import api_bp
    from .rpc import rpc_bp
    from .telemetry import seed_demo

    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(rpc_bp, url_prefix="/api")

    @app.errorhandler(HTTPException)
    def json_errors(e):  # JSON everywhere, not Flask's HTML error pages
        return jsonify(error=e.name, message=e.description), e.code

    with app.app_context():
        db.create_all()
        if app.config["SEED_DEMO"]:
            seed_demo()
    return app
