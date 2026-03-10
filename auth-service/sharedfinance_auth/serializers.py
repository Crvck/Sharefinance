from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import SharedWorkspace, User, WorkspaceMembership


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name"]


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SharedWorkspace
        fields = ["id", "name", "invitation_code", "created_at", "updated_at"]


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    workspace = WorkspaceSerializer(read_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = ["id", "role", "joined_at", "user", "workspace"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    workspace_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    invitation_code = serializers.CharField(max_length=12, required=False, allow_blank=True)

    def validate(self, attrs):
        workspace_name = (attrs.get("workspace_name") or "").strip()
        invitation_code = (attrs.get("invitation_code") or "").strip().upper()

        if not workspace_name and not invitation_code:
            raise serializers.ValidationError(
                {"workspace_name": "Escribe nombre del workspace o usa un codigo de invitacion."}
            )

        attrs["workspace_name"] = workspace_name
        attrs["invitation_code"] = invitation_code
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        workspace_name = validated_data.pop("workspace_name", "")
        invitation_code = validated_data.pop("invitation_code", "")
        user = User.objects.create_user(**validated_data)

        if invitation_code:
            workspace = SharedWorkspace.objects.filter(invitation_code=invitation_code).first()
            if not workspace:
                raise serializers.ValidationError({"invitation_code": "Codigo de invitacion invalido."})
            WorkspaceMembership.objects.create(
                workspace=workspace,
                user=user,
                role=WorkspaceMembership.ROLE_MEMBER,
            )
        else:
            workspace = None
            for _ in range(5):
                candidate = SharedWorkspace(name=workspace_name, created_by=user)
                if not SharedWorkspace.objects.filter(invitation_code=candidate.invitation_code).exists():
                    candidate.save()
                    workspace = candidate
                    break
            if workspace is None:
                raise serializers.ValidationError({"detail": "No se pudo generar codigo de invitacion."})
            WorkspaceMembership.objects.create(
                workspace=workspace,
                user=user,
                role=WorkspaceMembership.ROLE_OWNER,
            )
        return {
            "user": user,
            "workspace": workspace,
        }


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        email_value = attrs.get("email")
        if isinstance(email_value, str):
            attrs["email"] = email_value.strip().lower()
        return super().validate(attrs)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, min_length=6)
    new_password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Las contrasenas no coinciden."})
        return attrs
