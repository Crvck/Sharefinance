from django.db.models import DecimalField, Sum, Value, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from decimal import Decimal, InvalidOperation

from .models import BudgetCategory, MonthlyBudget, SavingsContribution, SavingsGoal, SharedWorkspace, Transaction, WhatsAppUser
from .serializers import (
    BudgetCategorySerializer,
    MonthlyBudgetSerializer,
    SavingsContributionSerializer,
    SavingsGoalSerializer,
    SharedWorkspaceSerializer,
    TransactionSerializer,
)


class WorkspaceSyncViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    def create(self, request):
        serializer = SharedWorkspaceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace_id = serializer.validated_data["id"]
        defaults = {
            "name": serializer.validated_data["name"],
        }
        workspace, _ = SharedWorkspace.objects.update_or_create(id=workspace_id, defaults=defaults)
        return Response(SharedWorkspaceSerializer(workspace).data, status=status.HTTP_200_OK)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Transaction.objects.all().order_by("-transaction_date", "-created_at")
        workspace_id = self.request.query_params.get("workspace_id")
        view_mode = self.request.query_params.get("view_mode")  # "personal" | "shared"
        user_id = self.request.query_params.get("user_id")
        
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)
        
        # Filtrar por modo de vista
        if view_mode == "personal" and user_id:
            queryset = queryset.filter(is_shared=False, created_by_user_id=user_id)
        elif view_mode == "shared":
            queryset = queryset.filter(is_shared=True)
        
        return queryset


class SavingsGoalViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsGoalSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = SavingsGoal.objects.all().order_by("name")
        workspace_id = self.request.query_params.get("workspace_id")
        view_mode = self.request.query_params.get("view_mode")  # "personal" | "shared"
        user_id = self.request.query_params.get("user_id")
        
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)
        
        # Filtrar por modo de vista
        if view_mode == "personal" and user_id:
            queryset = queryset.filter(is_shared=False, created_by_user_id=user_id)
        elif view_mode == "shared":
            queryset = queryset.filter(is_shared=True)
        
        return queryset


class MonthlyBudgetViewSet(viewsets.ModelViewSet):
    serializer_class = MonthlyBudgetSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = MonthlyBudget.objects.all().order_by("-month", "-created_at")
        workspace_id = self.request.query_params.get("workspace_id")
        month = self.request.query_params.get("month")
        view_mode = self.request.query_params.get("view_mode")  # "personal" | "shared"
        user_id = self.request.query_params.get("user_id")
        
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)
        if month:
            queryset = queryset.filter(month=month)
        
        # Filtrar por modo de vista
        if view_mode == "personal" and user_id:
            queryset = queryset.filter(is_shared=False, created_by_user_id=user_id)
        elif view_mode == "shared":
            queryset = queryset.filter(is_shared=True)
        
        return queryset


class BudgetCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetCategorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = BudgetCategory.objects.select_related("budget").all().order_by("name")
        workspace_id = self.request.query_params.get("workspace_id")
        month = self.request.query_params.get("month")
        budget_id = self.request.query_params.get("budget_id")
        if budget_id:
            queryset = queryset.filter(budget_id=budget_id)
        if workspace_id:
            queryset = queryset.filter(budget__workspace_id=workspace_id)
        if month:
            queryset = queryset.filter(budget__month=month)
        return queryset


class SavingsContributionViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsContributionSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = SavingsContribution.objects.select_related("savings_goal").all().order_by(
            "-contribution_date", "-created_at"
        )
        workspace_id = self.request.query_params.get("workspace_id")
        view_mode = self.request.query_params.get("view_mode")  # "personal" | "shared"
        user_id = self.request.query_params.get("user_id")
        
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)
        
        # Filtrar por modo de vista
        if view_mode == "personal" and user_id:
            queryset = queryset.filter(is_shared=False, created_by_user_id=user_id)
        elif view_mode == "shared":
            queryset = queryset.filter(is_shared=True)
        
        return queryset


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def dashboard_view(request):
    workspace_id = request.query_params.get("workspace_id")
    view_mode = request.query_params.get("view_mode")  # "personal" | "shared"
    user_id = request.query_params.get("user_id")
    
    if not workspace_id:
        return Response({"detail": "workspace_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.localdate()
    first_day = now.replace(day=1)

    workspace_transactions = Transaction.objects.filter(workspace_id=workspace_id)
    
    # Filtrar transacciones según el modo de vista
    if view_mode == "personal" and user_id:
        workspace_transactions = workspace_transactions.filter(is_shared=False, created_by_user_id=user_id)
    elif view_mode == "shared":
        workspace_transactions = workspace_transactions.filter(is_shared=True)

    decimal_zero = Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))

    total_spent = workspace_transactions.aggregate(total=Coalesce(Sum("amount"), decimal_zero))["total"]

    month_spent = workspace_transactions.filter(transaction_date__gte=first_day).aggregate(
        total=Coalesce(Sum("amount"), decimal_zero)
    )["total"]

    spent_by_user_qs = (
        workspace_transactions.values("created_by_user_id")
        .annotate(total=Coalesce(Sum("amount"), decimal_zero))
        .order_by("-total")
    )

    spent_by_user = [
        {
            "user_id": row["created_by_user_id"],
            "total": float(row["total"]),
        }
        for row in spent_by_user_qs
    ]

    # Obtener presupuesto mensual según el modo
    budget_filter = {"workspace_id": workspace_id, "month": first_day}
    if view_mode == "personal" and user_id:
        budget_filter["is_shared"] = False
        budget_filter["created_by_user_id"] = user_id
    elif view_mode == "shared":
        budget_filter["is_shared"] = True
    
    current_month_budget = MonthlyBudget.objects.filter(**budget_filter).first()

    budget_payload = None
    if current_month_budget:
        categories_payload = BudgetCategorySerializer(
            current_month_budget.categories.all(),
            many=True,
        ).data
        budget_payload = {
            "id": str(current_month_budget.id),
            "month": str(current_month_budget.month),
            "income_amount": float(current_month_budget.income_amount),
            "is_shared": current_month_budget.is_shared,
            "categories": categories_payload,
        }

    return Response(
        {
            "workspace_id": workspace_id,
            "view_mode": view_mode or "all",
            "balance": float(-total_spent),
            "month_spent": float(month_spent),
            "spent_by_user": spent_by_user,
            "monthly_budget": budget_payload,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def activity_history_view(request):
    workspace_id = request.query_params.get("workspace_id")
    view_mode = request.query_params.get("view_mode")  # "personal" | "shared"
    user_id = request.query_params.get("user_id")
    
    if not workspace_id:
        return Response({"detail": "workspace_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    tx_items = Transaction.objects.filter(workspace_id=workspace_id)
    contribution_items = SavingsContribution.objects.filter(workspace_id=workspace_id)
    
    # Filtrar según el modo de vista
    if view_mode == "personal" and user_id:
        tx_items = tx_items.filter(is_shared=False, created_by_user_id=user_id)
        contribution_items = contribution_items.filter(is_shared=False, created_by_user_id=user_id)
    elif view_mode == "shared":
        tx_items = tx_items.filter(is_shared=True)
        contribution_items = contribution_items.filter(is_shared=True)
    
    tx_items = tx_items.order_by("-transaction_date", "-created_at")
    contribution_items = contribution_items.order_by("-contribution_date", "-created_at")

    tx_payload = [
        {
            "id": str(item.id),
            "type": "expense",
            "date": str(item.transaction_date),
            "amount": float(item.amount),
            "category": item.category,
            "concept": item.concept,
            "goal_name": "",
            "is_shared": item.is_shared,
            "created_by_user_id": str(item.created_by_user_id),
            "created_by_user_email": item.created_by_user_email,
            "created_at": item.created_at,
        }
        for item in tx_items
    ]

    contribution_payload = [
        {
            "id": str(item.id),
            "type": "savings",
            "date": str(item.contribution_date),
            "amount": float(item.amount),
            "category": "",
            "concept": item.notes,
            "goal_name": item.savings_goal.name,
            "is_shared": item.is_shared,
            "created_by_user_id": str(item.created_by_user_id),
            "created_by_user_email": item.created_by_user_email,
            "created_at": item.created_at,
        }
        for item in contribution_items
    ]

    combined = sorted(
        [*tx_payload, *contribution_payload],
        key=lambda x: (x["date"], x["created_at"]),
        reverse=True,
    )
    for item in combined:
        item.pop("created_at", None)

    return Response(combined)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def bot_transaction_view(request):
    """
    Endpoint for WhatsApp bot to register expenses.
    Expects: { phone_number, amount, description, type }
    """
    phone_number = request.data.get("phone_number", "").strip()
    amount_raw = request.data.get("amount")
    description = request.data.get("description", "").strip()
    transaction_type = request.data.get("type", "gasto").strip().lower()

    # Validación de campos requeridos
    if not phone_number:
        return Response(
            {"ok": False, "error": "phone_number is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not amount_raw:
        return Response(
            {"ok": False, "error": "amount is required"},
            status=status.HTTP_400_BAD_REQUEST
        )
    if not description:
        return Response(
            {"ok": False, "error": "description is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validar y convertir monto
    try:
        amount = Decimal(str(amount_raw))
        if amount <= 0:
            return Response(
                {"ok": False, "error": "amount must be greater than zero"},
                status=status.HTTP_400_BAD_REQUEST
            )
    except (ValueError, InvalidOperation):
        return Response(
            {"ok": False, "error": f"Invalid amount format: {amount_raw}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Buscar usuario de WhatsApp
    try:
        whatsapp_user = WhatsAppUser.objects.get(phone_number=phone_number, is_active=True)
    except WhatsAppUser.DoesNotExist:
        return Response(
            {"ok": False, "error": f"Phone number {phone_number} not registered or inactive"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Crear transacción
    transaction = Transaction.objects.create(
        workspace=whatsapp_user.workspace,
        created_by_user_id=whatsapp_user.user_id,
        created_by_user_email=whatsapp_user.user_email,
        amount=amount,
        concept=description,
        transaction_date=timezone.localdate(),
        category="Bot",
        is_shared=True  # Por defecto, gastos del bot son compartidos
    )

    return Response(
        {
            "ok": True,
            "message": f"Gasto registrado: {description} por ${amount}",
            "transaction": {
                "id": str(transaction.id),
                "workspace_id": str(transaction.workspace_id),
                "amount": float(transaction.amount),
                "concept": transaction.concept,
                "date": str(transaction.transaction_date),
                "category": transaction.category,
                "is_shared": transaction.is_shared,
                "created_by": whatsapp_user.user_email or str(whatsapp_user.user_id)
            }
        },
        status=status.HTTP_201_CREATED
    )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def bot_balance_view(request):
    """
    Endpoint for WhatsApp bot to query user balance and spending.
    Expects query param: phone_number
    """
    phone_number = request.query_params.get("phone_number", "").strip()

    if not phone_number:
        return Response(
            {"ok": False, "error": "phone_number is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Buscar usuario de WhatsApp
    try:
        whatsapp_user = WhatsAppUser.objects.get(phone_number=phone_number, is_active=True)
    except WhatsAppUser.DoesNotExist:
        return Response(
            {"ok": False, "error": f"Phone number {phone_number} not registered or inactive"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Calcular balance y estadísticas
    now = timezone.localdate()
    first_day = now.replace(day=1)
    
    # Transacciones compartidas del workspace
    shared_transactions = Transaction.objects.filter(
        workspace=whatsapp_user.workspace,
        is_shared=True
    )
    
    # Transacciones personales del usuario
    personal_transactions = Transaction.objects.filter(
        workspace=whatsapp_user.workspace,
        is_shared=False,
        created_by_user_id=whatsapp_user.user_id
    )

    decimal_zero = Value(0, output_field=DecimalField(max_digits=12, decimal_places=2))

    # Total gastado compartido
    total_shared = shared_transactions.aggregate(total=Coalesce(Sum("amount"), decimal_zero))["total"]
    
    # Total gastado personal
    total_personal = personal_transactions.aggregate(total=Coalesce(Sum("amount"), decimal_zero))["total"]
    
    # Gastos del mes actual
    month_shared = shared_transactions.filter(transaction_date__gte=first_day).aggregate(
        total=Coalesce(Sum("amount"), decimal_zero)
    )["total"]
    
    month_personal = personal_transactions.filter(transaction_date__gte=first_day).aggregate(
        total=Coalesce(Sum("amount"), decimal_zero)
    )["total"]

    # Presupuesto mensual compartido
    shared_budget = MonthlyBudget.objects.filter(
        workspace=whatsapp_user.workspace,
        month=first_day,
        is_shared=True
    ).aggregate(total=Coalesce(Sum("income_amount"), decimal_zero))["total"]

    # Presupuesto mensual personal
    personal_budget = MonthlyBudget.objects.filter(
        workspace=whatsapp_user.workspace,
        month=first_day,
        is_shared=False,
        created_by_user_id=whatsapp_user.user_id
    ).aggregate(total=Coalesce(Sum("income_amount"), decimal_zero))["total"]

    # Ahorros (aportaciones) por seccion
    shared_savings_qs = SavingsContribution.objects.filter(
        workspace=whatsapp_user.workspace,
        is_shared=True,
    )
    personal_savings_qs = SavingsContribution.objects.filter(
        workspace=whatsapp_user.workspace,
        is_shared=False,
        created_by_user_id=whatsapp_user.user_id,
    )

    shared_savings_total = shared_savings_qs.aggregate(total=Coalesce(Sum("amount"), decimal_zero))["total"]
    personal_savings_total = personal_savings_qs.aggregate(total=Coalesce(Sum("amount"), decimal_zero))["total"]

    shared_savings_month = shared_savings_qs.filter(contribution_date__gte=first_day).aggregate(
        total=Coalesce(Sum("amount"), decimal_zero)
    )["total"]
    personal_savings_month = personal_savings_qs.filter(contribution_date__gte=first_day).aggregate(
        total=Coalesce(Sum("amount"), decimal_zero)
    )["total"]

    # Últimas transacciones (5 más recientes)
    recent_transactions = Transaction.objects.filter(
        workspace=whatsapp_user.workspace
    ).filter(
        Q(is_shared=True) | 
        Q(is_shared=False, created_by_user_id=whatsapp_user.user_id)
    ).order_by("-transaction_date", "-created_at")[:5]

    recent_list = [
        {
            "amount": float(tx.amount),
            "concept": tx.concept,
            "date": str(tx.transaction_date),
            "category": tx.category,
            "is_shared": tx.is_shared
        }
        for tx in recent_transactions
    ]

    return Response(
        {
            "ok": True,
            "user": {
                "phone": phone_number,
                "email": whatsapp_user.user_email,
                "workspace": whatsapp_user.workspace.name
            },
            "shared": {
                "total_spent": float(total_shared),
                "month_spent": float(month_shared),
                "month_budget": float(shared_budget),
                "remaining": float(shared_budget - month_shared) if shared_budget else None
            },
            "personal": {
                "total_spent": float(total_personal),
                "month_spent": float(month_personal),
                "month_budget": float(personal_budget),
                "remaining": float(personal_budget - month_personal) if personal_budget else None
            },
            "savings": {
                "shared_total": float(shared_savings_total),
                "shared_month": float(shared_savings_month),
                "personal_total": float(personal_savings_total),
                "personal_month": float(personal_savings_month),
                "combined_total": float(shared_savings_total + personal_savings_total),
                "combined_month": float(shared_savings_month + personal_savings_month),
            },
            "recent_transactions": recent_list,
            "summary": {
                "total_spent_combined": float(total_shared + total_personal),
                "month_spent_combined": float(month_shared + month_personal),
                "month": str(first_day)
            }
        },
        status=status.HTTP_200_OK
    )
