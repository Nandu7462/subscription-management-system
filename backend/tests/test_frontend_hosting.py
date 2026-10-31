def test_frontend_assets_and_spa_do_not_swallow_api_or_escape_directory(env, tmp_path, monkeypatch):
    import app.main as main
    folder = tmp_path / "dist"
    folder.mkdir()
    (folder / "index.html").write_text("<!doctype html><title>Brightloop</title>", encoding="utf-8")
    (folder / "assets").mkdir()
    (folder / "assets" / "app.js").write_text("console.log('app')", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("never serve this", encoding="utf-8")
    monkeypatch.setattr(main, "FRONTEND_DIRECTORY", folder)
    client = env[0]
    assert "Brightloop" in client.get("/").text
    assert "Brightloop" in client.get("/reset-password?token=example").text
    assert client.get("/assets/app.js").status_code == 200
    assert client.get("/assets/missing.js").status_code == 404
    assert client.get("/api/v1/not-a-route").status_code == 404
    assert client.get("/api").status_code == 404
    assert client.get("/%2e%2e%2fsecret.txt").status_code == 404


def test_unbuilt_frontend_returns_helpful_not_found(env, tmp_path, monkeypatch):
    import app.main as main
    monkeypatch.setattr(main, "FRONTEND_DIRECTORY", tmp_path / "missing")
    assert env[0].get("/").status_code == 404
