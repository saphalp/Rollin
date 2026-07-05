import { Colors } from "@/constants/theme";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Text } from "react-native-paper";

export default function AuthHeader() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <Text variant="headlineLarge" style={styles.heading}>
        Rollin'
      </Text>
      <Text variant="labelLarge" style={styles.subheading}>
        Explore. Connect. Rollin
      </Text>
    </View>
  );
}

function getStyles(colors: typeof Colors.light) {
  return StyleSheet.create({
    container: {
      justifyContent: "center",
      marginVertical: 40,
      alignItems: "center",
    },
    heading: {
      color: colors.primaryContainer,
      fontWeight: "900",
    },
    subheading: {
      color: colors.icon,
    },
  });
}
