import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SectionList,
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { Ionicons } from "@expo/vector-icons";
import TripCard from "@/components/TripCard";
import ParcelCard from "@/components/ParcelCard";

export default function ProfileScreen() {
  const { userId, userName, setUserInfo, isLoggedIn } = useUser();
  const [nameInput, setNameInput] = useState(userName);

  const handleSave = () => {
    if (!nameInput.trim()) {
      Alert.alert("Nom requis", "Veuillez entrer votre nom.");
      return;
    }
    setUserInfo(nameInput.trim());
    Alert.alert("Enregistre", `Bienvenue, ${nameInput.trim()} !`);
  };

  if (!isLoggedIn) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={48} color="#94A3B8" />
        </View>
        <Text style={styles.authTitle}>Bienvenue sur Colib</Text>
        <Text style={styles.authText}>
          Entrez votre nom pour commencer a publier des trajets et envoyer des
          colis.
        </Text>
        <TextInput
          style={styles.nameInput}
          placeholder="Votre nom"
          placeholderTextColor="#94A3B8"
          value={nameInput}
          onChangeText={setNameInput}
          autoFocus
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Commencer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <LoggedInProfile userId={userId} userName={userName} />;
}

function LoggedInProfile({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const myTrips = useQuery(api.trips.getByUser, { userId });
  const myParcels = useQuery(api.parcels.getByUser, { userId });

  const isLoading = myTrips === undefined || myParcels === undefined;

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {userName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.userId}>ID: {userId}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
        <SectionList
          sections={[
            {
              title: `Mes trajets (${myTrips?.length ?? 0})`,
              data: myTrips ?? [],
              type: "trip" as const,
            },
            {
              title: `Mes colis (${myParcels?.length ?? 0})`,
              data: myParcels ?? [],
              type: "parcel" as const,
            },
          ]}
          keyExtractor={(item) => item._id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderItem={({ item, section }) =>
            section.type === "trip" ? (
              <TripCard trip={item as any} />
            ) : (
              <ParcelCard parcel={item as any} />
            )
          }
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <Text style={styles.emptySection}>
                {section.type === "trip"
                  ? "Vous n'avez pas encore propose de trajet"
                  : "Vous n'avez pas encore envoye de colis"}
              </Text>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#F8FAFC",
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  authText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  nameInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1E293B",
    width: "100%",
    textAlign: "center",
  },
  saveButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#6366F1",
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  userId: {
    fontSize: 12,
    color: "#C7D2FE",
    marginTop: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 20,
    marginBottom: 12,
  },
  emptySection: {
    fontSize: 14,
    color: "#94A3B8",
    fontStyle: "italic",
    marginBottom: 16,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
});
