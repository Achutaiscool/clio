import { useState } from "react"
import { useEffect } from "react"
import { useRef } from "react"
import axios from "axios"
import Dock from "./components/Dock"

export default function App(){
    const[text,setText]=useState()
    const[notesArray,setNotesArray]=useState([])
    const[count,setCount]=useState(1)
    const[view,setView]=useState('list')
    const[group,setGroup]=useState()
    const isFirstRender = useRef(true)
    const textareaRef=useRef(null)

    const textAreaHeight=()=>{
            const el=textareaRef.current

            if(!el){
                return
            }
            el.style.height=`auto`

            el.style.height=`${el.scrollHeight}px`
    }

    useEffect(()=>{
        const result=localStorage.getItem('notes')

        if (result){
            setNotesArray(JSON.parse(result))
        }},[])

    useEffect(()=>{
        if (isFirstRender.current) {
        isFirstRender.current = false
        return
        }localStorage.setItem('notes',JSON.stringify(notesArray))},[notesArray]
        )

    useEffect(()=>{
        textAreaHeight()
    },[text])
        
    return(
        <>
        <div className= "bg-[#111111] min-h-screen text-white">
            <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 md:px-8 lg:px-12 py-12">    
                <textarea name="note" 
                ref={textareaRef}
                placeholder="hello"
                value={text}
                onChange={(e)=>{setText(e.target.value)}}
                className=" w-full min-h-[80vh] resize-none bg-transparent outline-none 
                border-none text-base sm:text-lg leading-8 overflow-y-auto"
                />
            </div>

            
            <div
                className="fixed inset-x-0 bottom-0 h-52 pointer-events-none z-40"
                style={{
                    backdropFilter: 'blur(3px)',
                    WebkitBackdropFilter: 'blur(3px)',
                    maskImage: 'linear-gradient(to top, black 0%, black 30%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to top, black 0%, black 30%, transparent 100%)',
                }}
            />

            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
                <Dock />
            </div>
            
            {/* <button onClick={async ()=>{
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
                setGroup(response.data)
                console.log('Grouped notes:', response.data) 
            } 
            catch (error) {
                console.error('Grouping error:', error)
            }}}>save</button>
            <button onClick={()=>{setView(view==='list'?'group':'list')}}>
                toggle view ({view==='list'?'group':'list'})
            </button>
            { view==='list'?(
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
                ):(
                    <div>
                        {group && group.map((group,idx)=>(
                            <div key={idx}>
                            <h3>{group.groupName}</h3>
                            <ul>
                                {group.notes.map((note)=>(
                                <li key={note.id}>{note.note}</li>
                            ))}
                            </ul>
                            </div>
                        ))}
                    </div>
                )
            } */}
       </div>
        </>
    )
}
