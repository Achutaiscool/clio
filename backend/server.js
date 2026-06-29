const express=require('express')
const axios=require('axios')
const Groq=require('groq-sdk')
const cors=require('cors')
require('dotenv').config()
const PORT = process.env.PORT;

const groq=new Groq({
    apiKey:process.env.GROQ_API_KEY
})

const app=express().use(express.json())
app.use(cors())
app.post('/group-notes',async(req,res)=>{
    const{notes}=req.body
    try{
        const response=await groq.chat.completions.create({
            model:'llama-3.1-8b-instant',
            messages:[
            {
            role:'user',
            content:`You are a note grouping AI. Group the following notes into logical categories.
            Return ONLY a valid JSON array. No text before or after. Format: [{"groupName": "category name", "notes": [note objects]}]
            Notes to group: ${JSON.stringify(notes)}`
            } 
            ]
        })
        res.json(response.choices[0].message.content)
    }
    catch(error){
        res.status(500).json({error:error.message})
    }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
})