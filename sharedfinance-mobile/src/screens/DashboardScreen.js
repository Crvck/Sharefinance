import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { useAuth } from "../context/AuthContext";
import { financeApi } from "../services/api";

const CHART_COLORS = ["#2563eb", "#0d9488", "#dc2626", "#7c3aed", "#ea580c", "#0891b2", "#65a30d"];

export default function DashboardScreen({ navigation }) {
  const { activeWorkspaceId, currentUser, signOut } = useAuth();
  const [dashboard, setDashboard] = useState({
    balance: 0,
    month_spent: 0,
    spent_by_user: [],
    monthly_budget: null,
  });
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // NUEVO: Estado para modo de vista (personal vs compartido)
  const [viewMode, setViewMode] = useState("shared"); // "personal" | "shared"

  const [entryType, setEntryType] = useState("expense");
  const [conceptInput, setConceptInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [selectedGoalId, setSelectedGoalId] = useState("");

  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [categoryPlannedAmountInput, setCategoryPlannedAmountInput] = useState("");

  const selectedMonthBudget = dashboard.monthly_budget;
  const categories = selectedMonthBudget?.categories || [];
  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  const currentMonthPrefix = new Date().toISOString().slice(0, 7);

  const monthTransactions = useMemo(
    () => (transactions || []).filter((item) => String(item.transaction_date || "").startsWith(currentMonthPrefix)),
    [transactions, currentMonthPrefix]
  );

  const categorySpend = useMemo(() => {
    const totals = {};
    monthTransactions.forEach((item) => {
      const key = (item.category || "Sin categoria").trim() || "Sin categoria";
      totals[key] = (totals[key] || 0) + Number(item.amount || 0);
    });
    return Object.entries(totals)
      .map(([name, amount], index) => ({ name, amount, color: CHART_COLORS[index % CHART_COLORS.length] }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTransactions]);

  const monthlyIncome = Number(selectedMonthBudget?.income_amount || 0);
  const monthSpent = Number(dashboard.month_spent || 0);
  const spentPct = monthlyIncome > 0 ? Math.min((monthSpent / monthlyIncome) * 100, 100) : 0;
  const remainingPct = monthlyIncome > 0 ? Math.max(100 - spentPct, 0) : 0;

  const pieData = useMemo(() => {
    if (monthlyIncome <= 0) {
      return [];
    }

    const slices = categorySpend
      .map((item) => ({
        label: item.name,
        value: Math.max((item.amount / monthlyIncome) * 100, 0),
        amount: item.amount,
        color: item.color,
      }))
      .filter((item) => item.value > 0.01);

    if (remainingPct > 0.01) {
      slices.push({
        label: "Disponible",
        value: remainingPct,
        amount: Math.max(monthlyIncome - monthSpent, 0),
        color: "#cbd5e1",
      });
    }

    return slices;
  }, [categorySpend, monthlyIncome, monthSpent, remainingPct]);

  const parseAmount = (rawValue) => {
    if (!rawValue) {
      return NaN;
    }
    return Number(rawValue.replace(",", ".").trim());
  };

  const formatAmountInput = (value) => {
    const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
    const [intPart = "", decimalPart = ""] = cleaned.split(".");
    const safeInt = intPart.replace(/^0+(?=\d)/, "");
    if (cleaned.includes(".")) {
      return `${safeInt || "0"}.${decimalPart.slice(0, 2)}`;
    }
    return safeInt;
  };

  const formatDateInput = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 4) {
      return digits;
    }
    if (digits.length <= 6) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  };

  const loadData = useCallback(async () => {
    if (!activeWorkspaceId || !currentUser?.id) {
      return;
    }
    try {
      setErrorMessage("");
      
      // Construir parámetros de query según el modo de vista
      const queryParams = `workspace_id=${activeWorkspaceId}&view_mode=${viewMode}&user_id=${currentUser.id}`;
      
      const [dashboardRes, transactionsRes, goalsRes] = await Promise.all([
        financeApi.get(`/dashboard/?${queryParams}`),
        financeApi.get(`/transactions/?${queryParams}`),
        financeApi.get(`/savings-goals/?${queryParams}`),
      ]);
      const payload = dashboardRes.data || {};
      setDashboard(payload);
      setTransactions(transactionsRes.data || []);
      setGoals(goalsRes.data || []);
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || "No se pudo cargar el dashboard");
    }
  }, [activeWorkspaceId, currentUser, viewMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const addBudgetCategory = async () => {
    if (!selectedMonthBudget?.id) {
      setErrorMessage("Configura primero tu ingreso mensual en Configuracion");
      return;
    }

    const parsedAmount = parseAmount(categoryPlannedAmountInput);
    if (!categoryNameInput.trim()) {
      setErrorMessage("Escribe nombre de categoria");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setErrorMessage("Monto de categoria invalido");
      return;
    }

    try {
      setErrorMessage("");
      await financeApi.post("/budget-categories/", {
        budget: selectedMonthBudget.id,
        name: categoryNameInput.trim(),
        planned_amount: parsedAmount,
      });
      setCategoryNameInput("");
      setCategoryPlannedAmountInput("");
      await loadData();
    } catch (error) {
      const detail =
        error?.response?.data?.non_field_errors?.[0] ||
        error?.response?.data?.detail ||
        "No se pudo guardar categoria";
      setErrorMessage(detail);
    }
  };

  const addExpense = async () => {
    const parsedAmount = parseAmount(amountInput);
    if (!conceptInput.trim()) {
      setErrorMessage("Escribe un concepto para el gasto");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Escribe un monto valido mayor a 0");
      return;
    }
    if (!categoryInput.trim()) {
      setErrorMessage("Selecciona o escribe una categoria");
      return;
    }

    const isShared = viewMode === "shared";

    await financeApi.post("/transactions/", {
      workspace: activeWorkspaceId,
      created_by_user_id: currentUser.id,
      created_by_user_email: currentUser.email || "",
      amount: parsedAmount,
      concept: conceptInput.trim(),
      category: categoryInput.trim(),
      transaction_date: dateInput,
      is_shared: isShared,
    });
  };

  const addSavingsContribution = async () => {
    const parsedAmount = parseAmount(amountInput);
    if (!selectedGoalId) {
      setErrorMessage("Selecciona un guardadito");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Escribe un monto valido mayor a 0");
      return;
    }

    await financeApi.post("/savings-contributions/", {
      workspace: activeWorkspaceId,
      savings_goal: selectedGoalId,
      amount: parsedAmount,
      contribution_date: dateInput,
      created_by_user_id: currentUser.id,
      created_by_user_email: currentUser.email || "",
      notes: conceptInput.trim(),
    });
  };

  const submitEntry = async () => {
    if (!activeWorkspaceId || !currentUser?.id) {
      return;
    }

    try {
      setErrorMessage("");
      if (entryType === "expense") {
        await addExpense();
      } else {
        await addSavingsContribution();
      }
      setConceptInput("");
      setAmountInput("");
      setDateInput(new Date().toISOString().slice(0, 10));
      await loadData();
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || "No se pudo guardar registro");
    }
  };

  const renderPie = () => {
    const size = 180;
    const strokeWidth = 26;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let cumulative = 0;

    return (
      <View style={styles.pieWrap}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {pieData.map((slice, index) => {
              const percent = Math.min(Math.max(slice.value, 0), 100);
              const segmentLength = (percent / 100) * circumference;
              const offset = circumference - (cumulative / 100) * circumference;
              cumulative += percent;

              return (
                <Circle
                  key={`${slice.label}-${index}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${segmentLength} ${circumference}`}
                  strokeDashoffset={offset}
                  strokeLinecap="butt"
                />
              );
            })}
          </G>
        </Svg>
        <View style={styles.pieCenterTextWrap}>
          <Text style={styles.pieCenterTop}>Gasto</Text>
          <Text style={styles.pieCenterPct}>{spentPct.toFixed(1)}%</Text>
          <Text style={styles.pieCenterBottom}>Disponible {remainingPct.toFixed(1)}%</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Hola, {currentUser?.email || "pareja"}</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Salir</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topActionsRow}>
          <TouchableOpacity style={styles.topActionBtn} onPress={() => navigation.navigate("ExpenseHistory")}>
            <Text style={styles.topActionBtnText}>Historial conjunto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topActionBtn} onPress={() => navigation.navigate("Settings")}>
            <Text style={styles.topActionBtnText}>Configuracion</Text>
          </TouchableOpacity>
        </View>

        {/* NUEVO: Switch para Personal/Compartido */}
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === "personal" && styles.viewModeBtnActive]}
            onPress={() => setViewMode("personal")}
          >
            <Text style={[styles.viewModeBtnText, viewMode === "personal" && styles.viewModeBtnTextActive]}>
              Lo Mío
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === "shared" && styles.viewModeBtnActive]}
            onPress={() => setViewMode("shared")}
          >
            <Text style={[styles.viewModeBtnText, viewMode === "shared" && styles.viewModeBtnTextActive]}>
              Lo Nuestro
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Ingreso Mensual</Text>
            <Text style={styles.incomeValue}>$ {monthlyIncome.toFixed(2)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Gasto Mes</Text>
            <Text style={styles.expenseValue}>$ {monthSpent.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Ingreso vs Gastos por Categoria</Text>
          {!!pieData.length ? (
            <>
              {renderPie()}
              <View style={styles.legendWrap}>
                {pieData.map((item, index) => (
                  <View key={`${item.label}-${index}`} style={styles.legendItem}>
                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>
                      {item.label}: $ {Number(item.amount || 0).toFixed(2)} ({item.value.toFixed(1)}%)
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>
              Configura tu ingreso mensual en Configuracion para ver el grafico de pastel.
            </Text>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Categorias de Presupuesto</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre categoria (ej. Comida)"
            value={categoryNameInput}
            onChangeText={setCategoryNameInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Monto categoria (ej. 500)"
            keyboardType="decimal-pad"
            value={categoryPlannedAmountInput}
            onChangeText={(text) => setCategoryPlannedAmountInput(formatAmountInput(text))}
          />
          <TouchableOpacity style={styles.secondaryActionBtn} onPress={addBudgetCategory}>
            <Text style={styles.secondaryActionBtnText}>Agregar Categoria</Text>
          </TouchableOpacity>

          {!!categories.length && (
            <View style={styles.categoriesWrap}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>
                    {cat.name}: $ {Number(cat.planned_amount).toFixed(2)} ({Number(cat.percentage_of_income).toFixed(2)}%)
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Registrar movimiento</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, entryType === "expense" && styles.toggleBtnActive]}
              onPress={() => setEntryType("expense")}
            >
              <Text style={[styles.toggleText, entryType === "expense" && styles.toggleTextActive]}>Gasto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, entryType === "savings" && styles.toggleBtnActive]}
              onPress={() => setEntryType("savings")}
            >
              <Text style={[styles.toggleText, entryType === "savings" && styles.toggleTextActive]}>Guardadito</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder={entryType === "expense" ? "Concepto (ej. Supermercado)" : "Nota (opcional)"}
            value={conceptInput}
            onChangeText={setConceptInput}
          />

          {entryType === "expense" ? (
            <>
              {!!categoryNames.length && (
                <View style={styles.categoriesWrap}>
                  {categoryNames.map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.categoryOption, categoryInput === name && styles.categoryOptionSelected]}
                      onPress={() => setCategoryInput(name)}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          categoryInput === name && styles.categoryOptionTextSelected,
                        ]}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Categoria"
                value={categoryInput}
                onChangeText={setCategoryInput}
              />
            </>
          ) : (
            <View style={styles.categoriesWrap}>
              {(goals || []).map((goal) => (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.categoryOption, selectedGoalId === goal.id && styles.categoryOptionSelected]}
                  onPress={() => setSelectedGoalId(goal.id)}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      selectedGoalId === goal.id && styles.categoryOptionTextSelected,
                    ]}
                  >
                    {goal.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Monto"
            keyboardType="decimal-pad"
            value={amountInput}
            onChangeText={(text) => setAmountInput(formatAmountInput(text))}
          />
          <TextInput
            style={styles.input}
            placeholder="Fecha YYYY-MM-DD"
            value={dateInput}
            onChangeText={(text) => setDateInput(formatDateInput(text))}
          />
          <TouchableOpacity style={styles.secondaryActionBtn} onPress={submitEntry}>
            <Text style={styles.secondaryActionBtnText}>
              {entryType === "expense" ? "Guardar Gasto" : "Guardar Aporte a Guardadito"}
            </Text>
          </TouchableOpacity>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("SavingsGoals")}>
          <Text style={styles.primaryBtnText}>Ver Guardaditos</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7f8",
  },
  container: {
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#102a43",
  },
  subtitle: {
    marginTop: 4,
    color: "#486581",
    fontSize: 14,
  },
  topActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  topActionBtn: {
    flex: 1,
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  topActionBtnText: {
    color: "#1e3a8a",
    fontWeight: "700",
  },
  viewModeToggle: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  viewModeBtn: {
    flex: 1,
    backgroundColor: "#f0f4f8",
    borderWidth: 2,
    borderColor: "#cbd5e0",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  viewModeBtnActive: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  viewModeBtnText: {
    color: "#486581",
    fontWeight: "700",
    fontSize: 15,
  },
  viewModeBtnTextActive: {
    color: "#ffffff",
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#d9e2ec",
  },
  secondaryBtnText: {
    color: "#102a43",
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#d9e2ec",
  },
  cardLabel: {
    color: "#627d98",
    fontSize: 12,
    fontWeight: "600",
  },
  incomeValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "800",
    color: "#0f766e",
  },
  expenseValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "800",
    color: "#9f1239",
  },
  chartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    padding: 14,
    gap: 12,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#102a43",
  },
  pieWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  pieCenterTextWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  pieCenterTop: {
    fontSize: 12,
    color: "#486581",
    fontWeight: "600",
  },
  pieCenterPct: {
    fontSize: 26,
    color: "#102a43",
    fontWeight: "900",
  },
  pieCenterBottom: {
    fontSize: 11,
    color: "#627d98",
    fontWeight: "600",
  },
  legendWrap: {
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: "#243b53",
    fontWeight: "600",
    fontSize: 13,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#d9e2ec",
  },
  categoriesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryPill: {
    backgroundColor: "#eef6f6",
    borderWidth: 1,
    borderColor: "#bee3e2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryPillText: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 12,
  },
  categoryOption: {
    borderWidth: 1,
    borderColor: "#bfd7ed",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f3f8fd",
  },
  categoryOptionSelected: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  categoryOptionText: {
    color: "#1e3a8a",
    fontWeight: "700",
  },
  categoryOptionTextSelected: {
    color: "#ffffff",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  toggleBtnActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  toggleText: {
    color: "#1e293b",
    fontWeight: "700",
  },
  toggleTextActive: {
    color: "#ffffff",
  },
  secondaryActionBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryActionBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  primaryBtn: {
    marginBottom: 10,
    backgroundColor: "#0ea5a6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 8,
    color: "#627d98",
  },
  errorText: {
    color: "#b42318",
    fontWeight: "600",
  },
});
