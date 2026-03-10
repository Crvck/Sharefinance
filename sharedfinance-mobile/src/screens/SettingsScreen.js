import React, { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { authApi, financeApi } from "../services/api";

const currentMonthStr = new Date().toISOString().slice(0, 7);

export default function SettingsScreen({ navigation }) {
  const { activeWorkspaceId, currentUser, activeWorkspace } = useAuth();
  const [incomeMonthInput, setIncomeMonthInput] = useState(currentMonthStr);
  const [incomeInput, setIncomeInput] = useState("");
  const [isSharedIncome, setIsSharedIncome] = useState(true); // NUEVO: Toggle personal/compartido
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const parseAmount = (rawValue) => {
    if (!rawValue) {
      return NaN;
    }
    return Number(rawValue.replace(",", ".").trim());
  };

  const formatMonthInput = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (digits.length <= 4) {
      return digits;
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
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

  const loadCurrentBudget = useCallback(async () => {
    if (!activeWorkspaceId) {
      return;
    }

    try {
      const monthDate = `${incomeMonthInput}-01`;
      const modeQuery = isSharedIncome
        ? "view_mode=shared"
        : `view_mode=personal&user_id=${currentUser?.id || ""}`;
      const response = await financeApi.get(
        `/monthly-budgets/?workspace_id=${activeWorkspaceId}&month=${monthDate}&${modeQuery}`
      );
      const budget = response.data?.[0];
      if (budget?.income_amount) {
        setIncomeInput(String(budget.income_amount));
      } else {
        setIncomeInput("");
      }
    } catch {
      // Keep quiet in UI; users can still manually set a value.
    }
  }, [activeWorkspaceId, currentUser?.id, incomeMonthInput, isSharedIncome]);

  useEffect(() => {
    loadCurrentBudget();
  }, [loadCurrentBudget]);

  const updateMonthlyIncome = async () => {
    if (!activeWorkspaceId || !currentUser?.id) {
      return;
    }

    const parsedIncome = parseAmount(incomeInput);
    if (!Number.isFinite(parsedIncome) || parsedIncome <= 0) {
      setErrorMessage("Ingresa un monto mensual valido.");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(incomeMonthInput)) {
      setErrorMessage("Mes invalido. Usa YYYY-MM.");
      return;
    }

    try {
      setErrorMessage("");
      setMessage("");
      const monthDate = `${incomeMonthInput}-01`;
      const modeQuery = isSharedIncome
        ? "view_mode=shared"
        : `view_mode=personal&user_id=${currentUser.id}`;
      const existing = await financeApi.get(
        `/monthly-budgets/?workspace_id=${activeWorkspaceId}&month=${monthDate}&${modeQuery}`
      );
      const existingBudget = existing.data?.[0];

      if (existingBudget?.id) {
        const baseIncome = Number(existingBudget.income_amount || 0);
        const nextIncome = isSharedIncome ? baseIncome + parsedIncome : parsedIncome;
        await financeApi.patch(`/monthly-budgets/${existingBudget.id}/`, {
          income_amount: nextIncome,
          is_shared: isSharedIncome,
        });
      } else {
        await financeApi.post("/monthly-budgets/", {
          workspace: activeWorkspaceId,
          month: monthDate,
          income_amount: parsedIncome,
          created_by_user_id: currentUser.id,
          is_shared: isSharedIncome,
        });
      }
      setMessage(
        isSharedIncome
          ? "Aportacion agregada al fondo comun."
          : "Ingreso personal actualizado."
      );
      setIncomeInput("");
      await loadCurrentBudget();
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || "No se pudo actualizar el ingreso.");
    }
  };

  const changePassword = async () => {
    if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
      setErrorMessage("Completa todos los campos de contrasena.");
      return;
    }

    try {
      setErrorMessage("");
      setMessage("");
      await authApi.post("/auth/change-password/", {
        current_password: currentPasswordInput,
        new_password: newPasswordInput,
        confirm_password: confirmPasswordInput,
      });
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setMessage("Contrasena actualizada correctamente.");
    } catch (error) {
      const apiError =
        error?.response?.data?.detail ||
        error?.response?.data?.confirm_password?.[0] ||
        "No se pudo cambiar la contrasena.";
      setErrorMessage(apiError);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Configuracion</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Codigo de Invitacion</Text>
          <Text style={styles.inviteCode}>{activeWorkspace?.invitation_code || "No disponible"}</Text>
          <Text style={styles.inviteHelp}>Comparte este codigo para unir otra cuenta al mismo workspace.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Modificar Ingreso Mensual</Text>
          <TextInput
            style={styles.input}
            placeholder="Mes YYYY-MM"
            value={incomeMonthInput}
            onChangeText={(text) => setIncomeMonthInput(formatMonthInput(text))}
          />
          <TextInput
            style={styles.input}
            placeholder="Ingreso mensual"
            keyboardType="decimal-pad"
            value={incomeInput}
            onChangeText={(text) => setIncomeInput(formatAmountInput(text))}
          />
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, !isSharedIncome && styles.toggleBtnActive]}
              onPress={() => setIsSharedIncome(false)}
            >
              <Text style={[styles.toggleBtnText, !isSharedIncome && styles.toggleBtnTextActive]}>Personal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, isSharedIncome && styles.toggleBtnActive]}
              onPress={() => setIsSharedIncome(true)}
            >
              <Text style={[styles.toggleBtnText, isSharedIncome && styles.toggleBtnTextActive]}>Compartido</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={updateMonthlyIncome}>
            <Text style={styles.primaryBtnText}>Guardar Ingreso</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cambiar Contrasena</Text>
          <TextInput
            style={styles.input}
            placeholder="Contrasena actual"
            secureTextEntry
            value={currentPasswordInput}
            onChangeText={setCurrentPasswordInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Nueva contrasena"
            secureTextEntry
            value={newPasswordInput}
            onChangeText={setNewPasswordInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirmar nueva contrasena"
            secureTextEntry
            value={confirmPasswordInput}
            onChangeText={setConfirmPasswordInput}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={changePassword}>
            <Text style={styles.primaryBtnText}>Actualizar Contrasena</Text>
          </TouchableOpacity>
        </View>

        {message ? <Text style={styles.successText}>{message}</Text> : null}
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
    fontSize: 24,
    fontWeight: "800",
    color: "#102a43",
  },
  backBtn: {
    backgroundColor: "#d9e2ec",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backBtnText: {
    fontWeight: "700",
    color: "#243b53",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#102a43",
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
  primaryBtn: {
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  inviteCode: {
    fontSize: 22,
    letterSpacing: 2,
    color: "#1d4ed8",
    fontWeight: "900",
  },
  inviteHelp: {
    color: "#486581",
    fontSize: 13,
  },
  successText: {
    color: "#0f766e",
    fontWeight: "700",
  },
  errorText: {
    color: "#b42318",
    fontWeight: "700",
  },
});
