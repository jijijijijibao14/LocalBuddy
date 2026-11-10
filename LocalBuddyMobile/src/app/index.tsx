import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView, { type WebViewNavigation } from "react-native-webview";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.trim();

export default function WebScreen() {
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  const shouldLoad = useCallback((req: { url: string }) => {
    if (/^(https?:|about:)/i.test(req.url)) return true;
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  const retry = () => {
    setError(false);
    setLoading(true);
    webRef.current?.reload();
  };

  if (!WEB_URL) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Thiếu EXPO_PUBLIC_WEB_URL</Text>
        <Text style={styles.msg}>Hãy tạo file .env (xem .env.example) rồi chạy lại `npx expo start -c`.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex}>
      <WebView
        ref={webRef}
        source={{ uri: WEB_URL }}
        style={styles.flex}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={shouldLoad}
        onNavigationStateChange={onNavChange}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setError(true)}
        onHttpError={(e) => e.nativeEvent.statusCode >= 500 && setError(true)}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsBackForwardNavigationGestures
      />
      {loading && !error && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      )}
      {error && (
        <View style={[styles.overlay, styles.errorBg]}>
          <Text style={styles.title}>Không thể tải trang</Text>
          <Text style={styles.msg}>Kiểm tra Wi-Fi, địa chỉ {WEB_URL} và việc Vite đang chạy với --host.</Text>
          <Pressable style={styles.btn} onPress={retry}>
            <Text style={styles.btnText}>Thử lại</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 24 },
  errorBg: { backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  msg: { fontSize: 14, color: "#555", textAlign: "center", marginBottom: 16 },
  btn: { backgroundColor: "#0d9488", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: "#fff", fontWeight: "600" },
});
