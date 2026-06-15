import React, { useState, useCallback, useRef } from "react";
import { FiUploadCloud, FiImage, FiVideo, FiAlertCircle } from "react-icons/fi";

const ACCEPTED = { "image/jpeg": true, "image/png": true, "video/mp4": true };

const DropZone = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState(null);
  const inputRef = useRef(null);

  const validate = (file) => {
    if (!ACCEPTED[file.type]) return "Only JPG, PNG, and MP4 files are supported.";
    if (file.size > 512 * 1024 * 1024) return "File must be smaller than 512 MB.";
    return null;
  };

  const handleFile = useCallback(
    (file) => {
      const err = validate(file);
      if (err) { setDragError(err); return; }
      setDragError(null);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        relative flex flex-col items-center justify-center min-h-72 rounded-2xl
        border-2 border-dashed cursor-pointer transition-all duration-300 select-none p-10
        ${isDragging
          ? "border-emerald-400 bg-emerald-50 scale-[1.01] shadow-lg shadow-emerald-100"
          : "border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50/50"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.mp4"
        onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
        className="hidden"
        disabled={disabled}
      />

      {/* Upload icon */}
      <div className={`relative mb-6 transition-transform duration-300 ${isDragging ? "scale-110" : ""}`}>
        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors ${isDragging ? "bg-emerald-100" : "bg-white border-2 border-gray-200 shadow-sm"}`}>
          <FiUploadCloud className={`text-4xl transition-colors ${isDragging ? "text-emerald-500" : "text-gray-400"}`} />
        </div>
      </div>

      <h2 className={`text-xl font-bold mb-1.5 transition-colors ${isDragging ? "text-emerald-700" : "text-gray-700"}`}>
        {isDragging ? "Release to analyse" : "Drop your file here"}
      </h2>
      <p className="text-gray-400 text-sm mb-6">or click to browse from your computer</p>

      {/* Format pills */}
      <div className="flex items-center gap-3">
        {[
          { Icon: FiImage, label: "JPG / PNG", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { Icon: FiVideo, label: "MP4", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
        ].map(({ Icon, label, color, bg }) => (
          <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${bg}`}>
            <Icon className={`${color} text-sm`} />
            <span className="text-gray-600 font-medium">{label}</span>
          </div>
        ))}
      </div>

      {/* Error */}
      {dragError && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 px-4 py-2 rounded-xl whitespace-nowrap shadow-sm">
          <FiAlertCircle className="flex-shrink-0" />
          {dragError}
        </div>
      )}
    </div>
  );
};

export default DropZone;
