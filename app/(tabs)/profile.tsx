import InterestChips from "@/components/profile/InterestChips";
import InterestPickerSheet from "@/components/profile/InterestPickerSheet";
import MyActivities from "@/components/profile/MyActivities";
import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStats from "@/components/profile/ProfileStats";
import SectionHeader from "@/components/profile/SectionHeader";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Chip } from "react-native-paper";

import ProfileAvatar from "@/components/profile/ProfileAvatar";

const DEFAULT_PROFILE_PICTURE =
  "https://imageio.forbes.com/specials-images/imageserve/663e595b4509f97fdafb95f5/0x0.jpg?format=jpg&crop=383,383,x1045,y23,safe&height=416&width=416&fit=bounds";

const INTEREST_OPTIONS = [
  "Board Games",
  "Soccer",
  "Study Nights",
  "Basketball",
  "Hiking",
  "Music",
  "Movies",
  "Coding",
  "Cooking",
  "Photography",
  "Gaming",
  "Yoga",
  "Running",
  "Cycling",
  "Concerts",
  "Coffee",
  "Reading",
  "Volunteering",
  "Art",
  "Dance",
];

const MY_ACTIVITIES = [
  {
    id: "1",
    title: "Board Game Night",
    date: "Nov 12, 2026",
    time: "8:00 PM",
    image: { uri: "https://picsum.photos/seed/boardgames/240/240" },
  },
  {
    id: "2",
    title: "Weekend Pickleball at Lambright",
    date: "Nov 15, 2026",
    time: "7:00 AM",
    image: { uri: "https://picsum.photos/seed/pickleball/240/240" },
  },
  {
    id: "3",
    title: "Hike to Lost Valley",
    date: "Nov 20, 2026",
    time: "6:30 AM",
    image: { uri: "https://picsum.photos/seed/hike/240/240" },
  },
];



export default function ProfileScreen() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const [interests, setInterests] = useState<string[]>([
    "Board Games",
    "Soccer",
    "Study Nights",
  ]);
  const [pickerVisible, setPickerVisible] = useState(false);


  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background, paddingTop: 25 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ProfileAvatar verified editable />
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
              onPress={() => setPickerVisible(true)}
              style={{
                backgroundColor: colors.background,
                borderStyle: "dashed",
                borderWidth: 2,
                borderColor: colors.icon,
              }}
            >
              +
            </Chip>
          </View>
        </View>
        <View>
          <SectionHeader header="My Activities" />
          <View style={styles.activitiesList}>
            {MY_ACTIVITIES.map((activity) => (
              <MyActivities
                key={activity.id}
                title={activity.title}
                date={activity.date}
                time={activity.time}
                image={activity.image}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <InterestPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        currentInterests={interests}
        options={INTEREST_OPTIONS}
        onSave={(next) => {
          setInterests(next);
          setPickerVisible(false);
        }}
      />
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
  activitiesList: {
    gap: 12,
    paddingTop: 15,
  },
});
