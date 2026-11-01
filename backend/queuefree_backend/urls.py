from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "service": "QueueFree API", "mode": "demo"})


def backend_root_view(request):
    html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QueueFree — Backend Services Online</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
        .card { background: white; max-width: 620px; width: 100%; border-radius: 20px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 99px; background: #ecfdf5; color: #059669; font-size: 12px; font-weight: 700; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
        h1 { font-size: 24px; font-weight: 800; margin: 16px 0 8px; }
        p { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 24px; }
        .btn-primary { display: block; text-align: center; background: #2563eb; color: white; padding: 14px 20px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; transition: background 0.2s; margin-bottom: 20px; box-shadow: 0 4px 14px rgba(37,99,235,0.25); }
        .btn-primary:hover { background: #1d4ed8; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
        .link-card { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; text-decoration: none; color: #1e293b; background: #f8fafc; transition: border-color 0.2s, background 0.2s; }
        .link-card:hover { border-color: #2563eb; background: #eff6ff; }
        .link-card strong { font-size: 13px; color: #0f172a; }
        .link-card span { font-size: 11px; color: #64748b; }
        .footer-links { font-size: 12px; color: #94a3b8; display: flex; gap: 14px; justify-content: center; border-top: 1px solid #f1f5f9; padding-top: 18px; }
        .footer-links a { color: #2563eb; text-decoration: none; }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge"><span class="dot"></span> Backend Services Online</span>
        <h1>QueueFree OPD Platform</h1>
        <p>The Django backend is active and serving API requests. The frontend application runs on port 5173. Click below to open any portal:</p>
        
        <a href="http://127.0.0.1:5173/" class="btn-primary">Open Main Web Application (Port 5173) &rarr;</a>

        <div class="grid">
            <a href="http://127.0.0.1:5173/doctor" class="link-card">
                <strong>Doctor Console</strong>
                <span>Call, consult & complete OPD visits</span>
            </a>
            <a href="http://127.0.0.1:5173/reception" class="link-card">
                <strong>Reception Desk</strong>
                <span>Live queue tracking & walk-in tokens</span>
            </a>
            <a href="http://127.0.0.1:5173/hospital-admin" class="link-card">
                <strong>Hospital Admin</strong>
                <span>Department & doctor management</span>
            </a>
            <a href="http://127.0.0.1:5173/display" class="link-card">
                <strong>Public TV Display</strong>
                <span>Real-time waiting board</span>
            </a>
        </div>

        <div class="footer-links">
            <a href="/api/v1/">API Index</a> &bull;
            <a href="/health/">System Health</a> &bull;
            <a href="/admin/">Django Admin</a>
        </div>
    </div>
</body>
</html>"""
    return HttpResponse(html)


urlpatterns = [
    path("", backend_root_view, name="backend-root"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("queue_api.urls")),
    path("health/", HealthView.as_view(), name="health"),
]
