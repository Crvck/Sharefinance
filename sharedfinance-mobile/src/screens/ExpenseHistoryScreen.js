import React, { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { financeApi } from "../services/api";

export default function ExpenseHistoryScreen({ navigation }) {
  const { activeWorkspaceId, currentUser } = useAuth();
  const [activity, setActivity] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState("shared"); // NUEVO: "personal" | "shared"

  const loadHistory = useCallback(async () => {
    if (!activeWorkspaceId || !currentUser?.id) {
      return;
    }

    try {
      setErrorMessage("");
      const queryParams = `workspace_id=${activeWorkspaceId}&view_mode=${viewMode}&user_id=${currentUser.id}`;
      const response = await financeApi.get(`/activity-history/?${queryParams}`);
      setActivity(response.data || []);
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || "No se pudo cargar el historial.");
    }
  }, [activeWorkspaceId, currentUser, viewMode]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Historial</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>

        {/* NUEVO: Toggle para Personal/Compartido */}
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

        {(activity || []).map((item) => (
          <View key={`${item.type}-${item.id}`} style={styles.itemCard}>
            <View style={styles.row}>
              <Text style={styles.badge}>{item.type === "expense" ? "Gasto" : "Guardadito"}</Text>
              <Text style={styles.amount}>$ {Number(item.amount || 0).toFixed(2)}</Text>
            </View>
            <Text style={styles.concept}>
              {item.type === "expense"
                ? item.concept || "Sin concepto"
                : `${item.goal_name || "Guardadito"}${item.concept ? ` - ${item.concept}` : ""}`}
            </Text>
            <View style={styles.row}>
              <Text style={styles.meta}>{item.category || item.date}</Text>
              <Text style={styles.meta}>{item.created_by_user_email || item.created_by_user_id?.slice(0, 8)}</Text>
            </View>
          </View>
        ))}

        {!activity.length ? <Text style={styles.emptyText}>Aun no hay movimientos registrados.</Text> : null}
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
    gap: 12,
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
  viewModeToggle: {
    flexDirection: "row",
    gap: 10,
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
  itemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    padding: 12,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  concept: {
    fontSize: 16,
    fontWeight: "700",
    color: "#102a43",
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9f1239",
  },
  meta: {
    fontSize: 13,
    color: "#627d98",
  },
  emptyText: {
    color: "#627d98",
    marginTop: 8,
  },
  errorText: {
    color: "#b42318",
    fontWeight: "600",
  },
});
