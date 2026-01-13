import { File, Clipboard, Camera, IconContext } from "phosphor-react"

const Import = () => {
  const BUTTONCLASS =
    "flex flex-row justify-between items-center hover:bg-settings-hover px-2 gap-4"
  return (
    <div className="flex flex-col bg-dark-bg text-dark-text h-fit rounded-lg text-sm">
      <IconContext.Provider
        value={{
          size: 36,
          className: "block w-fit p-2 rounded cursor-pointer",
        }}
      >
        <div className={BUTTONCLASS}>
          <div>Files</div>
          <File />
        </div>
        <div className={BUTTONCLASS}>
          <div>Paste from Clipboard</div>
          <Clipboard />
        </div>
        <div className={BUTTONCLASS}>
          <div>Take a Picture</div>
          <Camera />
        </div>
      </IconContext.Provider>
    </div>
  )
}

export default Import
