import { useState, useRef, useCallback } from "react";
import api from "../services/api";

export const PROCESSING_STEPS = [
  { id: "upload", label: "Uploading file...", duration: 700 },
  { id: "extract", label: "Extracting frames...", duration: 1400 },
  { id: "detect", label: "Running AI object detection...", duration: 2200 },
  { id: "postprocess", label: "Applying post-processing...", duration: 1100 },
  { id: "report", label: "Generating violation report...", duration: 800 },
];

// ----- Image: hit the backend /manual/image endpoint -----
async function processImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post("/manual/image", formData, {
    responseType: "blob",
    headers: { "Content-Type": "multipart/form-data" },
  });

  const processedUrl = URL.createObjectURL(res.data);
  const originalUrl = URL.createObjectURL(file);
  return { originalUrl, processedUrl };
}

// ----- Video: hit the backend /manual/video endpoint -----
async function processVideo(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post("/manual/video", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const videoUrl = URL.createObjectURL(file);
  // Backend returns: { violations: [{ timestamp, confidence, label, bbox }] }
  const violations = res.data.violations.map((v, idx) => ({ ...v, id: idx + 1 }));
  return { videoUrl, violations };
}

// ----------------------------------------------------------------
export function useManualAnalysis() {
  const [status, setStatus] = useState("idle"); // idle | processing | done | error
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState(null); // 'image' | 'video'
  const [originalUrl, setOriginalUrl] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [violations, setViolations] = useState([]);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const handleUpload = useCallback(async (uploadedFile) => {
    const isVideo = uploadedFile.type.startsWith("video/");
    setFile(uploadedFile);
    setFileType(isVideo ? "video" : "image");
    setStatus("processing");
    setCurrentStep(0);
    setCompletedSteps([]);
    setError(null);

    try {
      // Step 0: Uploading
      setCurrentStep(0);
      await new Promise((r) => setTimeout(r, 400));
      setCompletedSteps((prev) => [...prev, 0]);

      // Step 1: Extracting
      setCurrentStep(1);
      await new Promise((r) => setTimeout(r, 500));
      setCompletedSteps((prev) => [...prev, 1]);

      // Step 2: Running AI object detection (REAL API CALL)
      setCurrentStep(2);
      let result;
      if (isVideo) {
        result = await processVideo(uploadedFile);
      } else {
        result = await processImage(uploadedFile);
      }
      setCompletedSteps((prev) => [...prev, 2]);

      // Step 3: Post-processing
      setCurrentStep(3);
      await new Promise((r) => setTimeout(r, 400));
      setCompletedSteps((prev) => [...prev, 3]);

      // Step 4: Generating report
      setCurrentStep(4);
      await new Promise((r) => setTimeout(r, 400));
      setCompletedSteps((prev) => [...prev, 4]);

      // Done
      if (isVideo) {
        setVideoUrl(result.videoUrl);
        setViolations(result.violations);
      } else {
        setOriginalUrl(result.originalUrl);
        setProcessedUrl(result.processedUrl);
      }

      setStatus("done");
    } catch (err) {
      console.error(err);
      setError(err.message || "Processing failed");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    // Revoke old blob URLs to avoid memory leaks
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setStatus("idle");
    setFile(null);
    setFileType(null);
    setOriginalUrl(null);
    setProcessedUrl(null);
    setVideoUrl(null);
    setViolations([]);
    setError(null);
    setCurrentStep(-1);
    setCompletedSteps([]);
  }, [originalUrl, videoUrl]);

  const seekToTimestamp = useCallback((ts) => {
    if (videoRef.current) {
      videoRef.current.currentTime = ts;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return {
    status,
    currentStep,
    completedSteps,
    processingSteps: PROCESSING_STEPS,
    file,
    fileType,
    originalUrl,
    processedUrl,
    videoUrl,
    violations,
    error,
    videoRef,
    handleUpload,
    reset,
    seekToTimestamp,
  };
}
