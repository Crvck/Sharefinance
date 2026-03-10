from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    SavingsContributionViewSet,
    BudgetCategoryViewSet,
    MonthlyBudgetViewSet,
    SavingsGoalViewSet,
    TransactionViewSet,
    WorkspaceSyncViewSet,
    activity_history_view,
    dashboard_view,
    bot_transaction_view,
    bot_balance_view,
)

router = DefaultRouter()
router.register(r"workspaces", WorkspaceSyncViewSet, basename="workspace-sync")
router.register(r"transactions", TransactionViewSet, basename="transactions")
router.register(r"savings-goals", SavingsGoalViewSet, basename="savings-goals")
router.register(r"monthly-budgets", MonthlyBudgetViewSet, basename="monthly-budgets")
router.register(r"budget-categories", BudgetCategoryViewSet, basename="budget-categories")
router.register(r"savings-contributions", SavingsContributionViewSet, basename="savings-contributions")

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/", dashboard_view, name="dashboard"),
    path("activity-history/", activity_history_view, name="activity-history"),
    path("bot/balance/", bot_balance_view, name="bot-balance"),
    path("bot/transaction/", bot_transaction_view, name="bot-transaction"),
]
