export default function Dock() {
  return (
    <div className="flex items-center gap-4 rounded-full bg-[#222222] px-6 py-3 ">
      <button className="text-xl">Repository</button>
      <button className="text-xl">Insight</button>
      <button className="text-xl">Home</button>
      <button className="text-xl">Settings</button>
      <button className="text-xl">Save</button>
    </div>
  );
}