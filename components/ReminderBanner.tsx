import { getSupabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function ReminderBanner({ userId }: { userId: string }) {
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    const handleExpiry = async () => {
      try {
        // 1️⃣ Mark expired prayers as deleted
        await getSupabase()
          .from("prayers")
          .update({ deleted_at: new Date() })
          .eq("is_premium", false)
          .lte("expires_at", new Date())
          .is("deleted_at", null)
          .eq("user_id", userId);

        // 2️⃣ Find soon-expiring prayers (7 days)
        const reminderDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const { data: soonExpiring } = await getSupabase()
          .from("prayers")
          .select("id")
          .eq("is_premium", false)
          .eq("reminder_sent", false)
          .lte("expires_at", reminderDate)
          .eq("user_id", userId);

        if (soonExpiring && soonExpiring.length > 0) {
          // 3️⃣ Update reminder_sent flag
          await getSupabase()
            .from("prayers")
            .update({ reminder_sent: true })
            .eq("is_premium", false)
            .lte("expires_at", reminderDate)
            .eq("user_id", userId);

          setShowReminder(true);
        }
      } catch (err) {
        console.error("Reminder check failed:", err);
      }
    };

    handleExpiry();
  }, [userId]);

  if (!showReminder) return null;

  return (
    <View
      style={{
        backgroundColor: "#FFF8E1",
        borderRadius: 12,
        padding: 16,
        marginVertical: 12,
        borderWidth: 1,
        borderColor: "#EAD48F",
      }}
    >
      <Text
        style={{
          color: "#8C6A00",
          fontSize: 15,
          fontWeight: "500",
          marginBottom: 6,
        }}
      >
        ⏳ Some of your prayers will be deleted soon.
      </Text>
      <Text style={{ color: "#8C6A00", fontSize: 14, marginBottom: 8 }}>
        Upgrade to keep them permanently and lift the 60-day limit.
      </Text>
      <Pressable
        onPress={() => console.log("Open paywall")}
        style={{
          backgroundColor: "#E5C376",
          paddingVertical: 10,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#3B2E04", fontWeight: "600" }}>
          Upgrade to Premium
        </Text>
      </Pressable>
    </View>
  );
}