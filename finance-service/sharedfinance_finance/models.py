import uuid
from django.db import models
from django.db.models import Q


class SharedWorkspace(models.Model):
    # Mirrored workspace table in finance DB for service-local consistency.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shared_workspace"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Transaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        SharedWorkspace,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    created_by_user_id = models.UUIDField()
    created_by_user_email = models.EmailField(blank=True, default="")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    concept = models.CharField(max_length=255)
    transaction_date = models.DateField()
    category = models.CharField(max_length=100, blank=True)
    is_shared = models.BooleanField(default=True, help_text="True=Compartido (visible para todos), False=Personal (solo para el creador)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transaction"
        ordering = ["-transaction_date", "-created_at"]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="transaction_amount_gt_zero"),
        ]

    def __str__(self):
        return f"{self.workspace_id}: {self.concept} ({self.amount})"


class SavingsGoal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        SharedWorkspace,
        on_delete=models.CASCADE,
        related_name="savings_goals",
    )
    name = models.CharField(max_length=150)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_by_user_id = models.UUIDField()
    created_by_user_email = models.EmailField(blank=True, default="")
    target_date = models.DateField(null=True, blank=True)
    is_shared = models.BooleanField(default=True, help_text="True=Compartido (visible para todos), False=Personal (solo para el creador)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "savings_goal"
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(condition=Q(target_amount__gt=0), name="goal_target_amount_gt_zero"),
            models.CheckConstraint(condition=Q(current_amount__gte=0), name="goal_current_amount_gte_zero"),
        ]

    def __str__(self):
        return f"{self.name} ({self.current_amount}/{self.target_amount})"


class MonthlyBudget(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        SharedWorkspace,
        on_delete=models.CASCADE,
        related_name="monthly_budgets",
    )
    month = models.DateField(help_text="Use first day of month (YYYY-MM-01)")
    income_amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_shared = models.BooleanField(default=True, help_text="True=Aportacion compartida, False=Ingreso personal")
    created_by_user_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "monthly_budget"
        constraints = [
            models.UniqueConstraint(fields=["workspace", "month"], name="unique_budget_per_workspace_month"),
            models.CheckConstraint(condition=Q(income_amount__gt=0), name="income_amount_gt_zero"),
        ]
        ordering = ["-month", "-created_at"]

    def __str__(self):
        return f"{self.workspace_id} {self.month}: {self.income_amount}"


class BudgetCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    budget = models.ForeignKey(
        MonthlyBudget,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(max_length=120)
    planned_amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "budget_category"
        constraints = [
            models.UniqueConstraint(fields=["budget", "name"], name="unique_budget_category_name"),
            models.CheckConstraint(condition=Q(planned_amount__gte=0), name="planned_amount_gte_zero"),
        ]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name}: {self.planned_amount}"


class SavingsContribution(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        SharedWorkspace,
        on_delete=models.CASCADE,
        related_name="savings_contributions",
    )
    savings_goal = models.ForeignKey(
        SavingsGoal,
        on_delete=models.CASCADE,
        related_name="contributions",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    contribution_date = models.DateField()
    created_by_user_id = models.UUIDField()
    created_by_user_email = models.EmailField(blank=True, default="")
    is_shared = models.BooleanField(default=True, help_text="Hereda de savings_goal.is_shared")
    notes = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "savings_contribution"
        ordering = ["-contribution_date", "-created_at"]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="contribution_amount_gt_zero"),
        ]

    def __str__(self):
        return f"{self.savings_goal.name}: {self.amount}"


class WhatsAppUser(models.Model):
    """Maps WhatsApp phone numbers to SharedFinance users for bot integration."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(max_length=20, unique=True, help_text="WhatsApp phone with country code, e.g., +5215512345678")
    user_id = models.UUIDField(help_text="User ID from auth-service")
    user_email = models.EmailField(blank=True, default="")
    workspace = models.ForeignKey(
        SharedWorkspace,
        on_delete=models.CASCADE,
        related_name="whatsapp_users",
        help_text="Primary workspace for this WhatsApp user"
    )
    is_active = models.BooleanField(default=True, help_text="Enable/disable bot access for this phone")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "whatsapp_user"
        ordering = ["phone_number"]

    def __str__(self):
        return f"{self.phone_number} → {self.user_email or self.user_id}"
