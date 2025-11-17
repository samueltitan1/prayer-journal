import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Prayer = {
  id: string;
  prayed_at: string;
  duration_seconds: number | null;
  transcript_text: string | null;
  signed_audio_url: string | null;
};

type Props = {
  prayer: Prayer;
  onPress: (p: Prayer) => void;
};

export default function PrayerCard({ prayer, onPress }: Props) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => onPress(prayer)}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.time, { color: colors.textPrimary }]}>
          {new Date(prayer.prayed_at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>

        {prayer.transcript_text && (
          <Text
            style={[styles.preview, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {prayer.transcript_text}
          </Text>
        )}
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  time: {
    fontFamily: fonts.heading,
    fontSize: 14,
    marginBottom: 4,
  },
  preview: {
    fontFamily: fonts.body,
    fontSize: 13,
  },
});