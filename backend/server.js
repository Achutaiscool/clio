import express from "express";
import Groq from "groq-sdk";
import cors from "cors";
import "dotenv/config";
import mongoose from"mongoose"
import Note from "./models/Note.js"
import Group from "./models/Group.js"
import User from "./models/User.js"
mongoose.connect(process.env.MONGO)
    .then(()=>console.log(`MongoDB connected`))
    .catch(err=>console.log('MongoDB connection error',err))

const PORT = process.env.PORT;

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const app = express().use(express.json());

app.use(cors());

app.post('/group-notes', async (req, res) => {
    const { notes } = req.body;

    try {
        const response = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
            {
                role: 'user',
                content: `You are a note grouping AI. Group the following notes into logical categories.
                Return ONLY a valid JSON array. No text before or after. Format: [{"groupName": "category name", "notes": [note objects]}]
                Notes to group: ${JSON.stringify(notes)}`
            }
            ]
        });

        const output = response.choices[0].message.content;
        const parsed = JSON.parse(output);

        res.json(parsed);

    } catch(error){
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/notes',async(req,res)=>{
    try{
        const{userId, text, time}=req.body
        if(!userId||!text){
            return res.status(400).json({error:'userId and text are required'})
        }
        const newNote=new Note({
            userId:userId,
            text:text,
            time:time || new Date()
        })
        await newNote.save()
        res.json({success:true,noteId:newNote._id})
    }
    catch(err){
        console.error('error saving note',err)
        res.status(500).json({error:err.message})
    }

})

app.get('/api/notes',async(req,res)=>{
    try{
        const{userId}=req.query
        console.log('Fetching notes for userId:', userId) 
        if(!userId){
            return res.status(400).json({error:'userId is reqiured'})
        }

        const notes= await Note.find({userId:userId}).sort({createdAt:-1})
        console.log('Found notes:', notes)
        res.json({success:true,notes:notes})
    }
    catch(err){
        console.log('Error fetching notes',error)
        res.status(500).json({err:err.message})
    }
})

app.post('/api/groups',async(req,res)=>{
    try{
        const{userId,groupName,noteIds}=req.body
        if(!userId||!groupName||!noteIds){
            return res.status(400).json({error:'userId,groupName,noteIds required'})
        }
        const newGroup=new Group({
            userId:userId,
            groupName:groupName,
            noteIds:noteIds
        })
        await newGroup.save()
        res.json({success:true,groupId:newGroup._id})
    }
    catch(err){
        res.status(500).json({error:err.message})
    }
})

app.get('/api/groups',async(req,res)=>{
    try{
        const{userId}=req.query

        if(!userId){
            res.status(400).json({error:'userId required'})
        }
        const groups=await Group.find({userId:userId}).sort({createdAt:-1})
        res.json({success:true,groups:groups})
    }
    catch(err){
        res.status(500).json({error:err.message})
    }
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});