interface FolderItemProps {
  name: string;
  drawing: string;
}
const FolderItem = ({ name, drawing }: FolderItemProps) => {
  return (
    <div className="flex flex-row gap-2">
      <img src={drawing} />
      <div className="">{name}</div>
    </div>
  );
};

const FolderPreview = ({ items }: { items: FolderItemProps[] }) => {
  return (
    <div className="flex flex-col gap-2 *:items-center">
      {items.map((item) => (
        <FolderItem key={item.name} name={item.name} drawing={item.drawing} />
      ))}
    </div>
  );
};

export default FolderPreview;
