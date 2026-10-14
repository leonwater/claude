import { useEffect, useState } from "react";
import { Home } from "./screens/Home";
import { NewSet } from "./screens/NewSet";
import { SetDetail } from "./screens/SetDetail";
import { Quiz } from "./screens/Quiz";
import { WrongNotes } from "./screens/WrongNotes";
import { Settings } from "./screens/Settings";
import { ensureBuiltinBank } from "./lib/builtin";
import { activeSession } from "./lib/sessions";

export type Route =
  | { name: "home" }
  | { name: "new" }
  | { name: "set"; setId: number }
  | { name: "quiz"; sessionId: number }
  | { name: "wrong"; setId: number }
  | { name: "settings" };

export type Navigate = (r: Route) => void;

export function App() {
  const [stack, setStack] = useState<Route[]>([{ name: "home" }]);
  const [ready, setReady] = useState(false);
  const route = stack[stack.length - 1];

  useEffect(() => {
    // 내장 문제은행을 준비하고, 끝내지 않은 퀴즈가 있으면 바로 이어서 연다
    (async () => {
      try {
        await ensureBuiltinBank();
        const active = await activeSession();
        history.replaceState({ depth: 0 }, "");
        if (active) {
          history.pushState({ depth: 1 }, "");
          setStack([{ name: "home" }, { name: "quiz", sessionId: active.id! }]);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    // 기기 저장 공간이 부족해도 자료가 지워지지 않도록 요청
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    // 휴대폰 뒤로 가기 버튼을 앱 안의 뒤로 가기로 쓴다
    // history.go(-n)은 popstate가 한 번만 오므로, 기록에 저장한 깊이로 화면 스택을 맞춘다
    const onPop = (e: PopStateEvent) => {
      const depth = typeof e.state?.depth === "number" ? e.state.depth : 0;
      setStack((s) => s.slice(0, Math.max(1, depth + 1)));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go: Navigate = (r) => {
    history.pushState({ depth: stack.length }, "");
    setStack((s) => [...s, r]);
  };
  const back = () => history.back();
  const home = () => {
    const depth = stack.length - 1;
    if (depth > 0) history.go(-depth);
  };

  if (!ready) return <div className="splash">자료퀴즈</div>;

  switch (route.name) {
    case "home":
      return <Home go={go} />;
    case "new":
      return <NewSet back={back} replaceWithSet={(setId) => setStack((s) => [...s.slice(0, -1), { name: "set", setId }])} />;
    case "set":
      return <SetDetail setId={route.setId} go={go} back={back} />;
    case "quiz":
      return <Quiz key={route.sessionId} sessionId={route.sessionId} back={back} home={home} go={go} />;
    case "wrong":
      return <WrongNotes setId={route.setId} go={go} back={back} />;
    case "settings":
      return <Settings back={back} />;
  }
}
