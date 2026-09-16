import clsx from "clsx";
import { Folder } from "phosphor-react";

interface DashboardFolderProps {
  name: string;
  previews: string[];
  createdAt?: Date;
}

const Panel = ({ src, className }: { src?: string; className?: string }) => (
  <div className={clsx("bg-white overflow-hidden flex items-center justify-center", className)}>
    {src ? (
      <img src={src} alt="" className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full bg-white" />
    )}
  </div>
);

const DashboardFolder = ({ name, previews, createdAt = new Date() }: DashboardFolderProps) => {
  const dateString = createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="w-64 flex flex-col group cursor-pointer select-none text-left">
      <div className="w-full h-48 bg-dash-bg rounded-xl grid grid-cols-2 gap-1 border border-transparent group-hover:border-gray-500 transition-all">
        <Panel src={previews[0]} className="h-full rounded-l-lg" />
        <div className="h-full grid grid-rows-2 gap-1">
          <Panel src={previews[1]} className="rounded-tr-lg" />
          <Panel src={previews[2]} className="rounded-br-lg" />
        </div>
      </div>

      <div className="mt-2 px-1 text-sm text-white">
        <div className="font-semibold leading-tight truncate">{name}</div>
        <div className="text-[#a0a0a0] text-xs flex items-center gap-1.5 mt-0.5">
          <span>{dateString}</span>
          <Folder size={16} weight="fill" />
        </div>
      </div>
    </div>
  );
};

export default DashboardFolder;
