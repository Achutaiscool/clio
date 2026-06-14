import { useState } from "react"
export default function App(){
    const[text,setText]=useState()
    const[notesArray,setNotesArray]=useState([])
    const[delInput,setDel]=useState()
    const[count,setCount]=useState(1)

    return(
        <>
        <textarea name="note" 
        value={text}
        onChange={(e)=>{setText(e.target.value)
        }}
        />
        <button onClick={()=>{
             const newNote = {
                id: count,
                note: text,
                time: new Date().toISOString()
            }
            setNotesArray([...notesArray, newNote])
            setCount(count+1)
            setText("")
        }}>save</button>
        <br />
        <br />
        <ul>
        {
            notesArray.map((notes)=>{
                return <li key={notes.id}>{notes.note}
                    <button onClick={()=>{
                        setNotesArray(notesArray.filter((n)=>n.id!==notes.id))
                    }}>
                        delete
                    </button>
                </li>
            })
        }
        </ul>
        </>
    )
}
