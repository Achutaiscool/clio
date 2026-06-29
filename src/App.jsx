import { useState } from "react"
import { useEffect } from "react"
import { useRef } from "react"
import axios from "axios"
export default function App(){
    const[text,setText]=useState()
    const[notesArray,setNotesArray]=useState([])
    const[count,setCount]=useState(1)
    const isFirstRender = useRef(true)
    useEffect(()=>{
        const result=localStorage.getItem('notes')
            console.log('Loading from localStorage:', result)

        if (result){
            setNotesArray(JSON.parse(result))
        }
    },[])
    useEffect(()=>{
        if (isFirstRender.current) {
        isFirstRender.current = false
        return
    }
        localStorage.setItem('notes',JSON.stringify(notesArray))
    },[notesArray]
    )
    console.log(localStorage.getItem('notes'))
    return(
        <>
        <textarea name="note" 
        value={text}
        onChange={(e)=>{setText(e.target.value)}}
        />

        <button onClick={async ()=>{
            const newNote = {
            id: count,
            note: text,
            time: new Date().toISOString()
        }
        const updatedNotes = [...notesArray, newNote]
        setNotesArray(updatedNotes)
        setCount(count+1)
        setText("")
        try {
            const response = await axios.post(
            'http://localhost:5000/group-notes',
            {
                notes: updatedNotes
            })
            const grouped = await response.data
            console.log('Grouped notes:', grouped)
        } 
        catch (error) {
            console.error('Grouping error:', error)
        }}}>save</button>

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
