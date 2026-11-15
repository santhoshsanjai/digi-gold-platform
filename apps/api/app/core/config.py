from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_JWT_SECRET = "change-me-in-production-at-least-32-bytes"


class Settings(BaseSettings):
    """Process-wide settings, read from environment variables (prefix DG_)."""

    model_config = SettingsConfigDict(env_prefix="DG_", env_file=".env", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "postgresql+asyncpg://digigold:digigold@localhost:5432/digigold"
    db_pool_size: int = 5
    db_max_overflow: int = 5

    jwt_secret: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    password_change_token_minutes: int = 15

    temp_password_hours: int = 48
    reset_link_minutes: int = 30
    max_failed_logins: int = 5
    lockout_minutes: int = 15

    # Email: "console" logs messages (dev and tests); "smtp" sends them (Mailpit, Amazon SES);
    # "brevo" sends over Brevo's HTTPS API, for hosts that block SMTP ports (Render free plan).
    email_backend: Literal["console", "smtp", "brevo"] = "console"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = False
    email_from: str = "no-reply@digigold.local"
    email_from_name: str = "Digi Gold"
    brevo_api_key: str = ""

    # Base URLs used in emails (password reset links).
    crm_base_url: str = "http://localhost:5173"
    console_base_url: str = "http://localhost:5174"

    # Customer app sign-in by OTP.
    customer_access_minutes: int = 60
    customer_refresh_days: int = 90
    otp_minutes: int = 5
    otp_max_attempts: int = 5
    otp_resend_seconds: int = 30
    otp_max_per_hour: int = 5
    # Temporary password emailed by "forgot password" in the app.
    customer_temp_password_minutes: int = 30
    # "console" keeps SMS in memory and logs them; a real SMS provider is added later.
    sms_backend: Literal["console"] = "console"

    # Business time zone: "today" for rates and lot expiry is the Indian date.
    timezone: str = "Asia/Kolkata"

    # Daily expiry reminders run inside the API at this local hour (off in tests).
    run_scheduler: bool = True
    reminder_hour: int = 8

    # Uploaded images. Stored on local disk under media_dir and served at media_url_path;
    # set media_base_url to a CDN or bucket URL when files are moved to object storage.
    media_dir: str = "media"
    media_url_path: str = "/media"
    media_base_url: str = ""
    media_max_mb: int = 5

    cors_origins: list[str] = [
        "http://localhost:5173",  # CRM
        "http://localhost:5174",  # Platform Console
        "http://localhost:8081",  # mobile app in the browser preview
    ]
    config_cache_seconds: int = 300

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg(cls, url: str) -> str:
        # Hosts such as Render hand out plain postgres:// URLs; the API needs the asyncpg driver.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url[len(prefix) :]
        return url

    @model_validator(mode="after")
    def _production_needs_real_secrets(self):
        # A guessable signing secret would let anyone mint staff and customer tokens.
        if self.env == "prod" and (
            self.jwt_secret == _DEFAULT_JWT_SECRET or len(self.jwt_secret) < 32
        ):
            raise ValueError("DG_JWT_SECRET must be set to a random string of 32+ characters")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
