import { colors, fonts } from "@/theme/theme";
import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from "react-native";

type SecondaryButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function SecondaryButton({
  title,
  onPress,
  disabled = false,
  style,
  textStyle,
}: SecondaryButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accentGold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
