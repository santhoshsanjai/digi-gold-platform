import hashlib
import hmac
import secrets
from datetime import timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import now
from app.models import CustomerOtp

settings = get_settings()


class OtpError(Exception):
    pass


def _hash(code: str, phone: str) -> str:
    return hmac.new(
        settings.jwt_secret.encode(), f"{phone}:{code}".encode(), hashlib.sha256
    ).hexdigest()


async def issue(session: AsyncSession, tenant_id: UUID, phone: str, purpose: str) -> str:
    """Create a 6-digit code, enforcing an hourly limit per phone (and a resend gap for SMS).

    Only the newest code is accepted, so issuing a new one replaces the previous one."""
    recent = select(CustomerOtp).where(
        CustomerOtp.tenant_id == tenant_id,
        CustomerOtp.phone == phone,
        CustomerOtp.purpose == purpose,
        CustomerOtp.created_at > now() - timedelta(hours=1),
    )
    count = await session.scalar(select(func.count()).select_from(recent.subquery()))
    if count >= settings.otp_max_per_hour:
        raise OtpError("too many codes requested; try again later")
    if purpose == "login":  # SMS costs money; in-app redemption codes need no resend gap
        last = await session.scalar(recent.order_by(CustomerOtp.created_at.desc()).limit(1))
        if last and last.created_at > now() - timedelta(seconds=settings.otp_resend_seconds):
            raise OtpError("please wait before requesting another code")

    code = f"{secrets.randbelow(1_000_000):06d}"
    session.add(
        CustomerOtp(
            tenant_id=tenant_id,
            phone=phone,
            purpose=purpose,
            code_hash=_hash(code, phone),
            expires_at=now() + timedelta(minutes=settings.otp_minutes),
        )
    )
    return code


async def verify(
    session: AsyncSession, tenant_id: UUID, phone: str, purpose: str, code: str
) -> bool:
    """Check the newest live code. Returns False (and counts the attempt) on a wrong code."""
    otp = await session.scalar(
        select(CustomerOtp)
        .where(
            CustomerOtp.tenant_id == tenant_id,
            CustomerOtp.phone == phone,
            CustomerOtp.purpose == purpose,
            CustomerOtp.consumed_at.is_(None),
            CustomerOtp.expires_at > now(),
        )
        .order_by(CustomerOtp.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if otp is None or otp.attempts >= settings.otp_max_attempts:
        return False
    if not hmac.compare_digest(otp.code_hash, _hash(code, phone)):
        otp.attempts += 1
        return False
    otp.consumed_at = now()
    return True
