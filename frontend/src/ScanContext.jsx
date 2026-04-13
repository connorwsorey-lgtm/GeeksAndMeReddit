import { createContext, useContext, useState, useCallback, useRef } from "react";

const ScanContext = createContext(null);

export function ScanProvider({ children }) {
  const [scanning, setScanning] = useState(null); // search id or null
  const [scanLogs, setScanLogs] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const sourceRef = useRef(null);

  const startScan = useCallback((searchId) => {
    // Close any existing scan
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    setScanning(searchId);
    setScanResult(null);
    setScanLogs([]);

    const evtSource = new EventSource(`/api/searches/${searchId}/scan-stream`);
    sourceRef.current = evtSource;

    evtSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data);
        const entry = { ...log, timestamp: new Date().toLocaleTimeString() };
        setScanLogs((prev) => [...prev, entry]);

        if (log.stage === "done") {
          setScanResult({ id: searchId, ...log.data });
          setScanning(null);
          sourceRef.current = null;
          evtSource.close();
        } else if (log.stage === "error") {
          // Don't stop on error — pipeline continues
        }
      } catch {}
    };

    evtSource.onerror = () => {
      setScanLogs((prev) => [
        ...prev,
        { stage: "error", message: "Connection to scan stream lost", timestamp: new Date().toLocaleTimeString() },
      ]);
      setScanning(null);
      sourceRef.current = null;
      evtSource.close();
    };
  }, []);

  const stopScan = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    setScanLogs((prev) => [
      ...prev,
      { stage: "stopped", message: "Scan stopped by user", timestamp: new Date().toLocaleTimeString() },
    ]);
    setScanning(null);
  }, []);

  const clearLogs = useCallback(() => {
    setScanLogs([]);
    setScanResult(null);
  }, []);

  return (
    <ScanContext.Provider
      value={{ scanning, scanLogs, scanResult, startScan, stopScan, clearLogs }}
    >
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  return useContext(ScanContext);
}
