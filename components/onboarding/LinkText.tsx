import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { colors, fonts } from "@/theme/theme";

type LinkTextProps = {
  text: string;
  underlineText?: string;
  onPress?: () => void;
  style?: StyleProp<TextStyle>;
};

export default function LinkText({ text, underlineText, onPress, style }: LinkTextProps) {
  if (!underlineText) {
    return (
      <Text style={[styles.text, style]} onPress={onPress}>
        {text}
      </Text>
    );
  }

  const idx = text.indexOf(underlineText);
  if (idx === -1) {
    return (
      <Text style={[styles.text, style]} onPress={onPress}>
        {text}
      </Text>
    );
  }

  const before = text.slice(0, idx);
  const after = text.slice(idx + underlineText.length);

  return (
    <Text style={[styles.text, style]} onPress={onPress}>
      {before}
      <Text style={styles.underline}>{underlineText}</Text>
      {after}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  underline: {
    textDecorationLine: "underline",
    color: colors.textPrimary,
  },
});
