from django.contrib import admin
from .models import (
	BudgetCategory,
	MonthlyBudget,
	SavingsContribution,
	SharedWorkspace,
	SavingsGoal,
	Transaction,
)

admin.site.register(SharedWorkspace)
admin.site.register(Transaction)
admin.site.register(SavingsGoal)
admin.site.register(SavingsContribution)
admin.site.register(MonthlyBudget)
admin.site.register(BudgetCategory)
