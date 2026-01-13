import { Stack, DotsNine, SquaresFour, IconContext } from "phosphor-react"

const MenuBar = () => {
  return (
    <div className="flex flex-row fixed top-0 left-0">
      <IconContext.Provider
        value={{
          size: 36,
          weight: "fill",
          className: "block w-fit p-2 rounded cursor-pointer",
        }}
      >
        <SquaresFour />
        <input placeholder="FileName" className="outline-none" />
        <Stack />
        <DotsNine />
      </IconContext.Provider>
    </div>
  )
}

export default MenuBar
