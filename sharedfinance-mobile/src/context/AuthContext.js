import React, { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const signIn = ({ accessToken, user, workspaceId, workspace }) => {
    setToken(accessToken);
    setCurrentUser(user || null);
    setActiveWorkspaceId(workspaceId || null);
    setActiveWorkspace(workspace || null);
  };

  const signOut = () => {
    setToken(null);
    setCurrentUser(null);
    setActiveWorkspaceId(null);
    setActiveWorkspace(null);
  };

  const value = useMemo(
    () => ({
      token,
      currentUser,
      activeWorkspaceId,
      activeWorkspace,
      isAuthenticated: Boolean(token),
      signIn,
      signOut,
      setActiveWorkspaceId,
      setActiveWorkspace,
    }),
    [token, currentUser, activeWorkspaceId, activeWorkspace]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
