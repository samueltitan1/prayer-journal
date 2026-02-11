import Constants from "expo-constants";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const isExpoGo = Constants.appOwnership === "expo";

export const DevBuildGate = ({ children }: { children: React.ReactNode }) => {
  if (!isExpoGo) return React.createElement(React.Fragment, null, children);

  return React.createElement(
    View,
    { style: styles.container },
    React.createElement(Text, { style: styles.title }, "Development Build Required"),
    React.createElement(
      Text,
      { style: styles.body },
      "This app requires a Development Build (Google Sign-In + HealthKit)."
    ),
    React.createElement(
      Text,
      { style: styles.body },
      "Run:\n" + "npx expo run:ios\n" + "npx expo start --dev-client"
    )
  );
};

export const ensureNotExpoGo = () => !isExpoGo;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9F6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#2F2F2F",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: "#6B6B6B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 10,
  },
});
