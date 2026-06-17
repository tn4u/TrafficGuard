import React, { useEffect, useState, useRef } from "react";
import { FiShield, FiAlertTriangle, FiHelpCircle } from "react-icons/fi";

const RIDER_CROP_RATIO = 0.55;

const CropItem = ({ detection, originalImage, index }) => {
  const [dataUrl, setDataUrl] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!originalImage || !detection.bbox) return;

    const [x1, y1, x2, y2] = detection.bbox;
    const fullH = y2 - y1;
    // We display the upper portion of the bike which is where the helmet model looks
    const cropY2 = y1 + Math.round(fullH * RIDER_CROP_RATIO);
    const width = Math.max(1, x2 - x1);
    const height = Math.max(1, cropY2 - y1);

    const canvas = canvasRef.current;
    if (canvas) {
      // Draw at a slightly higher resolution for UI crispness without being blocky
      const scale = Math.max(1, 150 / Math.min(width, height));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(originalImage, x1, y1, width, height, 0, 0, canvas.width, canvas.height);
      setDataUrl(canvas.toDataURL("image/jpeg", 0.95));
    }
  }, [detection, originalImage]);

  const hasHelmet = detection.helmet_status === "helmet";
  const noHelmet = detection.helmet_status === "no_helmet";
  const isUnknown = !hasHelmet && !noHelmet;

  const borderColor = hasHelmet
    ? "border-emerald-300"
    : noHelmet
    ? "border-red-300"
    : "border-gray-200";

  const helmetConf = detection.helmet_confidence > 0
    ? `${(detection.helmet_confidence * 100).toFixed(0)}%`
    : null;

  return (
    <div className={`flex flex-col bg-white border-2 ${borderColor} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
      <div className="relative aspect-video bg-gray-50 flex items-center justify-center p-1">
        {dataUrl ? (
          <img src={dataUrl} alt={`Motorbike #${index + 1} rider crop`} className="max-w-full max-h-full object-contain rounded" />
        ) : (
          <div className="text-gray-300 text-xs animate-pulse">Cropping...</div>
        )}
        {/* Invisible canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
        {/* Index badge */}
        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-gray-800/70 flex items-center justify-center text-white text-[10px] font-bold">
          {index + 1}
        </div>
      </div>

      <div className="px-3 py-2.5 border-t border-gray-100 flex flex-col gap-1.5">
        <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">
          Motorbike · {(detection.confidence * 100).toFixed(0)}% conf
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasHelmet && (
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-md font-semibold">
              <FiShield className="text-[11px]" /> Helmet
            </span>
          )}
          {noHelmet && (
            <span className="flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-md font-semibold">
              <FiAlertTriangle className="text-[11px]" /> No Helmet
            </span>
          )}
          {isUnknown && (
            <span className="flex items-center gap-1 bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-md font-medium">
              <FiHelpCircle className="text-[11px]" /> Unknown
            </span>
          )}
          {helmetConf && !isUnknown && (
            <span className="text-gray-400 text-[11px] font-medium">{helmetConf}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const DetectedCropsList = ({ originalUrl, detections }) => {
  const [loadedImage, setLoadedImage] = useState(null);

  useEffect(() => {
    if (!originalUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous"; // Needed so canvas can draw from external sources without tainting
    img.onload = () => setLoadedImage(img);
    img.src = originalUrl;
  }, [originalUrl]);

  if (!detections || detections.length === 0) return null;

  // Filter only motorbikes (class 0)
  const motorbikes = detections.filter((d) => d.class_id === 0);
  if (motorbikes.length === 0) return null;

  const helmetCount = motorbikes.filter((d) => d.helmet_status === "helmet").length;
  const noHelmetCount = motorbikes.filter((d) => d.helmet_status === "no_helmet").length;
  const unknownCount = motorbikes.filter((d) => d.helmet_status === "unknown").length;

  return (
    <div className="mt-8 border-t border-gray-200 pt-8">
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-0.5">Detected Motorbikes</h3>
          <p className="text-sm text-gray-400">
            Cropped region used for helmet analysis · {motorbikes.length} detected
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {helmetCount > 0 && (
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
              <FiShield /> {helmetCount} Helmet
            </span>
          )}
          {noHelmetCount > 0 && (
            <span className="flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-semibold border border-red-200">
              <FiAlertTriangle /> {noHelmetCount} No Helmet
            </span>
          )}
          {unknownCount > 0 && (
            <span className="flex items-center gap-1 bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium border border-gray-200">
              <FiHelpCircle /> {unknownCount} Unknown
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {motorbikes.map((det, idx) => (
          <CropItem key={idx} detection={det} originalImage={loadedImage} index={idx} />
        ))}
      </div>
    </div>
  );
};

export default DetectedCropsList;
