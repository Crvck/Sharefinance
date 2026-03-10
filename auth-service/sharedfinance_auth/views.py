from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import WorkspaceMembership
from .serializers import (
    ChangePasswordSerializer,
    EmailTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
    WorkspaceSerializer,
)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        return Response(
            {
                "user": UserSerializer(result["user"]).data,
                "workspace": WorkspaceSerializer(result["workspace"]).data,
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        memberships = WorkspaceMembership.objects.filter(user=request.user).select_related("workspace")
        workspaces = [membership.workspace for membership in memberships]
        return Response(
            {
                "user": UserSerializer(request.user).data,
                "workspaces": WorkspaceSerializer(workspaces, many=True).data,
            }
        )


class AuthTokenPairView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = EmailTokenObtainPairSerializer


class AuthTokenRefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.user.check_password(serializer.validated_data["current_password"]):
            return Response(
                {"detail": "La contrasena actual es incorrecta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])

        return Response({"detail": "Contrasena actualizada correctamente."}, status=status.HTTP_200_OK)
