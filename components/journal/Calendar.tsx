// components/journal/Calendar.tsx

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "../../contexts/ThemeContext";
import { fonts, spacing } from "../../theme/theme";

type CalendarProps = {
  month: Date;
  onMonthChange: (next: Date) => void;
  selectedDateKey: string | null; // "YYYY-MM-DD"
  onSelectDate: (dateKey: string) => void;
  daysWithPrayer: Set<string>;
};

type CalendarCell = {
  date: Date;
  dateKey: string;
  label: string;
  belongsTo: "prev" | "current" | "next";
};

const formatDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"]; // Monday → Sunday

export default function Calendar({
  month,
  onMonthChange,
  selectedDateKey,
  onSelectDate,
  daysWithPrayer,
}: CalendarProps) {
  const { colors } = useTheme();

  // ----- Month Label -----
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
      }).format(month),
    [month]
  );

  const todayKey = formatDateKey(new Date());

  // ----- Build Calendar Grid -----
  const calendarRows = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();

    const firstOfMonth = new Date(year, m, 1);
    const lastOfMonth = new Date(year, m + 1, 0);
    const daysInMonth = lastOfMonth.getDate();

    // JS getDay(): Sun=0 → Sat=6
    // Convert to Monday-based index: 0=Mon → 6=Sun
    const jsDay = firstOfMonth.getDay();
    const firstWeekday = (jsDay + 6) % 7;

    const prevMonthLastDate = new Date(year, m, 0).getDate();

    const cells: CalendarCell[] = [];

    // ---- Leading days (prev month) ----
    for (let i = 0; i < firstWeekday; i++) {
      const dayNum = prevMonthLastDate - firstWeekday + 1 + i;
      const d = new Date(year, m - 1, dayNum);
      cells.push({
        date: d,
        dateKey: formatDateKey(d),
        label: String(dayNum),
        belongsTo: "prev",
      });
    }

    // ---- Current month days ----
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, m, day);
      cells.push({
        date: d,
        dateKey: formatDateKey(d),
        label: String(day),
        belongsTo: "current",
      });
    }

    // ---- Trailing days (next month) ----
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const needed = 7 - remainder;
      for (let i = 1; i <= needed; i++) {
        const d = new Date(year, m + 1, i);
        cells.push({
          date: d,
          dateKey: formatDateKey(d),
          label: String(i),
          belongsTo: "next",
        });
      }
    }

    // ---- Chunk into rows of 7 ----
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [month]);

  // ----- Handle Taps -----
  const handleDayPress = (cell: CalendarCell) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Change month if tapping faded dates
    if (cell.belongsTo === "prev") {
      const prev = new Date(month);
      prev.setMonth(month.getMonth() - 1);
      onMonthChange(prev);
    }
    if (cell.belongsTo === "next") {
      const next = new Date(month);
      next.setMonth(month.getMonth() + 1);
      onMonthChange(next);
    }

    onSelectDate(cell.dateKey);
  };

  return (
    <View style={styles.container}>
      {/* ----- Month Header ----- */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            const prev = new Date(month);
            prev.setMonth(month.getMonth() - 1);
            onMonthChange(prev);
          }}
        >
          <Ionicons
            name="chevron-back-outline"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>
          {monthLabel.toUpperCase()}
        </Text>

        <TouchableOpacity
          onPress={() => {
            const next = new Date(month);
            next.setMonth(month.getMonth() + 1);
            onMonthChange(next);
          }}
        >
          <Ionicons
            name="chevron-forward-outline"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ----- Weekday Labels (Mon → Sun) ----- */}
      <View style={styles.weekdayRow}>
        {weekdayLabels.map((d, i) => (
          <Text
            key={`${d}-${i}`}
            style={[styles.weekdayLabel, { color: colors.textSecondary }]}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* ----- Calendar Grid ----- */}
      {calendarRows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.weekRow}>
          {row.map((cell, colIndex) => {
            const isSelected = selectedDateKey === cell.dateKey;
            const isToday =
              cell.belongsTo === "current" && todayKey === cell.dateKey;

            const hasPrayer = daysWithPrayer.has(cell.dateKey);
            const isFaded = cell.belongsTo !== "current";

            const scaleAnim = new Animated.Value(1);

            const animatePress = () => {
              Animated.sequence([
                Animated.timing(scaleAnim, {
                  toValue: 0.9,
                  duration: 80,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                  toValue: 1,
                  friction: 3,
                  tension: 120,
                  useNativeDriver: true,
                }),
              ]).start();
            };

            return (
              <TouchableOpacity
                key={`${cell.dateKey}-${rowIndex}-${colIndex}`}
                style={styles.dayCell}
                activeOpacity={0.8}
                onPress={() => {
                  animatePress();
                  handleDayPress(cell);
                }}
              >
                <Animated.View
                  style={[
                    styles.dayCircle,
                    {
                      transform: [{ scale: scaleAnim }],
                      borderWidth: isSelected ? 2 : isToday ? 1 : 0,
                      borderColor: isSelected
                        ? colors.accent
                        : isToday
                        ? colors.accent
                        : "transparent",
                      backgroundColor: hasPrayer
                        ? isSelected
                          ? colors.accent + "40"
                          : colors.accent + "22"
                        : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      {
                        color: isFaded
                          ? colors.textSecondary + "55"
                          : colors.textPrimary,
                        fontFamily:
                          hasPrayer && !isFaded
                            ? fonts.heading
                            : fonts.body,
                      },
                    ]}
                  >
                    {cell.label}
                  </Text>

                  {hasPrayer && (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: colors.accent },
                      ]}
                    />
                  )}
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: -10,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },

  monthLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    letterSpacing: 1.2,
  },

  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },

  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.body,
    fontSize: 11,
  },

  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  dayCell: {
    flex: 1,
    alignItems: "center",
  },

  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  dayLabel: {
    fontSize: 14,
  },

  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});