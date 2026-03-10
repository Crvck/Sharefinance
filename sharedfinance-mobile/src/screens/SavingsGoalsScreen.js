import React, { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "../context/AuthContext";
import { financeApi } from "../services/api";

function ProgressBar({ value }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
    </View>
  );
}

export default function SavingsGoalsScreen({ navigation }) {
  const { activeWorkspaceId, currentUser } = useAuth();
  const [goals, setGoals] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [goalNameInput, setGoalNameInput] = useState("");
  const [targetAmountInput, setTargetAmountInput] = useState("");
  const [currentAmountInput, setCurrentAmountInput] = useState("0");
  const [targetDateInput, setTargetDateInput] = useState("");
  const [isShared, setIsShared] = useState(true); // NUEVO: Toggle para personal/compartido

  const loadGoals = useCallback(async () => {
    if (!activeWorkspaceId) {
      return;
    }
    try {
      setErrorMessage("");
      const response = await financeApi.get(`/savings-goals/?workspace_id=${activeWorkspaceId}`);
      setGoals(response.data || []);
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || "No se pudieron cargar guardaditos");
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadGoals();
    setIsRefreshing(false);
  };

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

  const createManualGoal = async () => {
    if (!activeWorkspaceId || !currentUser?.id) {
      return;
    }

    const parsedTarget = parseAmount(targetAmountInput);
    const parsedCurrent = parseAmount(currentAmountInput || "0");

    if (!goalNameInput.trim()) {
      setErrorMessage("Escribe un nombre para el guardadito");
      return;
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setErrorMessage("La meta debe ser un numero mayor a 0");
      return;
    }
    if (!Number.isFinite(parsedCurrent) || parsedCurrent < 0) {
      setErrorMessage("El monto actual debe ser un numero valido");
      return;
    }

    try {
      await financeApi.post("/savings-goals/", {
        workspace: activeWorkspaceId,
        name: goalNameInput.trim(),
        target_amount: parsedTarget,
        current_amount: parsedCurrent,
        created_by_user_id: currentUser.id,
        created_by_user_email: currentUser.email || "",
        target_date: targetDateInput.trim() || null,
        is_shared: isShared,
      });
      setGoalNameInput("");
      setTargetAmountInput("");
      setCurrentAmountInput("0");
      setTargetDateInput("");
      setIsShared(true);
      await loadGoals();
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || "No se pudo crear guardadito");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Guardaditos</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Crear Guardadito Manual</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre (ej. Viaje a la playa)"
            value={goalNameInput}
            onChangeText={setGoalNameInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Meta (ej. 5000)"
            keyboardType="decimal-pad"
            value={targetAmountInput}
            onChangeText={(text) => setTargetAmountInput(formatAmountInput(text))}
          />
          <TextInput
            style={styles.input}
            placeholder="Monto actual (ej. 200)"
            keyboardType="decimal-pad"
            value={currentAmountInput}
            onChangeText={(text) => setCurrentAmountInput(formatAmountInput(text))}
          />
          <TextInput
            style={styles.input}
            placeholder="Fecha objetivo YYYY-MM-DD (opcional)"
            value={targetDateInput}
            onChangeText={(text) => setTargetDateInput(formatDateInput(text))}
          />
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, !isShared && styles.toggleBtnActive]}
              onPress={() => setIsShared(false)}
            >
              <Text style={[styles.toggleBtnText, !isShared && styles.toggleBtnTextActive]}>Personal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, isShared && styles.toggleBtnActive]}
              onPress={() => setIsShared(true)}
            >
              <Text style={[styles.toggleBtnText, isShared && styles.toggleBtnTextActive]}>Compartido</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={createManualGoal} style={styles.createBtn}>
            <Text style={styles.createBtnText}>Guardar Guardadito</Text>
          </TouchableOpacity>
        </View>

        {goals.map((goal) => {
          const target = Number(goal.target_amount || 0);
          const current = Number(goal.current_amount || 0);
          const progress = target > 0 ? (current / target) * 100 : 0;
          return (
            <View key={goal.id} style={styles.goalCard}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <Text style={styles.goalNumbers}>
                $ {current.toFixed(2)} / $ {target.toFixed(2)}
              </Text>
              <ProgressBar value={progress} />
              <Text style={styles.goalPercent}>{progress.toFixed(1)}% completado</Text>
            </View>
          );
        })}

        {!goals.length ? <Text style={styles.emptyText}>Todavia no tienes guardaditos.</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
    gap: 14,
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
  createBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    padding: 14,
    gap: 10,
  },
  formTitle: {
    color: "#102a43",
    fontWeight: "800",
    fontSize: 17,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#d9e2ec",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: "#f0f4f8",
    borderWidth: 2,
    borderColor: "#cbd5e0",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  toggleBtnText: {
    color: "#486581",
    fontWeight: "700",
  },
  toggleBtnTextActive: {
    color: "#ffffff",
  },
  createBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  goalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    padding: 14,
  },
  goalName: {
    color: "#102a43",
    fontSize: 18,
    fontWeight: "800",
  },
  goalNumbers: {
    color: "#486581",
    marginTop: 6,
    marginBottom: 10,
    fontWeight: "600",
  },
  progressTrack: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    backgroundColor: "#e4ecef",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#0ea5a6",
  },
  goalPercent: {
    marginTop: 8,
    color: "#0f766e",
    fontWeight: "700",
  },
  emptyText: {
    color: "#627d98",
  },
  errorText: {
    color: "#b42318",
    fontWeight: "600",
  },
});
