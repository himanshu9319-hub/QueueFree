from django.urls import path

from . import views

urlpatterns = [
    path("", views.ApiIndexView.as_view(), name="api-index"),

    # Patient Authentication (ABDM / ABHA v3 & Registration)
    path("auth/patient/abha/init/", views.AbhaAuthInitView.as_view(), name="patient-abha-init"),
    path("auth/patient/abha/confirm/", views.AbhaAuthConfirmView.as_view(), name="patient-abha-confirm"),
    path("auth/patient/abha/cancel/", views.AbhaAuthCancelView.as_view(), name="patient-abha-cancel"),
    path("auth/patient/register/", views.PatientRegistrationView.as_view(), name="patient-register"),
    path("patient/profile/", views.PatientProfileDetailView.as_view(), name="patient-profile-detail"),
    path("auth/patient/send-otp/", views.PatientSendOtpView.as_view(), name="patient-send-otp"),
    path("auth/patient/verify-otp/", views.PatientVerifyOtpView.as_view(), name="patient-verify-otp"),
    path("auth/patient/demo/", views.PatientDemoLoginView.as_view(), name="patient-demo-login"),
    path("auth/patient/phone/", views.PatientPhoneLoginView.as_view(), name="patient-phone-login"),
    path("auth/patient/verify-abha/", views.PatientVerifyAbhaView.as_view(), name="patient-verify-abha"),

    # Staff Authentication
    path("auth/staff/login/", views.StaffLoginView.as_view(), name="staff-login"),
    path("auth/staff/me/", views.StaffMeView.as_view(), name="staff-me"),

    # Public Catalog
    path("hospitals/", views.HospitalListView.as_view(), name="hospital-list"),
    path("hospitals/<int:hospital_id>/", views.HospitalDetailView.as_view(), name="hospital-detail"),
    path("hospitals/<int:hospital_id>/departments/", views.DepartmentListView.as_view(), name="department-list"),
    path("doctors/", views.DoctorListView.as_view(), name="doctor-list"),
    path("availability/", views.AvailabilityView.as_view(), name="availability"),
    path("public/display/", views.PublicDisplayBoardView.as_view(), name="public-display-board"),

    # Patient Bookings
    path("bookings/", views.PatientBookingListCreateView.as_view(), name="patient-bookings"),
    path("bookings/<uuid:booking_id>/", views.PatientBookingDetailView.as_view(), name="patient-booking-detail"),
    path("bookings/<uuid:booking_id>/cancel/", views.PatientCancelView.as_view(), name="patient-cancel"),
    path("bookings/<uuid:booking_id>/reschedule/", views.PatientRescheduleView.as_view(), name="patient-reschedule"),
    path("payments/<uuid:booking_id>/demo-confirm/", views.DemoPaymentConfirmView.as_view(), name="demo-payment-confirm"),

    # Staff Live Queue
    path("staff/queue/", views.StaffQueueView.as_view(), name="staff-queue"),
    path("staff/queue/stream/", views.StaffQueueStreamView.as_view(), name="staff-queue-stream"),
    path("staff/queue/control/", views.StaffQueueControlView.as_view(), name="staff-queue-control"),
    path("staff/queue/walk-in/", views.StaffWalkInBookingView.as_view(), name="staff-queue-walk-in"),
    path("staff/queue/auto-no-show/", views.StaffAutoNoShowView.as_view(), name="staff-queue-auto-no-show"),
    path("staff/bookings/<uuid:booking_id>/action/", views.StaffQueueActionView.as_view(), name="staff-queue-action"),
    path("staff/doctor/profile/", views.DoctorProfileUpdateView.as_view(), name="staff-doctor-profile"),
    path("staff/doctor/delay/", views.DoctorDelayBroadcastView.as_view(), name="staff-doctor-delay"),

    # Real-Time SSE Streams & Notifications
    path("patient/queue/stream/", views.PatientQueueStreamView.as_view(), name="patient-queue-stream"),
    path("patient/notifications/", views.PatientNotificationListView.as_view(), name="patient-notifications"),
    path("hospital-admin/notifications/", views.HospitalAdminNotificationListView.as_view(), name="hospital-admin-notifications"),
    path("super-admin/notifications/", views.SuperAdminNotificationListView.as_view(), name="super-admin-notifications"),

    # Hospital Admin (Tenant Scoped)
    path("hospital-admin/hospital/", views.HospitalAdminHospitalDetailView.as_view(), name="hospital-admin-detail"),
    path("hospital-admin/departments/", views.HospitalAdminDepartmentsView.as_view(), name="hospital-admin-departments"),
    path("hospital-admin/doctors/", views.HospitalAdminDoctorsView.as_view(), name="hospital-admin-doctors"),
    path("hospital-admin/doctors/<int:pk>/", views.HospitalAdminDoctorDetailView.as_view(), name="hospital-admin-doctor-detail"),
    path("hospital-admin/schedules/", views.HospitalAdminDoctorScheduleView.as_view(), name="hospital-admin-schedules"),
    path("hospital-admin/holidays/", views.HospitalAdminHolidayView.as_view(), name="hospital-admin-holidays"),
    path("hospital-admin/staff/", views.HospitalAdminStaffListView.as_view(), name="hospital-admin-staff"),
    path("hospital-admin/slots/generate/", views.HospitalAdminSlotGenerateView.as_view(), name="hospital-admin-slots-generate"),

    # Super Admin (Platform-wide)
    path("super-admin/hospitals/", views.SuperAdminHospitalListCreateView.as_view(), name="super-admin-hospitals"),
    path("super-admin/hospitals/<int:pk>/", views.SuperAdminHospitalDetailView.as_view(), name="super-admin-hospital-detail"),
    path("super-admin/hospitals/<int:pk>/test-connection/", views.SuperAdminTestConnectionView.as_view(), name="super-admin-hospital-test-connection"),
    path("super-admin/hospitals/<int:pk>/api-config/", views.SuperAdminApiConfigUpdateView.as_view(), name="super-admin-hospital-api-config"),
    path("super-admin/analytics/", views.SuperAdminAnalyticsView.as_view(), name="super-admin-analytics"),

    # Backward compatibility
    path("admin/integrations/", views.IntegrationAdminView.as_view(), name="integration-admin"),
]
