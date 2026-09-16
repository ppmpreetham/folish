import { useState } from "react";
import Dashboard from "./components/Dashboard/dash";
import { Editor } from "./components/Canvas/InfiniteCanvas";
import { useAutoSave } from "./hooks/useAutoSave";

function App() {
  const [openFile, setOpenFile] = useState<string | null>(null);
  useAutoSave(openFile);

  return openFile ? (
    <>
      <Editor onBack={() => setOpenFile(null)} />
      {/*<ColorPicker />
      <InfiniteCanvas />
      <MenuBar />
      <LayersNew />
      <Parameters />*/}
    </>
  ) : (
    <Dashboard onOpenDrawing={setOpenFile} />
  );
}

export default App;
