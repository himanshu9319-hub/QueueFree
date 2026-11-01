"""
Zero-external-dependency authenticated encryption for sensitive API credentials.
Uses PBKDF2-HMAC-SHA256 key derivation and HMAC-CTR authenticated encryption (AEAD).
Tamper-proof and randomized with cryptographic salt and nonce.
"""

import base64
import hashlib
import hmac
import os
from django.conf import settings


def _get_master_key() -> str:
    if settings.configured:
        return getattr(settings, "SECRET_KEY", "queuefree-fallback-encryption-key-32b")
    return os.getenv("SECRET_KEY", "queuefree-fallback-encryption-key-32b")


def encrypt_secret(plaintext: str) -> str:
    """Encrypts plaintext string using authenticated encryption."""
    if not plaintext:
        return ""
    master_key = _get_master_key()
    salt = os.urandom(16)
    # Derive 32-byte key
    derived_key = hashlib.pbkdf2_hmac("sha256", master_key.encode("utf-8"), salt, 100000, dklen=32)

    data = plaintext.encode("utf-8")
    blocks = (len(data) + 31) // 32
    keystream = b"".join(
        hmac.new(derived_key, salt + i.to_bytes(4, "big"), hashlib.sha256).digest()
        for i in range(blocks)
    )
    ciphertext = bytes(a ^ b for a, b in zip(data, keystream[:len(data)]))
    tag = hmac.new(derived_key, salt + ciphertext, hashlib.sha256).digest()

    return "enc:v1:" + base64.b64encode(salt + tag + ciphertext).decode("ascii")


def decrypt_secret(ciphertext: str) -> str:
    """Decrypts ciphertext string, gracefully returning raw string if invalid or legacy."""
    if not ciphertext:
        return ""
    if not ciphertext.startswith("enc:v1:"):
        # Unencrypted legacy string fallback
        return ciphertext

    raw_b64 = ciphertext[len("enc:v1:"):]
    try:
        # Add padding if stripped
        missing_padding = len(raw_b64) % 4
        if missing_padding:
            raw_b64 += "=" * (4 - missing_padding)

        raw = base64.b64decode(raw_b64)
        if len(raw) < 48:
            return raw_b64
        salt, tag, cipher = raw[:16], raw[16:48], raw[48:]

        master_key = _get_master_key()
        derived_key = hashlib.pbkdf2_hmac("sha256", master_key.encode("utf-8"), salt, 100000, dklen=32)

        expected_tag = hmac.new(derived_key, salt + cipher, hashlib.sha256).digest()
        if not hmac.compare_digest(tag, expected_tag):
            return raw_b64

        blocks = (len(cipher) + 31) // 32
        keystream = b"".join(
            hmac.new(derived_key, salt + i.to_bytes(4, "big"), hashlib.sha256).digest()
            for i in range(blocks)
        )
        decrypted_bytes = bytes(a ^ b for a, b in zip(cipher, keystream[:len(cipher)]))
        return decrypted_bytes.decode("utf-8")
    except Exception:
        return raw_b64


def mask_secret(secret: str) -> str:
    """Returns masked secret for safe display in UIs."""
    if not secret:
        return ""
    plain = decrypt_secret(secret) if secret.startswith("enc:v1:") else secret
    if len(plain) <= 4:
        return "••••"
    return "••••••••" + plain[-4:]
