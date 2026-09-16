interface FolderItemProps {
  name: string;
  drawing: string;
  onSelect?: () => void;
}
const FolderItem = ({ name, drawing, onSelect }: FolderItemProps) => {
  return (
    <div
      className="flex flex-row gap-2 items-center cursor-pointer hover:opacity-80"
      onClick={onSelect}
    >
      {drawing ? (
        <img src={drawing} alt={name} className="size-8 object-cover rounded" />
      ) : (
        <div className="size-8 bg-white/80 rounded" />
      )}
      <div className="">{name}</div>
    </div>
  );
};

const FolderPreview = ({ items }: { items: FolderItemProps[] }) => {
  return (
    <div className="flex flex-col gap-2 *:items-center min-w-48">
      {items.map((item) => (
        <FolderItem key={item.name} {...item} />
      ))}
    </div>
  );
};

export default FolderPreview;
