import InterestChips from "@/components/profile/InterestChips";
import InterestPickerSheet from "@/components/profile/InterestPickerSheet";
import MyActivities from "@/components/profile/MyActivities";
import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStats from "@/components/profile/ProfileStats";
import SectionHeader from "@/components/profile/SectionHeader";
import { AppText } from "@/components/text";
import { AppView } from "@/components/view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { Chip } from "react-native-paper";
import { router } from "expo-router";

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

type MyActivity = {
  id: string;
  title: string;
  date: string;
  time: string;
  image: { uri: string };
};

const CATEGORY_SEEDS: Record<string, string> = {
  social: 'social',
  sports: 'sports',
  music: 'music',
  study: 'study',
  outdoor: 'outdoor',
  gaming: 'gaming',
  grocery: 'grocery',
};



export default function ProfileScreen() {
  const theme = useColorScheme() ?? "light";
  const colors = Colors[theme];
  const [interests, setInterests] = useState<string[]>([
    "Board Games",
    "Soccer",
    "Study Nights",
  ]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [myActivities, setMyActivities] = useState<MyActivity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchMyActivities() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('activities')
      .select('id, title, category, date_time, image_url')
      .eq('host_id', user.id)
      .order('date_time', { ascending: false });
    if (error) { console.error('fetchMyActivities error:', error); return; }
    if (data) {
      setMyActivities(data.map((a: any) => {
        const dt = a.date_time ? new Date(a.date_time) : null;
        const imageUri = a.image_url
          ?? `https://picsum.photos/seed/${CATEGORY_SEEDS[a.category] ?? 'activity'}/240/240`;
        return {
          id: a.id,
          title: a.title,
          date: dt ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD',
          time: dt ? dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'TBD',
          image: { uri: imageUri },
        };
      }));
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMyActivities().finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(useCallback(() => { fetchMyActivities(); }, []));


  return (
    <AppView style={styles.container}>
      <ScrollView
        style={{ backgroundColor: colors.background, paddingTop: 25 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
            {myActivities.length === 0 ? (
              <AppText style={{ color: colors.outline, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>
                No activities yet. Create one!
              </AppText>
            ) : (
              myActivities.map((activity) => (
                <MyActivities
                  key={activity.id}
                  title={activity.title}
                  date={activity.date}
                  time={activity.time}
                  image={activity.image}
                  onPress={() => router.push(`/activity/${activity.id}`)}
                />
              ))
            )}
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
