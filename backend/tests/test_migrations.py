import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url


def test_upgrade_downgrade_and_expression_index(tmp_path, request):
    url = "sqlite:///" + (tmp_path / "migrations.db").as_posix()
    admin_engine = None
    schema = "test_migrations_" + uuid4().hex
    if request.config.getoption("--postgres"):
        from dotenv import dotenv_values
        base_url = dotenv_values(".env")["DATABASE_URL"]
        admin_engine = create_engine(base_url)
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        url = make_url(base_url).update_query_dict({"options": f"-csearch_path={schema}"}).render_as_string(hide_password=False)
    environment = dict(os.environ, DATABASE_URL=url)
    root = Path(__file__).resolve().parents[1]
    def migrate(target):
        result = subprocess.run([sys.executable, "-m", "alembic", *target], cwd=root,
                                env=environment, capture_output=True, text=True)
        assert result.returncode == 0, result.stdout + result.stderr
    try:
        migrate(["upgrade", "head"])
        engine = create_engine(url)
        from app.db.base import Base
        assert set(inspect(engine).get_table_names()) == set(Base.metadata.tables) | {"alembic_version"}
        with engine.connect() as connection:
            if engine.dialect.name == "sqlite":
                names = [row[1] for row in connection.exec_driver_sql("PRAGMA index_list(users)")]
            else:
                names = [row[0] for row in connection.execute(text("SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()"))]
                fks = inspect(connection).get_foreign_keys("discount_rules")
                assert any(fk["referred_table"] == "subscriptions" for fk in fks)
            assert "uq_users_email_lower" in names
        engine.dispose()
        migrate(["downgrade", "base"])
        migrate(["upgrade", "head"])
    finally:
        if admin_engine:
            assert schema.startswith("test_migrations_") and len(schema) == 48
            with admin_engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            admin_engine.dispose()
