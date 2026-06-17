import React from "react";
import { FiShield, FiRefreshCw, FiAlertCircle } from "react-icons/fi";
import { useManualAnalysis } from "../../hooks/useManualAnalysis";
import DropZone from "./DropZone";
import ProcessingStatus from "./ProcessingStatus";
import BeforeAfterSlider from "./BeforeAfterSlider";
import VideoPlayer from "./VideoPlayer";
import ViolationLog from "./ViolationLog";
import DetectedCropsList from "./DetectedCropsList";

const ManualDashboard = () => {
  const {
    status,
    currentStep,
    completedSteps,
    processingSteps,
    file,
    fileType,
    originalUrl,
    processedUrl,
    imageDetections,
    videoUrl,
    violations,
    trackingData,
    error,
    videoRef,
    handleUpload,
    reset,
    seekToTimestamp,
  } = useManualAnalysis();

  const isIdle = status === "idle";
  const isProcessing = status === "processing";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <FiShield className="text-emerald-600 text-xl" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-emerald-700 leading-tight">
              Motorbike Detection
            </h1>
            <p className="text-xs text-gray-400">Manual Analysis Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDone && fileType === "video" && violations.length > 0 && (
            <span className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              <FiShield className="text-sm" />
              {violations.length} detection{violations.length !== 1 ? "s" : ""} found
            </span>
          )}
          {isDone && fileType === "video" && violations.length === 0 && (
            <span className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              <FiShield className="text-sm" />
              No violations detected
            </span>
          )}
          {(isDone || isError) && (
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all text-sm font-medium shadow-sm hover:shadow-md"
            >
              <FiRefreshCw className="text-sm" />
              Analyse New File
            </button>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden min-h-0 p-6">
        {/* Idle: drop zone */}
        {isIdle && (
          <div className="h-full flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <DropZone onFileSelect={handleUpload} />
            </div>
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div className="h-full flex items-center justify-center">
            <div className="w-full max-w-md bg-white rounded-2xl border border-emerald-100 shadow-lg">
              <ProcessingStatus
                steps={processingSteps}
                currentStep={currentStep}
                completedSteps={completedSteps}
                fileName={file?.name}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
                <FiAlertCircle className="text-red-500 text-2xl" />
              </div>
              <h2 className="text-gray-800 font-semibold mb-2">Processing Failed</h2>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Done — Image result */}
        {isDone && fileType === "image" && (
          <div className="h-full overflow-y-auto pr-2 pb-8">
            <BeforeAfterSlider originalUrl={originalUrl} processedUrl={processedUrl} />
            <DetectedCropsList originalUrl={originalUrl} detections={imageDetections} />
          </div>
        )}

        {/* Done — Video result */}
        {isDone && fileType === "video" && (
          <div className="h-full grid grid-cols-12 gap-5">
            <div className="col-span-8 h-full min-h-0">
              <VideoPlayer
                videoUrl={videoUrl}
                videoRef={videoRef}
                violations={violations}
                trackingData={trackingData}
              />
            </div>
            <div className="col-span-4 h-full min-h-0 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm overflow-hidden flex flex-col">
              <ViolationLog
                violations={violations}
                videoUrl={videoUrl}
                onSeek={seekToTimestamp}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualDashboard;
