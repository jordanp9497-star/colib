import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/context/UserContext";
import { BackButton } from "@/components/ui/back-button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Colors, Fonts } from "@/constants/theme";

export default function ShipmentScanScreen() {
  const { shipmentId } = useLocalSearchParams<{ shipmentId?: string }>();
  const { userId } = useUser();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualValue, setManualValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const scanDeliveryQrAndReleasePayment = useMutation(api.shipments.scanDeliveryQrAndReleasePayment);
  const canUseCamera = useMemo(() => permission?.granted === true, [permission?.granted]);

  const handleValidateQr = useCallback(
    async (qrPayload: string) => {
      if (!shipmentId || isSubmitting) return;
      const value = qrPayload.trim();
      if (!value) return;

      setIsSubmitting(true);
      try {
        await scanDeliveryQrAndReleasePayment({
          shipmentId: shipmentId as any,
          actorVisitorId: userId,
          qrPayload: value,
        });
        Alert.alert("Validation reussie", "Remise confirmee. Le paiement a ete libere.", [
          {
            text: "OK",
            onPress: () => router.replace({ pathname: "/shipment/[shipmentId]", params: { shipmentId: String(shipmentId) } }),
          },
        ]);
      } catch {
        Alert.alert("QR invalide", "Le QR est invalide, expire ou deja utilise.");
        setIsLocked(false);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, scanDeliveryQrAndReleasePayment, shipmentId, userId]
  );

  if (!shipmentId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Transport introuvable</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.content}>
        <BackButton onPress={() => router.back()} />

        <Text style={styles.title}>Scanner QR de remise</Text>
        <Text style={styles.subtitle}>Scannez le QR affiche sur le telephone du destinataire pour debloquer le paiement.</Text>

        {!permission ? (
          <View style={styles.cameraPlaceholder}>
            <ActivityIndicator color={Colors.dark.primary} />
          </View>
        ) : canUseCamera ? (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={(result) => {
                if (isLocked || isSubmitting) return;
                setIsLocked(true);
                void handleValidateQr(result.data);
              }}
            />
            <View style={styles.cameraOverlay} pointerEvents="none">
              <View style={styles.scanFrame} />
            </View>
          </View>
        ) : (
          <SurfaceCard style={styles.permissionCard}>
            <Text style={styles.permissionText}>Autorisez la camera pour scanner automatiquement le QR.</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={() => void requestPermission()}>
              <Text style={styles.permissionButtonText}>Activer la camera</Text>
            </TouchableOpacity>
          </SurfaceCard>
        )}

        <SurfaceCard style={styles.manualBlock}>
          <Text style={styles.manualTitle}>Plan B</Text>
          <Text style={styles.manualText}>Si le scan bloque, collez la valeur brute du QR.</Text>
          <TextInput
            style={styles.input}
            value={manualValue}
            onChangeText={setManualValue}
            autoCapitalize="none"
            placeholder="COLIB-DELIVERY:..."
            placeholderTextColor={Colors.dark.textSecondary}
          />
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.disabledButton]}
            disabled={isSubmitting}
            onPress={() => void handleValidateQr(manualValue)}
          >
            {isSubmitting ? <ActivityIndicator color={Colors.dark.text} size="small" /> : <Text style={styles.submitText}>Valider le QR</Text>}
          </TouchableOpacity>
        </SurfaceCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 24,
    gap: 12,
  },
  title: {
    fontSize: 24,
    color: Colors.dark.text,
    fontFamily: Fonts.displaySemiBold,
  },
  subtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Fonts.sans,
  },
  cameraWrapper: {
    height: 320,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.canvas,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "transparent",
  },
  cameraPlaceholder: {
    height: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.surface,
  },
  permissionCard: {
    padding: 14,
    gap: 8,
  },
  permissionText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.sans,
  },
  permissionButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  permissionButtonText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontFamily: Fonts.sansSemiBold,
  },
  manualBlock: {
    padding: 12,
    gap: 8,
  },
  manualTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts.sansSemiBold,
  },
  manualText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  input: {
    borderRadius: 10,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: Colors.dark.surfaceMuted,
    color: Colors.dark.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
  },
  submitButton: {
    borderRadius: 10,
    backgroundColor: Colors.dark.info,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: Colors.dark.text,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.65,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.background,
  },
});
