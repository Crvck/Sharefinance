from rest_framework import serializers

from django.db import transaction

from .models import BudgetCategory, MonthlyBudget, SavingsContribution, SavingsGoal, SharedWorkspace, Transaction


class SharedWorkspaceSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField()

    class Meta:
        model = SharedWorkspace
        fields = ["id", "name", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = [
            "id",
            "workspace",
            "created_by_user_id",
            "created_by_user_email",
            "amount",
            "concept",
            "transaction_date",
            "category",
            "is_shared",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SavingsGoalSerializer(serializers.ModelSerializer):
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = SavingsGoal
        fields = [
            "id",
            "workspace",
            "name",
            "target_amount",
            "current_amount",
            "created_by_user_id",
            "created_by_user_email",
            "target_date",
            "is_shared",
            "progress_percent",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "progress_percent"]

    def get_progress_percent(self, obj):
        if not obj.target_amount:
            return 0
        return round(float((obj.current_amount / obj.target_amount) * 100), 2)


class MonthlyBudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonthlyBudget
        fields = [
            "id",
            "workspace",
            "month",
            "income_amount",
            "created_by_user_id",
            "is_shared",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class BudgetCategorySerializer(serializers.ModelSerializer):
    percentage_of_income = serializers.SerializerMethodField()

    class Meta:
        model = BudgetCategory
        fields = [
            "id",
            "budget",
            "name",
            "planned_amount",
            "percentage_of_income",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "percentage_of_income"]

    def get_percentage_of_income(self, obj):
        income = obj.budget.income_amount
        if not income:
            return 0
        return round(float((obj.planned_amount / income) * 100), 2)


class SavingsContributionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingsContribution
        fields = [
            "id",
            "workspace",
            "savings_goal",
            "amount",
            "contribution_date",
            "created_by_user_id",
            "created_by_user_email",
            "notes",
            "is_shared",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    @transaction.atomic
    def create(self, validated_data):
        goal = validated_data["savings_goal"]
        # Heredar is_shared del goal
        validated_data["is_shared"] = goal.is_shared
        contribution = super().create(validated_data)
        goal.current_amount = goal.current_amount + contribution.amount
        goal.save(update_fields=["current_amount", "updated_at"])
        return contribution
