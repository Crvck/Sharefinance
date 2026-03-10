from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
import uuid


def generate_invitation_code():
    return uuid.uuid4().hex[:8].upper()


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower().strip()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email=email, password=password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "auth_user"
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email


class SharedWorkspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    invitation_code = models.CharField(max_length=12, db_index=True, default=generate_invitation_code)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="workspaces_created",
    )
    members = models.ManyToManyField(
        User,
        through="WorkspaceMembership",
        related_name="shared_workspaces",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shared_workspace"
        ordering = ["name"]

    def __str__(self):
        return self.name


class WorkspaceMembership(models.Model):
    ROLE_OWNER = "owner"
    ROLE_MEMBER = "member"
    ROLE_CHOICES = (
        (ROLE_OWNER, "Owner"),
        (ROLE_MEMBER, "Member"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        SharedWorkspace,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="workspace_memberships",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "workspace_membership"
        unique_together = ("workspace", "user")

    def __str__(self):
        return f"{self.user.email} in {self.workspace.name} ({self.role})"
