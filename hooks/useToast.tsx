import { useRef, useState } from "react";
import { Animated } from "react-native";

export type ToastType = "success" | "error" | "info";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<ToastType>("info");
  const opacity = useRef(new Animated.Value(0)).current;

  const showToast = (
    text: string,
    variant: ToastType = "info",
    duration = 2000
  ) => {
    setMessage(text);
    setType(variant);
    opacity.setValue(0);

    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(duration),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setMessage(null));
  };

  return { message, type, opacity, showToast };
}