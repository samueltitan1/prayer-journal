import { colors, fonts } from "@/theme/theme";
import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from "react-native";

type PrimaryButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  style,
  textStyle,
}: PrimaryButtonProps) {
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
    borderRadius: 50,
    backgroundColor: colors.accentGold,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});
