import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { authApi, financeApi, setApiAuthToken } from "../services/api";

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("demo@sharedfinance.app");
  const [password, setPassword] = useState("123456");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const normalizedEmail = email.trim().toLowerCase();

      const tokenRes = await authApi.post("/auth/token/", {
        email: normalizedEmail,
        password,
      });

      const accessToken = tokenRes.data?.access;
      if (!accessToken) {
        throw new Error("No se recibio token");
      }

      setApiAuthToken(accessToken);

      const meRes = await authApi.get("/auth/me/");
      const user = meRes.data?.user;
      const workspace = meRes.data?.workspaces?.[0] || null;

      if (workspace) {
        await financeApi.post("/workspaces/", {
          id: workspace.id,
          name: workspace.name,
        });
      }

      signIn({
        accessToken,
        user,
        workspaceId: workspace?.id || null,
        workspace,
      });
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.email?.[0] ||
        "No se pudo iniciar sesion";
      setErrorMessage(String(detail));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.wrapper}
      >
        <View>
          <Text style={styles.title}>SharedFinance</Text>
          <Text style={styles.subtitle}>Controla gastos en pareja sin drama.</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={onSubmit}>
            <Text style={styles.primaryBtnText}>{isLoading ? "Entrando..." : "Entrar"}</Text>
          </TouchableOpacity>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>No tengo cuenta. Registrarme</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7f8",
  },
  wrapper: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#102a43",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "#486581",
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#d9e2ec",
  },
  primaryBtn: {
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
  link: {
    textAlign: "center",
    color: "#0f766e",
    fontWeight: "600",
  },
  errorText: {
    color: "#b42318",
    marginTop: 4,
    fontWeight: "600",
  },
});
