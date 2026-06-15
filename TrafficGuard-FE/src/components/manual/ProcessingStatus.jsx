import React from "react";
import {
  FiUploadCloud,
  FiFilm,
  FiCpu,
  FiZap,
  FiFileText,
  FiCheck,
} from "react-icons/fi";

const STEP_ICONS = [FiUploadCloud, FiFilm, FiCpu, FiZap, FiFileText];

const ProcessingStatus = ({ steps, currentStep, completedSteps, fileName }) => {
  return (
    <div className="flex flex-col items-center py-8 px-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="relative w-20 h-20 mx-auto mb-5">
          <span
            className="absolute inset-0 rounded-full bg-emerald-100 animate-ping"
            style={{ animationDuration: "1.8s" }}
          />
          <div className="relative w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center shadow-sm">
            <FiCpu
              className="text-3xl text-emerald-600"
              style={{ animation: "spin 3s linear infinite" }}
            />
          </div>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">AI Processing</h2>
        {fileName && (
          <p className="text-gray-400 text-sm truncate max-w-xs">
            <span className="text-emerald-600 font-medium">{fileName}</span>
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="w-full space-y-2.5">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[index] || FiCpu;
          const isDone = completedSteps.includes(index);
          const isActive = index === currentStep && !isDone;
          const isPending = !isDone && !isActive;

          return (
            <div
              key={step.id}
              className={`
                flex items-center gap-3.5 px-4 py-3 rounded-xl border transition-all duration-500
                ${isDone ? "bg-emerald-50 border-emerald-200" : ""}
                ${isActive ? "bg-white border-emerald-300 shadow-sm shadow-emerald-100" : ""}
                ${isPending ? "bg-gray-50 border-gray-200 opacity-50" : ""}
              `}
            >
              {/* Status icon */}
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${isDone ? "bg-emerald-100" : ""}
                  ${isActive ? "bg-emerald-50" : ""}
                  ${isPending ? "bg-gray-100" : ""}
                `}
              >
                {isDone ? (
                  <FiCheck className="text-emerald-600 text-base" />
                ) : (
                  <Icon
                    className={`text-sm ${isActive ? "text-emerald-500 animate-pulse" : "text-gray-400"}`}
                  />
                )}
              </div>

              {/* Label + progress bar */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm font-medium ${
                    isDone ? "text-emerald-700" : isActive ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
                {isActive && (
                  <div className="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{
                        animation: "manualProgress 1.4s ease-in-out infinite alternate",
                        width: "70%",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Badge */}
              {isDone && (
                <span className="text-xs text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0 font-medium">
                  Done
                </span>
              )}
              {isActive && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex-shrink-0">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Running
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes manualProgress {
          from { transform: translateX(-30%); }
          to   { transform: translateX(60%); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProcessingStatus;
