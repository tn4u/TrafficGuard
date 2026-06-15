import { Outlet } from "react-router-dom";
import Header from "../components/common/Header";

const AppLayout = () => {
  return (
    <div className="h-screen flex flex-col ">
      <Header />
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
