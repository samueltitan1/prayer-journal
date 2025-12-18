import { MILESTONES } from "@/app/constants/milestonesConfig";
import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  currentStreak: number;
  unlockedMilestones: number[];
  onClose: () => void;
}

export default function MilestoneTimelineModal({
  visible,
  currentStreak,
  unlockedMilestones,
  onClose,
}: Props) {
  const { colors } = useTheme();

  const handleLockedPress = async () => {
    try {
      // Subtle micro-feedback for locked cards
      await Haptics.selectionAsync();
    } catch {
      // no-op if haptics unavailable
    }
  };

  if (!visible) return null;

  const nextMilestone = MILESTONES.find(
    (m) => m.requiredStreak > currentStreak
  );

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheetWrapper}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Milestones
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.textSecondary },
            ]}
          >
            Mark each step in your walk with God
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {MILESTONES.map((m) => {
              const unlocked =
                unlockedMilestones.includes(m.requiredStreak) ||
                currentStreak >= m.requiredStreak;
              const isNext =
                !unlocked && nextMilestone?.requiredStreak === m.requiredStreak;

              return (
                <View key={m.requiredStreak}>
                  {unlocked ? (
                    <View
                      style={[
                        styles.card,
                        {
                          backgroundColor: colors.accent + "20",
                          opacity: 1,
                        },
                      ]}
                    >
                      {/* Header */}
                      <View style={styles.headerRow}>
                        <View
                          style={[
                            styles.iconWrap,
                            {
                              backgroundColor: unlocked
                                ? colors.accent + "20"
                                : colors.textSecondary + "10",
                            },
                          ]}
                        >
                          <Ionicons
                            name={unlocked ? "checkmark" : "lock-closed-outline"}
                            size={20}
                            color={unlocked ? colors.accent : colors.textSecondary}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.name,
                              { color: colors.textPrimary },
                            ]}
                          >
                            {m.name}
                          </Text>
                          <Text
                            style={[
                              styles.description,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {m.description}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.days,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Day {m.requiredStreak}
                        </Text>
                      </View>

                      <View style={[styles.divider, { backgroundColor: colors.textSecondary + "15" }]} />

                      {/* Body */}
                      <Text
                        style={[
                          styles.verse,
                          { color: colors.textSecondary },
                        ]}
                      >
                        “{m.verseText}”
                      </Text>
                      <Text
                        style={[
                          styles.verseRef,
                          { color: colors.accent },
                        ]}
                      >
                        — {m.verseReference}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleLockedPress}
                      style={[
                        styles.card,
                        {
                          backgroundColor: colors.card,
                          opacity: 0.55,
                        },
                      ]}
                    >
                      {/* Header */}
                      <View style={styles.headerRow}>
                        <View
                          style={[
                            styles.iconWrap,
                            {
                              backgroundColor: unlocked
                                ? colors.accent + "20"
                                : colors.textSecondary + "10",
                            },
                          ]}
                        >
                          <Ionicons
                            name={unlocked ? "checkmark" : "lock-closed-outline"}
                            size={20}
                            color={unlocked ? colors.accent : colors.textSecondary}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.name,
                              { color: colors.textPrimary },
                            ]}
                          >
                            {m.name}
                          </Text>
                          <Text
                            style={[
                              styles.description,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {m.description}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.days,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Day {m.requiredStreak} 
                        </Text>
                      </View>

                      <View style={[styles.divider, { backgroundColor: colors.textSecondary + "15" }]} />

                      {/* Body */}
                      {isNext ? (
                        <View style={styles.unlockRow}>
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color={colors.accent}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.unlockText,
                              { color: colors.accent },
                            ]}
                          >
                            {m.requiredStreak - currentStreak} days until unlocked
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.lockedRow}>
                          <Ionicons
                            name="lock-closed"
                            size={14}
                            color={colors.textSecondary}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.lockedText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Scripture locked
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
          <Text
            style={[
              styles.footerText,
              { color: colors.textSecondary },
            ]}
          >
            Each milestone celebrates your faithfulness and consistency. Once unlocked, it remains yours forever
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: 24,
    padding: spacing.lg,
    maxHeight: "85%",
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    marginBottom: spacing.md,
    textAlign: "center",
  },

  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 20,
    opacity: 0.5,
  },

  footerText: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 18,
    opacity: 0.5,
  },

  card: {
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 16,
    marginBottom: 4,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 18,
  },
  days: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginLeft: spacing.sm,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },

  verse: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  verseRef: {
    fontFamily: fonts.heading,
    fontSize: 13,
  },

  unlockRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  unlockText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },

  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lockedText: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
});