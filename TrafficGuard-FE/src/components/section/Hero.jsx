import { Button } from "antd";

const Hero = () => {
  return (
    <section className="h-screen w-full flex snap-start">
      <div className="flex flex-col justify-center gap-4 px-24 w-1/2">
        <h1 className="text-4xl md:text-8xl sm:text-4xl font-bold text-emerald-600">
         TrafficGuard
        </h1>
        <p className="text-2xl md:text-3xl sm:text-base text-emerald-900 ">
          Real-time Helmet Violation Detection
        </p>
        <p className="text-lg md:text-2xl sm:text-sm text-gray-500">
          Our system automatically analyzes footage from surveillance cameras to accurately detect and track commuter behavior.
        </p>
        <div>
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
      <div className="flex items-center justify-center overflow-hidden w-1/2">
        <img
          src="/bg_landing_hero.png"
          alt="Navigation illustration"
          className="h-[80%] w-[80%] object-contain"
        />
      </div>
    </section>
  );
};
export default Hero;
