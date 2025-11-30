// components/journal/PrayerDayOverlay.tsx

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";
import { Prayer } from "@/types/Prayer";


// ---- Types -----------------------------------------------------------


type Props = {
  visible: boolean;
  dateKey: string | null;
  isEntryOpen: boolean;

  // the list of prayers for that selected date
  prayersForSelectedDate: Prayer[];
  selectedDateKey: string | null;
  expandedPrayerId: string | null;

  // modal visibility + close handler
  closeDayModal: () => void;

  // loading state
  loadingPrayers: boolean;

  // actions
  toggleBookmark: (id: string) => void;
  handleDeletePrayer: (p: Prayer) => void;

  // NEW → open the full-screen single prayer modal
  onSelectPrayer: (p: Prayer) => void;
};


// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---- Helper ----------------------------------------------------------

const formatDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const formatDuration = (s: number | null) =>
  !s ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const formatMsToClock = (ms?: number | null) => {
  if (ms == null) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;


};

// ---- Component -------------------------------------------------------

const PrayerDayModal: React.FC<Props> = ({
  visible,
  dateKey,

  expandedPrayerId,

  closeDayModal,
  selectedDateKey,
  prayersForSelectedDate,
  loadingPrayers,
  toggleBookmark,

  handleDeletePrayer,
  onSelectPrayer,
}) => {
  const { colors } = useTheme();

  if (!visible || !dateKey) return null;

  const dateLabel = new Date(dateKey).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const formatDuration = (s: number | null) =>
    !s ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const formatMsToClock = (ms?: number | null) => {
    if (ms == null) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };
  
  return (
    <View style={styles.backdrop}>
    <SafeAreaView
      style={[
        styles.Container,
        { backgroundColor: colors.background },
      ]}
    >
      {/* Modal header */}
      <View
        style={[
          styles.modalHeader,
          { borderBottomColor: colors.textSecondary + "20" },
        ]}
      >
        <TouchableOpacity onPress={closeDayModal}>
          <Ionicons
            name="chevron-down-outline"
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text
            style={[styles.modalTitle, { color: colors.textPrimary }]}
          >
            {selectedDateKey
              ? new Date(selectedDateKey).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "Selected day"}
          </Text>
          <Text
            style={[
              styles.modalSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            {prayersForSelectedDate.length}{" "}
            {prayersForSelectedDate.length === 1 ? "prayer" : "prayers"}
          </Text>
        </View>

      </View>

      <ScrollView
        contentContainerStyle={[
          styles.modalScrollContent,
          { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loadingPrayers ? (
          <ActivityIndicator color={colors.accent} />
        ) : prayersForSelectedDate.length === 0 ? (
          <Text
            style={[
              styles.sectionSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            No prayers recorded this day.
          </Text>
        ) : (
          prayersForSelectedDate.map((p) => {

            const isExpanded = expandedPrayerId === p.id;
          
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.9}
                onPress={() => onSelectPrayer(p)}
                style={[
                  styles.prayerCard,
                  { backgroundColor: colors.card },
                ]}
              >
                {/* Content */}
                <View style={{ flex: 1 }}>
                  <View style={styles.prayerHeaderRow}>
                    <Text
                      style={[
                        styles.prayerTime,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {new Date(p.prayed_at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      • {formatDuration(p.duration_seconds)}
                    </Text>
          
                    {/* Bookmark icon */}
                    <TouchableOpacity
                      onPress={(e) => 
                        {e.stopPropagation();
                        toggleBookmark(p.id)}}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ marginRight: 14 }}
                    >
                      <Ionicons
                        name={p.is_bookmarked ? "heart" : "heart-outline"}
                        size={20}
                        color={colors.accent}
                      />
                    </TouchableOpacity>
          
                    {/* Delete icon */}
                    <TouchableOpacity
                      onPress={(e) => 
                        {e.stopPropagation();
                        handleDeletePrayer(p)}}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
          
                  {/* Transcript (collapsible) */}
                  {p.transcript_text && (
                    <View style={{ marginTop: spacing.sm }}>
                      <Text
                        style={[
                          styles.prayerText,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={isExpanded ? undefined : 2}
                      >
                        {p.transcript_text}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "85%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  scroll: {
    marginTop: spacing.sm,
  },
  emptyWrapper: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
  },
  prayerCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  prayerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  prayerTime: {
    fontFamily: fonts.heading,
    fontSize: 14,
  },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  playButton: {
    marginRight: spacing.md,
  },
  playbackTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  playbackFill: {
    height: "100%",
    borderRadius: 999,
  },
  playbackTimesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  playbackTimeLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
  speakerToggle: {
    marginLeft: spacing.sm,
  },
  prayerText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  transcriptToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  transcriptToggleText: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginRight: 4,
  },
  Container: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  modalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
  modalScrollContent: {
    paddingBottom: spacing.xl,
  },
  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  playbackMeta: {
    marginBottom: spacing.xs,
  },
});

export default PrayerDayModal;