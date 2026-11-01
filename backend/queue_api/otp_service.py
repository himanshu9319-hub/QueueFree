import random
import time
from django.conf import settings

# Global OTP storage dictionary for development and caching
# In multi-server production, this maps directly to Django's cache / Redis
_OTP_CACHE = {}
_OTP_EXPIRY_SECONDS = 300  # 5 minutes
_MAX_ATTEMPTS = 5


def generate_otp():
    if getattr(settings, "DEMO_OTP_ENABLED", True):
        return "123456"
    return f"{random.randint(100000, 999999)}"


def send_otp_to_phone(phone_digits):
    now = time.time()
    code = generate_otp()
    _OTP_CACHE[phone_digits] = {
        "otp": code,
        "expires_at": now + _OTP_EXPIRY_SECONDS,
        "attempts": 0,
        "created_at": now,
    }
    
    # In production, dispatch via SMS Gateway adapter (Twilio, Gupshup, Fast2SMS)
    # logger.info("Dispatching SMS OTP %s to %s", code, phone_digits)
    
    dev_otp = code if (settings.DEBUG or getattr(settings, "DEMO_OTP_ENABLED", True)) else None
    return {
        "success": True,
        "phone": phone_digits,
        "expires_in_seconds": _OTP_EXPIRY_SECONDS,
        "cooldown_seconds": 30,
        "dev_otp": dev_otp,
    }


def verify_phone_otp(phone_digits, otp_input):
    entry = _OTP_CACHE.get(phone_digits)
    now = time.time()
    
    if not entry:
        # Fallback in demo mode if entered "123456"
        if getattr(settings, "DEMO_OTP_ENABLED", True) and otp_input == "123456":
            return True, "Demo OTP verified successfully"
        return False, "OTP has expired or was not requested. Please request a new OTP."

    if now > entry["expires_at"]:
        _OTP_CACHE.pop(phone_digits, None)
        return False, "OTP has expired. Please request a new OTP."

    entry["attempts"] += 1
    if entry["attempts"] > _MAX_ATTEMPTS:
        _OTP_CACHE.pop(phone_digits, None)
        return False, "Maximum verification attempts exceeded. Please request a new OTP."

    if entry["otp"] == otp_input.strip() or (getattr(settings, "DEMO_OTP_ENABLED", True) and otp_input.strip() == "123456"):
        _OTP_CACHE.pop(phone_digits, None)
        return True, "OTP verified successfully."

    return False, "Invalid OTP. Please check the code and try again."
