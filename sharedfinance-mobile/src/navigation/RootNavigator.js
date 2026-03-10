import React, { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { setApiAuthToken } from "../services/api";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DashboardScreen from "../screens/DashboardScreen";
import SavingsGoalsScreen from "../screens/SavingsGoalsScreen";
import ExpenseHistoryScreen from "../screens/ExpenseHistoryScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, token } = useAuth();

  useEffect(() => {
    setApiAuthToken(token);
  }, [token]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="ExpenseHistory" component={ExpenseHistoryScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="SavingsGoals" component={SavingsGoalsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
