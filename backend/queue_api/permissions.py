from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission
from .models import StaffProfile


def role_for_user(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return StaffProfile.Role.SUPER_ADMIN
    if hasattr(user, "staff_profile"):
        return user.staff_profile.role
    if hasattr(user, "patient_profile"):
        return "patient"
    return None


def get_user_tenant_hospital(user):
    """
    Returns the Hospital instance that scopes this user's queries.
    - Super Admins return None (meaning platform-wide access).
    - Hospital staff returns their assigned hospital.
    - Non-staff raises PermissionDenied.
    """
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication is required.")
    if user.is_superuser:
        return None
    if hasattr(user, "staff_profile"):
        staff = user.staff_profile
        if staff.role == StaffProfile.Role.SUPER_ADMIN:
            return None
        if not staff.hospital:
            raise PermissionDenied("Staff account is not assigned to a valid hospital.")
        return staff.hospital
    raise PermissionDenied("A hospital staff account is required for this action.")


class IsPatient(BasePermission):
    def has_permission(self, request, view):
        return role_for_user(request.user) == "patient"


class IsHospitalStaff(BasePermission):
    def has_permission(self, request, view):
        return role_for_user(request.user) in {
            StaffProfile.Role.RECEPTION,
            StaffProfile.Role.DOCTOR,
            StaffProfile.Role.ADMIN,
            StaffProfile.Role.SUPER_ADMIN,
        } or getattr(request.user, "is_superuser", False)


class IsHospitalAdmin(BasePermission):
    def has_permission(self, request, view):
        return role_for_user(request.user) in {
            StaffProfile.Role.ADMIN,
            StaffProfile.Role.SUPER_ADMIN,
        } or getattr(request.user, "is_superuser", False)


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return role_for_user(request.user) == StaffProfile.Role.SUPER_ADMIN or getattr(request.user, "is_superuser", False)


class IsDoctor(BasePermission):
    def has_permission(self, request, view):
        return role_for_user(request.user) in {
            StaffProfile.Role.DOCTOR,
            StaffProfile.Role.ADMIN,
            StaffProfile.Role.SUPER_ADMIN,
        } or getattr(request.user, "is_superuser", False)


class IsReceptionist(BasePermission):
    def has_permission(self, request, view):
        return role_for_user(request.user) in {
            StaffProfile.Role.RECEPTION,
            StaffProfile.Role.ADMIN,
            StaffProfile.Role.SUPER_ADMIN,
        } or getattr(request.user, "is_superuser", False)
