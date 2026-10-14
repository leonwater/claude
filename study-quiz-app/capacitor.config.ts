import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.studyquiz.app",
  appName: "자료퀴즈",
  webDir: "dist",
  android: {
    // 업로드 파일 선택기·Claude API 호출 모두 앱 안의 WebView에서 처리한다
    allowMixedContent: false,
  },
};

export default config;
