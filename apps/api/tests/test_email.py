import json

from app.core import email
from app.core.config import get_settings


def test_brevo_backend_posts_the_message(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "email_backend", "brevo")
    monkeypatch.setattr(settings, "brevo_api_key", "test-key")
    monkeypatch.setattr(settings, "email_from", "shop@example.com")
    monkeypatch.setattr(settings, "email_from_name", "Test Shop")
    sent = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def read(self):
            return b"{}"

    def fake_urlopen(request, timeout):
        sent.append(request)
        return Response()

    monkeypatch.setattr(email.urllib.request, "urlopen", fake_urlopen)
    email.send_email(email.Email("buyer@example.com", "Hi", "Body"))

    (request,) = sent
    assert request.full_url == email.BREVO_URL
    assert request.get_header("Api-key") == "test-key"
    payload = json.loads(request.data)
    assert payload["sender"] == {"email": "shop@example.com", "name": "Test Shop"}
    assert payload["to"] == [{"email": "buyer@example.com"}]
    assert payload["textContent"] == "Body"


def test_brevo_without_a_key_falls_back_to_the_log(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "email_backend", "brevo")
    monkeypatch.setattr(settings, "brevo_api_key", "")
    email.outbox.clear()
    email.send_email(email.Email("buyer@example.com", "Hi", "Body"))
    assert email.outbox[-1].to == "buyer@example.com"
