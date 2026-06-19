import { Button } from "antd";

const Hero = () => {
  return (
    <section className="h-screen w-full flex snap-start relative">
      <div className="flex flex-col justify-center gap-4 px-8 md:px-24 w-full md:w-[60%] lg:w-1/2 z-10">
        <h1 className="text-5xl md:text-6xl lg:text-8xl font-bold text-emerald-600">
         TrafficGuard
        </h1>
        <p className="text-xl md:text-2xl lg:text-3xl text-emerald-900">
          Real-time Helmet Violation Detection
        </p>
        <p className="text-base md:text-lg lg:text-xl text-gray-500 max-w-xl">
          Our system automatically analyzes footage from surveillance cameras to accurately detect and track commuter behavior.
        </p>
        <div className="mt-4">
          <Button
            size="large"
            onClick={() => {
              window.location.href = "/playground";
            }}
          >
            Get started
          </Button>
        </div>
      </div>
      <div className="absolute right-0 top-0 h-full w-[60%] md:w-1/2 flex items-center justify-center z-0 opacity-30 md:opacity-100">
        <img
          src="/bg_landing_hero.png"
          alt="Navigation illustration"
          className="h-auto max-h-[80%] w-[90%] md:w-[80%] object-contain"
        />
      </div>
    </section>
  );
};
export default Hero;
