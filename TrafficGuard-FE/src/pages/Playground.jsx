import React, { useState } from "react";
import { FiPlay, FiStopCircle, FiYoutube } from "react-icons/fi";
import { Spin } from "antd";

const Playground = () => {
  const PREDEFINED_CHANNELS = [
    { id: 1, name: "130 Quang Trung, Phường Hải Châu, thành phố Đà Nẵng", url: "https://www.youtube.com/watch?v=G_G8A6JU_LI" },
    { id: 2, name: "Cổng trường Nguyễn Huệ Đà Nẵng", url: "https://www.youtube.com/watch?v=sJvEFrG0wq0" },
    { id: 3, name: "Cổng Sau bệnh viện C Đà Nẵng", url: "https://www.youtube.com/watch?v=oif_zZFIfB4" },
    { id: 4, name: "Trường Lý Tự Trọng", url: "https://www.youtube.com/watch?v=NeJGBQAY-bE" },
  ];

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [streamUrl, setStreamUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleChannelChange = (e) => {
    const newUrl = e.target.value;
    setYoutubeUrl(newUrl);
    
    // Start stream immediately when selected
    setHasError(false);
    setIsLoading(true);
    const encodedUrl = encodeURIComponent(newUrl);
    setStreamUrl(`http://localhost:8000/api/v1/youtube/stream?url=${encodedUrl}`);
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-6xl mx-auto w-full gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FiYoutube className="text-red-500" />
          YouTube Livestream Analysis
        </h1>
        <p className="text-gray-500 text-sm">
          Select a live traffic camera below to run real-time motorbike and helmet detection.
        </p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiYoutube className="text-gray-400" />
            </div>
            <select
              className="block w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none bg-white cursor-pointer"
              value={youtubeUrl}
              onChange={handleChannelChange}
              required
            >
              <option value="" disabled>Select a live traffic camera...</option>
              {PREDEFINED_CHANNELS.map((channel) => (
                <option key={channel.id} value={channel.url}>
                  {channel.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-black rounded-2xl overflow-hidden border border-gray-200 shadow-md relative flex items-center justify-center min-h-[400px]">
        {!streamUrl ? (
          <div className="text-center text-gray-500 flex flex-col items-center gap-3">
            <FiYoutube className="text-5xl text-gray-700 opacity-50" />
            <p>Please select the channel to start the stream</p>
          </div>
        ) : (
          <>
            {isLoading && !hasError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10 text-white gap-4">
                <Spin size="large" />
                <p>Connecting to stream and initializing models...</p>
                <p className="text-sm text-gray-400 max-w-md text-center">This may take a few moments depending on the stream resolution.</p>
              </div>
            )}
            
            {hasError ? (
               <div className="text-center text-red-400 flex flex-col items-center gap-2 p-6">
                 <p className="font-semibold text-lg">Stream Connection Failed</p>
                 <p className="text-sm">Please ensure the URL is a valid, public YouTube stream.</p>
               </div>
            ) : (
              <img
                src={streamUrl}
                className="w-full h-full object-contain"
                alt="Live Analysis Stream"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setHasError(true);
                  setIsLoading(false);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Playground;
