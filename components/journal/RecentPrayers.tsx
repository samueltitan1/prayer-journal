// components/journal/RecentPrayers.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { fonts, spacing } from "../../theme/theme";

type Prayer = {
  id: string;
  prayed_at: string;
  transcript_text: string | null;
  duration_seconds: number | null;
};

type Props = {
  colors: any;
  prayers: Prayer[];
  formatDuration: (s: number | null) => string;
  onPressPrayer: (prayer: Prayer) => void;
};

const RecentPrayers: React.FC<Props> = ({
  colors,
  prayers,
  formatDuration,
  onPressPrayer,
}) => {
  return (
    <View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Recent prayers
      </Text>

      {prayers.length === 0 ? (
        <Text
          style={[styles.emptyText, { color: colors.textSecondary }]}
        >
          No prayers yet — your latest entries will appear here.
        </Text>
      ) : (
        prayers.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.row,
              { backgroundColor: colors.card || "#f7f7f7" },
            ]}
            onPress={() => onPressPrayer(p)}
          >
            <View style={styles.rowLeft}>
              <Ionicons
                name="play-circle"
                size={22}
                color={colors.accent}
                style={{ marginRight: spacing.sm }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.rowTitle,
                    { color: colors.textPrimary },
                  ]}
                >
                  {new Date(p.prayed_at).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  •{" "}
                  {new Date(p.prayed_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  • {formatDuration(p.duration_seconds)}
                </Text>
                {!!p.transcript_text && (
                  <Text
                    style={[
                      styles.rowSubtitle,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {p.transcript_text}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons
              name="chevron-forward-outline"
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    marginBottom: 2,
  },
  rowSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
});

export default RecentPrayers;