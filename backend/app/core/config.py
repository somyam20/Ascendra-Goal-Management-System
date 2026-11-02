from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Goal Management Platform"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://goals:goals@localhost:5432/goals"

    jwt_secret: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    reset_token_minutes: int = 60

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: int = 60

    ai_rate_limit_per_hour: int = 20
    enable_scheduler: bool = True

    admin_email: str = "admin@goals.local"
    admin_password: str = "Admin@12345"
    admin_name: str = "Administrator"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
