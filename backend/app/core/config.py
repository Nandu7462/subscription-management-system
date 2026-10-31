from functools import lru_cache
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///../database/subscriptions.db"
    secret_key: str = Field(min_length=32)
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    frontend_url: str = "http://localhost:5173"
    access_token_minutes: int = Field(default=60, gt=0)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    mail_from: str = "billing@example.com"
    mail_directory: str = ".mail"

    @model_validator(mode="after")
    def production(self):
        if self.secret_key.startswith("replace-"):
            raise ValueError("Set SECRET_KEY to a randomly generated secret")
        if self.environment == "production":
            if not self.database_url.startswith("postgresql") or not self.smtp_host:
                raise ValueError("Production requires PostgreSQL and SMTP_HOST")
            if "*" in self.cors_origins:
                raise ValueError("Production requires explicit CORS origins")
        return self


@lru_cache
def get_settings():
    return Settings()
