const Team = () => {
  const teamMembers = [
    {
      name: "Ngô Nguyễn Lê Khanh",
      class: "Lớp: 23H50301",
      faculty: "Khoa Công nghệ Thông tin",
    },
    {
      name: "Khổng Đức Tuấn",
      class: "Lớp: 23H50301",
      faculty: "Khoa Công nghệ Thông tin",
    },
  ];

  return (
    <div className="h-screen w-full snap-start bg-white flex flex-col items-center justify-center gap-12 border-b border-gray-200 px-4">
      <h2 className="text-3xl md:text-5xl font-bold text-emerald-700">
        Our Team
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {teamMembers.map((member, idx) => (
          <div
            key={idx}
            className="bg-white border border-emerald-100 rounded-2xl shadow-md p-8 text-center hover:shadow-lg transition-all duration-300"
          >
            <h3 className="text-2xl font-bold text-emerald-700 mb-4">
              {member.name}
            </h3>

            <div className="space-y-2 text-gray-600">
              <p>{member.class}</p>
              <p>{member.faculty}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Team;