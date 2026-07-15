import { ScrollView, StyleSheet, View } from "react-native";

import AvatarCard from "@/components/profile/AvatarCard";
import InterestChips from "@/components/profile/InterestChips";
import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStats from "@/components/profile/ProfileStats";
import SectionHeader from "@/components/profile/SectionHeader";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Chip } from "react-native-paper";

export default function ProfileScreen() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const interests = ["Board Games", "Soccer", "Study Nights"];
  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background, paddingTop: 25 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AvatarCard
          avatarImg={{
            uri: "https://imageio.forbes.com/specials-images/imageserve/663e595b4509f97fdafb95f5/0x0.jpg?format=jpg&crop=383,383,x1045,y23,safe&height=416&width=416&fit=bounds",
          }}
          verified
        />
        <ProfileInfo
          name="Saphal Pant"
          university="Louisana Tech University"
          major="Computer Science"
        />
        <ProfileStats
          statsData={{
            attended: 4,
            hosted: 10,
            rides: 12,
            rating: 4.5,
          }}
        />
        <View style={{}}>
          <SectionHeader header="Interests" />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              paddingTop: 15,
            }}
          >
            {interests.map((interest, key) => {
              return <InterestChips label={interest} key={key} />;
            })}
            <Chip
              style={{
                backgroundColor: colors.background,
                borderStyle: "dashed",
                borderWidth: 2,
                borderColor: colors.icon
              }}
            >
              +
            </Chip>
          </View>
        </View>
      </ScrollView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 25,
  },
});
