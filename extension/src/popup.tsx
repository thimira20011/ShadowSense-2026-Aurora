import React from "react";
import ReactDOM from "react-dom/client";
import { PopupPanel } from "./components/PopupPanel";
import { useSimulation } from "./hooks/useSimulation";
import "./styles/variables.css";
import "./styles/popup.css";

export const Popup: React.FC = () => {
  const { state } = useSimulation(22);

  return (
    <div className="popup-root">
      <PopupPanel state={state} />
    </div>
  );
};

export default Popup;

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}
