import { useState, useRef, useEffect } from "react";
import { Plus, CaretDown, Image, Pencil, FilePlus, Clipboard, Camera } from "phosphor-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import clsx from "clsx";
import type { Icon } from "phosphor-react";

const DropdownItem = ({
  icon: Icon,
  label,
  className,
  onClick,
}: {
  icon: Icon;
  label: string;
  className?: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={clsx(
      "flex items-center gap-2 p-3 hover:bg-[#111] rounded-xl text-left w-full text-sm font-medium cursor-pointer",
      className,
    )}
  >
    <Icon size={18} />
    {label}
  </button>
);

interface NewProps {
  onNewDrawing: () => void;
  onNewFolder: () => void;
}

const New = ({ onNewDrawing, onNewFolder }: NewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useGSAP(
    () => {
      if (isOpen && menuRef.current) {
        gsap.fromTo(
          menuRef.current,
          { opacity: 0, y: 15, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power2.out" },
        );
      }
    },
    { dependencies: [isOpen], scope: dropdownRef },
  );

  const handleAction = (callback?: () => void) => {
    if (!menuRef.current) {
      setIsOpen(false);
      callback?.();
      return;
    }

    gsap.to(menuRef.current, {
      opacity: 0,
      y: 10,
      scale: 0.95,
      duration: 0.15,
      ease: "power2.in",
      onComplete: () => {
        setIsOpen(false);
        callback?.();
      },
    });
  };

  return (
    <div ref={dropdownRef} className="fixed bottom-0 left-1/2 -translate-x-1/2 mb-6 z-50">
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 right-0 mb-2 bg-black text-white border border-[#222] rounded-2xl shadow-xl flex flex-col p-2 min-w-[180px] origin-bottom"
        >
          <DropdownItem icon={Pencil} label="New Drawing" onClick={() => handleAction(onNewDrawing)} />
          <DropdownItem icon={Image} label="New Folder" onClick={() => handleAction(onNewFolder)} />
          <DropdownItem
            icon={FilePlus}
            label="Import File"
            className="border-t border-[#222] rounded-t-none"
            onClick={() => handleAction()}
          />
          <DropdownItem icon={Clipboard} label="Paste" onClick={() => handleAction()} />
          <DropdownItem icon={Camera} label="Take a Picture" onClick={() => handleAction()} />
        </div>
      )}

      <button
        onClick={() => (isOpen ? handleAction() : setIsOpen(true))}
        className="flex flex-row items-center bg-black text-white rounded-full w-fit h-fit p-4 gap-2 hover:bg-[#111] cursor-pointer shadow-lg whitespace-nowrap"
      >
        <Plus size={24} />
        <span className="font-medium">New Drawing</span>
        <CaretDown
          size={24}
          className={clsx("transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>
    </div>
  );
};

export default New;
