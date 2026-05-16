"""Email sending service for outbound outreach."""
from __future__ import annotations

import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class EmailConfig:
    """Configuration for email sending."""

    provider: str = "resend"
    api_key: str = ""
    from_email: str = "outreach@siphonx.dev"
    from_name: str = "SIPHON-X Outreach"


@dataclass
class EmailResult:
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


class EmailService:
    """Send emails via configured provider."""

    def __init__(self, config: Optional[EmailConfig] = None):
        self._config = config or EmailConfig()

    async def send(
        self,
        to: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
    ) -> EmailResult:
        """Send an email and return the result."""
        if not self._config.api_key:
            # Development mode: log instead of sending
            logger.info(
                "email_send_dev_mode",
                extra={"to": to, "subject": subject, "body_preview": body[:100]},
            )
            return EmailResult(success=True, message_id="dev-mode")

        if self._config.provider == "resend":
            return await self._send_resend(to, subject, body, html_body)
        else:
            return EmailResult(success=False, error=f"Unknown provider: {self._config.provider}")

    async def _send_resend(
        self, to: str, subject: str, body: str, html_body: Optional[str] = None
    ) -> EmailResult:
        """Send via Resend API."""
        import httpx

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {self._config.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": f"{self._config.from_name} <{self._config.from_email}>",
                        "to": [to],
                        "subject": subject,
                        "text": body,
                        "html": html_body or body.replace("\n", "<br>"),
                    },
                    timeout=30,
                )

                if response.status_code == 200:
                    data = response.json()
                    return EmailResult(success=True, message_id=data.get("id"))
                else:
                    return EmailResult(
                        success=False,
                        error=f"Resend API error {response.status_code}: {response.text}",
                    )
        except Exception as e:
            return EmailResult(success=False, error=str(e))
