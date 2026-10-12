from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Process-wide settings, read from environment variables (prefix DG_)."""

    model_config = SettingsConfigDict(env_prefix="DG_", env_file=".env", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "postgresql+asyncpg://digigold:digigold@localhost:5432/digigold"
    db_pool_size: int = 5
    db_max_overflow: int = 5

    jwt_secret: str = "change-me-in-production-at-least-32-bytes"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    password_change_token_minutes: int = 15

    temp_password_hours: int = 48
    reset_link_minutes: int = 30
    max_failed_logins: int = 5
    lockout_minutes: int = 15

    # Email: "console" logs messages (dev and tests); "smtp" sends them (Mailpit, Amazon SES).
    email_backend: Literal["console", "smtp"] = "console"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = False
    email_from: str = "no-reply@digigold.local"

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
    # "console" keeps SMS in memory and logs them; a real SMS provider is added later.
    sms_backend: Literal["console"] = "console"

    # Business time zone: "today" for rates and lot expiry is the Indian date.
    timezone: str = "Asia/Kolkata"

    # Daily expiry reminders run inside the API at this local hour (off in tests).
    run_scheduler: bool = True
    reminder_hour: int = 8

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
    config_cache_seconds: int = 300


@lru_cache
def get_settings() -> Settings:
    return Settings()
