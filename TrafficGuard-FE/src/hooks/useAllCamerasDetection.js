import { useState, useEffect } from "react";
import API_CONFIG from "../config/api.config";
import api from "../services/api";

const POLL_INTERVAL = 10000;

export const useAllCamerasDetection = () => {
  const [cameras, setCameras] = useState([]);
  const [detectionResults, setDetectionResults] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch camera list once on mount
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const res = await api.get(API_CONFIG.ENDPOINTS.CAMERAS.LIST);
        // Handle various API response shapes: plain array, { results }, { data }, { cameras }
        const raw = res.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.cameras)
          ? raw.cameras
          : [];
        setCameras(list);
      } catch (err) {
        console.error("Failed to load cameras:", err);
        setError("Failed to load cameras");
        setCameras([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCameras();
  }, []);

  // Poll detection stats for all active cameras
  useEffect(() => {
    if (cameras.length === 0) return;

    const poll = async () => {
      const results = {};
      await Promise.allSettled(
        cameras.map(async (cam) => {
          try {
            const res = await api.get(API_CONFIG.ENDPOINTS.TRAFFIC.DETECTION.STATS(cam.id));
            results[cam.id] = res.data;
          } catch {
            // skip failed cameras silently
          }
        })
      );
      if (Object.keys(results).length > 0) {
        setDetectionResults(results);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [cameras]);

  return { cameras, detectionResults, isLoading, error };
};
