import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_refuses_the_default_signing_secret():
    with pytest.raises(ValidationError, match="DG_JWT_SECRET"):
        Settings(env="prod", _env_file=None)
    with pytest.raises(ValidationError, match="DG_JWT_SECRET"):
        Settings(env="prod", jwt_secret="too-short", _env_file=None)


def test_production_accepts_a_real_secret_and_dev_keeps_its_default():
    assert Settings(env="prod", jwt_secret="x" * 40, _env_file=None).env == "prod"
    assert Settings(env="dev", _env_file=None).env == "dev"
