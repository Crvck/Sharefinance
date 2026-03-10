"""Skill personalizada para Nanobot: registrar gastos en finance-service.

Esta herramienta recibe parametros extraidos por el LLM y envia un POST
al backend de Django para registrar una transaccion originada en WhatsApp.
"""

from __future__ import annotations

import os
from decimal import Decimal, InvalidOperation
from typing import Any

import requests

FINANCE_BOT_TRANSACTION_URL = os.getenv(
    "FINANCE_BOT_TRANSACTION_URL",
    "http://finance-service:8000/api/bot/transaction/",
)
FINANCE_BOT_TIMEOUT_SECONDS = float(os.getenv("FINANCE_BOT_TIMEOUT_SECONDS", "10"))


class RegistrarGastoError(Exception):
    """Error controlado de la skill registrar_gasto."""


def _normalize_amount(amount: Any) -> str:
    """Valida y normaliza el monto a string decimal con 2 decimales."""
    try:
        value = Decimal(str(amount).replace(",", ".").strip())
    except (InvalidOperation, AttributeError) as exc:
        raise RegistrarGastoError("Monto invalido. Ejemplo valido: 250.50") from exc

    if value <= 0:
        raise RegistrarGastoError("El monto debe ser mayor a 0")

    return f"{value:.2f}"


def registrar_gasto(
    phone_number: str,
    amount: Any,
    description: str,
    type: str,
) -> dict[str, Any]:
    """Registra un gasto en el finance-service.

    Args:
        phone_number: Numero del usuario (ej. +5215512345678)
        amount: Monto de la transaccion
        description: Descripcion corta del gasto
        type: Tipo de movimiento (ej. "expense", "shared", "personal")

    Returns:
        Dict con estado, mensaje y respuesta del backend.
    """
    if not phone_number or not str(phone_number).strip():
        raise RegistrarGastoError("phone_number es requerido")

    if not description or not str(description).strip():
        raise RegistrarGastoError("description es requerido")

    if not type or not str(type).strip():
        raise RegistrarGastoError("type es requerido")

    payload = {
        "phone_number": str(phone_number).strip(),
        "amount": _normalize_amount(amount),
        "description": str(description).strip(),
        "type": str(type).strip().lower(),
    }

    try:
        response = requests.post(
            FINANCE_BOT_TRANSACTION_URL,
            json=payload,
            timeout=FINANCE_BOT_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise RegistrarGastoError(f"No se pudo conectar con finance-service: {exc}") from exc

    if response.status_code >= 400:
        backend_msg = ""
        try:
            backend_msg = str(response.json())
        except Exception:
            backend_msg = response.text[:500]
        raise RegistrarGastoError(
            f"finance-service respondio {response.status_code}: {backend_msg}"
        )

    try:
        data = response.json()
    except ValueError:
        data = {"raw": response.text}

    return {
        "ok": True,
        "message": "Gasto registrado correctamente",
        "endpoint": FINANCE_BOT_TRANSACTION_URL,
        "payload_sent": payload,
        "backend_response": data,
    }


# Especificacion sugerida para registro de herramientas en frameworks de agentes.
TOOL_SPEC = {
    "name": "registrar_gasto",
    "description": (
        "Registra un gasto detectado desde lenguaje natural en WhatsApp "
        "enviandolo al finance-service de SharedFinance."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "phone_number": {
                "type": "string",
                "description": "Numero del usuario en formato internacional",
            },
            "amount": {
                "type": "string",
                "description": "Monto del gasto, por ejemplo 250.50",
            },
            "description": {
                "type": "string",
                "description": "Descripcion del gasto",
            },
            "type": {
                "type": "string",
                "description": "Tipo de movimiento (expense/shared/personal)",
            },
        },
        "required": ["phone_number", "amount", "description", "type"],
    },
}
