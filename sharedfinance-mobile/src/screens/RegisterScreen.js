import React, { useMemo, useState } from "react";
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

export default function RegisterScreen({ navigation }) {
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Casa");
  const [invitationCode, setInvitationCode] = useState("");
  const [registerMode, setRegisterMode] = useState("create");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const normalizedInvite = useMemo(() => invitationCode.trim().toUpperCase(), [invitationCode]);

  const onSubmit = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      const normalizedEmail = email.trim().toLowerCase();

      const [firstName, ...rest] = name.trim().split(" ");
      const lastName = rest.join(" ");

      const payload = {
        email: normalizedEmail,
        password,
        first_name: firstName || "",
        last_name: lastName || "",
      };

      if (registerMode === "join") {
        payload.invitation_code = normalizedInvite;
      } else {
        payload.workspace_name = workspaceName || "Casa";
      }

      const registerRes = await authApi.post("/auth/register/", payload);

      const tokenRes = await authApi.post("/auth/token/", { email: normalizedEmail, password });
      const accessToken = tokenRes.data?.access;
      const workspace = registerRes.data?.workspace;
      const user = registerRes.data?.user;

      setApiAuthToken(accessToken);

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
        error?.response?.data?.email?.[0] ||
        error?.response?.data?.invitation_code?.[0] ||
        error?.response?.data?.workspace_name?.[0] ||
        error?.response?.data?.detail ||
        "No se pudo completar el registro";
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
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Puedes crear workspace o unirte con codigo.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, registerMode === "create" && styles.modeBtnActive]}
              onPress={() => setRegisterMode("create")}
            >
              <Text style={[styles.modeBtnText, registerMode === "create" && styles.modeBtnTextActive]}>
                Crear cuenta nueva
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, registerMode === "join" && styles.modeBtnActive]}
              onPress={() => setRegisterMode("join")}
            >
              <Text style={[styles.modeBtnText, registerMode === "join" && styles.modeBtnTextActive]}>
                Unirme con codigo
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput placeholder="Nombre" value={name} onChangeText={setName} style={styles.input} />

          {registerMode === "create" ? (
            <TextInput
              placeholder="Nombre del Workspace"
              value={workspaceName}
              onChangeText={setWorkspaceName}
              style={styles.input}
            />
          ) : (
            <TextInput
              placeholder="Codigo de invitacion"
              autoCapitalize="characters"
              value={invitationCode}
              onChangeText={setInvitationCode}
              style={styles.input}
            />
          )}

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
            <Text style={styles.primaryBtnText}>{isLoading ? "Registrando..." : "Registrar"}</Text>
          </TouchableOpacity>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Ya tengo cuenta. Iniciar sesion</Text>
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
    fontSize: 32,
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
  modeRow: {
    gap: 8,
  },
  modeBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  modeBtnActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  modeBtnText: {
    color: "#1e293b",
    fontWeight: "700",
  },
  modeBtnTextActive: {
    color: "#ffffff",
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
