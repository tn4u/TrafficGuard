import { FaCamera, FaCrosshairs, FaMapMarkedAlt } from "react-icons/fa";
const Features = () => {
  const features = [
    {
      icon: <FaCamera className="text-emerald-500 text-3xl mb-4" />,
      title: "Real-time AI Detection",
      desc: "Instantly identify commuters with or without helmets from live RTSP camera streams and uploaded media using high-accuracy deep learning models.",
    },
    {
      icon: <FaCrosshairs className="text-emerald-500 text-3xl mb-4" />,
      title: "Continuous Object Tracking",
      desc: "Leverage robust tracking algorithms and advanced post-processing to follow subjects across consecutive frames, minimizing false alarms and ensuring reliable evidence.",
    },
    {
      icon: <FaMapMarkedAlt className="text-emerald-500 text-3xl mb-4" />,
      title: "Interactive Geo-Monitoring",
      desc: "Seamlessly manage and monitor distributed traffic cameras through an intuitive map interface for comprehensive, location-based situational awareness.",
    },
  ];

  return (
    <div className="h-screen w-full snap-start bg-emerald-50 flex flex-col items-center justify-center gap-12 border-b border-gray-200 pb-24">
      <h2 className="text-3xl md:text-5xl sm:text-3xl font-bold text-emerald-700">
        Key Features
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
        {features.map((feature, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center text-center border border-emerald-100 hover:shadow-xl transition-shadow"
          >
            {feature.icon}
            <h3 className="text-xl md:text-2xl sm:text-xl font-semibold text-emerald-700 mb-2">
              {feature.title}
            </h3>
            <p className="text-gray-600 md:text-lg sm:text-base">
              {feature.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default Features;
