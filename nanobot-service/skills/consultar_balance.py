"""
Nanobot Skill: Consultar Balance
Allows users to query their spending balance and budget via WhatsApp.
"""
import os
import requests


# Configuration from environment variables
FINANCE_BOT_BALANCE_URL = os.getenv(
    "FINANCE_BOT_BALANCE_URL",
    "http://finance-service:8000/api/bot/balance/"
)
FINANCE_BOT_TIMEOUT_SECONDS = int(os.getenv("FINANCE_BOT_TIMEOUT_SECONDS", "10"))


def consultar_balance(phone_number: str) -> dict:
    """
    Query user's balance, spending, and budget information.
    
    Args:
        phone_number (str): WhatsApp phone number with country code (e.g., +5215512345678)
    
    Returns:
        dict: {
            "ok": True/False,
            "message": str (human-readable summary),
            "data": dict (detailed balance information)
        }
    
    Example:
        User says: "¿Cuál es mi balance?" or "¿Cuánto he gastado?"
        LLM extracts: phone_number from sender
        Tool calls: consultar_balance(phone_number="+5215512345678")
        Returns: Summary of spending and budget
    """
    # Validate phone_number
    if not phone_number or not isinstance(phone_number, str):
        return {
            "ok": False,
            "error": "phone_number is required and must be a string",
            "message": "Error: número de teléfono inválido"
        }
    
    phone_number = phone_number.strip()
    if not phone_number.startswith("+"):
        return {
            "ok": False,
            "error": "phone_number must include country code (start with +)",
            "message": "Error: el número debe incluir código de país (ej: +52...)"
        }
    
    # Make GET request to finance-service
    try:
        response = requests.get(
            FINANCE_BOT_BALANCE_URL,
            params={"phone_number": phone_number},
            timeout=FINANCE_BOT_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        data = response.json()
        
        if not data.get("ok"):
            return {
                "ok": False,
                "error": data.get("error", "Unknown error"),
                "message": f"Error al consultar balance: {data.get('error', 'desconocido')}"
            }
        
        # Format human-readable message
        shared = data.get("shared", {})
        personal = data.get("personal", {})
        savings = data.get("savings", {})
        summary = data.get("summary", {})
        recent = data.get("recent_transactions", [])
        
        message_parts = []
        
        shared_month_spent = float(shared.get("month_spent", 0) or 0)
        personal_month_spent = float(personal.get("month_spent", 0) or 0)
        shared_total_spent = float(shared.get("total_spent", 0) or 0)
        personal_total_spent = float(personal.get("total_spent", 0) or 0)

        shared_month_savings = float(savings.get("shared_month", 0) or 0)
        personal_month_savings = float(savings.get("personal_month", 0) or 0)
        shared_total_savings = float(savings.get("shared_total", 0) or 0)
        personal_total_savings = float(savings.get("personal_total", 0) or 0)

        month_spent_combined = float(summary.get("month_spent_combined", 0) or 0)
        total_spent_combined = float(summary.get("total_spent_combined", 0) or 0)
        month_savings_combined = float(savings.get("combined_month", 0) or 0)
        total_savings_combined = float(savings.get("combined_total", 0) or 0)

        message_parts.append("📊 Resumen de cuenta")
        message_parts.append("")
        message_parts.append("👥 Compartido")
        message_parts.append(f"- Gastos mes: ${shared_month_spent:.2f}")
        message_parts.append(f"- Gastos total: ${shared_total_spent:.2f}")
        message_parts.append(f"- Ahorros mes: ${shared_month_savings:.2f}")
        message_parts.append(f"- Ahorros total: ${shared_total_savings:.2f}")
        if shared.get("month_budget"):
            remaining = float(shared.get("remaining", 0) or 0)
            message_parts.append(f"- Presupuesto mes: ${float(shared.get('month_budget', 0)):.2f}")
            message_parts.append(f"- Disponible: ${remaining:.2f}")

        message_parts.append("")
        message_parts.append("👤 Personal")
        message_parts.append(f"- Gastos mes: ${personal_month_spent:.2f}")
        message_parts.append(f"- Gastos total: ${personal_total_spent:.2f}")
        message_parts.append(f"- Ahorros mes: ${personal_month_savings:.2f}")
        message_parts.append(f"- Ahorros total: ${personal_total_savings:.2f}")
        if personal.get("month_budget"):
            remaining = float(personal.get("remaining", 0) or 0)
            message_parts.append(f"- Presupuesto mes: ${float(personal.get('month_budget', 0)):.2f}")
            message_parts.append(f"- Disponible: ${remaining:.2f}")

        message_parts.append("")
        message_parts.append("🔗 Unido (Compartido + Personal)")
        message_parts.append(f"- Gastos mes: ${month_spent_combined:.2f}")
        message_parts.append(f"- Gastos total: ${total_spent_combined:.2f}")
        message_parts.append(f"- Ahorros mes: ${month_savings_combined:.2f}")
        message_parts.append(f"- Ahorros total: ${total_savings_combined:.2f}")
        
        # Recent transactions
        if recent:
            message_parts.append("\n📝 Últimos gastos:")
            for tx in recent[:3]:  # Show only top 3
                tipo = "Compartido" if tx.get("is_shared") else "Personal"
                message_parts.append(f"   • ${tx['amount']:.2f} - {tx['concept']} ({tipo})")
        
        message = "\n".join(message_parts)
        
        return {
            "ok": True,
            "message": message,
            "data": data,
            "backend_response": data
        }
        
    except requests.exceptions.Timeout:
        return {
            "ok": False,
            "error": f"Request timeout after {FINANCE_BOT_TIMEOUT_SECONDS}s",
            "message": "Error: el servidor tardó demasiado en responder. Intenta de nuevo."
        }
    except requests.exceptions.ConnectionError:
        return {
            "ok": False,
            "error": f"Connection error to {FINANCE_BOT_BALANCE_URL}",
            "message": "Error: no se pudo conectar al servidor. Verifica tu conexión."
        }
    except requests.exceptions.HTTPError as e:
        error_detail = "Unknown error"
        try:
            error_data = e.response.json()
            error_detail = error_data.get("error", str(e))
        except:
            error_detail = str(e)
        
        return {
            "ok": False,
            "error": error_detail,
            "message": f"Error al consultar balance: {error_detail}"
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "message": f"Error inesperado: {str(e)}"
        }


# Nanobot tool specification for LLM
TOOL_SPEC = {
    "type": "function",
    "function": {
        "name": "consultar_balance",
        "description": (
            "Query user's spending balance, budget, and recent transactions. "
            "Use when user asks about their balance, spending, budget status, "
            "or how much they've spent. Examples: '¿cuál es mi balance?', "
            "'¿cuánto he gastado?', '¿me queda presupuesto?', 'muéstrame mis gastos'"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "phone_number": {
                    "type": "string",
                    "description": (
                        "User's WhatsApp phone number with country code. "
                        "This should be extracted from the incoming message sender. "
                        "Format: +[country_code][phone_number] (e.g., +5215512345678)"
                    )
                }
            },
            "required": ["phone_number"]
        }
    }
}
