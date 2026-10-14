import { useEffect, useState } from "react";
import { Home } from "./screens/Home";
import { NewSet } from "./screens/NewSet";
import { SetDetail } from "./screens/SetDetail";
import { Quiz } from "./screens/Quiz";
import { WrongNotes } from "./screens/WrongNotes";
import { Settings } from "./screens/Settings";
import type { AnswerMode } from "./lib/types";

export type Route =
  | { name: "home" }
  | { name: "new" }
  | { name: "set"; setId: number }
  | { name: "quiz"; setId: number; mode: AnswerMode; questionIds: number[] }
  | { name: "wrong"; setId: number }
  | { name: "settings" };

export type Navigate = (r: Route) => void;

export function App() {
  const [stack, setStack] = useState<Route[]>([{ name: "home" }]);
  const route = stack[stack.length - 1];

  useEffect(() => {
    // 기기 저장 공간이 부족해도 자료가 지워지지 않도록 요청
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    // 휴대폰 뒤로 가기 버튼을 앱 안의 뒤로 가기로 쓴다
    const onPop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go: Navigate = (r) => {
    history.pushState(null, "");
    setStack((s) => [...s, r]);
  };
  const back = () => history.back();
  const home = () => {
    const depth = stack.length - 1;
    if (depth > 0) history.go(-depth);
  };

  switch (route.name) {
    case "home":
      return <Home go={go} />;
    case "new":
      return <NewSet back={back} replaceWithSet={(setId) => setStack((s) => [...s.slice(0, -1), { name: "set", setId }])} />;
    case "set":
      return <SetDetail setId={route.setId} go={go} back={back} />;
    case "quiz":
      return <Quiz key={route.questionIds.join(",")} {...route} back={back} home={home} go={go} />;
    case "wrong":
      return <WrongNotes setId={route.setId} go={go} back={back} />;
    case "settings":
      return <Settings back={back} />;
  }
}
