import { Image, StyleSheet } from "react-native";

export default function ImageContainer() {
  return (
    <Image
      source={require("../../assets/images/login-img.png")}
      style={styles.image}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: 179,
    borderRadius: 15
  },
});
