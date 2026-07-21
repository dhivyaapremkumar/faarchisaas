import httpx
from app.core.config import settings


async def send_email(to: str, subject: str, html_body: str) -> bool:
    """
    Sends via Resend's HTTP API. Returns True/False rather than raising,
    so a misconfigured email key doesn't crash the request that triggered
    it - the caller decides how to surface a failure to the user.
    """
    if not settings.EMAIL_API_KEY:
        print("[email] EMAIL_API_KEY not set - skipping send (configure it in .env to enable)")
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.EMAIL_API_KEY}"},
                json={
                    "from": settings.EMAIL_FROM or "onboarding@resend.dev",
                    "to": [to],
                    "subject": subject,
                    "html": html_body,
                },
            )
            return response.status_code < 300
    except httpx.HTTPError as e:
        print(f"[email] Send failed (non-blocking): {e}")
        return False
