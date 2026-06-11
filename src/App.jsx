import { useState } from "react"
export default function App(){
    const[text,setText]=useState()
    return(
        <>
        <textarea name="note" 
        value={text}
        onChange={(e)=>{setText(e.target.value)}}
        />
        <button>save</button>
        <p>{text}</p>
        </>
    )
}