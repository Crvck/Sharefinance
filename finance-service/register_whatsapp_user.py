import os
import sys
import uuid

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from sharedfinance_finance.models import SharedWorkspace, WhatsAppUser  # noqa: E402


def main() -> int:
    if len(sys.argv) < 5:
        print("Usage:")
        print("  python register_whatsapp_user.py <phone> <user_id> <user_email> <workspace_id_or_name>")
        print("Example:")
        print("  python register_whatsapp_user.py +5215512345678 12a3fa44-2051-4d7d-a8da-c0684307ea43 user@sharedfinance.app 'Mi Workspace'")
        return 1

    phone = sys.argv[1].strip()
    user_id_raw = sys.argv[2].strip()
    user_email = sys.argv[3].strip()
    workspace_input = sys.argv[4].strip()

    if not phone.startswith("+"):
        print("Error: phone must start with '+' and include country code.")
        return 1

    try:
        user_id = uuid.UUID(user_id_raw)
    except ValueError:
        print("Error: user_id must be a valid UUID.")
        return 1

    workspace = SharedWorkspace.objects.filter(id=workspace_input).first()
    if workspace is None:
        workspace = SharedWorkspace.objects.filter(name=workspace_input).first()

    if workspace is None:
        print(f"Error: workspace not found by id/name: {workspace_input}")
        return 1

    whatsapp_user, created = WhatsAppUser.objects.update_or_create(
        phone_number=phone,
        defaults={
            "user_id": user_id,
            "user_email": user_email,
            "workspace": workspace,
            "is_active": True,
        },
    )

    action = "Created" if created else "Updated"
    print(f"{action} WhatsAppUser:")
    print(f"  phone: {whatsapp_user.phone_number}")
    print(f"  user_id: {whatsapp_user.user_id}")
    print(f"  user_email: {whatsapp_user.user_email}")
    print(f"  workspace: {whatsapp_user.workspace.name} ({whatsapp_user.workspace_id})")
    print(f"  active: {whatsapp_user.is_active}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
