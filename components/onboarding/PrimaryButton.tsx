import { colors, fonts } from "@/theme/theme";
import * as Haptics from "expo-haptics";
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
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={handlePress}
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
    
    color: "#FFFFFF",
  },
});
