"""Email sending service for outbound outreach."""
from __future__ import annotations

import base64
import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Resend API attachment size limit (25 MB in bytes)
_MAX_TOTAL_ATTACHMENT_SIZE = 25 * 1024 * 1024


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
        attachments: Optional[list[dict]] = None,
    ) -> EmailResult:
        """Send an email and return the result.

        Attachments format (Resend API):
            [{"filename": "report.pdf", "content_type": "application/pdf", "content": "<base64>"}]

        Total attachment size must not exceed 25 MB (Resend limit).
        """
        # Validate attachment size
        if attachments:
            self._validate_attachments(attachments)

        if not self._config.api_key:
            # Development mode: log instead of sending
            attach_info = (
                f"with {len(attachments)} attachment(s)"
                if attachments
                else "no attachments"
            )
            logger.info(
                "email_send_dev_mode",
                extra={
                    "to": to,
                    "subject": subject,
                    "body_preview": body[:100],
                    "attachments": attach_info,
                },
            )
            return EmailResult(success=True, message_id="dev-mode")

        if self._config.provider == "resend":
            return await self._send_resend(to, subject, body, html_body, attachments)
        else:
            return EmailResult(success=False, error=f"Unknown provider: {self._config.provider}")

    def _validate_attachments(self, attachments: list[dict]) -> None:
        """Validate attachment size and content structure.

        Raises:
            ValueError: If total size exceeds 25 MB limit or if required fields are missing.
        """
        total_size = 0
        for i, att in enumerate(attachments):
            # Validate required fields
            if "filename" not in att:
                raise ValueError(f"Attachment [{i}] missing required field 'filename'")
            if "content" not in att:
                raise ValueError(f"Attachment [{i}] missing required field 'content'")
            if "content_type" not in att:
                raise ValueError(f"Attachment [{i}] missing required field 'content_type'")

            content = att.get("content", "")
            decoded_size = len(base64.b64decode(content) if isinstance(content, str) else content)
            total_size += decoded_size

        if total_size > _MAX_TOTAL_ATTACHMENT_SIZE:
            size_mb = total_size / (1024 * 1024)
            raise ValueError(
                f"Total attachment size ({size_mb:.1f} MB) exceeds 25 MB limit"
            )

    async def _send_resend(
        self,
        to: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        attachments: Optional[list[dict]] = None,
    ) -> EmailResult:
        """Send via Resend API."""
        import httpx

        payload: dict = {
            "from": f"{self._config.from_name} <{self._config.from_email}>",
            "to": [to],
            "subject": subject,
            "text": body,
        }

        if html_body:
            payload["html"] = html_body
        else:
            payload["html"] = body.replace("\n", "<br>")

        if attachments:
            resend_attachments = []
            for att in attachments:
                resend_attachments.append({
                    "filename": att["filename"],
                    "content": att["content"],
                    "content_type": att.get("content_type", "application/octet-stream"),
                })
            payload["attachments"] = resend_attachments

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {self._config.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
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
