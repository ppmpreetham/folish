import type { ElementType, ReactNode } from "react";
import { CaretDown } from "phosphor-react";

interface DropdownProps {
  label: string;
  icon: ReactNode;
  isOpen: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
}

interface DropdownItemProps {
  label: string;
  icon: ElementType;
  active?: boolean;
  onClick: () => void;
}

export const DropdownItem = ({ label, icon: Icon, active = false, onClick }: DropdownItemProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
        active ? "bg-[#3a3a3a] text-white" : "text-[#a0a0a0] hover:bg-[#353535] hover:text-white"
      }`}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <Icon size={14} weight={active ? "fill" : "regular"} />
      </span>
      <span>{label}</span>
    </button>
  );
};

const Dropdown = ({ label, icon, isOpen, disabled = false, onToggle, children }: DropdownProps) => {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-1 text-xs text-[#a0a0a0] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {icon}
        <span>{label}</span>
        {!disabled && (
          <CaretDown size={10} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 z-10 mt-1.5 w-44 rounded-md border border-[#454545] bg-[#2a2a2a] p-1 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
};
export default Dropdown;
