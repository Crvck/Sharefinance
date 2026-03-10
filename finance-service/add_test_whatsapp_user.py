"""
Script to add a test WhatsApp user for bot integration testing.
Run: python manage.py shell < add_test_whatsapp_user.py
"""
import uuid
from sharedfinance_finance.models import SharedWorkspace, WhatsAppUser

# Get or create a test workspace
workspace, created = SharedWorkspace.objects.get_or_create(
    name="Test Workspace",
    defaults={"id": uuid.uuid4()}
)
if created:
    print(f"✓ Created workspace: {workspace.name} ({workspace.id})")
else:
    print(f"✓ Using existing workspace: {workspace.name} ({workspace.id})")

# Create test WhatsApp user
test_user_id = uuid.uuid4()
test_phone = "+5215512345678"
test_email = "testuser@sharedfinance.app"

whatsapp_user, created = WhatsAppUser.objects.get_or_create(
    phone_number=test_phone,
    defaults={
        "user_id": test_user_id,
        "user_email": test_email,
        "workspace": workspace,
        "is_active": True
    }
)

if created:
    print(f"✓ Created WhatsApp user: {test_phone} → {test_email}")
    print(f"  User ID: {whatsapp_user.user_id}")
    print(f"  Workspace: {whatsapp_user.workspace.name}")
else:
    print(f"✓ WhatsApp user already exists: {test_phone}")
    print(f"  User ID: {whatsapp_user.user_id}")
    print(f"  Workspace: {whatsapp_user.workspace.name}")

print("\n✅ Test data ready!")
