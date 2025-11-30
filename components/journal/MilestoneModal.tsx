// components/MilestoneModal.tsx

import type { MilestoneConfig } from "@/app/constants/milestonesConfig";
import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  milestone: MilestoneConfig | null;
  onClose: () => void;
}

export default function MilestoneModal({ visible, milestone, onClose }: Props) {
  const { colors } = useTheme();

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 12,
          stiffness: 130,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!milestone) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View
        style={[
          styles.backdrop,
          {
            backgroundColor: colors.background + "CC",
            opacity: fadeAnim,
          },
        ]}
      />

      <View style={styles.centerWrapper}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.card, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons
            name="trophy-outline"
            size={40}
            color={colors.accent}
            style={{ marginBottom: spacing.md }}
          />

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {milestone.name}
          </Text>

          <Text
            style={[styles.streak, { color: colors.accent }]}
          >{`${milestone.requiredStreak} Days`}</Text>

          {/* Verse */}
          <View style={{ marginVertical: spacing.md }}>
            <Text
              style={[
                styles.verseRef,
                { color: colors.textSecondary },
              ]}
            >
              {milestone.verseReference}
            </Text>
            <Text
              style={[
                styles.verse,
                { color: colors.textSecondary },
              ]}
            >
              "{milestone.verseText}"
            </Text>
          </View>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textPrimary }]}>
            {milestone.description}
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, { color: "#000" }]}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  centerWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    padding: spacing.lg,
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    textAlign: "center",
  },
  streak: {
    fontFamily: fonts.heading,
    fontSize: 15,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  verseRef: {
    fontFamily: fonts.heading,
    fontSize: 14,
    textAlign: "center",
  },
  verse: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 14,
  },
  buttonText: {
    fontFamily: fonts.heading,
    fontSize: 16,
  },
});