import { useTheme } from "@/contexts/ThemeContext";
import { fonts, spacing } from "@/theme/theme";
import React from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    View
} from "react-native";

type Reflection = {
  id: string;
  type: "weekly" | "monthly";
  title: string;      
  subtitle: string | null;
  body: string;
  verse_text: string | null;
  verse_reference: string | null;
  created_at: string;
};

type Props = {
  visible: boolean;
  reflection: Reflection | null;
  onClose: () => void;
};

const ReflectionModal: React.FC<Props> = ({ visible, reflection, onClose }) => {
  const { colors } = useTheme();

  if (!visible || !reflection) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View
              style={[styles.card, { backgroundColor: colors.surface || colors.card }]}
            >
              {/* Header */}
              <View
                style={[
                  styles.header,
                  { borderBottomColor: colors.textSecondary + "20" },
                ]}
              >
                <View>
                  <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                    {reflection.title}
                  </Text>
                  <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                    {new Date(reflection.created_at).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.md,
                  paddingBottom: spacing.xl,
                  flexGrow: 1,
                }}
                showsVerticalScrollIndicator={false}
              >
                {/* Subtitle */}
                {!!reflection.subtitle && (
                  <Text
                    style={[
                      styles.subtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {reflection.subtitle}
                  </Text>
                )}

                {/* Body */}
                <Text
                  style={[styles.body, { color: colors.textPrimary }]}
                >
                  {reflection.body}
                </Text>

                {/* Verse */}
                {!!reflection.verse_reference && (
                  <Text
                    style={[
                      styles.verse,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {reflection.verse_reference} — {reflection.verse_text}
                  </Text>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
backdrop: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.45)",
justifyContent: "center",
paddingHorizontal: spacing.md,
},
  card: {
  width: "92%",
  maxHeight: "85%",
  minHeight: "45%",
  alignSelf: "center",
  borderRadius: 22,
  paddingBottom: spacing.lg,
  overflow: "hidden",

},
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  dateLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  verse: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: spacing.lg,
    opacity: 0.8,
  },
});

export default ReflectionModal;