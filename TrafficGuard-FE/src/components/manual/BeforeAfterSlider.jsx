import React from "react";
import { FiImage, FiCpu } from "react-icons/fi";

const BeforeAfterSlider = ({ originalUrl, processedUrl }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
          Detection Result
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-gray-300 rounded-sm" /> Original
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-sm" /> AI Detected
          </span>
        </div>
      </div>

      {/* Two panels side by side */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Left — Original */}
        <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
          {/* Panel label */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white flex-shrink-0">
            <FiImage className="text-gray-400 text-sm" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Original
            </span>
          </div>
          {/* Image */}
          <div className="flex-1 flex items-center justify-center p-3 min-h-0">
            <img
              src={originalUrl}
              alt="Original"
              className="max-w-full max-h-full object-contain rounded-lg"
              draggable={false}
            />
          </div>
        </div>

        {/* Right — AI Detected */}
        <div className="flex flex-col rounded-2xl overflow-hidden border border-emerald-200 shadow-sm bg-emerald-50/30">
          {/* Panel label */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-emerald-200 bg-white flex-shrink-0">
            <FiCpu className="text-emerald-500 text-sm" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              AI Detected
            </span>
          </div>
          {/* Image */}
          <div className="flex-1 flex items-center justify-center p-3 min-h-0">
            <img
              src={processedUrl}
              alt="AI Detected"
              className="max-w-full max-h-full object-contain rounded-lg"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
