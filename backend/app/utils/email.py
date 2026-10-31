from email.message import EmailMessage
from pathlib import Path
from uuid import uuid4
import smtplib
import ssl
from app.core.config import get_settings


def send_email(recipient, subject, body, attachment=None):
    settings = get_settings()
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    if attachment:
        filename, data = attachment
        message.add_attachment(data, maintype="application", subtype="pdf", filename=filename)
    if settings.smtp_host:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    else:
        folder = Path(settings.mail_directory)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f"{uuid4()}.eml"
        target.write_bytes(message.as_bytes())
