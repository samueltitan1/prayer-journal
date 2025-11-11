import React, { useEffect } from "react";
import { Animated, Easing, Image, Modal, StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing } from "../theme/theme";

type Props = {
  visible: boolean;
  time: string;
  onClose: () => void;
};

export default function ReminderConfirmationModal({ visible, time, onClose }: Props) {
  const opacity = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <View style={styles.card}>
          <Image
            source={require("../assets/belltick.png")}
            style={{ width: 48, height: 48, marginBottom: spacing.md }}
          />
          <Text style={styles.title}>Reminder set for {time}</Text>
          <Text style={styles.subtitle}>
            You’ll receive a gentle daily nudge to pause and pray. You can change this anytime in Settings.
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(250, 249, 246, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: spacing.xl,
    width: "80%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});