import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger("queue_api")


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled server exception encountered in API view: %s", exc)
        return Response(
            {
                "error": {
                    "code": "internal_server_error",
                    "message": "An unexpected server error occurred. Please try again later.",
                    "details": str(exc) if getattr(context.get("request", None), "user", None) and context["request"].user.is_superuser else None,
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    details = response.data
    code = getattr(exc, "default_code", "request_error")
    
    if isinstance(details, dict) and "detail" in details:
        message = details["detail"]
        details_payload = None
    elif isinstance(details, dict):
        message = "Validation or request processing failed."
        details_payload = details
    elif isinstance(details, list):
        message = details[0] if details else "Request failed."
        details_payload = details
    else:
        message = str(details)
        details_payload = None

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "details": details_payload,
        }
    }
    return response
