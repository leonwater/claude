import { Capacitor } from "@capacitor/core";

/** 안드로이드 앱(APK)으로 실행 중인지 */
export const isNative = Capacitor.isNativePlatform();

/**
 * 백업 파일 저장. 웹은 브라우저 다운로드, 앱은 공유 창(드라이브·카톡 나에게 보내기 등)으로 내보낸다.
 * WebView는 <a download>를 처리하지 못하기 때문이다.
 */
export async function saveTextFile(fileName: string, text: string): Promise<void> {
  if (!isNative) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const { uri } = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: fileName, files: [uri] });
}

/** 문제 생성 중 화면이 꺼지지 않게 한다. 해제 함수를 돌려준다 */
export async function keepScreenOn(): Promise<() => Promise<void>> {
  try {
    if (isNative) {
      const { KeepAwake } = await import("@capacitor-community/keep-awake");
      await KeepAwake.keepAwake();
      return () => KeepAwake.allowSleep().catch(() => {});
    }
    const lock = await navigator.wakeLock?.request("screen");
    return async () => {
      await lock?.release().catch(() => {});
    };
  } catch {
    return async () => {};
  }
}
