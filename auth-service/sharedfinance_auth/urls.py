from django.urls import path

from .views import AuthTokenPairView, AuthTokenRefreshView, ChangePasswordView, MeView, RegisterView

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/token/", AuthTokenPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", AuthTokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="auth_me"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
]
