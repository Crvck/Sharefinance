# WhatsApp Bot Integration - Endpoint Documentation

## Overview
The `/api/bot/transaction/` endpoint allows the Nanobot WhatsApp bot to register expenses from natural language messages.

## Endpoint Details

**URL**: `http://finance-service:8000/api/bot/transaction/` (Docker internal) or `http://127.0.0.1:8002/api/bot/transaction/` (local)

**Method**: `POST`

**Authentication**: None (AllowAny) - secured via phone number registration

## Request Format

```json
{
  "phone_number": "+5215512345678",
  "amount": 150.50,
  "description": "Gasolina para el auto",
  "type": "gasto"
}
```

### Parameters

- `phone_number` (string, required): WhatsApp phone number with country code (e.g., +52155...)
- `amount` (number, required): Expense amount, must be > 0
- `description` (string, required): Description of the expense
- `type` (string, optional): Transaction type (default: "gasto")

## Response Format

### Success (201 Created)

```json
{
  "ok": true,
  "message": "Gasto registrado: Gasolina para el auto por $150.5",
  "transaction": {
    "id": "uuid",
    "workspace_id": "uuid",
    "amount": 150.5,
    "concept": "Gasolina para el auto",
    "date": "2026-03-09",
    "category": "Bot",
    "is_shared": true,
    "created_by": "user@example.com"
  }
}
```

### Errors

**400 Bad Request** - Missing or invalid parameters:
```json
{
  "ok": false,
  "error": "phone_number is required"
}
```

**404 Not Found** - Phone number not registered:
```json
{
  "ok": false,
  "error": "Phone number +5215512345678 not registered or inactive"
}
```

## Database Model: WhatsAppUser

To enable a phone number to register expenses, create a `WhatsAppUser` entry:

```python
from sharedfinance_finance.models import WhatsAppUser, SharedWorkspace
import uuid

# Get workspace
workspace = SharedWorkspace.objects.get(name="Test Workspace")

# Create WhatsApp user
WhatsAppUser.objects.create(
    phone_number="+5215512345678",  # WhatsApp number with country code
    user_id=uuid.UUID("user-uuid-from-auth-service"),  # User ID from auth-service
    user_email="user@example.com",  # User email
    workspace=workspace,  # Primary workspace for this user
    is_active=True  # Enable/disable bot access
)
```

## Integration with Nanobot

The Nanobot service (`registrar_gasto.py` skill) makes POST requests to this endpoint:

1. User sends WhatsApp message: "Gasté $250 en la gasolina"
2. Nanobot LLM extracts: amount=250, description="gasolina"
3. Skill calls: `POST /api/bot/transaction/` with phone_number from WhatsApp sender
4. Finance-service creates Transaction
5. Bot replies to user: "Gasto registrado: gasolina por $250"

## Test Credentials

A test WhatsApp user was created for development:

- **Phone**: `+5215512345678`
- **Email**: `testuser@sharedfinance.app`
- **Workspace**: Test Workspace

### Test cURL Command

```bash
curl -X POST http://127.0.0.1:8002/api/bot/transaction/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+5215512345678",
    "amount": 99.99,
    "description": "Test expense",
    "type": "gasto"
  }'
```

## Next Steps

1. **Register Real Users**: Add WhatsAppUser entries for actual users who will use the bot
2. **Build Nanobot Service**: Run `docker-compose build nanobot-service`
3. **Configure API Key**: Replace `REPLACE_WITH_OPENROUTER_API_KEY` in `nanobot-service/data/config/config.json`
4. **Start Service**: Run `docker-compose up -d nanobot-service`
5. **Link WhatsApp**: Scan QR code to connect bot to WhatsApp
6. **Test Live**: Send message "Gasté $150 en comida" to linked WhatsApp number

## Security Notes

- Phone numbers must be pre-registered in `WhatsAppUser` table
- Each phone is linked to specific user_id and workspace
- Transactions created as `is_shared=True` by default
- Category automatically set to "Bot" for tracking
- `is_active` flag allows disabling bot access per user
